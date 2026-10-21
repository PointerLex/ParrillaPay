const express = require("express");
const multer = require("multer");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      const err = new Error("Only image uploads are allowed");
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

// Receipt image upload. The buffer will later be sent to the Claude API for scanning.
router.post("/", upload.single("receipt"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image provided (field: receipt)" });
  }
  res.status(201).json({
    filename: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
  });
});

module.exports = router;
