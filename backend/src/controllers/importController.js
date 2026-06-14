const prisma = require("../config/prisma");
const fs = require("fs");
const csv = require("csv-parser");
const { calculateSplits, round2 } = require("../utils/splitCalculator");

const VALID_CURRENCIES = ["USD", "INR", "EUR", "GBP"];
const DEFAULT_CURRENCY = "INR";
const SETTLEMENT_KEYWORDS = /\b(payment|settlement|settle|paid\s*back|repaid|reimbursed|refund)\b/i;

function getGroupDefaultCurrency(group) {
  return (group?.currency || DEFAULT_CURRENCY).toUpperCase();
}

/**
 * Parses a date string in DD-MM-YYYY format, falling back to fuzzy JS Date parsing.
 * Returns { date, valid } so we can flag DATE_FORMAT_ERROR when parsing fails.
 */
function parseDate(dateStr) {
  if (!dateStr || !dateStr.trim()) return { date: new Date(), valid: true };

  const trimmed = dateStr.trim();
  const parts = trimmed.split("-");
  if (parts.length === 3 && parts[2].length === 4) {
    // DD-MM-YYYY
    const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    if (!isNaN(d.getTime())) return { date: d, valid: true };
  }

  // Fuzzy fallback only for complete dates with year information.
  // This avoids accepting incomplete formats like "Mar-14".
  if (/\b\d{4}\b/.test(trimmed) || /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(trimmed)) {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return { date: d, valid: true };
  }

  return { date: null, valid: false };
}

/**
 * Case-insensitive + partial substring name matching against group memberships.
 * Returns { userId, exact, suggestedName } or null.
 */
function findUserMatch(name, memberships) {
  if (!name || !name.trim()) return null;
  const trimmedName = name.trim();
  const cleanName = trimmedName.toLowerCase();

  // 1. Exact case-sensitive match
  let match = memberships.find(m => m.user.name === trimmedName);
  if (match) return { userId: match.userId, exact: true, suggestedName: match.user.name };

  // 2. Case-insensitive exact match
  match = memberships.find(m => m.user.name.toLowerCase() === cleanName);
  if (match) return { userId: match.userId, exact: false, suggestedName: match.user.name };

  // 3. Email-based match (user might reference by email)
  match = memberships.find(m => m.user.email.toLowerCase() === cleanName);
  if (match) return { userId: match.userId, exact: false, suggestedName: match.user.name };

  // 4. Partial substring match (e.g., "Priya S" contains "Priya", or "priya" is contained in "Priya Sharma")
  match = memberships.find(m => {
    const memberName = m.user.name.toLowerCase();
    return memberName.includes(cleanName) || cleanName.includes(memberName);
  });
  if (match) return { userId: match.userId, exact: false, suggestedName: match.user.name };

  return null;
}

/**
 * Parse split_details string like "Aisha 30%; Rohan 30%; Priya 30%; Meera 20%"
 * or "Rohan 700; Priya 400; Meera 400" into structured entries.
 */
function parseSplitDetails(splitDetailsStr) {
  if (!splitDetailsStr || !splitDetailsStr.trim()) return [];
  const parts = splitDetailsStr.split(";").map(s => s.trim()).filter(s => s);
  return parts.map(part => {
    // Match patterns like "Name Value%" or "Name Value"
    const match = part.match(/^(.+?)\s+([\d.]+)(%?)$/);
    if (match) {
      return { name: match[1].trim(), value: parseFloat(match[2]), isPercent: match[3] === "%" };
    }
    // Fallback: just a number
    const numMatch = part.match(/([\d.]+)/);
    if (numMatch) {
      return { name: part.replace(numMatch[0], "").trim(), value: parseFloat(numMatch[0]), isPercent: false };
    }
    return null;
  }).filter(Boolean);
}

