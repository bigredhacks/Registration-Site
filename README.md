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

Fill in the values in both `.env` files. Outbound email requires `RESEND_API_KEY`, `EMAIL_DELIVERY_ENABLED=true`, the email migration, and the queue worker; see the operations guide below. Local `.env` files are gitignored.

Before deploying registration deadlines, apply `supabase/migrations/20260905_registration_closure.sql` to the Supabase database. It adds nullable `form_configs.closes_at` and the `closes_timezone` display setting; existing forms retain no deadline. In Admin → Application Editor, edit a form's **Registration closes** date/time and **Time zone**, then save. The default zone is `America/New_York`; timestamps are stored as absolute instants and enforce daylight saving offsets. Clear the deadline to reopen an active form. Until this migration is applied, existing forms remain available and editable, but deadline controls are disabled.

At or after the deadline, the API rejects student submissions, edits, deletion, and legacy resume writes for that form unless late waitlist intake is enabled as described below. An active form stays visible for reviewing submitted answers and approval status. Admin edits and decisions remain available. No scheduler is needed: the server checks the deadline on each write, and open student pages update their closed state automatically.

To allow new waitlist applications after registration closes, apply `supabase/migrations/20260921000000_late_waitlist.sql` after the existing deadline, invitation, and email migrations, before deploying the updated application. The migration defaults `form_configs.allow_late_waitlist` to false and replaces `create_registration_with_email`; it does not change existing applications or queue emails. In **Application Editor**, enable **Accept waitlist applications after the deadline** and save. The form must stay active and have a deadline. Applicants still see **Registration closed**, with an **Apply on waitlist** button and notice that a spot is not guaranteed and submitted answers cannot be edited.

The server accepts only new late applications through this option; edits, deletion, and legacy resume writes stay closed. The database locks the form, checks the current deadline, activity and version, and atomically creates a waitlisted application plus its usual confirmation email job. For the main form, the initial waitlist status is also immediately released to the applicant; later organizer draft changes stay private until released normally. No separate decision email is automatically queued. A request crossing the deadline must acknowledge the waitlist before it can be saved. Turning the option off stops new late submissions without changing existing decisions. Removing the deadline reopens normal applications and edits; making the form inactive hides it and stops all submissions. Before migration, the new control is disabled and other form settings remain editable.

Also apply `supabase/migrations/20260905_unique_team_membership.sql` before deploying team publishing. It enforces one live team per user across concurrent requests. If existing duplicate memberships prevent creating the index, resolve those records explicitly; the migration never deletes them. Draft save/publish uses compensating rollback rather than a database transaction, so avoid simultaneous draft edits in the same pool.

Approvals and Team Matching share a selection per application form. Selection survives tab, search, and page changes during the current admin session; refreshing the browser resets it. Saving draft decisions does not send emails; the release dialog offers optional decision emails. Pasted lists match exact emails or full names and require resolving ambiguous names. Resume matching with Box is not connected yet.

### Admin Users directory

Admin → Users lists every Auth account, including accounts without a profile or application. Choose an application to inspect its submission status without excluding other accounts. Search names/account emails, filter profile completion, submission, email verification and signup dates (inclusive UTC days), and open a user for read-only account, profile and application details. Decision changes remain in Approvals. Profile completion matches the dashboard's 13-field meter, including optional fields; it does not represent an explicit profile submission.

Before deploying this feature, apply only `supabase/migrations/20260920000000_admin_users_directory.sql` to the intended Supabase project, then deploy backend and frontend together. The migration adds read-only, service-role-only functions; it does not change existing user data or application availability. The migration directory is not a complete schema baseline: inspect the target `auth.users`, `profiles`, and `registrations` columns and existing `(user_id, form_key)` uniqueness, and rehearse the new migration with synthetic records before applying it. Do not reset the remote database or replay unrelated migrations.

Run `npm run test:database` for the directory's query and permission coverage. After deployment, verify an admin can find an account with no application, select different forms, and open details; verify ordinary accounts cannot call the directory endpoints or functions. A rollback can remove the Users UI/routes while leaving the unused read-only functions in place.

Per-user application access is a separate, unimplemented follow-up: [later-session handoff](ADMIN_USER_APPLICATION_ACCESS.md).

## Local applicant preview

Run `npm run dev:frontend` and open `/applicant-preview.html` on the Vite server (normally `http://localhost:5173/applicant-preview.html`). No sign-in or backend is required. In a normal local session, **View as applicant** appears above **Admin** at the bottom of the sidebar; the admin sample preview also links to it. Production continues to show **Admin** only to organizers and does not include the applicant preview or its switcher.

