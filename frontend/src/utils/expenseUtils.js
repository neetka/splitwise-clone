const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export const calculateExpensePreview = ({ totalAmount, splitType, splits, paidByUserId }) => {
  const normalizedAmount = Number(totalAmount);
  let calculated = [];
  let allocated = 0;

  if (!normalizedAmount || normalizedAmount <= 0) return { calculated: [], error: 'Enter a valid total amount.' };

  try {
    if (splitType === 'EQUAL') {
      const userCount = splits.length;
      if (userCount === 0) throw new Error('At least one member is required.');
      const baseShare = round2(normalizedAmount / userCount);
      calculated = splits.map(split => ({
        ...split,
        amount: baseShare,
      }));
      allocated = round2(baseShare * userCount);
    } else if (splitType === 'UNEQUAL') {
      let sum = 0;
      calculated = splits.map(split => {
        const amount = round2(split.amount || 0);
        if (amount < 0) throw new Error('Split amounts cannot be negative.');
        sum += amount;
        return { ...split, amount };
      });
      if (round2(sum) !== round2(normalizedAmount)) {
        throw new Error('Unequal splits must sum exactly to the total amount.');
      }
      allocated = sum;
    } else if (splitType === 'PERCENTAGE') {
      let sumPct = 0;
      calculated = splits.map(split => {
        const splitValue = Number(split.splitValue || 0);
        if (splitValue < 0) throw new Error('Percentage values cannot be negative.');
        sumPct = round2(sumPct + splitValue);
        const amount = round2(normalizedAmount * (splitValue / 100));
        return { ...split, amount };
      });
      if (round2(sumPct) !== 100) {
        throw new Error('Percentage splits must sum to 100%.');
      }
      allocated = calculated.reduce((acc, item) => acc + item.amount, 0);
    } else if (splitType === 'SHARE') {
      const totalShares = splits.reduce((acc, split) => acc + Number(split.splitValue || 0), 0);
      if (totalShares <= 0) throw new Error('Total shares must be greater than 0.');
      calculated = splits.map(split => {
        const share = Number(split.splitValue || 0);
        if (share < 0) throw new Error('Share values cannot be negative.');
        const amount = round2(normalizedAmount * (share / totalShares));
        return { ...split, amount };
      });
      allocated = calculated.reduce((acc, item) => acc + item.amount, 0);
    }

    if (splitType !== 'UNEQUAL') {
      const remainder = round2(normalizedAmount - allocated);
      if (remainder !== 0) {
        const payer = calculated.find(item => item.userId === paidByUserId) || calculated[0];
        payer.amount = round2(payer.amount + remainder);
      }
    }

    return { calculated, error: null };
  } catch (error) {
    return { calculated: [], error: error.message };
  }
};

export const buildPayloadFromForm = ({ title, description, totalAmount, splitType, currency, paidByUserId, groupId, date, splits }) => {
  const payload = {
    title,
    description,
    totalAmount: Number(totalAmount) || 0,
    splitType,
    currency,
    paidByUserId,
    groupId,
    date,
    splits: splits.map(split => ({
      userId: split.userId,
      amount: split.amount !== undefined ? Number(split.amount) : undefined,
      splitValue: split.splitValue !== undefined ? Number(split.splitValue) : undefined,
    })),
  };
  return payload;
};
