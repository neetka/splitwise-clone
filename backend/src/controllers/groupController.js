const prisma = require("../config/prisma");

// Email regex helper
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Helper to construct a name from an email prefix
const getNameFromEmail = (email) => {
  const prefix = email.split("@")[0];
  // Capitalize words and replace common separators with spaces
  return prefix
    .split(/[._-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

// 1. Create Group: POST /api/groups
const createGroup = async (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.user.userId;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Group name is required.",
        code: "VALIDATION_ERROR",
      });
    }

    // Use a transaction to ensure both group creation and membership creation succeed together
    const result = await prisma.$transaction(async (tx) => {
      const group = await tx.group.create({
        data: {
          name: name.trim(),
        },
      });

      const membership = await tx.groupMembership.create({
        data: {
          groupId: group.id,
          userId: userId,
          isActive: true,
          isAdmin: true,
        },
      });

      return { group, membership };
    });

    return res.status(201).json({
      success: true,
      message: "Group created successfully.",
      data: {
        group: result.group,
        membership: {
          id: result.membership.id,
          userId: result.membership.userId,
          groupId: result.membership.groupId,
          isActive: result.membership.isActive,
          isAdmin: result.membership.isAdmin,
          joinedAt: result.membership.joinedAt,
        },
      },
    });
  } catch (error) {
    console.error("Create Group Error:", error);
    return res.status(500).json({
      success: false,
      message: "An internal server error occurred during group creation.",
      code: "INTERNAL_SERVER_ERROR",
    });
  }
};

// 2. Get User's Groups: GET /api/groups
const getGroups = async (req, res) => {
  try {
    const userId = req.user.userId;

    const memberships = await prisma.groupMembership.findMany({
      where: { userId },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: {
        joinedAt: "desc",
      },
    });

    const groups = memberships.map((membership) => ({
      id: membership.group.id,
      name: membership.group.name,
      createdAt: membership.group.createdAt,
      updatedAt: membership.group.updatedAt,
      membership: {
        isActive: membership.isActive,
        isAdmin: membership.isAdmin,
        joinedAt: membership.joinedAt,
        leftAt: membership.leftAt,
      },
    }));

    return res.status(200).json({
      success: true,
      data: {
        groups,
      },
    });
  } catch (error) {
    console.error("Get Groups Error:", error);
    return res.status(500).json({
      success: false,
      message: "An internal server error occurred while retrieving groups.",
      code: "INTERNAL_SERVER_ERROR",
    });
  }
};

// 3. Get Group Details: GET /api/groups/:id
const getGroupById = async (req, res) => {
  try {
    const groupId = req.params.id;

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found.",
        code: "GROUP_NOT_FOUND",
      });
    }

    const members = group.memberships.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      isActive: m.isActive,
      isAdmin: m.isAdmin,
      joinedAt: m.joinedAt,
      leftAt: m.leftAt,
    }));

    return res.status(200).json({
      success: true,
      data: {
        group: {
          id: group.id,
          name: group.name,
          createdAt: group.createdAt,
          updatedAt: group.updatedAt,
          members,
        },
      },
    });
  } catch (error) {
    console.error("Get Group Detail Error:", error);
    return res.status(500).json({
      success: false,
      message: "An internal server error occurred while retrieving group details.",
      code: "INTERNAL_SERVER_ERROR",
    });
  }
};

// 4. Update Group: PUT /api/groups/:id
const updateGroup = async (req, res) => {
  try {
    const groupId = req.params.id;
    const { name } = req.body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Group name is required.",
        code: "VALIDATION_ERROR",
      });
    }

    const updatedGroup = await prisma.group.update({
      where: { id: groupId },
      data: {
        name: name.trim(),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Group updated successfully.",
      data: {
        group: updatedGroup,
      },
    });
  } catch (error) {
    console.error("Update Group Error:", error);
    return res.status(500).json({
      success: false,
      message: "An internal server error occurred during group update.",
      code: "INTERNAL_SERVER_ERROR",
    });
  }
};

