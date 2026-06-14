const express = require("express");
const router = express.Router();
const { register, login, getMe } = require("../controllers/authController");
const { getMyBalances } = require("../controllers/balanceController");
const { getMySettlements } = require("../controllers/settlementController");
const { verifyToken } = require("../middleware/authMiddleware");

// Register a new user: POST /api/auth/register
router.post("/register", register);

// Login a user: POST /api/auth/login
router.post("/login", login);

// Get currently authenticated user details: GET /api/auth/me
router.get("/me", verifyToken, getMe);

// Get currently authenticated user's balances: GET /api/auth/me/balances
router.get("/me/balances", verifyToken, getMyBalances);

// Get currently authenticated user's settlements: GET /api/auth/me/settlements
router.get("/me/settlements", verifyToken, getMySettlements);

module.exports = router;
