const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
let db;
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const list = async (args = {}) => {
  const keys = Object.keys(args);
  const sql = keys.map((key, i) => `p_${key} => $${i + 1}`).join(',');
  return (await db.query(`SELECT public.admin_list_users(${sql}) AS result`, Object.values(args))).rows[0].result;
};
const detail = async (id, form = 'registration') => (await db.query('SELECT public.admin_user_detail($1,$2) AS result', [id, form])).rows[0].result;
const progress = async profile => (await db.query('SELECT * FROM public.admin_user_profile_progress($1)', [JSON.stringify(profile)])).rows[0];
const snapshot = async () => (await db.query(`SELECT
  (SELECT jsonb_agg(to_jsonb(u) ORDER BY id) FROM auth.users u) AS users,
  (SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM profiles p) AS profiles,
  (SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM registrations r) AS registrations`)).rows[0];
test.before(async () => {
  db = await PGlite.create();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,created_at timestamptz,email_confirmed_at timestamptz,last_sign_in_at timestamptz,
      raw_user_meta_data jsonb,encrypted_password text DEFAULT 'secret');
    CREATE TABLE profiles(id uuid PRIMARY KEY REFERENCES auth.users,first_name text,last_name text,full_name text,school text,
      phone_number text,age_range text,graduation_year integer,country text,level_of_study text,major text,gender text,
      dietary_restrictions text[],shirt_size text,linkedin text,private_note text DEFAULT 'private');
    CREATE TABLE registrations(id bigint PRIMARY KEY,user_id uuid REFERENCES auth.users,form_key text,created_at timestamptz,
      first_name text,last_name text,email text,school text,answers jsonb,status text,resume_path text,private_note text DEFAULT 'private',
      UNIQUE(user_id,form_key));
    GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
    INSERT INTO auth.users(id,email,created_at) VALUES ('${uid(1)}','account@example.com','2026-09-20T00:00:00Z');`);
  const before = await snapshot();
  await db.exec(fs.readFileSync(path.join(__dirname, '../migrations/20260920000000_admin_users_directory.sql'), 'utf8'));
  assert.deepEqual(await snapshot(), before);
});
test.after(async () => db?.close());
test.beforeEach(async () => {
  await db.exec('RESET ROLE; TRUNCATE registrations,profiles,auth.users;');
  await db.exec(`INSERT INTO auth.users(id,email,created_at,email_confirmed_at,raw_user_meta_data) VALUES
    ('${uid(1)}','first@example.com','2026-09-20T00:00:00Z',NULL,'{}'),
    ('${uid(2)}','second@example.com','2026-09-20T23:59:59Z','2026-09-20T01:00:00Z','{"full_name":"OAuth Name","secret":"hidden"}'),
    ('${uid(3)}','third@example.com','2026-09-21T00:00:00Z',NULL,'{}'),
    ('${uid(4)}','fourth@example.com','2026-09-20T00:00:00Z',NULL,'{}');
    INSERT INTO profiles(id,first_name,last_name,school) VALUES ('${uid(2)}','Profile','Person','Cornell');
    INSERT INTO profiles(id) VALUES ('${uid(4)}');
    INSERT INTO registrations(id,user_id,form_key,created_at,first_name,email,school,answers,status) VALUES
      (1,'${uid(2)}','registration','2026-09-20T12:00:00Z','Application','old@example.com','Other School','{"custom":"saved answer"}','approved'),
      (2,'${uid(3)}','workshop','2026-09-20T12:00:00Z','Workshop','third@example.com','School','{}','pending');`);
});

test('all auth accounts survive missing profile/application joins and forms remain scoped', async () => {
  const result = await list({ sort: 'created_at', dir: 'asc' });
  assert.equal(result.count, 4);
  assert.deepEqual(result.data.map(row => row.user_id), [uid(1), uid(4), uid(2), uid(3)]);
  assert.equal(result.data[0].name, null);
  assert.equal(result.data[0].profile_state, 'not_started');
  assert.equal(result.data[1].profile_state, 'not_started');
  assert.equal(result.data[2].name, 'Profile Person');
  assert.equal(result.data[2].email, 'second@example.com');
  assert.equal(result.data[2].school, 'Cornell');
  assert.equal(result.data[2].registration_id, 1);
  assert.equal(result.data[3].registration_id, null);
  assert.deepEqual((await list({ submitted: true })).data.map(row => row.user_id), [uid(2)]);
  assert.deepEqual((await list({ form_key: 'workshop', submitted: true })).data.map(row => row.user_id), [uid(3)]);
  assert.equal((await list({ submitted: false })).count, 3);
});

test('profile progress uses exactly the dashboard fields and missing labels', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../../frontend/src/pages/registration/dashboard.tsx'), 'utf8');
  const block = source.match(/const PROFILE_FIELDS[\s\S]*?=\s*\[([\s\S]*?)\];/)[1];
  const fields = [...block.matchAll(/key:\s*"([^"]+)",\s*label:\s*"([^"]+)"/g)].map(match => [match[1], match[2]]);
  assert.equal(fields.length, 13);
  const complete = Object.fromEntries(fields.map(([key]) => [key, key === 'dietary_restrictions' ? ['None'] : 'value']));
  assert.deepEqual(await progress(complete), { profile_state: 'complete', profile_pct: 100, missing_profile_fields: [] });
  assert.equal((await progress(null)).profile_state, 'not_started');
  assert.deepEqual((await progress({})).missing_profile_fields, fields.map(([,label]) => label));
  for (const [key, label] of fields) {
    for (const empty of [undefined, null, '', []]) {
      assert.deepEqual(await progress({ ...complete, [key]: empty }), {
        profile_state: 'incomplete', profile_pct: 92, missing_profile_fields: [label],
      });
    }
  }
});

test('search, verification, profile state and UTC signup dates filter before counting and paging', async () => {
  assert.equal((await list({ q: 'PROFILE PERSON' })).count, 1);
  assert.equal((await list({ q: 'second@example.com', email_verified: true, profile_state: 'incomplete' })).count, 1);
  assert.equal((await list({ q: 'cornell' })).count, 0);
  assert.equal((await list({ q: 'old@example.com' })).count, 0);
  assert.equal((await list({ q: '%' })).count, 0);
  assert.equal((await list({ q: "' OR true --" })).count, 0);
  assert.equal((await list({ email_verified: false })).count, 3);
  assert.equal((await list({ from: '2026-09-20', to: '2026-09-20' })).count, 3);
  assert.equal((await list({ profile_state: 'not_started' })).count, 3);
  assert.deepEqual(await list({ q: 'Profile Person', offset: 5, limit: 1 }), { data: [], count: 1 });
});

test('pagination covers more than 1000 accounts with deterministic UUID tie-breaking', async () => {
  await db.exec(`INSERT INTO auth.users(id,email,created_at)
    SELECT ('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'user' || n || '@example.com','2026-09-22T00:00:00Z'
    FROM generate_series(10,1210) n;`);
  const page = await list({ offset: 1000, limit: 200 });
  assert.equal(page.count, 1205);
  assert.equal(page.data.length, 200);
  assert.equal(page.data[0].user_id, uid(1010));
  assert.equal(page.data[199].user_id, uid(1209));
  assert.deepEqual((await list({ offset: 1000, limit: 200 })).data, page.data);
});

test('name and school sorting support both directions with missing values last', async () => {
  await db.exec(`INSERT INTO profiles(id,first_name,school) VALUES ('${uid(1)}','alex','Yale');`);
  assert.deepEqual((await list({ sort: 'name', dir: 'asc' })).data.map(row => row.user_id), [uid(1), uid(2), uid(3), uid(4)]);
  assert.deepEqual((await list({ sort: 'name', dir: 'desc' })).data.map(row => row.user_id), [uid(2), uid(1), uid(3), uid(4)]);
  assert.deepEqual((await list({ sort: 'school', dir: 'asc' })).data.map(row => row.user_id), [uid(2), uid(1), uid(3), uid(4)]);
  assert.deepEqual((await list({ sort: 'school', dir: 'desc' })).data.map(row => row.user_id), [uid(1), uid(2), uid(3), uid(4)]);
});

test('detail is read-only, separates profile from application, and only exposes allowlisted fields', async () => {
  const before = await snapshot();
  const empty = await detail(uid(1));
  assert.equal(empty.profile, null);
  assert.equal(empty.application, null);
  const user = await detail(uid(2));
  assert.equal(user.account.name, 'Profile Person');
  assert.equal(user.account.email, 'second@example.com');
  assert.equal(user.profile.school, 'Cornell');
  assert.equal(user.application.school, 'Other School');
  assert.equal(user.application.email, 'old@example.com');
  assert.deepEqual(user.application.answers, { custom: 'saved answer' });
  assert.equal(user.profile.private_note, undefined);
  assert.equal(user.application.private_note, undefined);
  assert.equal(user.account.encrypted_password, undefined);
  assert.equal(user.account.raw_user_meta_data, undefined);
  assert.equal((await detail(uid(3))).application, null);
  assert.equal((await detail(uid(3), 'workshop')).application.id, 2);
  assert.equal(await detail(uid(9999)), null);
  await db.exec(`UPDATE profiles SET first_name=NULL,last_name=NULL WHERE id='${uid(2)}'`);
  assert.equal((await detail(uid(2))).account.name, 'OAuth Name');
  await db.exec(`UPDATE profiles SET first_name='Profile',last_name='Person' WHERE id='${uid(2)}'`);
  assert.deepEqual(await snapshot(), before);
});

test('browser roles cannot query directory RPCs or auth data; backend role can call narrow read RPCs', async () => {
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`SET ROLE ${role}`);
    await assert.rejects(list(), /permission denied/);
    await assert.rejects(detail(uid(1)), /permission denied/);
    await assert.rejects(progress({}), /permission denied/);
    await assert.rejects(db.query('SELECT * FROM auth.users'), /permission denied/);
    await db.exec('RESET ROLE');
  }
  await db.exec('SET ROLE service_role');
  assert.equal((await list()).count, 4);
  assert.equal((await detail(uid(1))).account.email, 'first@example.com');
  await assert.rejects(db.query('SELECT * FROM auth.users'), /permission denied/);
  await db.exec('RESET ROLE');
});
