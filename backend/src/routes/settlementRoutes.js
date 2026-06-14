const express = require("express");
const { createSettlement } = require("../controllers/settlementController");
const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(verifyToken);
router.post("/", createSettlement);

module.exports = router;
