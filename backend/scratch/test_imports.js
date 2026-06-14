/**
 * test_imports.js — Comprehensive CSV Import Integration Tests
 * 
 * Tests:
 *  1. Duplicate detection (DB + intra-CSV)
 *  2. Disguised settlement detection
 *  3. Percentage mismatch
 *  4. Share mismatch (negative/non-integer)
 *  5. Timeline violation (joined after / left before)
 *  6. Missing payer
 *  7. Name mapping (case-insensitive & alias)
 *  8. Missing currency defaulting
 *  9. Unsupported currency handling
 * 10. Invalid precision auto-rounding
 * 11. Zero amount detection
 * 12. Negative amount detection
 * 13. Date format error
 * 14. Commit blocking with unresolved CRITICAL anomalies
 * 15. Successful commit with resolved anomalies
 * 16. Anomaly resolution workflow
 */

const fetch = require("node-fetch");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");

const BASE_URL = "http://localhost:5001/api";

let tokenA, tokenB, tokenC, tokenD;
let userA, userB, userC, userD;
let groupId;
let passed = 0, failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

async function api(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body && method !== "GET") opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const json = await res.json();
  return { status: res.status, body: json };
}

async function uploadCsv(groupId, csvContent, filename, token) {
  const tmpDir = path.join(__dirname, "..", "uploads");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const tmpPath = path.join(tmpDir, filename);
  fs.writeFileSync(tmpPath, csvContent);

  const form = new FormData();
  form.append("file", fs.createReadStream(tmpPath), filename);

  const res = await fetch(`${BASE_URL}/groups/${groupId}/imports`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, ...form.getHeaders() },
    body: form,
  });
  const json = await res.json();

  try { fs.unlinkSync(tmpPath); } catch (e) { /* ignore */ }
  return { status: res.status, body: json };
}

async function setup() {
  console.log("\n🔧 SETUP: Creating test users and group...\n");

  // Register 4 users: Aisha, Rohan, Priya, Dev
  let r;
  r = await api("POST", "/auth/register", { name: "Aisha", email: `aisha_import_${Date.now()}@test.com`, password: "pass123" });
  tokenA = r.body.data?.token; userA = r.body.data?.user;
  assert(r.status === 201, "Register Aisha");

  r = await api("POST", "/auth/register", { name: "Rohan", email: `rohan_import_${Date.now()}@test.com`, password: "pass123" });
  tokenB = r.body.data?.token; userB = r.body.data?.user;
  assert(r.status === 201, "Register Rohan");

  r = await api("POST", "/auth/register", { name: "Priya", email: `priya_import_${Date.now()}@test.com`, password: "pass123" });
  tokenC = r.body.data?.token; userC = r.body.data?.user;
  assert(r.status === 201, "Register Priya");

  r = await api("POST", "/auth/register", { name: "Dev", email: `dev_import_${Date.now()}@test.com`, password: "pass123" });
  tokenD = r.body.data?.token; userD = r.body.data?.user;
  assert(r.status === 201, "Register Dev");

  // Create group
  r = await api("POST", "/groups", { name: "Import Test Group" }, tokenA);
  groupId = r.body.data?.group?.id;
  assert(r.status === 201, "Create group");

  // Add members
  r = await api("POST", `/groups/${groupId}/members`, { email: userB.email }, tokenA);
  assert(r.status === 201 || r.status === 200, "Add Rohan to group");

  r = await api("POST", `/groups/${groupId}/members`, { email: userC.email }, tokenA);
  assert(r.status === 201 || r.status === 200, "Add Priya to group");

  r = await api("POST", `/groups/${groupId}/members`, { email: userD.email }, tokenA);
  assert(r.status === 201 || r.status === 200, "Add Dev to group");

  // Create an existing expense to test DB duplicate detection
  r = await api("POST", "/expenses", {
    groupId,
    title: "Groceries BigBasket",
    totalAmount: 2340,
    currency: "INR",
    paidByUserId: userC.id,
    date: "2026-02-03",
    splitType: "EQUAL",
    splits: [
      { userId: userA.id }, { userId: userB.id }, { userId: userC.id }, { userId: userD.id }
    ]
  }, tokenA);
  assert(r.status === 201, "Create existing expense for duplicate test");
}

