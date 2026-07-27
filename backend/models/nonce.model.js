const mongoose = require("mongoose");

// Stores challenge nonces for wallet sign-in (Sign-In with Ethereum)
const nonceSchema = new mongoose.Schema(
  {
    wallet:    { type: String, required: true, lowercase: true, index: true },
    nonce:     { type: String, required: true },
    expiresAt: { type: Date,   required: true },
  },
  { timestamps: true }
);

nonceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 300 }); // 5 min TTL

module.exports = mongoose.model("Nonce", nonceSchema);
