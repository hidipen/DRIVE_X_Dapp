const jwt    = require("jsonwebtoken");
const crypto = require("crypto");

/**
 * Middleware: verify JWT Bearer token.
 */
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { wallet, iat, exp }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token expired or invalid" });
  }
}

/**
 * Middleware: only allow requests from the admin wallet.
 */
function adminOnly(req, res, next) {
  const adminWallet = (process.env.ADMIN_WALLET || "").toLowerCase();
  if (!req.user || req.user.wallet.toLowerCase() !== adminWallet) {
    return res.status(403).json({ error: "Admin only" });
  }
  next();
}

/**
 * Generate a short-lived JWT for a wallet address.
 */
function generateJWT(wallet) {
  return jwt.sign(
    { wallet: wallet.toLowerCase() },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

module.exports = { authenticateJWT, adminOnly, generateJWT };