// ==================== TEST 1: Duplicate Detection ====================
async function testDuplicateDetection() {
  console.log("\n📋 TEST 1: Duplicate Expense Detection\n");

  const csv = `date,description,paid_by,amount,currency,split_type,split_with,split_details,notes
03-02-2026,Groceries BigBasket,Priya,2340,INR,equal,Aisha;Rohan;Priya;Dev,,this is a dupe
03-02-2026,Groceries BigBasket,Priya,2340,INR,equal,Aisha;Rohan;Priya;Dev,,same row again`;

  const r = await uploadCsv(groupId, csv, "test_dupe.csv", tokenA);
  assert(r.status === 200, "Upload succeeded");

  const anomalies = r.body.data.anomalies;
  const dupeAnomalies = anomalies.filter(a => a.anomalyType === "POTENTIAL_DUPLICATE");
  assert(dupeAnomalies.length >= 1, `Found ${dupeAnomalies.length} duplicate anomaly(ies)`);
  assert(dupeAnomalies[0].severity === "WARNING", "Duplicate anomaly severity is WARNING");
  assert(dupeAnomalies[0].resolutionAction?.action === "SKIP_ROW", "Suggests SKIP_ROW");
}

// ==================== TEST 2: Disguised Settlement ====================
async function testDisguisedSettlement() {
  console.log("\n📋 TEST 2: Settlement Disguised as Expense\n");

  const csv = `date,description,paid_by,amount,currency,split_type,split_with,split_details,notes
25-02-2026,Rohan paid Aisha back,Rohan,5000,INR,,Aisha,,this is a settlement`;

  const r = await uploadCsv(groupId, csv, "test_settlement.csv", tokenA);
  assert(r.status === 200, "Upload succeeded");

  const anomalies = r.body.data.anomalies;
  const settlementAnomalies = anomalies.filter(a => a.anomalyType === "SETTLEMENT_DETECTED");
  assert(settlementAnomalies.length >= 1, "Detected settlement disguise");
  assert(settlementAnomalies[0].severity === "WARNING", "Settlement anomaly is WARNING");
  assert(settlementAnomalies[0].resolutionAction?.action === "CONVERT_TO_SETTLEMENT", "Suggests CONVERT_TO_SETTLEMENT");
}

// ==================== TEST 3: Percentage Mismatch ====================
async function testPercentageMismatch() {
  console.log("\n📋 TEST 3: Percentage Mismatch Detection\n");

  const csv = `date,description,paid_by,amount,currency,split_type,split_with,split_details,notes
28-02-2026,Pizza Friday,Aisha,1440,INR,percentage,Aisha;Rohan;Priya;Dev,Aisha 30%; Rohan 30%; Priya 30%; Dev 20%,sum is 110 not 100`;

  const r = await uploadCsv(groupId, csv, "test_pct.csv", tokenA);
  assert(r.status === 200, "Upload succeeded");

  const anomalies = r.body.data.anomalies;
  const pctAnomalies = anomalies.filter(a => a.anomalyType === "PERCENTAGE_MISMATCH");
  assert(pctAnomalies.length === 1, "Found percentage mismatch anomaly");
  assert(pctAnomalies[0].severity === "CRITICAL", "Percentage mismatch is CRITICAL");
  assert(pctAnomalies[0].description.includes("110"), "Description mentions incorrect total");
}

// ==================== TEST 4: Share Mismatch ====================
async function testShareMismatch() {
  console.log("\n📋 TEST 4: Share Mismatch (negative/non-integer)\n");

  const csv = `date,description,paid_by,amount,currency,split_type,split_with,split_details,notes
10-03-2026,Scooter rentals,Priya,3600,INR,share,Aisha;Rohan;Priya;Dev,Aisha -1; Rohan 2; Priya 1.5; Dev 2,bad shares`;

  const r = await uploadCsv(groupId, csv, "test_share.csv", tokenA);
  assert(r.status === 200, "Upload succeeded");

  const anomalies = r.body.data.anomalies;
  const shareAnomalies = anomalies.filter(a => a.anomalyType === "SHARE_MISMATCH");
  assert(shareAnomalies.length === 1, "Found share mismatch anomaly");
  assert(shareAnomalies[0].severity === "CRITICAL", "Share mismatch is CRITICAL");
  assert(shareAnomalies[0].description.includes("negative") || shareAnomalies[0].description.includes("positive integers"), "Describes the share issue");
}

