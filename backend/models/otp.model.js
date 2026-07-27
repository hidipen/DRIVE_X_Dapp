const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    rentalId:  { type: String, required: true, index: true },
    otp:       { type: String, required: true },
    otpHash:   { type: String, required: true },
    expiresAt: { type: Date,   required: true },
    used:      { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Auto-delete expired OTPs after 1 hour
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

module.exports = mongoose.model("OTP", otpSchema);
