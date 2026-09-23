# Testing admin and database changes

How to test admin features (approvals, invitations, emails) and database changes without touching
production.

Production runs on a single Supabase project on the Free plan, which has no backups. Anything you
change there can't be undone, so don't test against it.

## Which test to use

| Tool | Tests | Setup |
| --- | --- | --- |
| Admin preview | Admin and applicant UI | None |
| `npm test` | Express route handlers | None |
| `npm run test:database` | SQL functions, constraints, permissions | None |
| Local Supabase stack | Everything together: real Auth, Storage, API, and database | About 30 minutes, once |

Most work needs only the first three. See [When you need the local stack](#when-you-need-the-local-stack)
before setting it up.

## Admin preview

```bash
npm run dev:frontend
```

Open http://localhost:5173/admin-preview.html or `/applicant-preview.html`. You don't need to sign
in, and the backend and Supabase don't need to be running. The README's *Local applicant preview*
section lists the applicant personas.

The preview replaces `window.fetch` and answers every `/api/*` request from fake data kept in page
memory. Saving a decision or queueing an email updates the page, but nothing is stored. Refreshing
resets everything.

The preview's responses are written by hand in `frontend/src/admin-preview.tsx`. They don't run
backend code, so they don't update when the backend changes. Keep this in mind:

- A new backend endpoint returns `No sample handler for …` in the preview until someone adds one.
- New validation, error cases, or logic changes in the backend don't show up in the preview.
- The build only catches a change if it affects a type the preview imports.

Use the preview to check how the UI looks and behaves. It doesn't tell you whether the backend works.

## Route tests

```bash
npm test
```

The backend tests in `backend/src/routes/*.test.js` run the real route handlers, but replace
`supabase.from` with an in-memory stand-in. They check request validation, query building, and
responses without a database.

## Database tests

```bash
npm run test:database
```

These run real PostgreSQL inside Node using [PGlite](https://pglite.dev). You don't need Docker or a
PostgreSQL install, and the suite takes about five seconds. CI runs it on every PR. It's the only
database testing CI does.

Most invitation and email logic lives in SQL functions such as `release_registration_decisions`,
`queue_decision_email_batch`, and `expire_registration_invitations`. If you change one of those, test
it here.

Each test file creates the tables it needs, then runs the real migration files:

```js
test.before(async () => {
  db = await PGlite.create();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);
    CREATE TABLE registrations(...);`);
  await migrate('20260914000000_invitation_responses.sql');
});
```

Each file has to create these tables itself because the migrations folder doesn't contain the core
tables (see [Why the migrations aren't enough](#why-the-migrations-arent-enough)). Copy the setup
from the existing test closest to your change.

The roles are real, so you can check permissions by running `SET ROLE anon` and confirming the query
is rejected.

### Adding a test

- For a new migration, add `migrate('<your file>.sql')` to the closest existing test, or create a new
  test file.
- If you create a new file, add it to the `test:database` script in `package.json`. The script lists
  each file by name, so an unlisted file never runs.
- Tests load migrations from `supabase/migrations/` by file name. Don't rename or move migration
  files.

### The native PostgreSQL test

`supabase/tests/invitations.test.js` is older and starts a real PostgreSQL server using `initdb`,
`pg_ctl`, and `psql`. Those need to be installed. CI doesn't run this test, so run it yourself when
you change concurrency behavior:

```bash
node --test supabase/tests/invitations.test.js
```

## When you need the local stack

The local stack runs your actual backend and frontend code against real Supabase services on your
machine. Use it when you need to check something the other tools can't:

- Login, signup, and bearer tokens (real Supabase Auth)
- Resume uploads and email templates (real Storage)
- The email worker processing the outbox
- That a migration works on real Supabase Postgres, not just PGlite
- That the backend actually behaves the way the preview assumes

Setup is in the [appendix](#appendix-local-stack-setup). It lives in a separate folder outside the
repo. It needs read access to the production project to copy its schema, but it never writes to
production.

## Rules

- Never run `supabase db push`. The migrations folder doesn't match production.
- Never run `supabase db reset --linked`. Always use `--local`.
- Never run Supabase CLI commands from the repo. Use the separate local stack folder.
- Never dump data from production (`--data-only`), and never commit a dump. Applicant data must not
  be copied anywhere.
- Never put the secret (service role) key in frontend variables, logs, or PRs.
- Run the email worker against the local stack only, with `npm run email:worker:localdb`. The
  worker expires invitations even when email delivery is off (`emailQueue.ts:80`). Against
  production, it would expire real invitations.

## Migration conventions

- Name files `YYYYMMDDHHMMSS_description.sql` with all 14 digits.
- Wrap the file in `BEGIN; ... COMMIT;`.
- Only make additive changes to existing data: new columns should be nullable.
- Define functions with `SECURITY INVOKER SET search_path=''` and use full names
  (`public.registrations`).
- Grant `EXECUTE` only to `service_role` for functions the browser shouldn't call, and test that
  with `SET ROLE anon`.
- Cover every migration in `npm run test:database`.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `Cannot find module '@electric-sql/pglite'` | Run `npm install` |
| New test file doesn't run | Add it to `test:database` in `package.json` |
| Migration fails with "relation does not exist" in a test | Add the missing table or column to that test's setup |
| Test fails with "no such file" for a migration | A migration file was moved or renamed. Restore it |
| Preview shows `No sample handler` | The preview has no fake response for that endpoint yet |

---

# Appendix: Local stack setup

## Why the migrations aren't enough

The migrations folder only creates six tables: `email_batches`, `email_decision_releases`,
`email_outbox`, `email_template_files`, `email_templates`, and `invitation_settings`. The core
tables (`registrations`, `profiles`, `admin_users`, `form_configs`, `user_teams`,
`user_team_members`, `participants`) were created in the Supabase dashboard and never saved as SQL.

Running the migrations on an empty database fails, so you start from a copy of production's schema.

## Where to run the commands

You'll work in two folders:

```text
~/brh-local-db/                 Supabase CLI commands (supabase init, db dump, start, stop, db reset)
  supabase/
    config.toml
    migrations/                 production schema copy + migrations production doesn't have yet
    seed.sql                    test accounts and required rows