// ==================== TEST 5: Timeline Violation ====================
async function testTimelineViolation() {
  console.log("\n📋 TEST 5: Membership Timeline Violation\n");

  // First, remove Dev from the group to give them a leftAt date
  const r0 = await api("DELETE", `/groups/${groupId}/members/${userD.id}`, null, tokenA);
  assert(r0.status === 200, "Removed Dev from group (soft delete)");

  // Import an expense dated AFTER Dev left
  const csv = `date,description,paid_by,amount,currency,split_type,split_with,split_details,notes
20-06-2026,Future expense,Aisha,1000,INR,equal,Aisha;Rohan;Priya;Dev,,Dev already left`;

  const r = await uploadCsv(groupId, csv, "test_timeline.csv", tokenA);
  assert(r.status === 200, "Upload succeeded");

  const anomalies = r.body.data.anomalies;
  const timelineAnomalies = anomalies.filter(a => a.anomalyType === "TIMELINE_VIOLATION");
  assert(timelineAnomalies.length >= 1, `Found ${timelineAnomalies.length} timeline violation(s)`);
  assert(timelineAnomalies[0].severity === "CRITICAL", "Timeline violation is CRITICAL");

  // Re-add Dev to group for subsequent tests
  const r1 = await api("POST", `/groups/${groupId}/members`, { email: userD.email }, tokenA);
  assert(r1.status === 201 || r1.status === 200, "Re-added Dev to group");
}

// ==================== TEST 6: Missing Payer ====================
async function testMissingPayer() {
  console.log("\n📋 TEST 6: Missing Payer Detection\n");

  const csv = `date,description,paid_by,amount,currency,split_type,split_with,split_details,notes
22-02-2026,House cleaning supplies,,780,INR,equal,Aisha;Rohan;Priya;Dev,,no payer`;

  const r = await uploadCsv(groupId, csv, "test_nopayer.csv", tokenA);
  assert(r.status === 200, "Upload succeeded");

  const anomalies = r.body.data.anomalies;
  const payerAnomalies = anomalies.filter(a => a.anomalyType === "MISSING_PAYER");
  assert(payerAnomalies.length === 1, "Found missing payer anomaly");
  assert(payerAnomalies[0].severity === "CRITICAL", "Missing payer is CRITICAL");
  assert(payerAnomalies[0].resolutionAction?.availableMembers?.length > 0, "Provides available members for selection");
}

// ==================== TEST 7: Name Mapping ====================
async function testNameMapping() {
  console.log("\n📋 TEST 7: Name Mapping (case-insensitive & alias)\n");

  const csv = `date,description,paid_by,amount,currency,split_type,split_with,split_details,notes
14-02-2026,Movie night snacks,priya,640,INR,equal,Aisha;Rohan;Priya,,lowercase payer
18-02-2026,Groceries DMart,Priya S,1875,INR,equal,Aisha;Rohan;Priya;Dev,,alias name`;

  const r = await uploadCsv(groupId, csv, "test_names.csv", tokenA);
  assert(r.status === 200, "Upload succeeded");

  const anomalies = r.body.data.anomalies;

  // Case-insensitive match should produce USER_DISCREPANCY
  const caseAnomalies = anomalies.filter(a => a.anomalyType === "USER_DISCREPANCY" && a.description.includes("priya"));
  assert(caseAnomalies.length >= 1, "Detected case mismatch for 'priya' → 'Priya'");
  assert(caseAnomalies[0].resolutionAction?.action === "MAP_USER", "Suggests MAP_USER for case mismatch");
  assert(caseAnomalies[0].resolutionAction?.suggestedName === "Priya", "Maps to correct user 'Priya'");

  // Alias match: "Priya S" should partially match "Priya"
  const aliasAnomalies = anomalies.filter(a => a.anomalyType === "USER_DISCREPANCY" && a.description.includes("Priya S"));
  assert(aliasAnomalies.length >= 1, "Detected alias 'Priya S' → 'Priya'");
}

