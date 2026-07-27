/**
 * Location service for nearby car discovery.
 * Coordinates are stored on-chain as integers (×1e6).
 * Distance calculation uses the Haversine formula.
 */

const EARTH_RADIUS_KM = 6371;

/**
 * Convert chain integer coordinates back to float.
 */
function chainCoordToFloat(chainVal) {
  return Number(chainVal) / 1e6;
}

/**
 * Convert float coordinates to chain integer format.
 */
function floatToChainCoord(val) {
  return Math.round(val * 1e6);
}

/**
 * Haversine distance between two lat/lng points. Returns km.
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat  = toRad(lat2 - lat1);
  const dLng  = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Filter + sort cars by distance from a given point.
 * @param {Array}  cars           Array of Car structs from chain
 * @param {number} userLat        User latitude
 * @param {number} userLng        User longitude
 * @param {number} maxDistanceKm  Maximum radius (default 50 km)
 */
function getNearbyCars(cars, userLat, userLng, maxDistanceKm = 50) {
  return cars
    .filter((car) => car.exists && car.status === 2n) // CarStatus.AVAILABLE = 2
    .map((car) => {
      const carLat = chainCoordToFloat(car.lat);
      const carLng = chainCoordToFloat(car.lng);
      const dist   = haversineDistance(userLat, userLng, carLat, carLng);
      return { ...car, distanceKm: parseFloat(dist.toFixed(2)) };
    })
    .filter((car) => car.distanceKm <= maxDistanceKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

module.exports = { getNearbyCars, haversineDistance, chainCoordToFloat, floatToChainCoord };
