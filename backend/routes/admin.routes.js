const express = require("express");
const { body, validationResult } = require("express-validator");
const {
  verifyUserOnChain,
  blockUserOnChain,
  resolveDisputeOnChain,
  getContract,
  rejectUserOnChain,
  verifyCarOnChain,
  rejectCarOnChain,
  getPendingUsersOnChain,
  getPendingCarsOnChain,
} = require("../services/blockchain.service");
const { authenticateJWT, adminOnly } = require("../middleware/auth.middleware");
const Notification = require("../models/notification.model");

const router = express.Router();

const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/";
const ROLE_MAP = { 1: "RENTER", 2: "OWNER", 3: "BOTH" };

function ipfsCid(uri = "") {
  return String(uri)
    .replace("ipfs://", "")
    .replace("https://gateway.pinata.cloud/ipfs/", "")
    .replace("https://ipfs.io/ipfs/", "");
}

function ipfsUrl(uri = "") {
  const cid = ipfsCid(uri);
  return cid ? `${IPFS_GATEWAY}${cid}` : "";
}

async function fetchIpfsJson(uri) {
  const url = ipfsUrl(uri);
  if (!url) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function fileRef(label, uri) {
  const cid = ipfsCid(uri);
  return cid ? { label, cid, url: ipfsUrl(cid) } : null;
}

function userDocs(metadata = {}) {
  metadata = metadata || {};
  return [
    fileRef("Driving Licence", metadata.licenseDoc),
    fileRef("Selfie Verification", metadata.selfieDoc),
  ].filter(Boolean);
}

function carDocs(metadata = {}) {
  metadata = metadata || {};
  return [
    fileRef("Registry Document", metadata.registryDoc),
    fileRef("Insurance Document", metadata.insuranceDoc),
    fileRef("Primary Photo", metadata.image),
  ].filter(Boolean);
}

// All admin routes require JWT + admin wallet
router.use(authenticateJWT, adminOnly);

/**
 * POST /api/admin/verify-user
 * Body: { wallet }
 */
router.post(
  "/verify-user",
  [body("wallet").isEthereumAddress()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      await verifyUserOnChain(req.body.wallet);
      
      await Notification.create({
        wallet: req.body.wallet,
        type: "USER_VERIFIED",
        title: "Account Verified",
        message: "Your account has been verified by the admin.",
      });

      res.json({ message: `User ${req.body.wallet} verified on-chain` });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/admin/block-user
 * Body: { wallet, reason }
 */
router.post(
  "/block-user",
  [body("wallet").isEthereumAddress(), body("reason").notEmpty()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      await blockUserOnChain(req.body.wallet, req.body.reason);
      
      await Notification.create({
        wallet: req.body.wallet,
        type: "USER_BLOCKED",
        title: "Account Blocked",
        message: `Your account has been blocked: ${req.body.reason}`,
      });

      res.json({ message: `User ${req.body.wallet} blocked` });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/admin/reject-user
 * Body: { wallet, reason }
 */
router.post(
  "/reject-user",
  [body("wallet").isEthereumAddress(), body("reason").notEmpty()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      await rejectUserOnChain(req.body.wallet, req.body.reason);
      
      await Notification.create({
        wallet: req.body.wallet,
        type: "USER_REJECTED",
        title: "Account Rejected",
        message: `Your document verification was rejected: ${req.body.reason}`,
      });

      res.json({ message: `User ${req.body.wallet} rejected` });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/admin/verify-car
 * Body: { carId, ownerWallet }
 */
router.post(
  "/verify-car",
  [body("carId").notEmpty(), body("ownerWallet").isEthereumAddress()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      await verifyCarOnChain(req.body.carId);
      
      await Notification.create({
        wallet: req.body.ownerWallet,
        type: "CAR_VERIFIED",
        title: "Car Verified",
        message: `Your car listing #${req.body.carId} has been verified and is now available.`,
      });

      res.json({ message: `Car ${req.body.carId} verified` });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/admin/reject-car
 * Body: { carId, ownerWallet, reason }
 */
router.post(
  "/reject-car",
  [body("carId").notEmpty(), body("ownerWallet").isEthereumAddress(), body("reason").notEmpty()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      await rejectCarOnChain(req.body.carId, req.body.reason);
      
      await Notification.create({
        wallet: req.body.ownerWallet,
        type: "CAR_REJECTED",
        title: "Car Verification Rejected",
        message: `Your car listing #${req.body.carId} was rejected: ${req.body.reason}`,
      });

      res.json({ message: `Car ${req.body.carId} rejected` });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/admin/resolve-dispute
 * Body: { rentalId, favouredParty, renterShare (0-100) }
 */
router.post(
  "/resolve-dispute",
  [
    body("rentalId").notEmpty(),
    body("favouredParty").isEthereumAddress(),
    body("renterShare").isInt({ min: 0, max: 100 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { rentalId, favouredParty, renterShare } = req.body;
      await resolveDisputeOnChain(rentalId, favouredParty, renterShare);
      res.json({ message: `Dispute for rental ${rentalId} resolved` });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/admin/pending-users
 */
router.get("/pending-users", async (req, res, next) => {
  try {
    const pending = await getPendingUsersOnChain();
    const users = await Promise.all(
      pending.map(async (u) => {
        const metadata = await fetchIpfsJson(u.metadataURI);

        return {
          wallet: u.wallet,
          licenseHash: u.licenseHash,
          metadataURI: u.metadataURI,
          metadataUrl: ipfsUrl(u.metadataURI),
          metadata,
          docs: userDocs(metadata),
          role: Number(u.role),
          roleLabel: ROLE_MAP[Number(u.role)] || "UNKNOWN",
        };
      })
    );

    res.json({
      users,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/pending-cars
 */
router.get("/pending-cars", async (req, res, next) => {
  try {
    const pending = await getPendingCarsOnChain();
    const cars = await Promise.all(
      pending.map(async (c) => {
        const metadata = await fetchIpfsJson(c.metadataURI);

        return {
          id: String(c.id),
          owner: c.owner,
          metadataURI: c.metadataURI,
          metadataUrl: ipfsUrl(c.metadataURI),
          metadata,
          docs: carDocs(metadata),
        };
      })
    );

    res.json({
      cars,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/stats
 * Quick on-chain stats for the admin dashboard.
 */
router.get("/stats", async (req, res, next) => {
  try {
    const contract     = getContract();
    const carCounter   = await contract.carCounter();
    const rentalCounter = await contract.rentalCounter();
    res.json({
      totalCars:    Number(carCounter),
      totalRentals: Number(rentalCounter),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
