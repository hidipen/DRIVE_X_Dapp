const express = require("express");
const { getContract } = require("../services/blockchain.service");
const { authenticateJWT } = require("../middleware/auth.middleware");

const router = express.Router();

/**
 * GET /api/rentals/:id
 */
router.get("/:id", authenticateJWT, async (req, res, next) => {
  try {
    const contract = getContract();
    const rental   = await contract.getRental(BigInt(req.params.id));
    if (!rental.exists) return res.status(404).json({ error: "Rental not found" });
    res.json(formatRental(rental));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/rentals/:id/status
 * Lightweight status check (no auth required for polling).
 */
router.get("/:id/status", async (req, res, next) => {
  try {
    const contract = getContract();
    const rental   = await contract.getRental(BigInt(req.params.id));
    if (!rental.exists) return res.status(404).json({ error: "Rental not found" });
    res.json({
      rentalId: req.params.id,
      status:   RENTAL_STATUS_MAP[Number(rental.status)],
    });
  } catch (err) {
    next(err);
  }
});

// ── Helpers ──────────────────────────────────────────────────────

const RENTAL_STATUS_MAP = {
  0: "NONE", 1: "REQUESTED", 2: "APPROVED", 3: "PICKUP_PENDING",
  4: "ACTIVE", 5: "RETURN_PENDING", 6: "COMPLETED",
  7: "CANCELLED", 8: "DISPUTED",
};

function formatFuelRecord(f) {
  return {
    ipfsHash:   f.ipfsHash,
    percentage: Number(f.percentage),
    timestamp:  Number(f.timestamp),
  };
}

function formatPickupWindow(p) {
  return {
    startTime:   Number(p.startTime),
    endTime:     Number(p.endTime),
    gracePeriod: Number(p.gracePeriod),
  };
}

function formatRental(r) {
  return {
    id:           String(r.id),
    carId:        String(r.carId),
    renter:       r.renter,
    owner:        r.owner,
    startTime:    Number(r.startTime),
    endTime:      Number(r.endTime),
    depositPaid:  r.depositPaid?.toString(),
    totalCost:    r.totalCost?.toString(),
    pickup:       formatPickupWindow(r.pickup),
    pickupFuel:   formatFuelRecord(r.pickupFuel),
    returnFuel:   formatFuelRecord(r.returnFuel),
    status:       RENTAL_STATUS_MAP[Number(r.status)],
    otpConfirmed: r.otpConfirmed,
    disputeReason:r.disputeReason,
    exists:       r.exists,
  };
}

module.exports = router;
