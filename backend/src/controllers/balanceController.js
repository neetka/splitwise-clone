const prisma = require("../config/prisma");
const { aggregateBalances, summarizeGroupBalances } = require("../utils/balanceEngine");

exports.getGroupBalances = async (req, res, next) => {
  try {
    const groupId = req.params.id;

    // 1. Fetch all expenses and their splits for this specific group
    const expenses = await prisma.expense.findMany({
      where: { groupId },
      include: { splits: true }
    });

    // Fetch all settlements for this group
    const settlements = await prisma.settlement.findMany({
      where: { groupId }
    });

    // 2. Aggregate the raw expenses and settlements into netted peer debts
    const peerBalances = aggregateBalances(expenses, settlements);
    
    // 3. Summarize the individual totals for the group
    const groupBalances = summarizeGroupBalances(peerBalances);

    res.status(200).json({
      data: {
        groupBalances,
        peerBalances
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getMyBalances = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // 1. Find all groups the user has ever been part of (active or inactive)
    const memberships = await prisma.groupMembership.findMany({
      where: { userId }
    });
    
    if (memberships.length === 0) {
      return res.status(200).json({
        data: { totalOwed: 0, totalOwedToMe: 0, peerBalances: [] }
      });
    }

    const groupIds = memberships.map(m => m.groupId);

    // 2. Fetch all expenses and settlements across all those groups
    const expenses = await prisma.expense.findMany({
      where: { groupId: { in: groupIds } },
      include: { splits: true }
    });

    const settlements = await prisma.settlement.findMany({
      where: { groupId: { in: groupIds } }
    });

    // 3. We calculate the peer-to-peer netting per group so users know *where* the debt originates
    let globalPeerBalances = [];
    let globalTotalOwed = 0;
    let globalTotalOwedToMe = 0;

    const expensesByGroup = {};
    for (const exp of expenses) {
      if (!expensesByGroup[exp.groupId]) expensesByGroup[exp.groupId] = [];
      expensesByGroup[exp.groupId].push(exp);
    }

    const settlementsByGroup = {};
    for (const stl of settlements) {
      if (!settlementsByGroup[stl.groupId]) settlementsByGroup[stl.groupId] = [];
      settlementsByGroup[stl.groupId].push(stl);
    }

    for (const groupId of groupIds) {
      const groupExps = expensesByGroup[groupId] || [];
      const groupStls = settlementsByGroup[groupId] || [];
      
      if (groupExps.length === 0 && groupStls.length === 0) continue;

      const peerBalances = aggregateBalances(groupExps, groupStls);
      
      // Filter out only the debts that involve the requesting user
      for (const debt of peerBalances) {
        if (debt.debtorId === userId || debt.creditorId === userId) {
          globalPeerBalances.push({ ...debt, groupId });
          
          if (debt.debtorId === userId) {
            globalTotalOwed += debt.amount;
          } else {
            globalTotalOwedToMe += debt.amount;
          }
        }
      }
    }

    res.status(200).json({
      data: {
        totalOwed: Number(globalTotalOwed.toFixed(2)),
        totalOwedToMe: Number(globalTotalOwedToMe.toFixed(2)),
        peerBalances: globalPeerBalances
      }
    });
  } catch (error) {
    next(error);
  }
};
