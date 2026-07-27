require("dotenv").config();
const express    = require("express");
const cors       = require("cors");
const helmet     = require("helmet");
const morgan     = require("morgan");
const mongoose   = require("mongoose");

const authRoutes   = require("./routes/auth.routes");
const userRoutes   = require("./routes/user.routes");
const carRoutes    = require("./routes/car.routes");
const rentalRoutes = require("./routes/rental.routes");
const otpRoutes    = require("./routes/otp.routes");
const ipfsRoutes   = require("./routes/ipfs.routes");
const adminRoutes  = require("./routes/admin.routes");

const { errorHandler }    = require("./middleware/error.middleware");
const { startCronJobs }   = require("./jobs/pickup.jobs");

const app = express();

// ── Security & Parsing ───────────────────────────
app.use(helmet());
app.use(cors({
  origin:      process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// ── Routes ───────────────────────────────────────
app.use("/api/auth",    authRoutes);
app.use("/api/users",   userRoutes);
app.use("/api/cars",    carRoutes);
app.use("/api/rentals", rentalRoutes);
app.use("/api/otp",     otpRoutes);
app.use("/api/ipfs",    ipfsRoutes);
app.use("/api/admin",   adminRoutes);

// ── Health ───────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok", ts: Date.now() }));

// ── Error Handler ────────────────────────────────
app.use(errorHandler);

// ── DB + Start ───────────────────────────────────
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(PORT, () => {
      console.log(`🚗 DriveX API running on http://localhost:${PORT}`);
      startCronJobs();
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

module.exports = app;
// Trigger nodemon reload with new env vars

