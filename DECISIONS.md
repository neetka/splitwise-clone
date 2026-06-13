# Architecture & Design Decisions - Splitwise Clone MVP

This document records the design and engineering decisions for the Splitwise Clone MVP.

---

## 1. Technical Stack

| Layer | Technology Choice | Rationale |
| :--- | :--- | :--- |
| **Frontend** | React + Vite | Fast build times, robust developer tooling, and modern Component architecture. |
| **Backend** | Node.js + Express | Unified Javascript stack, high concurrency handling, rapid REST API construction. |
| **Database** | PostgreSQL | Relational database is optimal for strict schema validation, referential integrity (foreign keys), and transaction handling. |
| **ORM** | Prisma | Typesafe database client, simplified schema modeling, and seamless migrations. |
| **Realtime** | Socket.IO | Easiest tool to integrate for websocket-based real-time discussions. |
| **Styling** | Vanilla CSS | Clean, pure CSS style rules. No pre-processors or large utility libraries (like TailwindCSS) required, maximizing direct control and flexibility. |

---

## 2. Dynamic Balance Engine vs. Caching
- **Decision**: Compute all user balances dynamically on-the-fly via SQL/Application aggregations rather than storing pre-calculated balances in a summary database table.
- **Rationale**: Storing cached balances creates opportunities for database synchronization anomalies (e.g., if a transaction is edited but a trigger fails). Dynamic computation ensures absolute correctness. For an MVP-scale database, on-the-fly aggregation is highly performant.

---

## 3. Separate Settlement Entity
- **Decision**: Settlements are stored in a dedicated `Settlements` table rather than sharing the `Expenses` schema.
- **Rationale**: An expense represents shared spending with multiple splits, whereas a settlement represents a single debt repayment transaction between two users. Separating these concepts keeps schemas cleaner and prevents bloated logic (e.g., avoiding split calculations for settlements).

---

## 4. Currency Conversion Policy
- **Decision**: Use a static exchange rate of **1 USD = 83.00 INR** recorded inside each import batch rather than integrating a live FX rates API.
- **Rationale**: Stating a static conversion rate at import time maintains reproducibility and avoids network dependencies during testing/grading. Converting all values to the group base currency (INR) simplifies dynamic balance calculation.

---

## 5. Rounding Policy
- **Decision**: Round splits to 2 decimal places and allocate the division remainder (penny difference) to the **payer** of the expense.
- **Rationale**: Equal splits (e.g., $10.00 split 3 ways) naturally produce infinite repeating decimals. Distributing the remainder to the payer ensures that the total of all individual split shares equals the total expense amount exactly.

---

## 6. CSV Anomaly Handling & Review Grid
- **Decision**: Block final CSV commit until all critical anomalies are resolved via an interactive staging review screen in the UI.
- **Rationale**: Hardcoded automatic corrections are prone to error when importing messy real-world data. Giving the user a clear review interface to map aliases, assign missing fields, check duplicates, and adjust split values balances user control and data integrity.

---

## 7. Deployment Platform
- **Frontend**: Vercel (ideal for React/Vite assets).
- **Backend**: Render (simple deployment of Node.js servers and websockets).
- **Database**: Neon (serverless PostgreSQL with easy branching and zero-config deployment).
