const express = require("express");
const router = express.Router();
const { register, login, getMe } = require("../controllers/authController");
const { verifyToken } = require("../middleware/authMiddleware");

// Register a new user: POST /api/auth/register
router.post("/register", register);

// Login a user: POST /api/auth/login
router.post("/login", login);

// Get currently authenticated user details: GET /api/auth/me
router.get("/me", verifyToken, getMe);

module.exports = router;
