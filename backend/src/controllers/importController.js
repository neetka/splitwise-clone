const prisma = require("../config/prisma");
const fs = require("fs");
const csv = require("csv-parser");

const VALID_CURRENCIES = ["USD", "INR", "EUR", "GBP"];

exports.uploadCsv = async (req, res, next) => {
  try {
    const groupId = req.params.id;
    const userId = req.user.userId;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No CSV file uploaded." });
    }

    // 1. Ensure group exists
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      return res.status(404).json({ error: "Group not found." });
    }

    // 2. Create an import batch
    const batch = await prisma.importBatch.create({
      data: {
        groupId,
        uploadedByUserId: userId,
        filename: file.originalname,
        status: "PENDING",
      }
    });

    const anomalies = [];
    const rows = [];
    let rowIndex = 1;

    // 3. Parse CSV
    fs.createReadStream(file.path)
      .pipe(csv())
      .on('data', (data) => {
        rows.push({ index: rowIndex, data });
        rowIndex++;
      })
      .on('end', async () => {
        // 4. Detect Anomalies
        for (const row of rows) {
          const { index, data } = row;
          
          // Missing Title
          if (!data.Title || data.Title.trim() === "") {
            anomalies.push({
              batchId: batch.id,
              rowIndex: index,
              rawRowData: data,
              anomalyType: "MISSING_TITLE",
              severity: "CRITICAL",
              description: "The expense title is missing."
            });
          }

          // Invalid Amount
          const amount = parseFloat(data.Amount);
          if (isNaN(amount) || amount <= 0) {
            anomalies.push({
              batchId: batch.id,
              rowIndex: index,
              rawRowData: data,
              anomalyType: "INVALID_AMOUNT",
              severity: "CRITICAL",
              description: "Amount is missing or invalid."
            });
          }

          // Unsupported Currency
          if (data.Currency && !VALID_CURRENCIES.includes(data.Currency.toUpperCase())) {
            anomalies.push({
              batchId: batch.id,
              rowIndex: index,
              rawRowData: data,
              anomalyType: "UNSUPPORTED_CURRENCY",
              severity: "WARNING",
              description: `Currency '${data.Currency}' is unsupported.`
            });
          }

          // Missing Payer
          if (!data.PaidBy || data.PaidBy.trim() === "") {
            anomalies.push({
              batchId: batch.id,
              rowIndex: index,
              rawRowData: data,
              anomalyType: "MISSING_PAYER",
              severity: "CRITICAL",
              description: "Payer information is missing."
            });
          }
        }

        // 5. Store anomaly records
        if (anomalies.length > 0) {
          await prisma.importAnomaly.createMany({
            data: anomalies
          });
        }

        // Clean up temp file
        fs.unlinkSync(file.path);

        // 6. Generate import report
        res.status(200).json({
          message: "CSV processed.",
          data: {
            batchId: batch.id,
            rowsProcessed: rows.length,
            anomaliesFound: anomalies.length
          }
        });
      })
      .on('error', (err) => {
        next(err);
      });

  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    next(error);
  }
};

exports.getBatchReview = async (req, res, next) => {
  try {
    const { batchId } = req.params;
    
    // 7. Create review endpoint
    const batch = await prisma.importBatch.findUnique({
      where: { id: batchId },
      include: {
        anomalies: true
      }
    });

    if (!batch) return res.status(404).json({ error: "Batch not found" });

    res.status(200).json({ data: batch });
  } catch (error) {
    next(error);
  }
};