Registration-Site/              npm commands and .env files, as usual
```

Keep the Supabase files out of the repo. The repo already has a `supabase/` folder, so running the
CLI there would add untracked files to it, including a copy of production's schema that's easy to
commit by accident. The database tests also load migrations by file name, so rearranging that
folder breaks `npm run test:database`.

The app connects to the local database at `127.0.0.1:54321`, so it doesn't matter where the
Supabase files live.

Each step below says which folder to run it in.

## Prerequisites

The commands below assume macOS with zsh (the default Mac shell). On Linux, install the tools with
your package manager and start Docker your usual way. On Windows, use WSL.

- Docker Desktop, running before step 2. Both `db dump` and `supabase start` need it.
- Supabase CLI: `brew install supabase/tap/supabase`
- `jq`, for the API examples: `brew install jq`
- Node 22.23.2 (see `.nvmrc`) and `npm install` in the repo
- The production project's session pooler URL **and database password**. The password isn't shown
  in the dashboard. Ask whoever manages the project. Don't reset it: resetting changes it for the
  live site.

## 1. Create the local Supabase folder

In a new folder outside the repo (any location works, such as next to the repo):

```bash
mkdir ~/brh-local-db
cd ~/brh-local-db
supabase init
mkdir -p supabase/migrations     # init doesn't create this folder
```

If `init` asks about VS Code or IntelliJ settings, answer `N`.

Open `supabase/config.toml` and find the `[auth]` section that `init` created. It's well down the
file, below `[api]`, `[db]`, and `[studio]`. Change these two existing lines:

```toml
site_url = "http://localhost:5173"
additional_redirect_urls = ["http://localhost:5173"]
```

Don't add a new `[auth]` section. A second one makes every CLI command fail with
`table auth already exists`.

Use `localhost:5173`, the Vite frontend. The default, port 3000, is the backend API, which has no
pages for signup or password reset links to open. Use `localhost` rather than `127.0.0.1` so the
links open the same address you log in on; the browser keeps separate sessions for each.

## 2. Copy the production schema

Start Docker Desktop and wait until it's ready:

```bash
open -a Docker
docker info > /dev/null 2>&1 && echo "ready" || echo "not ready"   # repeat until "ready"
```

Then, in `~/brh-local-db`:

```bash
read -rs "DB_URL?Session pooler URL: "     # bash: read -rsp "Session pooler URL: " DB_URL
supabase db dump --db-url "$DB_URL" -f supabase/migrations/00000000000000_remote_baseline.sql
unset DB_URL
```

Get the URL from **Project Settings → Database → Connection string → Session pooler**. It shows
`[YOUR-PASSWORD]` where the password goes. Paste the full URL with the password filled in.

- Use port 5432. Port 6543 doesn't work with `pg_dump`, and direct connections need IPv6.
- Percent-encode special characters in the password (for example `@` becomes `%40`).
- `read` keeps the password out of your shell history.

The first dump downloads a Postgres Docker image and can take a few minutes. To check that it worked:

```bash
grep -c "CREATE TABLE" supabase/migrations/00000000000000_remote_baseline.sql
```

The count should be at least 13: the 7 core tables plus the 6 email and invitation tables.

The file name starts with zeros so it runs before every other migration. This copies the schema
only, never data, and doesn't use `supabase link`, so the folder isn't left connected to production.

## 3. Copy migrations production doesn't have yet

The schema copy already includes every migration applied to production. Only copy migrations that
production doesn't have yet. These are usually migrations merged to `main` but not yet deployed,
plus the one you're working on.

To check a migration, search the schema copy for something that migration adds: a new table,
function, or column. For example, the late waitlist migration adds `allow_late_waitlist`:

```bash
cd ~/brh-local-db
grep -c "allow_late_waitlist" supabase/migrations/00000000000000_remote_baseline.sql
```

- Count above 0: production already has it. Don't copy it.
- Count is 0: copy it from the repo.

```bash
cp ~/path/to/Registration-Site/supabase/migrations/20260921000000_late_waitlist.sql supabase/migrations/
```

If a migration only replaces an existing function, a name search can't tell you. Check the README
or ask whoever deployed it.

## 4. Add test data

Create `~/brh-local-db/supabase/seed.sql`, next to `config.toml`. **Not in `migrations/`**: the CLI
skips files there unless the name starts with a timestamp, so the seed would never run. It runs
automatically after the migrations. Every account uses the password `LocalTestingOnly123!`.

```sql
-- Local test data only. Every account uses the password LocalTestingOnly123!
-- To add an applicant, add a row below and run `supabase db reset --local`.
DO $$
BEGIN
  CREATE TEMP TABLE seed_people AS
  SELECT ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid AS id, *
  FROM (VALUES
    -- n  email                        name              draft        released      RSVP        expired checked in application
    ( 1, 'admin@brh.test',             'Admin',          NULL,        NULL,         NULL,       false,  false,     false),
    ( 2, 'pending@brh.test',           'Pending',        'pending',   NULL,         NULL,       false,  false,     true),
    ( 3, 'submitted@brh.test',         'Submitted',      'submitted', NULL,         NULL,       false,  false,     true),
    ( 4, 'draft-approved@brh.test',    'Draft Approved', 'approved',  NULL,         NULL,       false,  false,     true),
    ( 5, 'draft-waitlisted@brh.test',  'Draft Waitlist', 'waitlisted',NULL,         NULL,       false,  false,     true),
    ( 6, 'draft-rejected@brh.test',    'Draft Rejected', 'rejected',  NULL,         NULL,       false,  false,     true),
    ( 7, 'invited@brh.test',           'Invited',        'approved',  'approved',   NULL,       false,  false,     true),
    ( 8, 'accepted@brh.test',          'Accepted',       'approved',  'approved',   'accepted', false,  false,     true),
    ( 9, 'declined@brh.test',          'Declined',       'approved',  'approved',   'declined', false,  false,     true),
    (10, 'expired@brh.test',           'Expired',        'rejected',  'rejected',   'declined', true,   false,     true),
    (11, 'waitlisted@brh.test',        'Waitlisted',     'waitlisted','waitlisted', NULL,       false,  false,     true),
    (12, 'rejected@brh.test',          'Rejected',       'rejected',  'rejected',   NULL,       false,  false,     true),
    (13, 'changed@brh.test',           'Changed Draft',  'approved',  'waitlisted', NULL,       false,  false,     true),
    (14, 'checked-in@brh.test',        'Checked In',     'approved',  'approved',   'accepted', false,  true,      true),
    (15, 'no-application@brh.test',    'No Application', NULL,        NULL,         NULL,       false,  false,     false)
  ) AS v(n, email, first_name, status, released_status, response, expired, checked_in, has_application);

  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    phone_change, phone_change_token, email_change_token_current, reauthentication_token)
  SELECT '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
    extensions.crypt('LocalTestingOnly123!', extensions.gen_salt('bf')), now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}', '', '', '', '', '', '', '', ''
  FROM seed_people;

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at)
  SELECT gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email), 'email',
    now(), now(), now()
  FROM seed_people;

  INSERT INTO public.admin_users (user_id) SELECT id FROM seed_people WHERE email = 'admin@brh.test';

  INSERT INTO public.invitation_settings (id, deadline) VALUES ('registration', now() + interval '14 days')
  ON CONFLICT (id) DO UPDATE SET deadline = excluded.deadline;

  INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', false)
  ON CONFLICT DO NOTHING;
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('email-templates', 'email-templates', false, 262144, ARRAY['text/html', 'application/json'])
  ON CONFLICT DO NOTHING;

  INSERT INTO public.form_configs (key, title, version, is_active)
  VALUES ('registration', 'BigRed//Hacks', 1, true);

  INSERT INTO public.registrations (user_id, form_key, form_version, answers, email, first_name,
    last_name, school, status, released_status, decision_released_at, invitation_response,
    invitation_responded_at, invitation_expired_at, checked_in, checked_in_at)
  SELECT id, 'registration', 1,
    jsonb_build_object('first_name', first_name, 'last_name', 'Test', 'email', email, 'school', 'Cornell University'),
    email, first_name, 'Test', 'Cornell University', status, released_status,
    CASE WHEN released_status IS NOT NULL THEN now() - interval '2 days' END,
    response,
    CASE WHEN response IS NOT NULL THEN now() - interval '1 day' END,
    CASE WHEN expired THEN now() - interval '1 day' END,
    checked_in,
    CASE WHEN checked_in THEN now() END
  FROM seed_people WHERE has_application;