// 5. Delete Group: DELETE /api/groups/:id
const deleteGroup = async (req, res) => {
  try {
    const groupId = req.params.id;

    await prisma.group.delete({
      where: { id: groupId },
    });

    return res.status(200).json({
      success: true,
      message: "Group deleted successfully.",
    });
  } catch (error) {
    console.error("Delete Group Error:", error);
    return res.status(500).json({
      success: false,
      message: "An internal server error occurred during group deletion.",
      code: "INTERNAL_SERVER_ERROR",
    });
  }
};

// 6. Add Member: POST /api/groups/:id/members
const addMember = async (req, res) => {
  try {
    const groupId = req.params.id;
    const { email } = req.body;

    if (!email || typeof email !== "string" || !emailRegex.test(email.trim().toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "A valid email address is required.",
        code: "VALIDATION_ERROR",
      });
    }

    const targetEmail = email.trim().toLowerCase();

    // 1. Find or create the user as a stub/placeholder
    let user = await prisma.user.findUnique({
      where: { email: targetEmail },
    });

    if (!user) {
      // Create a stub account for the user, which they can claim later
      const name = getNameFromEmail(targetEmail);
      user = await prisma.user.create({
        data: {
          name,
          email: targetEmail,
          passwordHash: "", // Stub password
        },
      });
    }

    // 2. Check if membership already exists
    const existingMembership = await prisma.groupMembership.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: user.id,
        },
      },
    });

    let membership;
    if (existingMembership) {
      if (existingMembership.isActive) {
        return res.status(400).json({
          success: false,
          message: "User is already an active member of this group.",
          code: "ALREADY_MEMBER",
        });
      } else {
        // User was soft-removed, reactivate them
        membership = await prisma.groupMembership.update({
          where: { id: existingMembership.id },
          data: {
            isActive: true,
            leftAt: null,
            joinedAt: new Date(), // Reset join date to now
          },
        });
      }
    } else {
      // Create new membership record
      membership = await prisma.groupMembership.create({
        data: {
          groupId,
          userId: user.id,
          isActive: true,
          isAdmin: false,
        },
      });
    }

    return res.status(existingMembership ? 200 : 201).json({
      success: true,
      message: existingMembership ? "Member reactivated successfully." : "Member added successfully.",
      data: {
        membership: {
          id: membership.id,
          userId: membership.userId,
          groupId: membership.groupId,
          isActive: membership.isActive,
          isAdmin: membership.isAdmin,
          joinedAt: membership.joinedAt,
          leftAt: membership.leftAt,
        },
      },
    });
  } catch (error) {
    console.error("Add Member Error:", error);
    return res.status(500).json({
      success: false,
      message: "An internal server error occurred while adding group member.",
      code: "INTERNAL_SERVER_ERROR",
    });
  }
};

// 7. Remove Member: DELETE /api/groups/:id/members/:memberId
const removeMember = async (req, res) => {
  try {
    const groupId = req.params.id;
    const memberId = req.params.memberId;

    // Check if membership exists and is active
    const membership = await prisma.groupMembership.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: memberId,
        },
      },
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: "Group membership record not found.",
        code: "MEMBERSHIP_NOT_FOUND",
      });
    }

    if (!membership.isActive) {
      return res.status(400).json({
        success: false,
        message: "User is already inactive/removed from this group.",
        code: "ALREADY_INACTIVE",
      });
    }

    // Soft-remove the member
    const updatedMembership = await prisma.groupMembership.update({
      where: { id: membership.id },
      data: {
        isActive: false,
        leftAt: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Member removed from group successfully.",
      data: {
        membership: {
          id: updatedMembership.id,
          userId: updatedMembership.userId,
          groupId: updatedMembership.groupId,
          isActive: updatedMembership.isActive,
          isAdmin: updatedMembership.isAdmin,
          joinedAt: updatedMembership.joinedAt,
          leftAt: updatedMembership.leftAt,
        },
      },
    });
  } catch (error) {
    console.error("Remove Member Error:", error);
    return res.status(500).json({
      success: false,
      message: "An internal server error occurred while removing group member.",
      code: "INTERNAL_SERVER_ERROR",
    });
  }
};

module.exports = {
  createGroup,
  getGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
  addMember,
  removeMember,
};
