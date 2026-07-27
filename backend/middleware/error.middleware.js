/**
 * Centralised error handler.
 * Any route that calls next(err) lands here.
 */
function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${req.method} ${req.path} —`, err.message || err);

  // Ethers / blockchain errors
  if (err.code === "CALL_EXCEPTION" || err.reason) {
    return res.status(400).json({
      error:   "Smart contract error",
      reason:  err.reason || err.message,
    });
  }

  // Mongoose validation
  if (err.name === "ValidationError") {
    return res.status(400).json({ error: "Validation error", details: err.message });
  }

  // JWT
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({ error: "Invalid token" });
  }

  const status  = err.status || err.statusCode || 500;
  const message = err.message || "Internal server error";
  res.status(status).json({ error: message });
}

module.exports = { errorHandler };
