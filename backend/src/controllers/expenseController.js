const prisma = require("../config/prisma");
const { calculateSplits } = require("../utils/splitCalculator");

exports.createExpense = async (req, res, next) => {
  try {
    const { groupId, title, totalAmount, currency, paidByUserId, date, splitType, splits } = req.body;

    if (!groupId || !title || !totalAmount || !currency || !paidByUserId || !splitType || !splits || splits.length === 0) {
      return res.status(400).json({ error: "Missing required expense fields." });
    }

    const amountNum = Number(totalAmount);
    if (amountNum <= 0) {
      return res.status(400).json({ error: "Total amount must be greater than 0." });
    }

    // 1. Validate Group & PaidByUser
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return res.status(404).json({ error: "Group not found." });

    const payerMembership = await prisma.groupMembership.findFirst({
      where: { groupId, userId: paidByUserId, isActive: true }
    });
    if (!payerMembership) {
      return res.status(400).json({ error: "Payer must be an active member of the group." });
    }

    // 2. Validate all split users are active members
    const splitUserIds = splits.map(s => s.userId);
    const memberships = await prisma.groupMembership.findMany({
      where: { groupId, userId: { in: splitUserIds }, isActive: true }
    });
    if (memberships.length !== splitUserIds.length) {
      return res.status(400).json({ error: "All split users must be active members of the group." });
    }

    // 3. Calculate exact splits
    let calculatedSplits;
    try {
      calculatedSplits = calculateSplits(amountNum, splitType, splits, paidByUserId);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    // 4. Interactive Transaction
    const expense = await prisma.$transaction(async (tx) => {
      const newExp = await tx.expense.create({
        data: {
          groupId,
          title,
          totalAmount: amountNum,
          currency,
          paidByUserId,
          date: date ? new Date(date) : new Date(),
        }
      });

      const splitsToInsert = calculatedSplits.map(s => ({
        expenseId: newExp.id,
        userId: s.userId,
        amount: s.amount,
        splitType: s.splitType,
        splitValue: s.splitValue
      }));

      await tx.expenseSplit.createMany({ data: splitsToInsert });

      // Fetch the created expense with splits
      return await tx.expense.findUnique({
        where: { id: newExp.id },
        include: { splits: true, paidByUser: { select: { id: true, name: true, email: true } } }
      });
    });

    res.status(201).json({ message: "Expense created successfully.", data: expense });
  } catch (error) {
    next(error);
  }
};

exports.getGroupExpenses = async (req, res, next) => {
  try {
    const groupId = req.params.id;
    // Auth middleware already verified user is a member of this group
    const expenses = await prisma.expense.findMany({
      where: { groupId },
      include: {
        splits: true,
        paidByUser: { select: { id: true, name: true, email: true } }
      },
      orderBy: { date: 'desc' }
    });
    res.status(200).json({ data: expenses });
  } catch (error) {
    next(error);
  }
};

exports.getExpense = async (req, res, next) => {
  try {
    const expenseId = req.params.id;
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: {
        splits: true,
        paidByUser: { select: { id: true, name: true, email: true } },
        group: { select: { id: true, name: true } }
      }
    });

    if (!expense) return res.status(404).json({ error: "Expense not found." });

    // Verify user is in the group
    const membership = await prisma.groupMembership.findFirst({
      where: { groupId: expense.groupId, userId: req.user.id }
    });
    if (!membership) return res.status(403).json({ error: "Not authorized to view this expense." });

    res.status(200).json({ data: expense });
  } catch (error) {
    next(error);
  }
};

exports.updateExpense = async (req, res, next) => {
  try {
    const expenseId = req.params.id;
    const { title, totalAmount, currency, paidByUserId, date, splitType, splits } = req.body;

    const existingExpense = await prisma.expense.findUnique({ where: { id: expenseId } });
    if (!existingExpense) return res.status(404).json({ error: "Expense not found." });

    // Verify user is an active member of the group
    const requestorMembership = await prisma.groupMembership.findFirst({
      where: { groupId: existingExpense.groupId, userId: req.user.id, isActive: true }
    });
    if (!requestorMembership) return res.status(403).json({ error: "Only active members can update expenses." });

    // Update fields if provided, else keep existing
    const newTotal = totalAmount ? Number(totalAmount) : Number(existingExpense.totalAmount);
    if (newTotal <= 0) return res.status(400).json({ error: "Total amount must be greater than 0." });

    let calculatedSplits = null;
    if (splits && splitType) {
      // Validate active members
      const splitUserIds = splits.map(s => s.userId);
      const memberships = await prisma.groupMembership.findMany({
        where: { groupId: existingExpense.groupId, userId: { in: splitUserIds }, isActive: true }
      });
      if (memberships.length !== splitUserIds.length) {
        return res.status(400).json({ error: "All split users must be active members of the group." });
      }

      const newPayer = paidByUserId || existingExpense.paidByUserId;
      try {
        calculatedSplits = calculateSplits(newTotal, splitType, splits, newPayer);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    const updatedExpense = await prisma.$transaction(async (tx) => {
      const updExp = await tx.expense.update({
        where: { id: expenseId },
        data: {
          title: title || existingExpense.title,
          totalAmount: newTotal,
          currency: currency || existingExpense.currency,
          paidByUserId: paidByUserId || existingExpense.paidByUserId,
          date: date ? new Date(date) : existingExpense.date,
        }
      });

      if (calculatedSplits) {
        await tx.expenseSplit.deleteMany({ where: { expenseId } });
        const splitsToInsert = calculatedSplits.map(s => ({
          expenseId,
          userId: s.userId,
          amount: s.amount,
          splitType: s.splitType,
          splitValue: s.splitValue
        }));
        await tx.expenseSplit.createMany({ data: splitsToInsert });
      }

      return await tx.expense.findUnique({
        where: { id: expenseId },
        include: { splits: true, paidByUser: { select: { id: true, name: true, email: true } } }
      });
    });

    res.status(200).json({ message: "Expense updated successfully.", data: updatedExpense });
  } catch (error) {
    next(error);
  }
};

exports.deleteExpense = async (req, res, next) => {
  try {
    const expenseId = req.params.id;

    const existingExpense = await prisma.expense.findUnique({ where: { id: expenseId } });
    if (!existingExpense) return res.status(404).json({ error: "Expense not found." });

    // Verify user is an active member
    const requestorMembership = await prisma.groupMembership.findFirst({
      where: { groupId: existingExpense.groupId, userId: req.user.id, isActive: true }
    });
    if (!requestorMembership) return res.status(403).json({ error: "Only active members can delete expenses." });

    await prisma.expense.delete({ where: { id: expenseId } });
    // Cascade delete automatically handles expenseSplits
    res.status(200).json({ message: "Expense deleted successfully." });
  } catch (error) {
    next(error);
  }
};