// ==================== UPLOAD CSV ====================
exports.uploadCsv = async (req, res, next) => {
  try {
    const groupId = req.params.id;
    const userId = req.user.userId;
    const file = req.file;

    if (!file) return res.status(400).json({ error: "No CSV file uploaded." });

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return res.status(404).json({ error: "Group not found." });

    const memberships = await prisma.groupMembership.findMany({
      where: { groupId },
      include: { user: true }
    });

    const existingExpenses = await prisma.expense.findMany({
      where: { groupId },
      include: { splits: true }
    });

    const defaultCurrency = getGroupDefaultCurrency(group);

    const batch = await prisma.importBatch.create({
      data: {
        groupId,
        uploadedByUserId: userId,
        filename: file.originalname,
        status: "PENDING",
        rawCsvData: [] // Will update after parsing
      }
    });

    const anomalies = [];
    const rows = [];
    let rowIndex = 1;

    fs.createReadStream(file.path)
      .pipe(csv())
      .on('data', (data) => {
        rows.push({ index: rowIndex, data });
        rowIndex++;
      })
      .on('end', async () => {
        try {
          for (const row of rows) {
            const { index, data } = row;
            const title = (data.description || "").trim();
            const paidBy = (data.paid_by || "").trim();
            let amountStr = (data.amount || "0").replace(/,/g, '');
            const amount = parseFloat(amountStr);
            const currency = (data.currency || "").trim().toUpperCase();
            const splitType = (data.split_type || "").trim().toLowerCase();
            const dateStr = (data.date || "").trim();
            const { date: parsedDate, valid: dateValid } = parseDate(dateStr);
            const splitWithNames = (data.split_with || "").split(";").map(s => s.trim()).filter(s => s);
            const notes = (data.notes || "").trim();

            // ---- 1. DATE FORMAT ERROR ----
            if (dateStr && !dateValid) {
              anomalies.push({
                batchId: batch.id, rowIndex: index, rawRowData: data,
                anomalyType: "DATE_FORMAT_ERROR", severity: "CRITICAL",
                description: `Cannot parse date '${dateStr}'. Expected DD-MM-YYYY format.`,
                resolutionAction: { action: "EDIT_DATE", suggestedResolution: "Provide a valid date in DD-MM-YYYY format." }
              });
            }

            // ---- 2. MISSING TITLE ----
            if (!title) {
              anomalies.push({
                batchId: batch.id, rowIndex: index, rawRowData: data,
                anomalyType: "MISSING_TITLE", severity: "CRITICAL",
                description: "Expense title/description is missing.",
                resolutionAction: { action: "EDIT_TITLE", suggestedResolution: "Provide a title for this expense." }
              });
            }

            // ---- 3. ZERO AMOUNT ----
            if (!isNaN(amount) && amount === 0) {
              anomalies.push({
                batchId: batch.id, rowIndex: index, rawRowData: data,
                anomalyType: "ZERO_AMOUNT", severity: "WARNING",
                description: "Amount is zero. This row may be a placeholder or correction entry.",
                resolutionAction: { action: "SKIP_ROW", suggestedResolution: "Skip this row, keep as correction, or edit the amount." }
              });
            }

            // ---- 4. NEGATIVE AMOUNT ----
            if (!isNaN(amount) && amount < 0) {
              anomalies.push({
                batchId: batch.id, rowIndex: index, rawRowData: data,
                anomalyType: "NEGATIVE_AMOUNT", severity: "WARNING",
                description: `Amount is negative (${amount}). May be a refund.`,
                resolutionAction: { action: "KEEP_AS_REFUND", suggestedResolution: "Import as a reverse-split refund, or skip this row." }
              });
            }

            // ---- 5. INVALID AMOUNT ----
            if (isNaN(amount)) {
              anomalies.push({
                batchId: batch.id, rowIndex: index, rawRowData: data,
                anomalyType: "INVALID_AMOUNT", severity: "CRITICAL",
                description: "Amount is missing or cannot be parsed as a number.",
                resolutionAction: { action: "EDIT_AMOUNT", suggestedResolution: "Provide a valid numeric amount." }
              });
            }

            // ---- 6. INVALID PRECISION ----
            if (!isNaN(amount) && amount !== 0) {
              const decimalParts = amountStr.split(".");
              if (decimalParts.length === 2 && decimalParts[1].length > 2) {
                const roundedAmount = round2(amount);
                anomalies.push({
                  batchId: batch.id, rowIndex: index, rawRowData: data,
                  anomalyType: "INVALID_PRECISION", severity: "WARNING",
                  description: `Amount ${amount} has more than 2 decimal places. Auto-rounding to ${roundedAmount}.`,
                  resolutionAction: { action: "AUTO_ROUND", roundedAmount, suggestedResolution: `Amount will be rounded to ${roundedAmount}.` }
                });
              }
            }

            // ---- 7. DUPLICATE EXPENSE DETECTION ----
            // Check against existing DB expenses (same date, similar title, same amount)
            const isDuplicate = existingExpenses.find(e => {
              const sameTitle = e.title.toLowerCase() === title.toLowerCase();
              const similarTitle = e.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes(title.toLowerCase().replace(/[^a-z0-9]/g, '')) ||
                title.toLowerCase().replace(/[^a-z0-9]/g, '').includes(e.title.toLowerCase().replace(/[^a-z0-9]/g, ''));
              const sameAmount = Math.abs(Number(e.totalAmount) - Math.abs(amount)) < 0.01;
              const sameDate = parsedDate && e.date.toDateString() === parsedDate.toDateString();
              return (sameTitle || similarTitle) && sameAmount && sameDate;
            });
            if (isDuplicate) {
              anomalies.push({
                batchId: batch.id, rowIndex: index, rawRowData: data,
                anomalyType: "POTENTIAL_DUPLICATE", severity: "WARNING",
                description: `Potential duplicate of existing expense '${isDuplicate.title}' (${Number(isDuplicate.totalAmount)} on ${isDuplicate.date.toDateString()}).`,
                resolutionAction: { action: "SKIP_ROW", duplicateExpenseId: isDuplicate.id, suggestedResolution: "Skip this row if it is a duplicate, or keep both." }
              });
            }

            // Also check within the CSV batch itself for internal duplicates
            const internalDup = rows.find(r =>
              r.index < index &&
              (r.data.description || "").trim().toLowerCase().replace(/[^a-z0-9]/g, '') === title.toLowerCase().replace(/[^a-z0-9]/g, '') &&
              Math.abs(parseFloat((r.data.amount || "0").replace(/,/g, '')) - Math.abs(amount)) < 0.01 &&
              (r.data.date || "").trim() === dateStr
            );
            if (internalDup && !isDuplicate) {
              anomalies.push({
                batchId: batch.id, rowIndex: index, rawRowData: data,
                anomalyType: "POTENTIAL_DUPLICATE", severity: "WARNING",
                description: `Potential duplicate of CSV row ${internalDup.index} ('${internalDup.data.description}').`,
                resolutionAction: { action: "SKIP_ROW", duplicateRowIndex: internalDup.index, suggestedResolution: "Skip this row if duplicate, or keep both." }
              });
            }

            // ---- 8. SETTLEMENT DISGUISED AS EXPENSE ----
            const looksLikeSettlement = SETTLEMENT_KEYWORDS.test(title) || SETTLEMENT_KEYWORDS.test(notes);
            const hasNoSplitType = !splitType || splitType === "";
            const hasSingleRecipient = splitWithNames.length === 1;
            if (looksLikeSettlement || (hasNoSplitType && hasSingleRecipient)) {
              if (looksLikeSettlement) {
                anomalies.push({
                  batchId: batch.id, rowIndex: index, rawRowData: data,
                  anomalyType: "SETTLEMENT_DETECTED", severity: "WARNING",
                  description: `This looks like a settlement/payment, not an expense. Description: '${title}'.`,
                  resolutionAction: { action: "CONVERT_TO_SETTLEMENT", suggestedResolution: "Convert to a Settlement record, or keep as an Expense." }
                });
              }
            }

            // ---- 9. MISSING CURRENCY ----
            if (!currency) {
              anomalies.push({
                batchId: batch.id, rowIndex: index, rawRowData: data,
                anomalyType: "MISSING_CURRENCY", severity: "WARNING",
                description: `Currency is missing. Defaulting to ${defaultCurrency}.`,
                resolutionAction: {
                  action: "SET_DEFAULT_CURRENCY",
                  currency: defaultCurrency,
                  defaultCurrency,
                  suggestedResolution: `Will default to ${defaultCurrency}. Change if needed.`
                }
              });
            }

            // ---- 10. UNSUPPORTED CURRENCY ----
            if (currency && !VALID_CURRENCIES.includes(currency)) {
              anomalies.push({
                batchId: batch.id, rowIndex: index, rawRowData: data,
                anomalyType: "UNSUPPORTED_CURRENCY", severity: "WARNING",
                description: `Currency '${currency}' is not supported. Supported: ${VALID_CURRENCIES.join(", ")}.`,
                resolutionAction: {
                  action: "SET_DEFAULT_CURRENCY",
                  currency: defaultCurrency,
                  defaultCurrency,
                  suggestedResolution: `Change to a supported currency (${VALID_CURRENCIES.join(", ")}).`
                }
              });
            }

            // ---- 11. MISSING PAYER ----
            if (!paidBy) {
              anomalies.push({
                batchId: batch.id, rowIndex: index, rawRowData: data,
                anomalyType: "MISSING_PAYER", severity: "CRITICAL",
                description: "Payer (paid_by) is missing. A payer must be assigned.",
                resolutionAction: {
                  action: "SELECT_PAYER",
                  suggestedResolution: "Select an active group member as the payer.",
                  availableMembers: memberships.filter(m => m.isActive).map(m => ({ userId: m.userId, name: m.user.name }))
                }
              });
            }

            // ---- 12. PAYER NAME MAPPING ----
            if (paidBy) {
              const payerMatch = findUserMatch(paidBy, memberships);
              if (!payerMatch) {
                anomalies.push({
                  batchId: batch.id, rowIndex: index, rawRowData: data,
                  anomalyType: "UNKNOWN_PAYER", severity: "CRITICAL",
                  description: `Payer '${paidBy}' is not a recognized group member.`,
                  resolutionAction: {
                    action: "CREATE_STUB_USER", name: paidBy,
                    suggestedResolution: `Create '${paidBy}' as a new user, or map to an existing member.`,
                    availableMembers: memberships.map(m => ({ userId: m.userId, name: m.user.name }))
                  }
                });
              } else if (!payerMatch.exact) {
                // Case-insensitive or alias match found - auto-resolve suggestion
                anomalies.push({
                  batchId: batch.id, rowIndex: index, rawRowData: data,
                  anomalyType: "USER_DISCREPANCY", severity: "WARNING",
                  description: `Payer '${paidBy}' is not an exact match. Did you mean '${payerMatch.suggestedName}'?`,
                  resolutionAction: {
                    action: "MAP_USER",
                    mappedUserId: payerMatch.userId,
                    originalName: paidBy,
                    suggestedName: payerMatch.suggestedName,
                    suggestedMapping: { from: paidBy, to: payerMatch.suggestedName },
                    suggestedResolution: `Auto-map '${paidBy}' → '${payerMatch.suggestedName}'.`
                  }
                });
              }
              // Check payer membership timeline
              if (payerMatch && parsedDate) {
                const payerMem = memberships.find(m => m.userId === payerMatch.userId);
                if (payerMem) {
                  if (payerMem.joinedAt > parsedDate) {
                    anomalies.push({
                      batchId: batch.id, rowIndex: index, rawRowData: data,
                      anomalyType: "TIMELINE_VIOLATION", severity: "CRITICAL",
                      description: `Payer '${paidBy}' joined the group on ${payerMem.joinedAt.toISOString().split('T')[0]}, but this expense is dated ${parsedDate.toISOString().split('T')[0]}.`,
                      resolutionAction: { action: "CHANGE_DATE_OR_EXCLUDE", suggestedResolution: "Change the expense date or select a different payer." }
                    });
                  }
                  if (payerMem.leftAt && payerMem.leftAt < parsedDate) {
                    anomalies.push({
                      batchId: batch.id, rowIndex: index, rawRowData: data,
                      anomalyType: "TIMELINE_VIOLATION", severity: "CRITICAL",
                      description: `Payer '${paidBy}' left the group on ${payerMem.leftAt.toISOString().split('T')[0]}, but this expense is dated ${parsedDate.toISOString().split('T')[0]}.`,
                      resolutionAction: { action: "CHANGE_DATE_OR_EXCLUDE", suggestedResolution: "Change the expense date or select a different payer." }
                    });
                  }
                }
              }
            }

            // ---- 13. SPLIT_WITH NAME MAPPING & TIMELINE VALIDATION ----
            for (const name of splitWithNames) {
              const match = findUserMatch(name, memberships);
              if (!match) {
                anomalies.push({
                  batchId: batch.id, rowIndex: index, rawRowData: data,
                  anomalyType: "UNKNOWN_PARTICIPANT", severity: "CRITICAL",
                  description: `Participant '${name}' in split_with is not a recognized group member.`,
                  resolutionAction: {
                    action: "CREATE_STUB_USER", name,
                    suggestedResolution: `Create '${name}' as a new user, map to existing member, or exclude from split.`,
                    availableMembers: memberships.map(m => ({ userId: m.userId, name: m.user.name }))
                  }
                });
              } else {
                if (!match.exact) {
                  anomalies.push({
                    batchId: batch.id, rowIndex: index, rawRowData: data,
                    anomalyType: "USER_DISCREPANCY", severity: "WARNING",
                    description: `Participant '${name}' is not an exact match. Did you mean '${match.suggestedName}'?`,
                    resolutionAction: {
                      action: "MAP_USER",
                      mappedUserId: match.userId,
                      originalName: name,
                      suggestedName: match.suggestedName,
                      suggestedMapping: { from: name, to: match.suggestedName },
                      suggestedResolution: `Auto-map '${name}' → '${match.suggestedName}'.`
                    }
                  });
                }
                  // Membership timeline validation
                  if (paidBy && parsedDate) {
                  const mem = memberships.find(m => m.userId === match.userId);
                  if (mem && mem.joinedAt > parsedDate) {
                    anomalies.push({
                      batchId: batch.id, rowIndex: index, rawRowData: data,
                      anomalyType: "TIMELINE_VIOLATION", severity: "CRITICAL",
                      description: `Participant '${name}' joined on ${mem.joinedAt.toISOString().split('T')[0]}, after expense date ${parsedDate.toISOString().split('T')[0]}.`,
                      resolutionAction: { action: "CHANGE_DATE_OR_EXCLUDE", userName: name, userId: match.userId, suggestedResolution: "Change expense date or exclude this user from the split." }
                    });
                  }
                  if (mem && mem.leftAt && mem.leftAt < parsedDate) {
                    anomalies.push({
                      batchId: batch.id, rowIndex: index, rawRowData: data,
                      anomalyType: "TIMELINE_VIOLATION", severity: "CRITICAL",
                      description: `Participant '${name}' left on ${mem.leftAt.toISOString().split('T')[0]}, before expense date ${parsedDate.toISOString().split('T')[0]}.`,
                      resolutionAction: { action: "CHANGE_DATE_OR_EXCLUDE", userName: name, userId: match.userId, suggestedResolution: "Change expense date or exclude this user from the split." }
                    });
                  }
                }
              }
            }

            // ---- 14. PERCENTAGE MISMATCH ----
            if (splitType === 'percentage' && data.split_details) {
              const details = parseSplitDetails(data.split_details);
              const totalPct = details.reduce((sum, d) => sum + d.value, 0);
              if (Math.abs(totalPct - 100) > 0.01) {
                anomalies.push({
                  batchId: batch.id, rowIndex: index, rawRowData: data,
                  anomalyType: "PERCENTAGE_MISMATCH", severity: "CRITICAL",
                  description: `Percentage split values sum to ${totalPct}%, not 100%. Difference: ${round2(totalPct - 100)}%.`,
                  resolutionAction: { action: "EDIT_PERCENTAGES", currentTotal: totalPct, suggestedResolution: "Edit the percentages so they sum exactly to 100%." }
                });
              }
            }

            // ---- 15. SHARE MISMATCH (negative or non-integer shares) ----
            if (splitType === 'share' && data.split_details) {
              const details = parseSplitDetails(data.split_details);
              let hasInvalid = false;
              const invalidEntries = [];
              for (const d of details) {
                if (d.value < 0 || !Number.isInteger(d.value)) {
                  hasInvalid = true;
                  invalidEntries.push(`${d.name}: ${d.value}`);
                }
              }
              if (hasInvalid) {
                anomalies.push({
                  batchId: batch.id, rowIndex: index, rawRowData: data,
                  anomalyType: "SHARE_MISMATCH", severity: "CRITICAL",
                  description: `Share values must be positive integers. Invalid entries: ${invalidEntries.join(", ")}.`,
                  resolutionAction: { action: "EDIT_SHARES", invalidEntries, suggestedResolution: "Correct share values to positive integers." }
                });
              }
            }

            // ---- 16. UNEQUAL SPLIT MISMATCH ----
            if (splitType === 'unequal' && data.split_details && !isNaN(amount)) {
              const details = parseSplitDetails(data.split_details);
              const totalVal = details.reduce((sum, d) => sum + d.value, 0);
              if (Math.abs(totalVal - Math.abs(amount)) > 0.01) {
                anomalies.push({
                  batchId: batch.id, rowIndex: index, rawRowData: data,
                  anomalyType: "SPLIT_MISMATCH", severity: "CRITICAL",
                  description: `Unequal split amounts sum to ${totalVal}, but the total expense is ${Math.abs(amount)}. Difference: ${round2(totalVal - Math.abs(amount))}.`,
                  resolutionAction: { action: "EDIT_SPLITS", currentTotal: totalVal, expectedTotal: Math.abs(amount), suggestedResolution: "Adjust the split amounts to equal the total expense." }
                });
              }
            }
          }

          // Store rows on the batch for later commit
          await prisma.importBatch.update({
            where: { id: batch.id },
            data: { rawCsvData: rows }
          });

          if (anomalies.length > 0) {
            await prisma.importAnomaly.createMany({ data: anomalies });
          }

          // Clean up uploaded temp file
          try { fs.unlinkSync(file.path); } catch (e) { /* ignore */ }

          // Fetch back created anomalies with IDs
          const savedAnomalies = await prisma.importAnomaly.findMany({
            where: { batchId: batch.id },
            orderBy: { rowIndex: 'asc' }
          });

          res.status(200).json({
            message: "CSV processed successfully.",
            data: {
              batchId: batch.id,
              filename: file.originalname,
              rowsProcessed: rows.length,
              anomaliesFound: savedAnomalies.length,
              criticalCount: savedAnomalies.filter(a => a.severity === 'CRITICAL').length,
              warningCount: savedAnomalies.filter(a => a.severity === 'WARNING').length,
              anomalies: savedAnomalies
            }
          });
        } catch (err) {
          next(err);
        }
      })
      .on('error', (err) => next(err));

  } catch (error) {
    if (req.file) try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }
    next(error);
  }
};

