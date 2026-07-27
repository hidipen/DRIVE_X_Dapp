const express = require("express");
const { getContract, getAllCarsOnChain } = require("../services/blockchain.service");
const { authenticateJWT } = require("../middleware/auth.middleware");

const router = express.Router();

/**
 * GET /api/users/:wallet
 * Returns on-chain user data.
 */
router.get("/:wallet", async (req, res, next) => {
  try {
    const contract = getContract();
    const user     = await contract.getUser(req.params.wallet);
    if (!user.exists) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(formatUser(user));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/users/:wallet/rentals
 * Returns all rental IDs for a user.
 */
router.get("/:wallet/rentals", authenticateJWT, async (req, res, next) => {
  try {
    const contract   = getContract();
    const rentalIds  = await contract.getRentalsByUser(req.params.wallet);
    res.json({ rentalIds: rentalIds.map(String) });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/users/:wallet/cars
 * Returns all cars listed by an owner, including pending/rejected cars.
 */
router.get("/:wallet/cars", authenticateJWT, async (req, res, next) => {
  try {
    const wallet = req.params.wallet.toLowerCase();
    const cars = await getAllCarsOnChain();

    res.json({
      cars: cars
        .filter((car) => car.exists && car.owner.toLowerCase() === wallet)
        .map(formatCar),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/users/:wallet/reputation
 */
router.get("/:wallet/reputation", async (req, res, next) => {
  try {
    const contract = getContract();
    const user     = await contract.getUser(req.params.wallet);
    res.json({
      wallet:         req.params.wallet,
      reputationScore: Number(user.reputationScore),
      noShowCount:     Number(user.noShowCount),
      status:          Number(user.status),
    });
  } catch (err) {
    next(err);
  }
});

// ── Helpers ──────────────────────────────────────────────────────

const ROLE_MAP   = { 0: "NONE", 1: "RENTER", 2: "OWNER", 3: "BOTH" };
const STATUS_MAP = { 0: "UNVERIFIED", 1: "VERIFIED", 2: "BLOCKED", 3: "REJECTED" };
const CAR_STATUS_MAP = { 0: "UNAVAILABLE", 1: "PENDING_VERIFICATION", 2: "AVAILABLE", 3: "RENTED", 4: "REJECTED" };

function formatUser(u) {
  return {
    wallet:         u.wallet,
    licenseHash:    u.licenseHash,
    metadataURI:    u.metadataURI,
    role:           ROLE_MAP[Number(u.role)],
    status:         STATUS_MAP[Number(u.status)],
    reputationScore: Number(u.reputationScore),
    noShowCount:    Number(u.noShowCount),
    exists:         u.exists,
  };
}

function formatCar(c) {
  return {
    id: String(c.id),
    owner: c.owner,
    metadataURI: c.metadataURI,
    pricePerHour: c.pricePerHour?.toString(),
    securityDeposit: c.securityDeposit?.toString(),
    status: CAR_STATUS_MAP[Number(c.status)],
    exists: c.exists,
  };
}

module.exports = router;
