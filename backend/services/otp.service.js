const crypto = require("crypto");
const OTP    = require("../models/otp.model");
const { hashOTP, storeOTPHashOnChain } = require("./blockchain.service");

const OTP_LENGTH      = parseInt(process.env.OTP_LENGTH       || "7");
const OTP_EXPIRY_MIN  = parseInt(process.env.OTP_EXPIRY_MINUTES || "10");

/**
 * Generate a cryptographically random N-digit OTP.
 */
function generateNumericOTP(length = OTP_LENGTH) {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  // Use crypto for secure random
  const range  = max - min + 1;
  const bytes  = crypto.randomBytes(4);
  const random = bytes.readUInt32BE(0);
  return min + (random % range);
}

/**
 * Generate OTP for a rental, store hash on-chain, persist in DB.
 */
async function generateAndStoreOTP(rentalId) {
  // Invalidate any existing OTP for this rental
  await OTP.findOneAndUpdate(
    { rentalId: String(rentalId), used: false },
    { used: true }
  );

  const otp       = generateNumericOTP();
  const otpHash   = hashOTP(otp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MIN * 60 * 1000);

  // Store hash on-chain (admin relay)
  await storeOTPHashOnChain(rentalId, otpHash);

  // Persist plaintext in DB (only backend ever sees this)
  await OTP.create({
    rentalId:  String(rentalId),
    otp:       String(otp),
    otpHash,
    expiresAt,
    used:      false,
  });

  return { otp, expiresAt };
}

/**
 * Verify an OTP submitted by the renter (for UI display feedback).
 * The actual on-chain verification is done in confirmPickup().
 */
async function verifyOTP(rentalId, submittedOTP) {
  const record = await OTP.findOne({
    rentalId: String(rentalId),
    used:     false,
  });

  if (!record) return { valid: false, reason: "No active OTP" };
  if (new Date() > record.expiresAt) return { valid: false, reason: "OTP expired" };
  if (record.otp !== String(submittedOTP)) return { valid: false, reason: "Invalid OTP" };

  return { valid: true };
}

/**
 * Mark OTP as used after successful pickup.
 */
async function markOTPUsed(rentalId) {
  await OTP.findOneAndUpdate(
    { rentalId: String(rentalId), used: false },
    { used: true }
  );
}

module.exports = { generateAndStoreOTP, verifyOTP, markOTPUsed };
