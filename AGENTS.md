# Codebase guide

This file applies to the whole repository. It describes the implementation on
`main`, reviewed at commit `fb5d757`, and the conventions to preserve when changing
it. Update this map when entry points, workflows, or database contracts change.

## Purpose and stack

BigRed//Hacks' registration portal lets applicants authenticate, maintain a
profile, submit configurable applications, respond to released invitations, and
create/join teams or request matching. Organizers edit forms, review applications,
release decisions, manage teams, inspect statistics, and prepare email campaigns.

The root is a private npm workspace containing `frontend` and `backend`:

- `frontend/`: React 19, TypeScript, React Router 7, Vite 6, Tailwind CSS 4,
  and Zod 4. Components use React state, hooks, and context; there is no separate
  application state store or query-cache layer.
- `backend/`: Express 4 and TypeScript, using Supabase's JavaScript client for
  Auth, PostgreSQL access, Storage, and database RPCs. Zod validates requests.
- `supabase/`: incremental SQL migrations and isolated database tests. Important
  transaction and concurrency behavior lives in SQL, not only in TypeScript.
- `netlify/`: serverless adapters for the API and scheduled email worker.
- `docs/email-and-team-update.md`: email, invitation deadline, Storage template,
  and team operations. `README.md` covers setup and invitation rollout/recovery.

## Runtime and entry points

```text
Browser
  frontend/src/main.tsx -> React Router -> pages/components
  frontend/src/config/supabase.ts -> Supabase Auth
  frontend/src/lib/api.ts -> /api with the session's Bearer token
    local: Vite proxy -> backend/src/server.ts
    hosted: Netlify redirect -> netlify/functions/api.ts
      backend/src/app.ts -> routes/index.ts -> route modules
        backend/src/config/supabase.ts -> database / Storage / RPCs

Scheduled email processing
  netlify/functions/process-email-queue.ts (every minute)
  or backend/src/emailWorker.ts (one pass per invocation)
    utils/emailQueue.ts -> database outbox -> utils/email.ts -> Resend
```

`backend/src/app.ts` installs CORS, JSON parsing, the `/api` router, and a final
error handler. It does not open a listening socket. `server.ts` loads dotenv and
listens on `PORT` (default `3000`); the Netlify API function wraps the same app
with `serverless-http`.

`netlify.toml` builds only the frontend into `frontend/dist`; Netlify bundles the
function TypeScript and imported backend source using esbuild. The `/api/*`
redirect precedes the SPA fallback. `npm run build` separately type-checks/builds
both workspaces; it is broader than the Netlify build command.

## Frontend map

### Routing and layout

Routes are declared in `frontend/src/main.tsx`, not `App.tsx`:

| URL | Implementation / behavior |
| --- | --- |
| `/` | `App.tsx`, public landing page |
| `/login`, `/signup` | `pages/authorization/`, Supabase authentication |
| `/auth/reset-password` | `pages/ResetPasswordPage.tsx` |
| `/dashboard`, `/register` | `pages/registration/dashboard.tsx` |
| `/apply` | Redirect to `/register` |
| `/profile` | `pages/registration/profile.tsx` |
| `/team` | `pages/TeamPage.tsx` |
| `/admin` | `pages/admin/AdminPage.tsx` |
| `/forms/:key` | `pages/DynamicFormPage.tsx` |

The applicant and admin pages are wrapped in `components/ProtectedRoute.tsx`.
`AdminPage` additionally checks `lib/useAdmin.ts`. These are presentation guards;
the Express middleware is the authorization boundary.

`components/layouts/RegistrationLayout.tsx` and `components/SideBar/` provide the
authenticated shell. `Modal`, `ConfirmationDialog`, `SearchableCombobox`,
`AdminSelect`, and `Toast/` are shared UI primitives. Theme colors, fonts, Tailwind
imports, and global styles live in `src/index.css`; landing styles are in
`App.css`, and admin styles in `pages/admin/admin.css`. Images live in
`src/assets/`; the public email logo is `public/email-assets/brh-logo-red.png`.

