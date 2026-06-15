# Splitwise Clone

A full-stack Splitwise-style expense tracker with group expense splitting, balances, settlements, and CSV import review.

## Features
- User authentication with email/password and JWT session management.
- Group creation and member management.
- Expense creation, editing, and split previews.
- Group-level and global balance summaries.
- Settlement recording and settlement history.
- CSV import workflow with anomaly detection and review.
- In-app toast notifications and polished navigation.

## Local setup

### Backend
1. Install dependencies:
   ```bash
   cd backend
   npm install
   ```
2. Start the backend server:
   ```bash
   npm start
   ```
3. The backend serves API requests under `/api`.

### Frontend
1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Start the frontend development server:
   ```bash
   npm run dev
   ```
3. Open the app at the URL shown in the terminal, typically `http://localhost:5173`.

## Frontend routes
- `/login` — sign in
- `/register` — create account
- `/dashboard` — user dashboard and quick links
- `/groups` — list groups
- `/groups/:id` — group details
- `/groups/:groupId/import` — upload CSV import for a group
- `/groups/:groupId/expenses` — group expense list
- `/groups/:groupId/expenses/new` — create expense
- `/groups/:groupId/expenses/:expenseId` — expense details
- `/groups/:groupId/balances` — group balances
- `/groups/:groupId/settlements` — group settlement history
- `/balances` — global balance summary
- `/settlements` — global settlement history

## Running the app
1. Start the backend server first.
2. Start the frontend.
3. Register or log in.
4. Create a group, add members, and start tracking expenses.
5. Use the group import page to upload CSV expense batches and review anomalies.

## Deployment notes
- The backend is a Node/Express service and can be hosted on any Node-compatible platform.
- The frontend is a Vite React app and can be deployed as a static site after running `npm run build`.
- Ensure the frontend is configured to proxy API requests to the backend or use a production backend URL.

## Current status
- Full local development flow is implemented.
- CSV import review and commit workflow is available for group imports.
- No hosted deployment URL is included in this repository.
