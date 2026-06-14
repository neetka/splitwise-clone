// Helper to safely round to 2 decimal places
const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

/**
 * Calculates exact split amounts for an expense.
 * @param {Number} totalAmount The total expense amount
 * @param {String} splitType "EQUAL", "UNEQUAL", "PERCENTAGE", or "SHARE"
 * @param {Array} splitsInput The raw input splits [{ userId, amount, splitValue }]
 * @param {String} paidByUserId The ID of the user who paid
 * @returns {Array} Formatted array of splits ready for database insertion
 */
function calculateSplits(totalAmount, splitType, splitsInput, paidByUserId) {
  let calculatedSplits = [];
  let allocated = 0;

  if (splitType === "EQUAL") {
    const numUsers = splitsInput.length;
    if (numUsers === 0) throw new Error("At least one split member is required.");

    const baseShare = round2(totalAmount / numUsers);
    
    splitsInput.forEach(split => {
      calculatedSplits.push({
        userId: split.userId,
        amount: baseShare,
        splitType: "EQUAL",
        splitValue: null,
      });
      allocated += baseShare;
    });

  } else if (splitType === "UNEQUAL") {
    let sum = 0;
    splitsInput.forEach(split => {
      const amt = round2(Number(split.amount));
      if (amt < 0) throw new Error("Split amounts cannot be negative.");
      calculatedSplits.push({
        userId: split.userId,
        amount: amt,
        splitType: "UNEQUAL",
        splitValue: null,
      });
      sum += amt;
    });
    
    if (round2(sum) !== round2(totalAmount)) {
      throw new Error("Unequal splits must sum exactly to the total amount.");
    }
    allocated = sum;

  } else if (splitType === "PERCENTAGE") {
    let pctSum = 0;
    splitsInput.forEach(split => {
      const pct = Number(split.splitValue);
      if (pct < 0) throw new Error("Percentage values cannot be negative.");
      pctSum += pct;
      const amt = round2(totalAmount * (pct / 100));
      calculatedSplits.push({
        userId: split.userId,
        amount: amt,
        splitType: "PERCENTAGE",
        splitValue: pct,
      });
      allocated += amt;
    });
    
    if (round2(pctSum) !== 100.00) {
      throw new Error("Percentage splits must sum exactly to 100%.");
    }

  } else if (splitType === "SHARE") {
    let totalShares = 0;
    splitsInput.forEach(split => {
      const share = Number(split.splitValue);
      if (share < 0) throw new Error("Share values cannot be negative.");
      totalShares += share;
    });
    
    if (totalShares <= 0) {
      throw new Error("Total shares must be greater than 0.");
    }

    splitsInput.forEach(split => {
      const share = Number(split.splitValue);
      const amt = round2(totalAmount * (share / totalShares));
      calculatedSplits.push({
        userId: split.userId,
        amount: amt,
        splitType: "SHARE",
        splitValue: share,
      });
      allocated += amt;
    });
  } else {
    throw new Error("Invalid split type.");
  }

  // Adjust precision remainder for EQUAL, PERCENTAGE, and SHARE
  if (splitType !== "UNEQUAL") {
    let remainder = round2(totalAmount - allocated);
    if (remainder !== 0) {
      // Find payer in the split list to assign the remainder penny difference
      const payerSplit = calculatedSplits.find(s => s.userId === paidByUserId);
      if (payerSplit) {
        payerSplit.amount = round2(payerSplit.amount + remainder);
      } else {
        // Fallback: If payer isn't in the split list, add remainder to the first person
        calculatedSplits[0].amount = round2(calculatedSplits[0].amount + remainder);
      }
    }
  }

  return calculatedSplits;
}

module.exports = { calculateSplits, round2 };