Vite and the frontend tsconfig define the specific aliases `@/assets`,
`@/components`, `@/config`, `@/lib`, and `@/pages`. Keep both configurations aligned
when introducing another alias.

### Applications and forms

- `dashboard.tsx` combines active form summaries with the user's submissions,
  shows invitation state, and opens `components/registration/ApplicationPanel.tsx`
  for the main `registration` form.
- `ApplicationPanel.tsx` fetches the remote form, profile, and existing answers. It
  offers profile prefill and creates or updates the application.
- `DynamicFormPage.tsx` provides the generic `/forms/:key` submission flow.
- `components/registration/DynamicForm.tsx` renders fields using `form-fields/`.
  Supported kinds are text, email, dropdown, radio, checkbox, checkbox group,
  file, multiple-choice grid, preference grid, and display-only note.
- `lib/formConfig.ts` defines frontend field types, option constants, profile
  validation, and built-in registration/team-matching configurations.
  `lib/formPresets.ts` uses these as editor starting points. Live application
  forms come from `form_configs`, not from these presets.
- `lib/buildSchema.ts` builds runtime Zod schemas. Its backend counterpart is
  `backend/src/utils/registrationForms.ts`; changes to field semantics need both.
- `lib/loadCsvOptions.ts` loads school/country options; combobox helpers handle
  searching, selection, and positioning.
- `lib/registrationClosure.ts` handles deadline presentation and timezone
  conversion. `useRegistrationClock.ts` calibrates the displayed clock using
  `server_now`. `RegistrationDeadlineNotice.tsx` shares the closed/waitlist notice
  between the application panel and generic forms. The backend still enforces writes.
- `InvitationActions.tsx` and `lib/invitations.ts` implement applicant RSVP,
  confirmation dialogs, deadline refresh, and response presentation.

### Organizer UI

`pages/admin/AdminPage.tsx` owns the Approvals, Team Matching, Application Editor,
Stats, and Emails tabs. The tabs are local state rather than nested URL routes.

- `AdminUsers.tsx`: approvals table, filtering, application review, check-in,
  exports, and invitation views. `AdminApprovalFilters`, `AdminInvitationStatus`,
  `AdminInvitationResponse`, and `AdminInvitationDeadline` support this workflow.
- `AdminSelectionProvider.tsx` / `AdminSelectionContext.ts`: application-scoped
  selection shared across Approvals and Team Matching, bulk draft decisions,
  refresh revisions, and release confirmation. Selection survives tab/page
  changes while mounted but resets on browser refresh. Draft decisions are sent
  in batches of 200, so a multi-batch action can partially succeed.
- `AdminDecisionRelease.tsx`: refresh selected decisions, choose email kinds,
  prepare a reviewed release, then confirm the same preview ID.
- `AdminTeamMatching.tsx`: existing teams, matching candidates, generated/saved
  drafts, publishing, and reviewed team deletion.
- `AdminFormList.tsx` / `AdminFormEditor.tsx`: form creation, presets, field
  editing, activation, version updates, and registration deadlines.
- `AdminStats.tsx`: filtered registration aggregates from `/api/admin/metrics`.
- `AdminEmails.tsx`, `AdminEmailEditor.tsx`, `AdminTestEmail.tsx`, and
  `AdminAnnouncements.tsx`: templates, personalized tests, reviewed announcements,
  delivery history, and safe retries. `EmailPreview.tsx` uses a sandboxed iframe.
- `adminApprovalState.ts`, `adminTeamMatchingState.ts`, and
  `adminRegistrationsQuery.ts` contain testable state/query helpers.

`admin-preview.html` / `src/admin-preview.tsx` render actual admin components
against fictional in-memory API fixtures. `stats-preview.html` /
`src/stats-preview.tsx` provide synthetic metrics. They are Vite development
entries and are not included in the normal production build. The admin preview
explicitly rejects non-development execution; keep its fixtures separate from
real authorization and API behavior.

## Backend map and authorization

