const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/authMiddleware");
const {
  requireGroupMember,
  requireActiveGroupMember,
  requireGroupAdmin,
} = require("../middleware/groupMiddleware");

const {
  createGroup,
  getGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
  addMember,
  removeMember,
} = require("../controllers/groupController");

const { getGroupExpenses } = require("../controllers/expenseController");
const { getGroupBalances } = require("../controllers/balanceController");
const { getGroupSettlements } = require("../controllers/settlementController");
const { uploadCsv } = require("../controllers/importController");
const multer = require("multer");

const uploadDir = "./uploads";
const upload = multer({ dest: uploadDir });

// Apply authentication token verification to all group routes
router.use(verifyToken);

// Create a new group: POST /api/groups
router.post("/", createGroup);

// Get groups the authenticated user belongs to: GET /api/groups
router.get("/", getGroups);

// Get detailed information of a group: GET /api/groups/:id
router.get("/:id", requireGroupMember, getGroupById);

// Get all expenses for a group: GET /api/groups/:id/expenses
router.get("/:id/expenses", requireGroupMember, getGroupExpenses);

// Upload CSV for a group: POST /api/groups/:id/imports
router.post("/:id/imports", requireActiveGroupMember, upload.single("file"), uploadCsv);

// Get calculated balances for a group: GET /api/groups/:id/balances
router.get("/:id/balances", requireGroupMember, getGroupBalances);

// Get all settlements for a group: GET /api/groups/:id/settlements
router.get("/:id/settlements", requireGroupMember, getGroupSettlements);

// Update a group details: PUT /api/groups/:id
router.put("/:id", requireGroupAdmin, updateGroup);

// Delete a group: DELETE /api/groups/:id
router.delete("/:id", requireGroupAdmin, deleteGroup);

// Add a member to a group: POST /api/groups/:id/members
router.post("/:id/members", requireActiveGroupMember, addMember);

// Remove (soft-delete) a member from a group: DELETE /api/groups/:id/members/:memberId
router.delete("/:id/members/:memberId", requireGroupAdmin, removeMember);

module.exports = router;
