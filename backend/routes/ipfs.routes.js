const express = require("express");
const multer  = require("multer");
const { uploadToIPFS, uploadJSONToIPFS } = require("../services/ipfs.service");
const { authenticateJWT } = require("../middleware/auth.middleware");

const router  = express.Router();
const upload  = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "application/pdf"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type "${file.mimetype}" not allowed. Accepted: JPEG, PNG, WebP, GIF, HEIC, PDF.`));
    }
  },
});

/**
 * POST /api/ipfs/upload
 * Multipart: file (image)
 * Returns { ipfsHash, url }
 */
router.post("/upload", authenticateJWT, (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      // Multer errors: file too large, invalid type, etc.
      const message = err instanceof multer.MulterError
        ? (err.code === "LIMIT_FILE_SIZE" ? "File too large (max 5 MB)" : err.message)
        : err.message;
      return res.status(400).json({ error: message });
    }
    next();
  });
}, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file provided" });

    const result = await uploadToIPFS(
      req.file.buffer,
      req.file.originalname,
      { uploadedBy: req.user.wallet }
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/ipfs/upload-json
 * Body: { data: {}, name: "car-metadata" }
 * Returns { ipfsHash, url }
 */
router.post("/upload-json", authenticateJWT, async (req, res, next) => {
  try {
    const { data, name } = req.body;
    if (!data) return res.status(400).json({ error: "data is required" });

    const result = await uploadJSONToIPFS(data, name || "metadata");
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