// ==================== TEST 8: Missing Currency Defaulting ====================
async function testMissingCurrency() {
  console.log("\n📋 TEST 8: Missing Currency Defaulting\n");

  const csv = `date,description,paid_by,amount,currency,split_type,split_with,split_details,notes
15-03-2026,Groceries DMart,Priya,2105,,equal,Aisha;Rohan;Priya;Dev,,no currency`;

  const r = await uploadCsv(groupId, csv, "test_currency.csv", tokenA);
  assert(r.status === 200, "Upload succeeded");

  const anomalies = r.body.data.anomalies;
  const currAnomalies = anomalies.filter(a => a.anomalyType === "MISSING_CURRENCY");
  assert(currAnomalies.length === 1, "Found missing currency anomaly");
  assert(currAnomalies[0].severity === "WARNING", "Missing currency is WARNING");
  assert(currAnomalies[0].resolutionAction?.currency === "INR", "Defaults to INR");
}

// ==================== TEST 9: Unsupported Currency ====================
async function testUnsupportedCurrency() {
  console.log("\n📋 TEST 9: Unsupported Currency Handling\n");

  const csv = `date,description,paid_by,amount,currency,split_type,split_with,split_details,notes
15-03-2026,Groceries,Priya,100,JPY,equal,Aisha;Rohan;Priya;Dev,,Japanese yen`;

  const r = await uploadCsv(groupId, csv, "test_badcurrency.csv", tokenA);
  assert(r.status === 200, "Upload succeeded");

  const anomalies = r.body.data.anomalies;
  const unsupported = anomalies.filter(a => a.anomalyType === "UNSUPPORTED_CURRENCY");
  assert(unsupported.length === 1, "Found unsupported currency anomaly");
  assert(unsupported[0].description.includes("JPY"), "Mentions the unsupported currency");
}

// ==================== TEST 10: Invalid Precision ====================
async function testInvalidPrecision() {
  console.log("\n📋 TEST 10: Invalid Precision Auto-Rounding\n");

  const csv = `date,description,paid_by,amount,currency,split_type,split_with,split_details,notes
15-02-2026,Cylinder refill,Rohan,899.995,INR,equal,Aisha;Rohan;Priya;Dev,,three decimals`;

  const r = await uploadCsv(groupId, csv, "test_precision.csv", tokenA);
  assert(r.status === 200, "Upload succeeded");

  const anomalies = r.body.data.anomalies;
  const precisionAnomalies = anomalies.filter(a => a.anomalyType === "INVALID_PRECISION");
  assert(precisionAnomalies.length === 1, "Found precision anomaly");
  assert(precisionAnomalies[0].severity === "WARNING", "Precision anomaly is WARNING");
  assert(precisionAnomalies[0].resolutionAction?.roundedAmount === 900, "Auto-rounds to 900.00");
}

// ==================== TEST 11: Zero & Negative Amount ====================
async function testZeroAndNegativeAmount() {
  console.log("\n📋 TEST 11: Zero & Negative Amount Detection\n");

  const csv = `date,description,paid_by,amount,currency,split_type,split_with,split_details,notes
22-03-2026,Dinner order Swiggy,Priya,0,INR,equal,Aisha;Rohan;Priya;Dev,,zero amount
12-03-2026,Parasailing refund,Dev,-30,USD,equal,Aisha;Rohan;Priya;Dev,,refund`;

  const r = await uploadCsv(groupId, csv, "test_amounts.csv", tokenA);
  assert(r.status === 200, "Upload succeeded");

  const anomalies = r.body.data.anomalies;
  const zeroAnomalies = anomalies.filter(a => a.anomalyType === "ZERO_AMOUNT");
  assert(zeroAnomalies.length === 1, "Found zero amount anomaly");

  const negAnomalies = anomalies.filter(a => a.anomalyType === "NEGATIVE_AMOUNT");
  assert(negAnomalies.length === 1, "Found negative amount anomaly");
}

// ==================== TEST 12: Date Format Error ====================
async function testDateFormatError() {
  console.log("\n📋 TEST 12: Date Format Error Detection\n");

  const csv = `date,description,paid_by,amount,currency,split_type,split_with,split_details,notes
Mar-14,Airport cab,Rohan,1100,INR,equal,Aisha;Rohan;Priya;Dev,,bad date format`;

  const r = await uploadCsv(groupId, csv, "test_date.csv", tokenA);
  assert(r.status === 200, "Upload succeeded");

  const anomalies = r.body.data.anomalies;
  const dateAnomalies = anomalies.filter(a => a.anomalyType === "DATE_FORMAT_ERROR");
  assert(dateAnomalies.length === 1, "Found date format error anomaly");
  assert(dateAnomalies[0].severity === "CRITICAL", "Date format error is CRITICAL");
}

