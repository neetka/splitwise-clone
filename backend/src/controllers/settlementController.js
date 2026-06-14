const prisma = require("../config/prisma");
const { aggregateBalances } = require("../utils/balanceEngine");

exports.createSettlement = async (req, res, next) => {
  try {
    const { groupId, receiverId, amount, currency, date } = req.body;
    const payerId = req.user.userId;

    if (!groupId || !receiverId || !amount || !currency) {
      return res.status(400).json({ error: "Missing required settlement fields." });
    }

    if (payerId === receiverId) {
      return res.status(400).json({ error: "Payer and receiver cannot be the same user." });
    }

    const amountNum = Number(amount);
    if (amountNum <= 0) {
      return res.status(400).json({ error: "Settlement amount must be positive." });
    }

    // 1. Verify both users are members of the group
    const memberships = await prisma.groupMembership.findMany({
      where: { groupId, userId: { in: [payerId, receiverId] } }
    });
    
    if (memberships.length !== 2) {
      return res.status(400).json({ error: "Both users must belong to the group." });
    }

    // 2. Prevent over-settlement by running the dynamic balance engine
    const expenses = await prisma.expense.findMany({ where: { groupId }, include: { splits: true } });
    const settlements = await prisma.settlement.findMany({ where: { groupId } });
    
    const peerBalances = aggregateBalances(expenses, settlements);
    
    // Check the specific graph edge representing what the payer owes this receiver
    const exactDebt = peerBalances.find(p => p.debtorId === payerId && p.creditorId === receiverId);
    const owedAmount = exactDebt ? exactDebt.amount : 0;

    if (amountNum > owedAmount) {
      return res.status(400).json({ 
        error: `Cannot over-settle. You currently owe ${owedAmount} to this user.` 
      });
    }

    // 3. Create the settlement
    const settlement = await prisma.settlement.create({
      data: {
        groupId,
        payerId,
        receiverId,
        amount: amountNum,
        currency,
        date: date ? new Date(date) : new Date()
      },
      include: {
        payer: { select: { id: true, name: true, email: true } },
        receiver: { select: { id: true, name: true, email: true } }
      }
    });

    res.status(201).json({ message: "Settlement created successfully.", data: settlement });
  } catch (error) {
    next(error);
  }
};

exports.getGroupSettlements = async (req, res, next) => {
  try {
    const groupId = req.params.id;
    const settlements = await prisma.settlement.findMany({
      where: { groupId },
      include: {
        payer: { select: { id: true, name: true, email: true } },
        receiver: { select: { id: true, name: true, email: true } }
      },
      orderBy: { date: 'desc' }
    });

    res.status(200).json({ data: settlements });
  } catch (error) {
    next(error);
  }
};

exports.getMySettlements = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const settlements = await prisma.settlement.findMany({
      where: {
        OR: [
          { payerId: userId },
          { receiverId: userId }
        ]
      },
      include: {
        group: { select: { id: true, name: true } },
        payer: { select: { id: true, name: true, email: true } },
        receiver: { select: { id: true, name: true, email: true } }
      },
      orderBy: { date: 'desc' }
    });

    res.status(200).json({ data: settlements });
  } catch (error) {
    next(error);
  }
};
