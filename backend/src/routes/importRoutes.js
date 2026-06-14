const express = require("express");
const multer = require("multer");
const fs = require("fs");
const { verifyToken } = require("../middleware/authMiddleware");
const { uploadCsv, getBatchReview, resolveAnomaly, commitBatch } = require("../controllers/importController");

const router = express.Router();

// Ensure uploads directory exists
const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const upload = multer({ dest: uploadDir });

router.use(verifyToken);

// This will be mounted under /api/imports, but we also mount an endpoint in groupRoutes
// To fetch a specific batch review:
router.get("/batches/:batchId/review", getBatchReview);

// Resolve an anomaly
router.post("/batches/:batchId/anomalies/:anomalyId/resolve", resolveAnomaly);

// Commit the final batch
router.post("/batches/:batchId/commit", commitBatch);

module.exports = router;