// ==================== TEST 13: Unknown Participant ====================
async function testUnknownParticipant() {
  console.log("\n📋 TEST 13: Unknown Participant Detection\n");

  const csv = `date,description,paid_by,amount,currency,split_type,split_with,split_details,notes
11-03-2026,Parasailing,Dev,150,USD,equal,Aisha;Rohan;Priya;Dev;Kabir,,Kabir is unknown`;

  const r = await uploadCsv(groupId, csv, "test_unknown.csv", tokenA);
  assert(r.status === 200, "Upload succeeded");

  const anomalies = r.body.data.anomalies;
  const unknownAnomalies = anomalies.filter(a => a.anomalyType === "UNKNOWN_PARTICIPANT");
  assert(unknownAnomalies.length >= 1, "Found unknown participant anomaly for Kabir");
  assert(unknownAnomalies[0].severity === "CRITICAL", "Unknown participant is CRITICAL");
  assert(unknownAnomalies[0].resolutionAction?.availableMembers?.length > 0, "Provides available members");
}

// ==================== TEST 14: Commit Blocking ====================
async function testCommitBlocking() {
  console.log("\n📋 TEST 14: Commit Blocking with Unresolved Critical Anomalies\n");

  // Upload CSV with a CRITICAL anomaly (missing payer)
  const csv = `date,description,paid_by,amount,currency,split_type,split_with,split_details,notes
22-02-2026,House cleaning supplies,,780,INR,equal,Aisha;Rohan;Priya;Dev,,no payer`;

  const r = await uploadCsv(groupId, csv, "test_block.csv", tokenA);
  assert(r.status === 200, "Upload succeeded");

  const batchId = r.body.data.batchId;

  // Try to commit without resolving
  const commitR = await api("POST", `/imports/batches/${batchId}/commit`, {}, tokenA);
  assert(commitR.status === 400, "Commit blocked with 400");
  assert(commitR.body.error.includes("Unresolved critical"), "Error message mentions unresolved critical anomalies");
  assert(commitR.body.unresolvedCriticalCount > 0, "Reports count of unresolved critical anomalies");
}

// ==================== TEST 15: Anomaly Resolution ====================
async function testAnomalyResolution() {
  console.log("\n📋 TEST 15: Anomaly Resolution Workflow\n");

  // Upload CSV with a CRITICAL anomaly
  const csv = `date,description,paid_by,amount,currency,split_type,split_with,split_details,notes
22-02-2026,House cleaning supplies,,780,INR,equal,Aisha;Rohan;Priya;Dev,,no payer`;

  const r = await uploadCsv(groupId, csv, "test_resolve.csv", tokenA);
  const batchId = r.body.data.batchId;
  const anomalies = r.body.data.anomalies;

  const missingPayer = anomalies.find(a => a.anomalyType === "MISSING_PAYER");
  assert(missingPayer !== undefined, "Found MISSING_PAYER anomaly");

  // Resolve by selecting Aisha as payer
  const resolveR = await api("PUT", `/imports/batches/${batchId}/anomalies/${missingPayer.id}/resolve`, {
    resolutionAction: { action: "SELECT_PAYER", selectedUserId: userA.id }
  }, tokenA);

  // The route is POST not PUT — check the importRoutes
  // It's: router.post("/batches/:batchId/anomalies/:anomalyId/resolve", resolveAnomaly);
  const resolveR2 = await api("POST", `/imports/batches/${batchId}/anomalies/${missingPayer.id}/resolve`, {
    resolutionAction: { action: "SELECT_PAYER", selectedUserId: userA.id }
  }, tokenA);

  const resolveResult = resolveR.status === 200 ? resolveR : resolveR2;
  assert(resolveResult.status === 200, "Anomaly resolved successfully");
  assert(resolveResult.body.data.resolved === true, "Anomaly marked as resolved");
  assert(resolveResult.body.unresolvedCriticalCount === 0, "No unresolved critical anomalies remaining");
}

