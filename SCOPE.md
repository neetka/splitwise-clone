# Scope Specification - Splitwise Clone MVP

This document outlines the strict boundaries of the Splitwise Clone MVP project to ensure high quality and delivery within the 3-day timeline.

---

## In-Scope Features

### 1. User Account & Authentication
- User sign-up and registration.
- User login with email and password.
- JWT-based protected API endpoints.
- Group member access validation (authorization).

### 2. Group Management
- Creating new groups.
- Adding members to a group (by name/email).
- Tracking member joined and left dates to enforce expense-splitting active windows.
- Supporting inactive group memberships where members cannot be split but historical debts are preserved.

### 3. Expense Recording & Splitting
- Creating, editing, and deleting group expenses.
- Default Equal split.
- Unequal monetary splits.
- Percentage-based splits (totaling 100%).
- Share-based splits (using integer ratios).
- Precision rounding rules (remnants added to the payer's share).
- Currencies: INR and USD support (static conversion of 1 USD = 83 INR).

### 4. Settlements/Repayments
- Recording peer-to-peer repayments.
- Settlements are recorded as a distinct entity from normal shared expenses.
- Settlements take effect immediately (no receiver approval required).

### 5. Dynamic Balance Engine
- Real-time dynamic recalculations from transactional data.
- Global user net balance displays.
- Detailed group-level peer-to-peer debt matrices (greedy netting algorithm).

### 6. CSV Import Wizard & Anomaly Resolution
- Parsing of standard export formats.
- Pre-import validation engine detecting:
  - Missing payers
  - User name variances (case-insensitive checks and manual alias mapping)
  - Unknown group participants
  - Missing currencies
  - Payments/settlements logged as expenses
  - Duplicate transactions
  - Negative amounts (refunds)
  - Precision anomalies (rounding to 2 decimal places)
  - Zero-value entries
  - Split percentage/share mismatches
  - Low-confidence date formats
  - Membership timeline violations
- Interactive review grid UI allowing users to manually map aliases, assign payers, resolve maths, and check off duplicates before committing the batch.
- Import Batch Summary Report.

### 7. Real-Time Discussions
- Message thread attached to each expense page using Socket.IO.

### 8. Audit logs
- History of all modifications to group expenses, settlements, and CSV import actions.

---

## Out-of-Scope Features

- **Debt Simplification**: No graph reduction algorithms (e.g. Alice owes Bob owes Charlie).
- **OCR/Receipt Parsing**: No document uploading or automatic reading of scans.
- **Recurring Bills**: No scheduled automated expenses.
- **Push Notifications**: External/device push notifications are excluded.
- **Payment Gateway Integration**: No actual bank account/Venmo/UPI integrations.
- **Mobile Native Applications**: Web browser clients only.
- **Offline Mode**: Database operations require online server-side synchronization.
- **Advanced Financial Analytics**: No dashboards showing spending over time, charts, or category breakdowns.
