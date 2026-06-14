const express = require("express");
const { createExpense, getExpense, updateExpense, deleteExpense } = require("../controllers/expenseController");
const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

// Require valid JWT token for all expense routes
router.use(verifyToken);

router.post("/", createExpense);
router.get("/:id", getExpense);
router.put("/:id", updateExpense);
router.delete("/:id", deleteExpense);

module.exports = router;