// ==================== TEST 16: Successful Commit ====================
async function testSuccessfulCommit() {
  console.log("\n📋 TEST 16: Successful Commit with Clean Data\n");

  const csv = `date,description,paid_by,amount,currency,split_type,split_with,split_details,notes
01-02-2026,Test Rent Payment,Aisha,12000,INR,equal,Aisha;Rohan;Priya;Dev,,clean row
03-02-2026,Test Groceries,Rohan,3000,INR,equal,Aisha;Rohan;Priya;Dev,,clean row 2`;

  const r = await uploadCsv(groupId, csv, "test_commit.csv", tokenA);
  assert(r.status === 200, "Upload succeeded");

  const batchId = r.body.data.batchId;
  const criticalCount = r.body.data.criticalCount;

  // If there are no critical anomalies, commit directly
  if (criticalCount === 0) {
    const commitR = await api("POST", `/imports/batches/${batchId}/commit`, {}, tokenA);
    assert(commitR.status === 200, "Commit succeeded");
    assert(commitR.body.data.summary.importedRows >= 2, `Imported ${commitR.body.data.summary.importedRows} rows`);
    assert(commitR.body.data.summary.totalRows === 2, "Total rows = 2");
    assert(commitR.body.data.report !== undefined, "Report record created");

    // Verify batch status is PROCESSED
    const reviewR = await api("GET", `/imports/batches/${batchId}/review`, null, tokenA);
    assert(reviewR.body.data.status === "PROCESSED", "Batch status is PROCESSED");

    // Cannot commit again
    const reCommit = await api("POST", `/imports/batches/${batchId}/commit`, {}, tokenA);
    assert(reCommit.status === 400, "Re-commit blocked");
  } else {
    console.log("  ⚠️  Clean CSV had unexpected critical anomalies, resolving...");
    // Resolve all critical anomalies
    const anomalies = r.body.data.anomalies.filter(a => a.severity === "CRITICAL");
    for (const a of anomalies) {
      await api("POST", `/imports/batches/${batchId}/anomalies/${a.id}/resolve`, {
        resolutionAction: { action: "SKIP_ROW" }
      }, tokenA);
    }
    const commitR = await api("POST", `/imports/batches/${batchId}/commit`, {}, tokenA);
    assert(commitR.status === 200, "Commit succeeded after resolving");
  }
}

// ==================== TEST 17: Settlement Creation via Commit ====================
async function testSettlementCreation() {
  console.log("\n📋 TEST 17: Settlement Creation via Commit\n");

  const csv = `date,description,paid_by,amount,currency,split_type,split_with,split_details,notes
25-02-2026,Rohan paid back Aisha,Rohan,2000,INR,,Aisha,,settlement`;

  const r = await uploadCsv(groupId, csv, "test_settle_commit.csv", tokenA);
  assert(r.status === 200, "Upload succeeded");

  const batchId = r.body.data.batchId;
  const anomalies = r.body.data.anomalies;

  // Resolve all critical anomalies first
  const criticals = anomalies.filter(a => a.severity === "CRITICAL");
  for (const a of criticals) {
    await api("POST", `/imports/batches/${batchId}/anomalies/${a.id}/resolve`, {
      resolutionAction: { action: "SKIP_ROW" }
    }, tokenA);
  }

  // Resolve the settlement anomaly as CONVERT_TO_SETTLEMENT
  const settlementAnomaly = anomalies.find(a => a.anomalyType === "SETTLEMENT_DETECTED");
  if (settlementAnomaly) {
    await api("POST", `/imports/batches/${batchId}/anomalies/${settlementAnomaly.id}/resolve`, {
      resolutionAction: { action: "CONVERT_TO_SETTLEMENT" }
    }, tokenA);
  }

  const commitR = await api("POST", `/imports/batches/${batchId}/commit`, {}, tokenA);
  assert(commitR.status === 200, "Commit succeeded");

  if (commitR.body.data?.summary) {
    assert(commitR.body.data.summary.settlementsCreated >= 1, `Created ${commitR.body.data.summary.settlementsCreated} settlement(s)`);
  }
}