END $$;
```

| Account | What it tests |
| --- | --- |
| `admin@brh.test` | Admin access (the only account in `admin_users`) |
| `pending@`, `submitted@` | Undecided applications, including the legacy `submitted` status |
| `draft-approved@`, `draft-waitlisted@`, `draft-rejected@` | Saved but unreleased decisions. The applicant still sees **Under review** |
| `invited@` | Released approval with no RSVP yet. Can accept or decline |
| `accepted@`, `declined@` | Released approval with an RSVP |
| `expired@` | Invitation that expired after the deadline |
| `waitlisted@`, `rejected@` | Released waitlist and rejection |
| `changed@` | Draft changed after release, so it shows in **Ready to release** |
| `checked-in@` | Accepted and checked in |
| `no-application@` | Account with no application, for the Users directory |

All emails end in `@brh.test`. To add an applicant, add a row to the `VALUES` list with an unused
number, then run `supabase db reset --local`. The database requires a release time for every
released decision and a response time for every RSVP; the seed fills both in automatically.

An account is an admin only if it has a row in `admin_users`.

A schema-only dump keeps tables but drops their rows. That includes rows the app needs, such as
`invitation_settings` and the Storage buckets. If a feature fails locally because a required row is
missing, add that row to `seed.sql`.

The seeded accounts don't need a `profiles` row. Saving a profile creates it if it's missing.

Production's Storage policies aren't copied. The backend reaches Storage with the service role key,
which ignores those policies, and the frontend never calls Storage directly, so they don't affect
local testing.

If the seed fails with a "null value violates not-null constraint" error, production has a required
column this seed doesn't set. Add a value for it.

## 5. Start Supabase

In `~/brh-local-db`:

```bash
supabase start      # the first run downloads several GB
supabase status     # shows local URLs and keys
```

| Service | Address |
| --- | --- |
| API and Auth | http://127.0.0.1:54321 |
| PostgreSQL | 127.0.0.1:54322 |
| Studio | http://127.0.0.1:54323 |
| Auth email inbox | http://127.0.0.1:54324 |

To rebuild the database from scratch (deletes all local data):

```bash
supabase db reset --local
```

The seed only runs when the database is first created, or on `db reset`. If you create or change
`seed.sql` after the first `supabase start`, run `db reset --local`.

Check that the seed worked before moving on: open Studio at http://127.0.0.1:54323 and go to
**Authentication**. You should see 15 accounts, including `admin@brh.test`.

If you have `psql` installed, you can check from the terminal instead:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select email from auth.users"
```