`middleware/auth.ts` verifies Bearer tokens with `supabase.auth.getUser(token)`
and attaches `req.user`. `middleware/requireAdmin.ts` checks the `admin_users`
table and supplies owner-or-admin lookup helpers. `middleware/validate.ts`
validates and replaces parsed bodies, parameters, and queries using Zod.
`types/` contains request schemas and domain interfaces; these are maintained
manually, not generated from the live database.

All API route groups require authentication. In particular, `/api/profile`
installs `requireAuth` inside `routes/profile.ts`; the README's statement that it
is exempt is outdated. `/api/admin/me` allows authenticated non-admins to probe
membership; the rest of that router runs after `requireAdmin`.

| Route module | Mounted path and responsibility |
| --- | --- |
| `registrations.ts` | `/api/registrations`: caller submissions, form-scoped reads/writes, RSVP/settings, legacy signed resume URLs, owner/admin access by ID |
| `profile.ts` | `/api/profile`: get/create and update the caller's profile |
| `participants.ts` | `/api/participants`: matching preferences per caller/pool; admin listing; owner/admin deletion |
| `formConfigs.ts` | `/api/form-configs`: active form discovery and definitions, with closure metadata |
| `teams.ts` | `/api/teams`: caller's team, create, join, leave; then mounts admin matching routes behind `requireAdmin` |
| `adminTeams.ts` | Under `/api/teams`, **not** `/api/admin/teams`: `/admin`, `/saved`, `/save`, `/publish`, and generation at the group root |
| `admin.ts` | `/api/admin`: membership probe, legacy registration list/export, individual draft decisions, check-in, resume downloads, form CRUD, metrics |
| `adminApprovals.ts` | `/api/admin/approval`: shared filtered students/selection/export, pasted identity resolution, bulk draft decisions, legacy release, RSVP correction |
| `adminEmails.ts` | `/api/admin/emails`: templates, tests, job history/retry, legacy decision drafts; mounts release and announcement routers |
| `adminReleaseEmails.ts` | `/api/admin/emails/releases`: frozen release preparation, previews/tests, atomic confirmation |
| `adminAnnouncements.ts` | `/api/admin/emails/announcements`: reviewed audience-based announcement batches |
| `adminInvitations.ts` | `/api/admin/invitations/deadline`: shared RSVP deadline and versioned updates |

The backend uses `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`, so route
ownership/admin checks and service-only RPC privileges are essential. Never move
these credentials into `VITE_*` variables. The browser Supabase client handles
authentication; application data flows through `apiFetch` and Express.

## Data model and important contracts

| Store | Role |
| --- | --- |
| Supabase Auth users | Accounts, sessions, recovery, verified identity/email |
| `profiles` | Profile keyed by Auth user ID; separate from submitted answers |
| `admin_users` | Organizer membership by `user_id` |
| `form_configs` | Form key, JSON fields, version, activation, registration deadline/timezone, `allow_late_waitlist` |
| `registrations` | Application per `(user_id, form_key)`, JSON `answers`, submitted form version, summary columns, decisions, RSVP, check-in, legacy resume path |
| `participants` | Matching preference submission per `(user_id, pool_id)` |
| `teams`, `team_members` | Saved matching drafts referencing participant IDs |
| `user_teams`, `user_team_members` | Live teams, invite codes, account memberships |
| `invitation_settings` | Main-form RSVP deadline, timezone, optimistic version |
| `email_decision_releases` | Reviewed decision/email snapshot and saved confirmation result |
| `email_batches` | Reviewed decision or announcement recipients and payloads |
| `email_outbox` | Durable delivery jobs, deduplication, leases, attempts, receipts |
| `email_template_files` | Active immutable Storage revision and version for each template kind |
| Storage `email-templates` | Private `<kind>/<UUID>/template.html` and `settings.json` files |
| Storage `resumes` | Legacy resume objects accessed through signed URLs |

Applications use `registration` as the default/main form key. Matching uses
`default` as the default pool ID. These identify different concepts. Creating a
form from the team-matching preset still creates a generic application form;
`TeamPage.tsx` separately transforms the built-in matching form into
`participants` API payloads.

Preserve these behaviors:

1. Registration answers are validated against the current server form. The
   backend stores `answers` and `form_version` and projects first/last name,
   school, level of study, and shirt size into summary columns. New/self-updated
   application email comes from the authenticated account. Legacy rows are
   normalized on read. Do not assume every answer has a maintained SQL column.
2. For the main form, `status` is the organizer's **draft**; `released_status`
   and `decision_released_at` are public state. `utils/invitations.ts` masks draft
   decisions from applicant responses. Check-in is independent of both.
3. `create_registration_with_email` inserts an application and its confirmation
   job transactionally. With `allow_late_waitlist`, active forms accept new
   applications after `closes_at`, requiring explicit waitlist acknowledgement.
   The RPC locks/rechecks the config and assigns `waitlisted`; main-form late
   applications also receive an initial public waitlist release. Existing
   applications and later private draft decisions are unchanged; edits remain
   closed after the deadline. Ordinary edits do not queue another confirmation.
   Apply `20260921000000_late_waitlist.sql` before enabling this feature.
4. `release_decisions_with_emails` confirms up to 1,000 reviewed decisions and
   selected emails in one transaction. It checks stale decisions, recipients,
   personalization, deadlines, and preview ownership/age. An uncertain HTTP
   result must be retried using the same preview ID. The older dashboard-only
   `release_registration_decisions` RPC handles up to 200 per call.
5. Applicant RSVP is main-form-only, final, and idempotent for identical retries.
   It remains available after registration closes or the form becomes inactive,
   subject to the separate invitation deadline. Admin corrections compare the
   expected prior response and timestamp.
6. Expiry changes unanswered released approvals to rejected/declined and records
   `invitation_expired_at`. Extending the deadline does not revive them. Accepted
   and genuine declined responses remain intact. The worker runs expiry even
   when email delivery is paused; the applicant settings endpoint also runs it.
7. Live membership and applications are independent: an account can join a team
   without applying. Draft matching uses `TeamMatcher` in `utils/teamMatcher.ts`;
   publishing materializes drafts into live teams and consumes the saved batch.
   One live team per user is enforced by a database unique index. Save/publish
   use compensating rollback and a process-local pool lock, not a distributed
   transaction. Team deletion uses a separate atomic RPC with a reviewed snapshot.
8. `utils/adminApprovals.ts` supplies shared filtering, ordering, identity
   matching, and CSV behavior. Keep the approvals table, select-all, and export
   consistent. `utils/adminTeams.ts` supplies paged reads and assignment checks;
   `utils/adminMetrics.ts` supplies aggregates. Several queries deliberately page
   through all rows to avoid Supabase response limits.

## Email subsystem

`utils/emailTemplates.ts` is the pure default-template and HTML/text renderer;
some frontend admin components import it directly, so keep it free of server
credentials and side effects. There are five template kinds: confirmation,
approved, rejected, waitlisted, and announcement. Test jobs reuse those templates.

`utils/emailSettings.ts` reads settings, loads Storage revisions, and uploads
immutable files before activating their pointer with an expected-version check.
Defaults apply only until a template is saved. A broken active revision must
fail rather than silently use defaults. The old `email_templates` table remains
for legacy export; current code does not use it as template storage.

`utils/emailQueue.ts` claims leased jobs through `claim_email_job`, freezes payloads
before sending, and saves results only while holding the matching lease token.
`utils/email.ts` calls Resend using HTTP fetch with bounded timeouts and a stable
idempotency key. The installed Resend SDK is not the active delivery transport.
Retries retain their payload/key, back off, and stop automatic attempts after
six tries. Jobs outside the 23-hour safety window require operator review.
Audience/recipient/decision changes cancel unattempted jobs; uncertain attempted
jobs require review. A `sent` state means provider acceptance, not inbox delivery.

Decision and announcement previews freeze their templates. Confirmation jobs
load the active template lazily, once per worker pass. Announcements use reviewed
audiences, checked again during queueing and claim. `announcementAudience.ts` and
the SQL audience function must agree. Approval emails require a future saved RSVP
deadline. See the operations document for migration order and recovery details.

## Development and verification

