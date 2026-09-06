# BigRed//Hacks Registration Site

Standalone registration portal for BigRed//Hacks. Hackers create an account, complete a profile, fill out a server-driven application, and form or join teams. Admins manage form configs, review applications, and inspect users.

## Structure

```text
frontend/   React 19 + TypeScript + Vite + Tailwind v4
backend/    Express + TypeScript
```

Backend routes live under `/api` and are mounted in `backend/src/routes/index.ts`:
`registrations`, `participants`, `teams`, `profile`, `form-configs`, `admin`. All except `profile` require auth; `admin` additionally requires the admin role.

## Setup

```bash
npm install
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

Fill in the values in both `.env` files. Optionally set `RESEND_API_KEY` in `backend/.env` to enable outbound email. Local `.env` files are gitignored.

Before deploying registration deadlines, apply `supabase/migrations/20260905_registration_closure.sql` to the Supabase database. It adds nullable `form_configs.closes_at` and the `closes_timezone` display setting; existing forms retain no deadline. In Admin → Application Editor, edit a form's **Registration closes** date/time and **Time zone**, then save. The default zone is `America/New_York`; timestamps are stored as absolute instants and enforce daylight saving offsets. Clear the deadline to reopen an active form. Until this migration is applied, existing forms remain available and editable, but deadline controls are disabled.

At or after the deadline, the API rejects student submissions, edits, deletion, and legacy resume writes for that form. An active form stays visible for reviewing submitted answers and approval status. Admin edits and decisions remain available. No scheduler is needed: the server checks the deadline on each write, and open student pages update their closed state automatically.

Also apply `supabase/migrations/20260905_unique_team_membership.sql` before deploying team publishing. It enforces one live team per user across concurrent requests. If existing duplicate memberships prevent creating the index, resolve those records explicitly; the migration never deletes them. Draft save/publish uses compensating rollback rather than a database transaction, so avoid simultaneous draft edits in the same pool.

Approvals and Team Matching share a selection per application form. Selection survives tab, search, and page changes during the current admin session; refreshing the browser resets it. Bulk actions update registration statuses without sending decision emails. Pasted lists match exact emails or full names and require resolving ambiguous names. Resume matching with Box is not connected yet.

## Development

```bash
npm run dev:frontend   # Vite on 5173
npm run dev:backend    # Express on PORT (default 3000)
# or both:
npm run dev
```

`npm run dev` runs both servers together. Press Ctrl+C to stop both. If either
server fails, the other stops too, so a failed startup does not leave a server
running in the background. Run the command again after fixing the error.

The Vite dev server proxies `/api` to the backend. Override the target with `VITE_API_PROXY_TARGET` if your backend runs on a non-default port (e.g. set `PORT=5001` in `backend/.env` and `VITE_API_PROXY_TARGET=http://localhost:5001` in `frontend/.env`).

Open `/admin-preview.html` on the Vite development server to try the actual admin components with fictional students. All preview API requests are intercepted locally; approvals, team publication, and deadline edits affect sample data only. Reloading resets the sample. This preview is not a production build entry point.

## Verification

```bash
npm run build
npm run lint
npm test
```
