const prisma = require("../config/prisma");

// Allows any member (active or inactive) to access group data (read-only operations)
const requireGroupMember = async (req, res, next) => {
  try {
    const groupId = req.params.groupId || req.params.id;
    const userId = req.user.userId;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: "Group ID is missing in request parameters.",
        code: "GROUP_ID_REQUIRED",
      });
    }

    const membership = await prisma.groupMembership.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You are not a member of this group.",
        code: "FORBIDDEN",
      });
    }

    // Attach membership to request for downstream handlers
    req.membership = membership;
    next();
  } catch (error) {
    console.error("requireGroupMember Middleware Error:", error);
    return res.status(500).json({
      success: false,
      message: "An internal server error occurred during authorization.",
      code: "INTERNAL_SERVER_ERROR",
    });
  }
};

// Requires active membership status to perform action
const requireActiveGroupMember = async (req, res, next) => {
  try {
    const groupId = req.params.groupId || req.params.id;
    const userId = req.user.userId;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: "Group ID is missing in request parameters.",
        code: "GROUP_ID_REQUIRED",
      });
    }

    const membership = await prisma.groupMembership.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    if (!membership || !membership.isActive) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Active group membership is required.",
        code: "FORBIDDEN",
      });
    }

    req.membership = membership;
    next();
  } catch (error) {
    console.error("requireActiveGroupMember Middleware Error:", error);
    return res.status(500).json({
      success: false,
      message: "An internal server error occurred during authorization.",
      code: "INTERNAL_SERVER_ERROR",
    });
  }
};

// Requires active membership AND admin privileges (isAdmin = true)
const requireGroupAdmin = async (req, res, next) => {
  try {
    const groupId = req.params.groupId || req.params.id;
    const userId = req.user.userId;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: "Group ID is missing in request parameters.",
        code: "GROUP_ID_REQUIRED",
      });
    }

    const membership = await prisma.groupMembership.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    if (!membership || !membership.isActive || !membership.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Active group administrator rights are required.",
        code: "FORBIDDEN",
      });
    }

    req.membership = membership;
    next();
  } catch (error) {
    console.error("requireGroupAdmin Middleware Error:", error);
    return res.status(500).json({
      success: false,
      message: "An internal server error occurred during authorization.",
      code: "INTERNAL_SERVER_ERROR",
    });
  }
};

module.exports = {
  requireGroupMember,
  requireActiveGroupMember,
  requireGroupAdmin,
};