Use **View as applicant** to choose a fictional applicant: not started, under review, an unreleased draft approval, applying after the deadline, waitlisted, invited, accepted, declined, expired, rejected, or fully closed. Switching keeps the current Dashboard, Profile, Register, or Team page and preserves each applicant's in-memory changes. The real applicant components render these fixtures; the preview does not fetch real applicants or impersonate accounts. Use **Reset applicant** to restore that applicant's starting state; reloading resets all changes. The selected applicant and page can be linked, for example `/applicant-preview.html?persona=invited#/dashboard`.

Profile saves, application submissions, RSVP confirmations, team creation/joining/leaving, and matching preferences operate only on these fixtures. Use team code **BRH026** to join the sample team. Preview requests never reach the real API, Supabase, or email provider, and the preview does not load or alter the signed-in account's session. **Admin** opens the synthetic admin preview inside the same sidebar layout. Its Dashboard, Profile, Register, and Team links return to the selected applicant; choosing another applicant opens their dashboard. Moving between the admin and applicant previews reloads their fictional data. **Exit preview** (or Logout) returns to the regular dashboard. These previews exercise UI behavior, not live backend integration.

## Decision release and invitation responses

For the main `registration` application, `registrations.status` is the organizer's draft decision. Applicants see **Under review** until an admin uses **Release decisions…** in Approvals, except new late waitlist applications, which immediately show **Waitlisted**. A release copies the reviewed draft into `released_status` and sets `decision_released_at`. Later draft edits remain private until released again. Only approved, waitlisted, and rejected decisions can be released; pending/submitted selections are skipped. Other forms keep their existing status behavior.

Released approvals offer **Accept invitation** and **Decline invitation** on the dashboard until the shared invitation deadline, even when registration has closed or the form is inactive. The final answer is stored in `invitation_response` (`accepted`, `declined`, or null) with a database-generated `invitation_responded_at`. Identical retries preserve the original answer and timestamp; an opposite answer is rejected. Set the deadline in **Approvals → Invitations**. Unanswered invitations are automatically declined after the deadline and marked with `invitation_expired_at`; accepted invitations stay accepted. Extending the deadline does not revive expired invitations. Releasing a new approval after setting a future deadline clears a system-generated expiry. Ordinary reapproval retains an applicant's actual response. Organizers can correct an accepted or declined response from **Review → Change invitation response** while the released decision is approved. A concurrent response change rejects the correction; reopen Review before retrying. See the email/deadline deployment guide below for the additional migrations and worker.

The approvals list distinguishes draft decisions, released decisions, and RSVP. Its release/response filters also apply to selection and CSV exports. **Select all** includes every matching applicant across pages. Form-wide invitation totals count **released approved** registrations and separately show expired invitations, independently of draft decisions or table filters. Accepted/declined filters exclude system-generated expiry and include historical applicant responses; combine them with the released-approved filter to view current invitations.

For each wave:

1. Filter/select applicants and save draft decisions with Approve, Waitlist, or Reject. These actions do not release decisions or send emails.
2. Select the intended applicants again and choose **Release decisions…**. Choose release without emails, or enable approved, denied, and waitlisted emails separately. Review the grouped recipients and email choices, then confirm. Preview templates and send personalized tests from Emails. The app releases decisions and queues the chosen emails together.
3. Edit templates and track delivery in **Emails**. Recipients receive the template matching their released decision. The Invitations view manages deadlines and responses; it does not repeat the release action. CSV includes release and response timestamps. `decision_released_at` identifies the latest changed release; delivery tracking and deduplication live in the email outbox.
4. Review accepted, declined, unanswered and expired counts before selecting another wave. Unanswered invitations remain valid until the shared deadline; the site does not enforce capacity or automatically promote applicants.

The release dialog prepares a frozen preview with `POST /api/admin/emails/releases`, then confirms it with `POST /api/admin/emails/releases/:id/confirm`. The database releases up to 1,000 reviewed decisions and queues chosen messages in one transaction. Stale decisions, changed recipients, or a queue failure reject the entire action. Retry the same preview after an uncertain response; completed requests return their original result. Releasing an unchanged decision preserves its timestamp and RSVP, and previously queued emails for that release are skipped. The older `/api/admin/approval/release` endpoint remains available for dashboard-only releases of up to 200 records per request.

