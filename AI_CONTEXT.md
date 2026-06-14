# Splitwise Clone MVP Specification - Source of Truth

**Implementation Start Date**: June 14, 2026  
**Current Phase Status**: Phase 1: Database & Authentication (Completed)  
**Finalized Documentation References**:
- [BUILD_PLAN.md](file:///Users/neetka/Desktop/splitwise-clone/BUILD_PLAN.md)
- [DECISIONS.md](file:///Users/neetka/Desktop/splitwise-clone/DECISIONS.md)
- [SCOPE.md](file:///Users/neetka/Desktop/splitwise-clone/SCOPE.md)

This document serves as the absolute, complete source of truth for the Splitwise Clone MVP project. The application is designed to be fully buildable, runnable, and verifiable from the definitions and constraints documented here.

---

## 1. Product Goals & User Personas

### Primary Goal
To build a deployable, Splitwise-inspired shared expenses web application that demonstrates:
- Correct expense tracking and multi-split calculations.
- Robust settlement recording.
- Real-time expense-level discussions.
- Highly trace-able CSV import and anomaly resolution workflows for handling messy historical data.
- Complete audit transparency for all balance-modifying actions.

### Target Users & Personas
1. **Flatmates**: Individuals sharing recurring household expenses (e.g., rent, bills) with changing memberships.
2. **Travelers**: Friends going on trips splitting dynamic costs.
3. **Dynamic Groups**: Groups where members may join or leave over time, requiring strict timeline-based splitting.

---

## 2. Core Workflows & MVP Scope

### In-Scope Core Workflows
1. **User Authentication**: Secure signup, login, and token-based sessions.
2. **Group Management**: Group creation, member additions, and active/inactive status tracking.
3. **Expense Management**: Group-level expenses with equal, unequal, percentage, and share-based splits.
4. **Settlements**: Recording payments made from one user to another to reduce balances.
5. **Real-time Discussion**: Instant messaging thread inside each individual expense details page.
6. **Balances**: Group-level and global dynamic net balance summaries and peer-to-peer breakdowns.
7. **CSV Import Wizard**: A workflow to parse, analyze, edit/resolve anomalies, and bulk-import historical data.
8. **Audit Log**: A historical ledger capturing all modifications to expenses and settlements.

### Out-of-Scope Features
- **Debt Simplification**: No auto-minimization of debt graphs (no "Simplify Debts" algorithm).
- **OCR/Receipts**: No image uploads or automated reading of invoices.
- **Recurring Bills**: No scheduled automated expenses.
- **Push Notifications**: Only in-app real-time comments.
- **Payment Gateways**: No actual banking or card transaction integrations.
- **Mobile/Offline**: Web-only implementation.

---

## 3. Authentication & Security
- **Mechanism**: Email and password authentication with JSON Web Tokens (JWT).
- **Security Standards**:
  - Hashing passwords using `bcrypt` before database storage.
  - Storing JWTs securely on the client (Local Storage or HttpOnly Cookie, depending on implementation choice).
  - Protecting all api routes except `/api/auth/register` and `/api/auth/login`.
  - Authorizing requests by verifying that the authenticated user belongs to the group of the requested resource.

---

## 4. Database & Data Model (PostgreSQL + Prisma)

### Entities & Schemas

#### 1. User
- `id` (UUID, Primary Key)
- `name` (String)
- `email` (String, Unique)
- `password_hash` (String)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

#### 2. Group
- `id` (UUID, Primary Key)
- `name` (String)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

#### 3. GroupMembership
- `id` (UUID, Primary Key)
- `group_id` (UUID, Foreign Key -> Group.id)
- `user_id` (UUID, Foreign Key -> User.id)
- `joined_at` (Timestamp)
- `left_at` (Timestamp, Nullable)
- `is_active` (Boolean, Default: true)

#### 4. Expense
- `id` (UUID, Primary Key)
- `group_id` (UUID, Foreign Key -> Group.id)
- `title` (String)
- `total_amount` (Decimal)
- `currency` (String)
- `paid_by_user_id` (UUID, Foreign Key -> User.id)
- `date` (Timestamp)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

#### 5. ExpenseSplit
- `id` (UUID, Primary Key)
- `expense_id` (UUID, Foreign Key -> Expense.id, On Delete Cascade)
- `user_id` (UUID, Foreign Key -> User.id)
- `amount` (Decimal)
- `split_type` (Enum: EQUAL, UNEQUAL, PERCENTAGE, SHARE)
- `split_value` (Decimal, Nullable)  -- Stores the percentage, share ratio, or raw input value.

#### 6. Settlement
- `id` (UUID, Primary Key)
- `group_id` (UUID, Foreign Key -> Group.id)
- `payer_id` (UUID, Foreign Key -> User.id)
- `receiver_id` (UUID, Foreign Key -> User.id)
- `amount` (Decimal)
- `currency` (String)
- `date` (Timestamp)
- `created_at` (Timestamp)

#### 7. ExpenseComment
- `id` (UUID, Primary Key)
- `expense_id` (UUID, Foreign Key -> Expense.id, On Delete Cascade)
- `user_id` (UUID, Foreign Key -> User.id)
- `comment_text` (Text)
- `created_at` (Timestamp)

#### 8. ImportBatch
- `id` (UUID, Primary Key)
- `group_id` (UUID, Foreign Key -> Group.id)
- `uploaded_by_user_id` (UUID, Foreign Key -> User.id)
- `filename` (String)
- `status` (Enum: PENDING, PROCESSED, FAILED)
- `exchange_rate` (Decimal, Default: 83.00) -- Static rate used for this batch: 1 USD = 83 INR
- `created_at` (Timestamp)

#### 9. ImportAnomaly
- `id` (UUID, Primary Key)
- `batch_id` (UUID, Foreign Key -> ImportBatch.id, On Delete Cascade)
- `row_index` (Integer) -- Line number in the CSV
- `raw_row_data` (Json) -- Keeps the raw row details for fallback display
- `anomaly_type` (String) -- e.g., "MISSING_PAYER", "USER_DISCREPANCY", "DUPLICATE", "MATH_MISMATCH"
- `severity` (Enum: WARNING, CRITICAL)
- `description` (String)
- `resolved` (Boolean, Default: false)
- `resolution_action` (Json, Nullable) -- Stored configuration of the manual resolution choice
- `resolved_at` (Timestamp, Nullable)

#### 10. AuditLog
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key -> User.id)
- `action_type` (String) -- e.g. "CREATE_EXPENSE", "UPDATE_EXPENSE", "DELETE_EXPENSE", "CREATE_SETTLEMENT", "RESOLVE_ANOMALY"
- `entity_type` (String) -- e.g. "Expense", "Settlement", "ImportBatch"
- `entity_id` (UUID)
- `change_summary` (String)
- `previous_state` (Json, Nullable)
- `new_state` (Json, Nullable)
- `created_at` (Timestamp)

---

## 5. Business Logic & Calculations

### 1. Group Membership Date Constraint
A user can only participate in an expense (be the payer or included in splits) if:
- `expense_date >= joined_at` AND (`left_at` is NULL OR `expense_date <= left_at`).
- If an expense is updated to a date outside a participant's active window, or if a user is moved to inactive, historical transactions remain intact, but new actions must enforce this boundary.

### 2. Rounding Policy
- Divisions must resolve to two decimal places (cents/paise).
- Any division remainder is assigned to the payer's share of that expense.
  - *Example*: An expense of 10.00 split equally among 3 users (Payer A, User B, User C):
    - Split shares initially computed: 10.00 / 3 = 3.3333...
    - Base share: 3.33 each. Sum of base shares = 3.33 * 3 = 9.99.
    - Remainder: 10.00 - 9.99 = 0.01.
    - The remainder (0.01) is added to Payer A's share.
    - Final split: Payer A owes 3.34, User B owes 3.33, User C owes 3.33.

### 3. Currency Conversion
- Base currency for group calculations is **INR**.
- If an expense is recorded or imported in **USD**:
  - The application stores both original currency/amount and converted values.
  - Static conversion rate: **1 USD = 83.00 INR**.
  - Converted amount = `USD amount * 83.00`.
  - All balance accumulations are processed in INR using the converted amounts.

### 4. Dynamic Balance Engine
Balances are computed dynamically from the database source entries (`Expenses`, `ExpenseSplits`, `Settlements`).
- **Payer Share**: For a given expense, the Payer paid $E_{total}$. Payer's own split share is $S_{payer}$.
- **Net Balance Calculation**:
  - A user $U$'s net balance in a group is:
    $$\sum (\text{Amounts Paid by } U) - \sum (\text{Split Shares owed by } U) + \sum (\text{Settlements Received by } U) - \sum (\text{Settlements Paid by } U)$$
  - positive balance = others owe this user money.
  - negative balance = this user owes others money.
- **P2P Debt Resolution**:
  - Calculate net balances for all group members.
  - Sort members: debtors (negative net balance) and creditors (positive net balance).
  - Greedily match the largest debtor with the largest creditor until all balances are zero, outputting the peer-to-peer debts (e.g., "Rohan owes Aisha ₹300").

---

## 6. CSV Import & Anomaly Handling Rules

### CSV Headers
Columns: `date`, `description`, `paid_by`, `amount`, `currency`, `split_type`, `split_with`, `split_details`, `notes`

### Anomaly Policies & Resolution Rules

| Anomaly Type | Detection Signal | Severity | Suggested Auto-Action / UI Options for Resolution |
| :--- | :--- | :--- | :--- |
| **MISSING_PAYER** | `paid_by` column is empty. | **CRITICAL** | **Block import.** UI forces the user to select an active group member to assign as the payer. |
| **USER_DISCREPANCY** | Case mismatch or name variance (e.g. `priya` vs `Priya`, or `Priya S` which doesn't exist). | **WARNING / CRITICAL** | 1. **Case-insensitive match**: Automatically map `priya` -> `Priya` and log as auto-resolved.<br>2. **Unmatched Name (e.g. `Priya S`)**: Flag for review. User can: map to existing `Priya`, or create `Priya S` as a new group member. |
| **UNKNOWN_PARTICIPANT** | Name in `split_with` is not an active group member (e.g., `Dev's friend Kabir`). | **CRITICAL** | User can:<br>1. Create user in system and add to group.<br>2. Map to an existing group member.<br>3. Exclude from this expense and recalculate the split. |
| **MISSING_CURRENCY** | `currency` column is empty. | **WARNING** | UI suggests defaulting to group base currency (INR). User must click to confirm or select USD. |
| **SETTLEMENT_DETECTED** | `split_type` is blank, `split_with` has 1 user, description/notes suggest repayment. | **WARNING** | UI displays suggestion: *"Convert to Settlement record?"* User can accept (converts to a `Settlement`) or reject (keeps as an `Expense`). |
| **POTENTIAL_DUPLICATE** | Same date, amount, and similar description or overlapping members. | **WARNING** | Highlight row. User can: Keep both, skip (ignore) this row, or manually merge details. |
| **NEGATIVE_AMOUNT** | `amount` is negative (e.g. `-30`). | **WARNING** | Treat as refund. UI prompts user to import it as a reverse split (reversing credit/debit shares) or standard negative entry. |
| **INVALID_PRECISION** | Decimal places exceed 2 (e.g. `899.995`). | **WARNING** | Auto-round to 2 decimals (e.g. `900.00`). Log the action in the import report. |
| **ZERO_AMOUNT** | `amount` is exactly `0`. | **WARNING** | User can: Ignore (skip) row, keep as a correction entry, or edit the amount. |
| **PERCENTAGE_MISMATCH** | `split_type = percentage` and split detail percents do not total 100%. | **CRITICAL** | **Block import.** Reviewer must edit the percentages on-screen until they sum to 100%. |
| **SHARE_MISMATCH** | `split_type = share` and values are negative or non-integers. | **CRITICAL** | **Block import.** Reviewer must correct values to positive integers on-screen. |
| **DATE_FORMAT_ERROR** | Date cannot be parsed (e.g. `Mar-14`). | **CRITICAL** | Parse fuzzy matches if possible, else flag and require the reviewer to input a valid date (`DD-MM-YYYY`). |
| **TIMELINE_VIOLATION** | Expense date is outside a participant's join/leave dates. | **CRITICAL** | **Block import.** Reviewer must change the expense date or exclude the user from the split. |

---

## 7. UI Screens & Navigation

### 13 Mandatory Screens
1. **Login Page**: Standard form with email/password input.
2. **Register Page**: Signup form (name, email, password).
3. **Dashboard / Home**:
   - Total net balance summary (e.g. "You are owed ₹1,200 total").
   - List of all groups the user belongs to.
4. **Groups List View**: Paginated list of groups with summary status (active members, net group debt).
5. **Group Detail View**:
   - Group name and member listing (including invite/inactive statuses).
   - Feed of expenses and settlements.
   - Core CTA: "Add Expense", "Settle Up", and "Import CSV".
6. **Create/Edit Expense Form**: Title, amount, currency (INR/USD), date, payer, split type selector, and participant checkboxes.
7. **Expense Detail View**: Breakdown of splits, audit history, and the comment discussion feed.
8. **Expense Discussion Chat**: Integrated Socket.IO message thread within the Expense Detail view.
9. **Balances View**: Full group breakdown showing net balances and resolved peer-to-peer debt matrices.
10. **Settlements View**: Dedicated log of payment receipts between members.
11. **CSV Import Wizard**: File drag-and-drop landing page with group selection.
12. **Import Review Screen**: The critical workspace grid showing rows, detected warnings/critical anomalies, and live resolve controls.
13. **Import Report Screen**: Post-import summary showing rows processed, anomalies resolved, auto-created users, and total imported amounts.

---

## 8. API Design

### JSON Error Format
All failed API responses must return:
```json
{
  "success": false,
  "message": "Human readable description of the error",
  "code": "ERROR_CODE"
}
```

### Endpoints List

#### Auth
- `POST /api/auth/register` (body: name, email, password)
- `POST /api/auth/login` (body: email, password)
- `GET /api/auth/me` (header: Authorization JWT)

#### Groups
- `GET /api/groups`
- `POST /api/groups` (body: name)
- `GET /api/groups/:id`
- `POST /api/groups/:id/members` (body: email, joined_at)
- `PUT /api/groups/:id/members/:userId/leave` (body: left_at)

#### Expenses
- `GET /api/groups/:groupId/expenses`
- `POST /api/groups/:groupId/expenses` (body: title, amount, currency, paid_by_user_id, date, split_type, splits)
- `GET /api/expenses/:id`
- `PUT /api/expenses/:id` (body: title, amount, currency, paid_by_user_id, date, split_type, splits)
- `DELETE /api/expenses/:id`

#### Comments (Socket.IO & REST)
- `GET /api/expenses/:id/comments`
- `POST /api/expenses/:id/comments` (body: comment_text)

#### Settlements
- `GET /api/groups/:groupId/settlements`
- `POST /api/groups/:groupId/settlements` (body: payer_id, receiver_id, amount, currency, date)

#### CSV Imports
- `POST /api/groups/:groupId/import/upload` (multipart CSV upload -> returns batch_id + parse anomalies)
- `GET /api/import/batches/:batchId/anomalies`
- `PUT /api/import/anomalies/:anomalyId/resolve` (body: resolution_action)
- `POST /api/import/batches/:batchId/commit` (finalizes import and creates DB entries)

---

## 9. Implementation Progress Log

### Phase 1: Database & Authentication (Completed: June 14, 2026)
- **Database & ORM**: Setup PostgreSQL database connection on Neon DB. Configured Prisma 7 client with `@prisma/adapter-pg` and CommonJS setup. Initialized database schema with all 10 core tables: `users`, `groups`, `group_memberships`, `expenses`, `expense_splits`, `settlements`, `expense_comments`, `import_batches`, `import_anomalies`, and `audit_logs`. Completed initial migration successfully.
- **Express Backend**: Set up Express 5.x application, CORS, JSON parsing, health check route, and structured JSON-error handlers for 404s and global exceptions in `src/app.js`. Managed server lifecycle in `src/server.js` with graceful database connection teardown on `SIGTERM`/`SIGINT`.
- **Authentication Flow**:
  - **Password Hashing**: Implemented hashing with `bcryptjs` (using salt round of 10) on user registration, and secure comparison on login.
  - **Session Tokens**: Implemented token-signing with `jsonwebtoken` storing `userId`, `email`, and `name` with a `7d` expiration.
  - **Token Middleware**: Implemented `verifyToken` middleware to extract bearer tokens from the `Authorization` header, validating claims and forwarding decoded user info on `req.user`.
  - **APIs**: Implemented `POST /api/auth/register`, `POST /api/auth/login`, and `GET /api/auth/me`.
- **Verification & Testing**:
  - Created an automated integration script `scratch/test_auth.js` testing all success routes and failure scenarios.
  - **Test Results**: All tests passed successfully:
    - `GET /health` -> 200 Success
    - `POST /api/auth/register` (New user) -> 201 Success (returns signed JWT)
    - `POST /api/auth/register` (Duplicate user) -> 409 Conflict (`EMAIL_ALREADY_EXISTS`)
    - `POST /api/auth/login` (Correct credentials) -> 200 Success (returns signed JWT)
    - `GET /api/auth/me` (Valid JWT) -> 200 Success (returns current user object)
    - `GET /api/auth/me` (Invalid JWT) -> 403 Forbidden (`AUTH_INVALID`)
    - `GET /api/auth/me` (Missing JWT) -> 401 Unauthorized (`AUTH_REQUIRED`)
