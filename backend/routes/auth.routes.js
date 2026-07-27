const express    = require("express");
const { ethers } = require("ethers");
const crypto     = require("crypto");
const Nonce      = require("../models/nonce.model");
const { generateJWT } = require("../middleware/auth.middleware");

const router = express.Router();

/**
 * GET /api/auth/nonce/:wallet
 * Returns a challenge nonce for the wallet to sign.
 */
router.get("/nonce/:wallet", async (req, res, next) => {
  try {
    const wallet = req.params.wallet.toLowerCase();
    const nonce  = crypto.randomBytes(16).toString("hex");

    await Nonce.findOneAndUpdate(
      { wallet },
      { wallet, nonce, expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
      { upsert: true, new: true }
    );

    res.json({
      nonce,
      message: `Sign this message to authenticate with DriveX.\n\nWallet: ${wallet}\nNonce: ${nonce}`,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/verify
 * Body: { wallet, signature }
 * Returns JWT if signature is valid.
 */
router.post("/verify", async (req, res, next) => {
  try {
    const { wallet, signature } = req.body;
    if (!wallet || !signature) {
      return res.status(400).json({ error: "wallet and signature required" });
    }

    const walletLower = wallet.toLowerCase();

    // Fetch stored nonce
    const nonceDoc = await Nonce.findOne({ wallet: walletLower });
    if (!nonceDoc) {
      return res.status(400).json({ error: "No nonce found. Request a new one." });
    }
    if (new Date() > nonceDoc.expiresAt) {
      await Nonce.deleteOne({ wallet: walletLower });
      return res.status(400).json({ error: "Nonce expired" });
    }

    const message = `Sign this message to authenticate with DriveX.\n\nWallet: ${walletLower}\nNonce: ${nonceDoc.nonce}`;

    // Recover signer
    const recovered = ethers.verifyMessage(message, signature).toLowerCase();
    if (recovered !== walletLower) {
      return res.status(401).json({ error: "Signature verification failed" });
    }

    // Invalidate nonce
    await Nonce.deleteOne({ wallet: walletLower });

    const token = generateJWT(walletLower);
    res.json({ token, wallet: walletLower });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