Use the Node version in `.nvmrc` (currently `22.23.2`). Install from the repository
root with `npm ci` for a locked install (`npm install` when intentionally updating
dependencies). The root lockfile governs the workspace install; nested historical
lockfiles also exist. Avoid independent installs that unintentionally diverge them.

Copy the two `.env.example` files to their workspace `.env` paths and fill in the
required values. Never commit credentials or applicant data. The backend example
sets `PORT=5001`, but the Vite proxy defaults to `http://localhost:3000`: either
change the backend port to 3000 or set
`VITE_API_PROXY_TARGET=http://localhost:5001` in `frontend/.env`.

| Root command | Purpose |
| --- | --- |
| `npm run dev` | Both development servers; stops the other if either exits |
| `npm run dev:frontend` | Vite, normally port 5173 |
| `npm run dev:backend` | Express via nodemon/ts-node |
| `npm run build` | Frontend TypeScript/Vite build plus backend TypeScript compile |
| `npm run lint` | Frontend ESLint only; no backend lint script exists |
| `npm test` | Node test runner for colocated frontend/backend `.test.ts`/`.test.js` |
| `npm run test:database` | Four PGlite suites using actual migrations and synthetic schemas/data |
| `node --test supabase/tests/invitations.test.js` | Separate native PostgreSQL suite; needs `initdb`, `pg_ctl`, and `psql` on PATH |

Backend route tests load TypeScript through ts-node and stub Supabase; frontend
tests focus on pure helpers rather than browser rendering. PGlite tests cover
SQL transactions and privileges but not independent concurrent connections. The
native PostgreSQL suite creates its own temporary cluster and tests competing
transactions; neither database test path needs the application's Supabase account.
Neither `npm test` nor `test:database` includes that native suite.

`.github/workflows/ci.yml` runs on PRs targeting `main`: root `npm ci`, frontend
lint, application tests, PGlite tests, and both builds. For behavior changes, use
the relevant existing tests and verify changed UI flows at desktop/mobile widths.
The synthetic previews help with admin UI checks but do not prove real backend
integration. Generated `dist/`, `node_modules/`, `.playwright-cli/`, and
`output/playwright/` are ignored local artifacts.

`npm run email:worker -w backend` performs one worker pass and can affect the
configured database even with delivery disabled, because it expires invitations.
It is an operational command, not an isolated test. Actual delivery additionally
requires `RESEND_API_KEY` and `EMAIL_DELIVERY_ENABLED=true`; `EMAIL_SITE_URL` and
`RESEND_FROM_ADDRESS` configure links and sender identity.

## Database evolution and current limitations

The checked-in migrations are **not a complete initial schema**. Earlier tables,
triggers, grants, and Storage setup are assumed. There is no checked-in Supabase
CLI project configuration or full seed. Do not infer a fresh database can be
bootstrapped by replaying this directory, or reset/push a remote database as part
of ordinary local verification. Follow the reviewed rollout instructions in the
README and operations document for database work. Later migrations replace RPC
definitions; read the latest applicable definition, not only the original one.

Current limitations to account for when extending the site:

- Dynamic `file` fields render a picker, but the application submission paths
  JSON-stringify their values without uploading file bytes. File fields are also
  optional in both generated schemas. The separate legacy resume API does not
  make generic file fields functional. Box resume matching is not connected.
- Live team joining checks member count before inserting in separate requests;
  the checked-in unique membership index protects one team per user, not atomic
  enforcement of the four-member capacity. The full hosted schema is not present
  here, so any additional deployed trigger protection requires verification.
- The operations guide records a legacy `registrations_user_id_unique` index in
  an earlier live audit. This repository does not remove it. Verify the target
  schema before relying on multiple applications per account; do not assume the
  historical audit describes every environment's current state.
- Registration `form_version` records a submission version, but there is no
  versioned form-definition history table in this repository. Preserve field IDs
  and compatibility with older answers when editing form behavior.

Keep changes localized to the appropriate route/helper/component. Preserve
authorization, applicant draft masking, deadline semantics, immutable email
payloads, and concurrency checks across both TypeScript and SQL. Documentation
work does not itself authorize migration execution or outbound email delivery.