// ==================== GET BATCH REVIEW ====================
exports.getBatchReview = async (req, res, next) => {
  try {
    const { batchId } = req.params;
    const batch = await prisma.importBatch.findUnique({
      where: { id: batchId },
      include: {
        anomalies: { orderBy: { rowIndex: 'asc' } },
        report: true
      }
    });
    if (!batch) return res.status(404).json({ error: "Batch not found" });

    const anomalies = batch.anomalies.map(a => ({
      ...a,
      status: a.resolved ? 'RESOLVED' : 'UNRESOLVED',
      suggestedResolution: a.resolutionAction?.suggestedResolution || null
    }));

    const summary = {
      totalRows: Array.isArray(batch.rawCsvData) ? batch.rawCsvData.length : 0,
      totalAnomalies: anomalies.length,
      criticalUnresolved: anomalies.filter(a => a.severity === 'CRITICAL' && !a.resolved).length,
      warningUnresolved: anomalies.filter(a => a.severity === 'WARNING' && !a.resolved).length,
      resolved: anomalies.filter(a => a.resolved).length,
      canCommit: anomalies.filter(a => a.severity === 'CRITICAL' && !a.resolved).length === 0,
      status: batch.status
    };

    res.status(200).json({ data: { ...batch, anomalies, summary } });
  } catch (error) {
    next(error);
  }
};

