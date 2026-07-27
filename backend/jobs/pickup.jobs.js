const cron    = require("node-cron");
const { getContract, getAdminContract } = require("../services/blockchain.service");

/**
 * Periodic job: detect rentals whose pickup window has expired
 * but are still in PICKUP_PENDING state (owner no-show automation).
 *
 * Runs every 5 minutes.
 */
async function checkExpiredPickupWindows() {
  try {
    const contract      = getContract();
    const rentalCounter = await contract.rentalCounter();
    const now           = Math.floor(Date.now() / 1000);

    for (let i = 1; i <= Number(rentalCounter); i++) {
      const rental = await contract.getRental(i);
      if (Number(rental.status) !== 3) continue; // Only PICKUP_PENDING (3)

      const windowEnd   = Number(rental.pickup.endTime);
      const gracePeriod = Number(rental.pickup.gracePeriod);

      if (now > windowEnd + gracePeriod) {
        console.log(`[CRON] Pickup window expired for rental #${i} — owner no-show`);
        // The renter must call reportOwnerNoShow() themselves;
        // we log here for monitoring and can send a push notification.
        // Optionally: call the contract on behalf of the renter if they gave permission.
      }
    }
  } catch (err) {
    console.error("[CRON] checkExpiredPickupWindows error:", err.message);
  }
}

/**
 * Start all cron jobs.
 */
function startCronJobs() {
  // Every 5 minutes
  cron.schedule("*/5 * * * *", checkExpiredPickupWindows);
  console.log("⏰ Cron jobs started");
}

module.exports = { startCronJobs };