Applicant responses use authenticated `PUT /api/registrations/me/invitation-response` with `{response: "accepted" | "declined"}`. Ownership and main-form scope come from the verified account. Query parameters and additional body fields are rejected. Applicant registration responses expose the released decision through `status` and omit `released_status`; admin APIs expose both draft and released fields. All data access uses Express and a backend secret/service-role key, including the two service-only database functions.

### Migration and rollout

Apply `supabase/migrations/20260914000000_invitation_responses.sql` **before deploying this version**. It is a one-time additive migration; every existing decision starts unreleased. It locks registrations during the transaction, records their original values in a temporary table, adds four nullable columns and paired timestamp/value checks, installs the two functions and privileges, and checks every original registration value before committing. Any preservation mismatch rolls the entire migration back. It does not rewrite answers, decisions, owners, resume references, check-ins, or related tables.

Production procedure:

1. Confirm the deployment's Supabase project and that `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` is present on the backend. A publishable key no longer suffices. Verify the live schema, triggers, RLS, role memberships, grants, and any views/functions exposing registrations. The migration revokes direct `anon`/`authenticated` access to this table (including existing column grants); inherited privileges or another privileged view/function must not expose drafts. Verify no external client relies on direct browser access to registrations.
2. Take a fresh private logical backup using a PostgreSQL client compatible with the server, with the connection explicitly verified before running it. For a configured libpq service/environment, use `pg_dump --format=custom --file=/secure/path/brh-before-invitations.dump`, then inspect `pg_restore --list /secure/path/brh-before-invitations.dump`. Confirm application schema/data, sequences, Auth data, and Storage metadata are covered; rehearse the recovery procedure in a restricted recovery environment. Never put dumps in Git, public artifacts, or ordinary beta seed data. Verify protection of legacy Storage object bytes separately: they are not included in database dumps. Current hosted backup coverage must be checked rather than inferred from this repository. See [Supabase backups](https://supabase.com/docs/guides/platform/backups).
3. Rehearse this exact migration on an isolated copy of the current schema with synthetic data. The repository's older migrations are not a complete schema baseline. Do not run a remote reset or blindly push the unreconciled migration directory.
4. During a short maintenance window, pause decision editing and applicant/API traffic, then apply the exact SQL in Supabase SQL Editor or with `psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/20260914000000_invitation_responses.sql` against the verified connection. Stop on any error; do not continue deploying after an unsuccessful migration. Capture registration totals grouped by form/status and related-table totals before and after. All four new fields must initially be null, with all old totals unchanged.
5. Deploy the backend and frontend together and verify the new API paths before restoring traffic. The old backend returns raw drafts, so adding columns alone does not activate privacy. Check a synthetic test account: draft approval remains Under review, releasing it enables RSVP, and recording a response persists after login. Verify unauthenticated/non-admin release attempts and direct PostgREST reads/writes are denied. Then restore traffic and release the real first wave through the admin UI.
6. Watch release/response errors and compare the admin counts with the released-approved cohort after the first wave. Email sending is a separate operation.

For recovery, prefer a forward fix. If disabling the RSVP UI, retain the backend's released-decision masking, direct-client restrictions, columns, and collected data. An unmodified old backend would expose draft decisions. Do not drop the new columns or restore a pre-RSVP backup as an ordinary application rollback: that would discard responses collected after launch. A failed migration transaction itself leaves the old schema/data intact.

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

With native PostgreSQL tools (`initdb`, `pg_ctl`, `psql`) available, run:

```bash
node --test supabase/tests/invitations.test.js
```

This creates and removes its own disposable PostgreSQL cluster using a private Unix socket and synthetic records. It never uses the app's Supabase configuration. It tests migration preservation, role permissions despite permissive legacy RLS, release validation/atomicity, final/idempotent responses, and competing response/release transactions. No production connection is needed.

The development admin preview includes synthetic draft/released decisions and RSVP counts. For browser acceptance, check desktop and mobile release confirmation/cancellation, stale-release errors, multi-batch failure reporting, and filters/CSV. With synthetic applicant API data, check unreleased, approved, accepted, declined, waitlisted/rejected, inactive/closed forms, failed saves, reload persistence, and keyboard confirmation dialogs.

## Email and team operations

See [email delivery and team management](docs/email-and-team-update.md) for the six required migrations, worker configuration, editable email templates, filtered general announcements, decision-email workflow, shared invitation deadline and team deletion behavior.
