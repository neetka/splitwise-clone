# Frontend Foundation & Authentication Walkthrough

This phase implements the frontend foundation required for user authentication.

## What was added
- React Router configuration with protected routes.
- `AuthContext` for JWT state and session persistence.
- Axios-based API service configured to proxy `/api` requests to `http://localhost:5001`.
- `LoginPage`, `RegisterPage`, `NotFoundPage`, and a placeholder `DashboardPage`.
- `ProtectedRoute` to block anonymous access and redirect unauthenticated users to login.
- JWT storage in `localStorage` so refreshes preserve the session.

## How it works
- On successful login/register, the JWT and user object are saved in `localStorage`.
- Axios attaches the token to all future requests.
- The `AuthProvider` calls `/api/auth/me` on page load when a token exists.
- If the token is invalid, the app clears local storage and redirects to login.

## Verification steps
1. Start the backend on port `5001`.
2. Start the frontend with `cd frontend && npm run dev`.
3. Open the app in the browser.
4. Register a new account and confirm navigation to `/dashboard`.
5. Log out, then log back in.
6. Refresh the `/dashboard` page and verify the session remains active.
7. Attempt to access `/dashboard` while logged out and confirm redirect to `/login`.

## Phase 7B: Group Management UI
- Added a dedicated group list page at `/groups`.
- Added a group details page at `/groups/:id` with members list, add member, and remove member support.
- Implemented a create group modal and connected it to the backend group creation API.
- Connected group management UI flows to backend APIs for listing groups, loading group details, adding members, and removing members.

## Verification steps for group management
1. Create a new group via the dashboard or groups page.
2. Verify the new group appears in the group list.
3. Open the group details page.
4. Add a group member by email and confirm they appear in the members list.
5. Remove a member and confirm the change is reflected.
