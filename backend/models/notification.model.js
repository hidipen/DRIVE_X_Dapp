const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    wallet:   { type: String, required: true, lowercase: true, index: true },
    type:     {
      type: String,
      enum: [
        "RENTAL_REQUESTED", "RENTAL_APPROVED", "RENTAL_CANCELLED",
        "OTP_GENERATED", "PICKUP_CONFIRMED", "RETURN_INITIATED",
        "RENTAL_COMPLETED", "DISPUTE_FLAGGED", "DISPUTE_RESOLVED",
        "OWNER_NO_SHOW", "USER_VERIFIED", "USER_BLOCKED", "USER_REJECTED", 
        "REPUTATION_UPDATED", "CAR_VERIFIED", "CAR_REJECTED"
      ],
      required: true,
    },
    title:   { type: String, required: true },
    message: { type: String, required: true },
    rentalId:{ type: String },
    read:    { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