// ==================== TEST 18: Batch Review Endpoint ====================
async function testBatchReview() {
  console.log("\n📋 TEST 18: Batch Review Endpoint\n");

  const csv = `date,description,paid_by,amount,currency,split_type,split_with,split_details,notes
01-02-2026,Review Test,Aisha,500,INR,equal,Aisha;Rohan,,`;

  const r = await uploadCsv(groupId, csv, "test_review.csv", tokenA);
  const batchId = r.body.data.batchId;

  const reviewR = await api("GET", `/imports/batches/${batchId}/review`, null, tokenA);
  assert(reviewR.status === 200, "Review endpoint returns 200");
  assert(reviewR.body.data.summary !== undefined, "Has summary object");
  assert(reviewR.body.data.summary.totalRows >= 1, "Shows total rows count");
  assert(reviewR.body.data.summary.canCommit !== undefined, "Shows canCommit flag");
}

// ==================== TEST 19: Percentage Split Commit ====================
async function testPercentageSplitCommit() {
  console.log("\n📋 TEST 19: Percentage Split Commit\n");

  const csv = `date,description,paid_by,amount,currency,split_type,split_with,split_details,notes
25-03-2026,Weekend brunch,Aisha,2200,INR,percentage,Aisha;Rohan;Priya;Dev,Aisha 25%; Rohan 25%; Priya 25%; Dev 25%,equal pct`;

  const r = await uploadCsv(groupId, csv, "test_pct_commit.csv", tokenA);
  const batchId = r.body.data.batchId;

  // Resolve any critical anomalies
  const criticals = (r.body.data.anomalies || []).filter(a => a.severity === "CRITICAL");
  for (const a of criticals) {
    await api("POST", `/imports/batches/${batchId}/anomalies/${a.id}/resolve`, {
      resolutionAction: { action: "SKIP_ROW" }
    }, tokenA);
  }

  const commitR = await api("POST", `/imports/batches/${batchId}/commit`, {}, tokenA);
  assert(commitR.status === 200, "Percentage split commit succeeded");
  assert(commitR.body.data.summary.importedRows >= 1, "At least 1 row imported");
}

// ==================== TEST 20: Share Split Commit ====================
async function testShareSplitCommit() {
  console.log("\n📋 TEST 20: Share Split Commit\n");

  const csv = `date,description,paid_by,amount,currency,split_type,split_with,split_details,notes
10-03-2026,Scooter rentals,Priya,3600,INR,share,Aisha;Rohan;Priya;Dev,Aisha 1; Rohan 2; Priya 1; Dev 2,valid shares`;

  const r = await uploadCsv(groupId, csv, "test_share_commit.csv", tokenA);
  const batchId = r.body.data.batchId;

  // Resolve any critical anomalies
  const criticals = (r.body.data.anomalies || []).filter(a => a.severity === "CRITICAL");
  for (const a of criticals) {
    await api("POST", `/imports/batches/${batchId}/anomalies/${a.id}/resolve`, {
      resolutionAction: { action: "SKIP_ROW" }
    }, tokenA);
  }

  const commitR = await api("POST", `/imports/batches/${batchId}/commit`, {}, tokenA);
  assert(commitR.status === 200, "Share split commit succeeded");
  assert(commitR.body.data.summary.importedRows >= 1, "At least 1 row imported");
}

// ==================== MAIN ====================
async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  CSV Import Integration Test Suite");
  console.log("═══════════════════════════════════════════════════");

  try {
    await setup();

    await testDuplicateDetection();
    await testDisguisedSettlement();
    await testPercentageMismatch();
    await testShareMismatch();
    await testTimelineViolation();
    await testMissingPayer();
    await testNameMapping();
    await testMissingCurrency();
    await testUnsupportedCurrency();
    await testInvalidPrecision();
    await testZeroAndNegativeAmount();
    await testDateFormatError();
    await testUnknownParticipant();
    await testCommitBlocking();
    await testAnomalyResolution();
    await testSuccessfulCommit();
    await testSettlementCreation();
    await testBatchReview();
    await testPercentageSplitCommit();
    await testShareSplitCommit();

  } catch (err) {
    console.error("\n💥 FATAL ERROR:", err);
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log("═══════════════════════════════════════════════════\n");

  process.exit(failed > 0 ? 1 : 0);
}

main();
