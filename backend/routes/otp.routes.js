const express = require("express");
const { body, validationResult } = require("express-validator");
const { generateAndStoreOTP, verifyOTP } = require("../services/otp.service");
const { authenticateJWT } = require("../middleware/auth.middleware");
const { getContract }     = require("../services/blockchain.service");

const router = express.Router();

/**
 * POST /api/otp/generate
 * Body: { rentalId }
 * Called by owner when renter arrives. Admin relay stores hash on-chain.
 * Returns OTP to owner (owner shows/communicates to renter verbally or via app).
 */
router.post(
  "/generate",
  authenticateJWT,
  [body("rentalId").notEmpty().isString()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { rentalId } = req.body;

      // Verify caller is the owner of this rental
      const contract = getContract();
      const rental   = await contract.getRental(BigInt(rentalId));
      if (!rental.exists) return res.status(404).json({ error: "Rental not found" });
      if (rental.owner.toLowerCase() !== req.user.wallet.toLowerCase()) {
        return res.status(403).json({ error: "Only the owner can generate OTP" });
      }
      if (Number(rental.status) !== 2) { // APPROVED
        return res.status(400).json({ error: "Rental must be in APPROVED state" });
      }

      const { otp, expiresAt } = await generateAndStoreOTP(rentalId);

      res.json({
        otp:       String(otp),
        expiresAt: expiresAt.toISOString(),
        message:   "Share this OTP with the renter at pickup. Valid for 10 minutes.",
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/otp/verify
 * Body: { rentalId, otp }
 * Off-chain verification check (UI feedback). The real verification happens on-chain.
 */
router.post(
  "/verify",
  [body("rentalId").notEmpty(), body("otp").notEmpty()],
  async (req, res, next) => {
    try {
      const { rentalId, otp } = req.body;
      const result = await verifyOTP(rentalId, otp);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
