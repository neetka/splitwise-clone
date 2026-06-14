const { round2 } = require("./splitCalculator");

/**
 * Aggregates expenses and splits into a netted peer-to-peer debt graph.
 * @param {Array} expenses Array of Prisma expense objects including their splits
 * @returns {Array} Flat list of peer debts { debtorId, creditorId, amount }
 */
function aggregateBalances(expenses) {
  // graph[debtorId][creditorId] = total amount owed
  const graph = {};

  // 1. Build raw edges from expenses
  for (const expense of expenses) {
    const payerId = expense.paidByUserId;
    if (!expense.splits) continue;

    for (const split of expense.splits) {
      if (split.userId === payerId) continue; // Ignore payer's self-split

      const debtorId = split.userId;
      const amount = Number(split.amount);

      if (!graph[debtorId]) graph[debtorId] = {};
      if (!graph[debtorId][payerId]) graph[debtorId][payerId] = 0;

      graph[debtorId][payerId] += amount;
    }
  }

  // 2. Peer-to-Peer Netting
  const nettedGraph = {};
  const processedPairs = new Set();

  for (const debtorId in graph) {
    for (const creditorId in graph[debtorId]) {
      // Sort IDs to create a unique consistent key for the pair
      const pairKey = [debtorId, creditorId].sort().join("-");
      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);

      const aOwesB = graph[debtorId]?.[creditorId] || 0;
      const bOwesA = graph[creditorId]?.[debtorId] || 0;

      const net = round2(aOwesB - bOwesA);
      
      if (net > 0) {
        if (!nettedGraph[debtorId]) nettedGraph[debtorId] = {};
        nettedGraph[debtorId][creditorId] = net;
      } else if (net < 0) {
        if (!nettedGraph[creditorId]) nettedGraph[creditorId] = {};
        nettedGraph[creditorId][debtorId] = Math.abs(net);
      }
    }
  }

  // 3. Convert to flat array output
  const peerBalances = [];
  for (const debtorId in nettedGraph) {
    for (const creditorId in nettedGraph[debtorId]) {
      peerBalances.push({
        debtorId,
        creditorId,
        amount: nettedGraph[debtorId][creditorId]
      });
    }
  }

  return peerBalances;
}

/**
 * Computes individual user summaries from peer balances for a group context.
 * @param {Array} peerBalances Flat array of netted peer debts
 * @returns {Array} Summaries grouped by userId
 */
function summarizeGroupBalances(peerBalances) {
  const summaries = {};

  for (const debt of peerBalances) {
    const { debtorId, creditorId, amount } = debt;

    if (!summaries[debtorId]) summaries[debtorId] = { userId: debtorId, totalOwed: 0, totalOwedToMe: 0 };
    if (!summaries[creditorId]) summaries[creditorId] = { userId: creditorId, totalOwed: 0, totalOwedToMe: 0 };

    summaries[debtorId].totalOwed = round2(summaries[debtorId].totalOwed + amount);
    summaries[creditorId].totalOwedToMe = round2(summaries[creditorId].totalOwedToMe + amount);
  }

  return Object.values(summaries);
}

module.exports = { aggregateBalances, summarizeGroupBalances };