## 6. Point the app at it

In the `Registration-Site` repo, not `~/brh-local-db`.

Keep your existing `.env` files for the hosted project. Put the local values in a new file named
`.env.localdb.local` in both `backend/` and `frontend/`. Git already ignores that name.

`backend/.env.localdb.local`:

```dotenv
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SECRET_KEY=<Secret key from supabase status>
EMAIL_DELIVERY_ENABLED=false
RESEND_API_KEY=
```

`frontend/.env.localdb.local`:

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<Publishable key from supabase status>
VITE_API_PROXY_TARGET=http://localhost:3000
```

`supabase status` shows a **Secret key** (`sb_secret_…`, backend only) and a **Publishable key**
(`sb_publishable_…`, frontend). Older docs call these the service role key and the anon key. If you
need the older-style keys, `supabase status -o env` lists them as `SERVICE_ROLE_KEY` and `ANON_KEY`.

Don't set `PORT` in the backend file, so the backend runs on 3000. Keep the `VITE_API_PROXY_TARGET`
line in the frontend file even though 3000 is the default: in `localdb` mode Vite still loads
`frontend/.env` first, and a hosted setup often points the proxy at another port there, such as
5001.

Start the app:

```bash
npm run dev:localdb
```

Open http://localhost:5173/login and sign in as `admin@brh.test`.

To go back to the hosted project, use `npm run dev`.

To run the two halves separately, use two terminals in `Registration-Site`:

```bash
DOTENV_CONFIG_PATH=.env.localdb.local npm run dev -w backend
```

```bash
npm run dev -w frontend -- --mode localdb
```

`dev:localdb`, `email:worker:localdb`, and the backend command above only work in Mac and Linux
shells. In Windows PowerShell, start the backend with:

```powershell
$env:DOTENV_CONFIG_PATH = ".env.localdb.local"; npm run dev -w backend
```

The frontend command is the same on every system.

How this works:

- The backend loads its env file with `dotenv`, which reads the file named in `DOTENV_CONFIG_PATH`
  instead of `.env`. The path is relative to `backend/`. It loads only that file, so nothing from
  `backend/.env` leaks in.
- Vite loads `.env.localdb.local` only in `localdb` mode. It still loads `frontend/.env` too, and
  keys in `.env.localdb.local` override the same keys there. Any key you don't set locally keeps its
  hosted value.
- Don't use `.env.local` for local values. Vite loads `frontend/.env.local` in every mode, so it
  would also override your hosted values.
- Shell variables override every env file. If `echo $SUPABASE_URL` prints anything, run
  `unset SUPABASE_URL` first.

## Using it

### Call admin APIs

From any folder:

```bash
ANON=<Publishable key from supabase status>
TOKEN=$(curl -s "http://127.0.0.1:54321/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"email":"admin@brh.test","password":"LocalTestingOnly123!"}' | jq -r .access_token)

curl -s http://localhost:3000/api/admin/me -H "Authorization: Bearer $TOKEN" | jq
```

| File | Path |
| --- | --- |
| `admin.ts` | `/api/admin` |
| `adminApprovals.ts` | `/api/admin/approval` |
| `adminEmails.ts` | `/api/admin/emails` |
| `adminInvitations.ts` | `/api/admin/invitations` |
| `adminReleaseEmails.ts` | `/api/admin/emails/releases` |
| `adminAnnouncements.ts` | `/api/admin/emails/announcements` |
| `adminTeams.ts` | `/api/teams` |

### Test emails

Releasing decisions adds rows to `email_outbox`. The worker processes them in a single pass and then
exits. Run it from `Registration-Site`:

```bash
npm run email:worker:localdb
```

Don't use `npm run email:worker -w backend` here. It reads `backend/.env` and runs against the hosted
project.

While `EMAIL_DELIVERY_ENABLED=false`, the worker doesn't send anything, but it still updates the
database. Check the results in Studio:

```sql
SELECT id, kind, recipient, state, attempts, last_error FROM email_outbox ORDER BY created_at DESC;
```

The inbox at port 54324 only receives Supabase Auth emails such as signup and password reset.

### Test new signups (optional)

The seeded accounts are enough for everything else. Only do this if you're testing the signup page.

In production, a trigger on `auth.users` creates a `profiles` row for each new account. The schema
dump leaves it out. To copy it, run this in the production SQL editor:

```sql
SELECT pg_get_triggerdef(oid) || ';'
FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal;
```

Save the output to `~/brh-local-db/supabase/migrations/00000000000001_signup_trigger.sql`, then run
`supabase db reset --local`. The function the trigger calls is in `public`, so the schema copy
already has it.

### Test a migration

1. Write the migration in the repo's `supabase/migrations/`.
2. Copy it to `~/brh-local-db/supabase/migrations/`.
3. In `~/brh-local-db`, run `supabase db reset --local`.

Repeat steps 2 and 3 after every edit. The local folder doesn't see changes made in the repo.

`db reset` starts from an empty database, so it confirms the schema builds but not that existing
rows survive. To check that, add rows, apply the migration, and compare. Then add a PGlite test so
CI covers it.

## Starting and stopping

**Stop:** press Ctrl+C in the `npm run dev:localdb` terminal, then in `~/brh-local-db`:

```bash
supabase stop
```

Always use `supabase stop` rather than just quitting Docker. If you only quit Docker, the containers
restart the next time Docker opens, and they hold the ports, which blocks other Supabase projects.
Never add `--no-backup`: it deletes your local data.

**Start again:** open Docker Desktop, wait until `docker info` works, then in `~/brh-local-db`:

```bash
supabase start
```

Your data and accounts are still there. The seed doesn't run again, so use `supabase db reset --local`
if you want a clean database.

**Check what's running:** `supabase status` in `~/brh-local-db`, or
`docker ps --format "table {{.Names}}\t{{.Status}}" | grep supabase` for every project.

## Keeping it up to date

The app code is always current, because the app runs from the repo. The local database is not.

- The schema copy doesn't change when production does. Repeat steps 2 and 3 after any production
  schema change.
- When a copied migration is deployed to production and you've taken a new schema copy, delete it
  from `~/brh-local-db/supabase/migrations/`.
- If a migration adds a required column or row, update `seed.sql`.

Usually, an outdated setup makes `db reset --local` fail rather than quietly return wrong results.

## Local stack troubleshooting

| Problem | Fix |
| --- | --- |
| `failed to open dump file: … no such file or directory` | Run `mkdir -p supabase/migrations` in `~/brh-local-db` |
| `Cannot connect to the Docker daemon` | Start Docker Desktop and wait until `docker info` works |
| `db dump` hangs | Use the session pooler URL on port 5432 |
| `db dump` can't parse the URL | Percent-encode the password |
| `db dump` says authentication failed | Wrong database password. Ask the project owner; don't reset it |
| `db reset` fails on a duplicate object | That migration is already in the schema copy. Delete it from the local folder |
| `db reset` fails on a missing object | The schema copy is out of date, or a needed migration wasn't copied |
| Seed fails on a not-null constraint | Add a value for that column in `seed.sql` |
| Invitation or email pages fail | A required row is missing. Check `invitation_settings` has a `registration` row |
| `http proxy error … ECONNREFUSED` right after starting, before `[backend] Server running` | Harmless. Vite starts before the backend finishes compiling, and an open tab calls the API too early. Refresh once the backend is up |
| "Couldn't verify admin access", and Vite logs `http proxy error … ECONNREFUSED` | If the errors continue after `Server running`, the proxy points at the wrong port, usually from `frontend/.env`. Add `VITE_API_PROXY_TARGET=http://localhost:3000` to `frontend/.env.localdb.local` and restart |
| Admin page shows the fake preview data, and the URL ends in `.html` | You're in the preview. In development, **View as applicant** above **Admin** opens it, and Admin then stays in the preview. Go to `localhost:5173/admin` or click **Exit preview** |
| `localhost:5173` shows a different app | Another dev server holds port 5173. Find it with `lsof -nP -iTCP:5173 -sTCP:LISTEN` and stop it. Vite may not switch ports on its own, because it can still claim the IPv6 address |
| Login says invalid credentials | The seed didn't run. Check `seed.sql` is in `supabase/`, not `supabase/migrations/`, then run `supabase db reset --local` |
| Admin pages return 403 | The account has no `admin_users` row |
| A new signup has no profile | Copy the signup trigger (see *Test new signups*) |
| Resume upload or template save fails | The bucket rows are missing from `seed.sql` (step 4) |
| App shows production data | Start with `npm run dev:localdb`, not `npm run dev`, and check no `SUPABASE_*` shell variable is set |
| `supabase start` fails with `port is already allocated` | Another Supabase project is running. `docker ps` shows its name; stop it with `supabase stop --project-id <name>` |
| `supabase start` fails pulling an image (`context deadline exceeded`) | Network timeout. Run it again. Skip unused services with `supabase start -x edge-runtime` |
| `git status` shows new files under `supabase/` | The CLI was run in the repo. Delete them and use `~/brh-local-db` |