// ==================== RESOLVE ANOMALY ====================
exports.resolveAnomaly = async (req, res, next) => {
  try {
    const { batchId, anomalyId } = req.params;
    const { resolutionAction } = req.body;

    if (!resolutionAction || !resolutionAction.action) {
      return res.status(400).json({ error: "resolutionAction with an 'action' field is required." });
    }

    // Verify the anomaly belongs to this batch
    const existing = await prisma.importAnomaly.findUnique({ where: { id: anomalyId } });
    if (!existing) return res.status(404).json({ error: "Anomaly not found." });
    if (existing.batchId !== batchId) return res.status(400).json({ error: "Anomaly does not belong to this batch." });

    // Verify the batch is still PENDING
    const batch = await prisma.importBatch.findUnique({ where: { id: batchId } });
    if (batch.status === 'PROCESSED') return res.status(400).json({ error: "Batch already committed. Cannot resolve anomalies." });

    const anomaly = await prisma.importAnomaly.update({
      where: { id: anomalyId },
      data: {
        resolved: true,
        resolutionAction,
        resolvedAt: new Date()
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        actionType: "ANOMALY_RESOLVED",
        entityType: "ImportAnomaly",
        entityId: anomalyId,
        changeSummary: `Resolved anomaly type=${existing.anomalyType} row=${existing.rowIndex} with action=${resolutionAction.action}`,
        previousState: { resolved: false, resolutionAction: existing.resolutionAction },
        newState: { resolved: true, resolutionAction }
      }
    });

    // Return updated state including unresolved critical count
    const unresolvedCritical = await prisma.importAnomaly.count({
      where: { batchId, resolved: false, severity: 'CRITICAL' }
    });

    res.status(200).json({
      data: anomaly,
      unresolvedCriticalCount: unresolvedCritical
    });
  } catch (error) {
    next(error);
  }
};

