const express = require("express");
const { getContract, getAllCarsOnChain } = require("../services/blockchain.service");
const { getNearbyCars, chainCoordToFloat } = require("../services/location.service");
const { authenticateJWT } = require("../middleware/auth.middleware");

const router = express.Router();

/**
 * GET /api/cars
 * Query params: lat, lng, radius (km), page, limit
 * Returns nearby available cars sorted by distance.
 */
router.get("/", async (req, res, next) => {
  try {
    const { lat, lng, radius = 50 } = req.query;

    const allCars = await getAllCarsOnChain();

    if (lat && lng) {
      const nearby = getNearbyCars(
        allCars,
        parseFloat(lat),
        parseFloat(lng),
        parseFloat(radius)
      );
      return res.json({ cars: nearby.map(formatCar), total: nearby.length });
    }

    // No location filter — return all available cars
    const available = allCars
      .filter((c) => c.exists && c.status === 2n)
      .map(formatCar);

    res.json({ cars: available, total: available.length });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/cars/:id
 */
router.get("/:id", async (req, res, next) => {
  try {
    const contract = getContract();
    const car      = await contract.getCar(BigInt(req.params.id));
    if (!car.exists) return res.status(404).json({ error: "Car not found" });
    res.json(formatCar(car));
  } catch (err) {
    next(err);
  }
});

// ── Helpers ──────────────────────────────────────────────────────

const CAR_STATUS_MAP = { 0: "UNAVAILABLE", 1: "PENDING_VERIFICATION", 2: "AVAILABLE", 3: "RENTED", 4: "REJECTED" };

function formatCar(c) {
  return {
    id:              String(c.id),
    owner:           c.owner,
    metadataURI:     c.metadataURI,
    pricePerHour:    c.pricePerHour?.toString(),
    securityDeposit: c.securityDeposit?.toString(),
    lat:             chainCoordToFloat(c.lat),
    lng:             chainCoordToFloat(c.lng),
    status:          CAR_STATUS_MAP[Number(c.status)],
    distanceKm:      c.distanceKm,
    exists:          c.exists,
  };
}

module.exports = router;