// ==================== COMMIT BATCH ====================
exports.commitBatch = async (req, res, next) => {
  try {
    const { batchId } = req.params;
    const userId = req.user.userId;

    const batch = await prisma.importBatch.findUnique({
      where: { id: batchId },
      include: { anomalies: true }
    });

    if (!batch) return res.status(404).json({ error: "Batch not found" });
    if (batch.status === 'PROCESSED') return res.status(400).json({ error: "Batch already committed." });

    const unresolvedCritical = batch.anomalies.filter(a => !a.resolved && a.severity === 'CRITICAL');
    if (unresolvedCritical.length > 0) {
      return res.status(400).json({
        error: "Cannot commit. Unresolved critical anomalies exist.",
        unresolvedCriticalCount: unresolvedCritical.length,
        unresolvedCriticalAnomalies: unresolvedCritical.map(a => ({
          id: a.id, rowIndex: a.rowIndex, type: a.anomalyType, description: a.description
        }))
      });
    }

    const rows = batch.rawCsvData || [];
    const report = {
      rowsProcessed: rows.length,
      rowsImported: 0,
      rowsSkipped: 0,
      anomaliesDetected: batch.anomalies.length,
      anomaliesResolved: batch.anomalies.filter(a => a.resolved).length,
      settlementsCreated: 0,
      duplicatesSkipped: 0,
      autoCreatedUsers: 0
    };

    let memberships = await prisma.groupMembership.findMany({
      where: { groupId: batch.groupId },
      include: { user: true }
    });
    const createdUsersCache = {};
    const group = await prisma.group.findUnique({ where: { id: batch.groupId } });
    const defaultCurrency = getGroupDefaultCurrency(group);

    async function resolveUser(name, rowAnomalies, tx) {
      if (!name || !name.trim()) return null;
      const cleanName = name.trim();
      const relevantAnomalyTypes = ["UNKNOWN_PAYER", "UNKNOWN_PARTICIPANT", "USER_DISCREPANCY", "ALIAS_PAYER", "UNKNOWN_SPLIT_USER"];
      const matchingAnomaly = rowAnomalies.find(a =>
        a.resolved && a.resolutionAction && relevantAnomalyTypes.includes(a.anomalyType) &&
        (a.resolutionAction.name === cleanName || a.resolutionAction.originalName === cleanName ||
         (a.description && a.description.includes(`'${cleanName}'`)))
      );

      if (matchingAnomaly && matchingAnomaly.resolutionAction) {
        const action = matchingAnomaly.resolutionAction.action;
        if (action === "MAP_USER") {
          return matchingAnomaly.resolutionAction.mappedUserId || matchingAnomaly.resolutionAction.selectedUserId || null;
        }
        if (action === "SELECT_PAYER") {
          return matchingAnomaly.resolutionAction.selectedUserId || null;
        }
        if (action === "CREATE_STUB_USER") {
          const stubName = matchingAnomaly.resolutionAction.name || cleanName;
          if (createdUsersCache[stubName]) return createdUsersCache[stubName];
          const email = `stub_${Date.now()}_${Math.floor(Math.random() * 10000)}@splitwise-stub.com`;
          const newUser = await tx.user.create({
            data: { name: stubName, email, passwordHash: "stub" }
          });
          await tx.groupMembership.create({
            data: { groupId: batch.groupId, userId: newUser.id }
          });
          createdUsersCache[stubName] = newUser.id;
          report.autoCreatedUsers++;
          memberships = await tx.groupMembership.findMany({
            where: { groupId: batch.groupId },
            include: { user: true }
          });
          return newUser.id;
        }
        if (action === "EXCLUDE_USER") {
          return null;
        }
      }

      const match = findUserMatch(cleanName, memberships);
      return match ? match.userId : null;
    }

    const rowAnomaliesByIndex = batch.anomalies.reduce((acc, anomaly) => {
      acc[anomaly.rowIndex] = acc[anomaly.rowIndex] || [];
      acc[anomaly.rowIndex].push(anomaly);
      return acc;
    }, {});

    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const { index, data } = row;
        const rowAnomalies = rowAnomaliesByIndex[index] || [];
        let skipRow = false;
        let convertToSettlement = false;

        for (const anomaly of rowAnomalies) {
          const action = anomaly.resolutionAction?.action;
          if (anomaly.resolved && action === "SKIP_ROW") {
            // Only treat row skipping as a true skip for anomalies that
            // explicitly indicate the entire row should be skipped.
            if (["POTENTIAL_DUPLICATE", "DUPLICATE_EXPENSE", "ZERO_AMOUNT", "INVALID_AMOUNT"].includes(anomaly.anomalyType)) {
              skipRow = true;
              if (["POTENTIAL_DUPLICATE", "DUPLICATE_EXPENSE"].includes(anomaly.anomalyType)) {
                report.duplicatesSkipped++;
              }
            }
          }
          if (anomaly.resolved && action === "CONVERT_TO_SETTLEMENT") {
            convertToSettlement = true;
          }
          if (!anomaly.resolved && anomaly.severity === 'CRITICAL') {
            skipRow = true;
          }
        }

        if (skipRow) {
          report.rowsSkipped++;
          continue;
        }

        const paidBy = (data.paid_by || "").trim();
        let amountStr = (data.amount || "0").replace(/,/g, '');
        let amount = parseFloat(amountStr);
        const title = (data.description || "Imported Expense").trim();
        const { date } = parseDate(data.date);

        const precisionAnomaly = rowAnomalies.find(a => a.anomalyType === "INVALID_PRECISION");
        if (precisionAnomaly && precisionAnomaly.resolutionAction?.roundedAmount) {
          amount = precisionAnomaly.resolutionAction.roundedAmount;
        } else {
          amount = round2(amount);
        }

        let currency = (data.currency || "").trim().toUpperCase();
        const currencyAnomaly = rowAnomalies.find(a => ["MISSING_CURRENCY", "UNSUPPORTED_CURRENCY"].includes(a.anomalyType));
        if (currencyAnomaly) {
          if (currencyAnomaly.resolved && currencyAnomaly.resolutionAction?.currency) {
            currency = currencyAnomaly.resolutionAction.currency;
          } else {
            currency = defaultCurrency;
          }
        }
        if (!currency) currency = defaultCurrency;

        let expenseDate = date || new Date();
        const dateAnomaly = rowAnomalies.find(a => a.anomalyType === "DATE_FORMAT_ERROR");
        if (dateAnomaly && dateAnomaly.resolved && dateAnomaly.resolutionAction?.correctedDate) {
          expenseDate = new Date(dateAnomaly.resolutionAction.correctedDate);
        }

        if (amount === 0) {
          report.rowsSkipped++;
          continue;
        }

        const payerUserId = await resolveUser(paidBy, rowAnomalies, tx);
        if (!payerUserId) {
          report.rowsSkipped++;
          continue;
        }

        const absAmount = Math.abs(amount);

        if (convertToSettlement) {
          const splitWithNames = (data.split_with || "").split(";").map(s => s.trim()).filter(s => s);
          let receiverUserId = null;
          for (const name of splitWithNames) {
            const uid = await resolveUser(name, rowAnomalies, tx);
            if (uid && uid !== payerUserId) {
              receiverUserId = uid;
              break;
            }
          }

          if (receiverUserId) {
            await tx.settlement.create({
              data: {
                groupId: batch.groupId,
                payerId: payerUserId,
                receiverId: receiverUserId,
                amount: absAmount,
                currency,
                date: expenseDate
              }
            });
            report.settlementsCreated++;
            report.rowsImported++;
            await tx.auditLog.create({
              data: {
                userId,
                actionType: "SETTLEMENT_IMPORTED",
                entityType: "Settlement",
                entityId: batch.id,
                changeSummary: `Converted CSV row ${index} to settlement: ${paidBy} → ${splitWithNames[0]} (${absAmount} ${currency})`
              }
            });
            continue;
          }
        }

        const expense = await tx.expense.create({
          data: {
            groupId: batch.groupId,
            title,
            totalAmount: absAmount,
            currency,
            paidByUserId: payerUserId,
            date: expenseDate
          }
        });

        const splitWithNames = (data.split_with || "").split(";").map(s => s.trim()).filter(s => s);
        const resolvedUserIds = [];
        for (const name of splitWithNames) {
          const id = await resolveUser(name, rowAnomalies, tx);
          if (id && !resolvedUserIds.includes(id)) resolvedUserIds.push(id);
        }
        if (resolvedUserIds.length === 0) resolvedUserIds.push(payerUserId);

        const splitType = (data.split_type || "equal").trim().toUpperCase();
        const splitsData = [];

        if (splitType === "PERCENTAGE" && data.split_details) {
          const details = parseSplitDetails(data.split_details);
          let allocated = 0;
          for (let i = 0; i < details.length; i++) {
            const detail = details[i];
            const uid = await resolveUser(detail.name, rowAnomalies, tx) || resolvedUserIds[i] || resolvedUserIds[0];
            const splitAmount = i === details.length - 1
              ? round2(absAmount - allocated)
              : round2(absAmount * (detail.value / 100));
            allocated += splitAmount;
            splitsData.push({
              expenseId: expense.id,
              userId: uid,
              amount: splitAmount,
              splitType: "PERCENTAGE",
              splitValue: detail.value
            });
          }
        } else if (splitType === "UNEQUAL" && data.split_details) {
          const details = parseSplitDetails(data.split_details);
          for (const detail of details) {
            const uid = await resolveUser(detail.name, rowAnomalies, tx) || resolvedUserIds[0];
            splitsData.push({
              expenseId: expense.id,
              userId: uid,
              amount: round2(detail.value),
              splitType: "UNEQUAL",
              splitValue: null
            });
          }
        } else if (splitType === "SHARE" && data.split_details) {
          const details = parseSplitDetails(data.split_details);
          const totalShares = details.reduce((sum, detail) => sum + detail.value, 0);
          let allocated = 0;
          for (let i = 0; i < details.length; i++) {
            const detail = details[i];
            const uid = await resolveUser(detail.name, rowAnomalies, tx) || resolvedUserIds[i] || resolvedUserIds[0];
            const splitAmount = i === details.length - 1
              ? round2(absAmount - allocated)
              : round2(absAmount * (detail.value / totalShares));
            allocated += splitAmount;
            splitsData.push({
              expenseId: expense.id,
              userId: uid,
              amount: splitAmount,
              splitType: "SHARE",
              splitValue: detail.value
            });
          }
        } else {
          const perPerson = round2(absAmount / resolvedUserIds.length);
          let allocated = 0;
          for (let i = 0; i < resolvedUserIds.length; i++) {
            const finalAmount = i === resolvedUserIds.length - 1
              ? round2(absAmount - allocated)
              : perPerson;
            allocated += finalAmount;
            splitsData.push({
              expenseId: expense.id,
              userId: resolvedUserIds[i],
              amount: finalAmount,
              splitType: "EQUAL",
              splitValue: null
            });
          }
        }

        if (splitsData.length > 0) {
          await tx.expenseSplit.createMany({ data: splitsData });
        }
        report.rowsImported++;
      }

      await tx.importBatch.update({ where: { id: batchId }, data: { status: "PROCESSED" } });
      await tx.importReport.create({
        data: {
          batchId,
          rowsProcessed: report.rowsProcessed,
          rowsImported: report.rowsImported,
          rowsSkipped: report.rowsSkipped,
          anomaliesDetected: report.anomaliesDetected,
          anomaliesResolved: report.anomaliesResolved,
          settlementsCreated: report.settlementsCreated,
          duplicatesSkipped: report.duplicatesSkipped,
          autoCreatedUsers: report.autoCreatedUsers
        }
      });
      await tx.auditLog.create({
        data: {
          userId,
          actionType: "BATCH_COMMITTED",
          entityType: "ImportBatch",
          entityId: batchId,
          changeSummary: `Committed import batch ${batchId}: ${report.rowsImported} imported, ${report.rowsSkipped} skipped, ${report.settlementsCreated} settlements, ${report.autoCreatedUsers} auto-created users`
        }
      });
    });

    const reportRecord = await prisma.importReport.findUnique({ where: { batchId } });

    res.status(200).json({
      message: "Import successfully committed!",
      data: {
        report: reportRecord,
        summary: {
          totalRows: report.rowsProcessed,
          importedRows: report.rowsImported,
          skippedRows: report.rowsSkipped,
          duplicateRowsSkipped: report.duplicatesSkipped,
          settlementsCreated: report.settlementsCreated,
          anomaliesDetected: report.anomaliesDetected,
          anomaliesResolved: report.anomaliesResolved,
          autoCreatedUsers: report.autoCreatedUsers
        }
      }
    });
  } catch (error) {
    next(error);
  }
};
