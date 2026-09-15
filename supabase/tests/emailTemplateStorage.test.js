const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
let db;
const admin = '00000000-0000-4000-8000-000000000009';
const file = n => `approved/00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const activate = (version, n=1, user=admin) => db.query('SELECT to_jsonb(activate_email_template_files($1,$2,$3,$4)) AS value',['approved',file(n),version,user]).then(result=>result.rows[0].value);
test.before(async () => {
  db = await PGlite.create();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE TABLE admin_users(user_id uuid PRIMARY KEY); INSERT INTO admin_users VALUES('${admin}');
    CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(bucket_id text,name text); ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE POLICY legacy_broad_access ON storage.objects FOR ALL USING(true) WITH CHECK(true);
    GRANT USAGE ON SCHEMA public,storage TO anon,authenticated,service_role;
    GRANT SELECT,INSERT ON storage.objects TO anon,authenticated,service_role;
    GRANT SELECT ON admin_users TO service_role;
    CREATE FUNCTION save_email_template(text,text,text,text,integer,uuid) RETURNS void LANGUAGE sql AS 'SELECT';
    REVOKE EXECUTE ON FUNCTION save_email_template(text,text,text,text,integer,uuid) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION save_email_template(text,text,text,text,integer,uuid) TO service_role;`);
  await db.exec(fs.readFileSync(path.join(__dirname,'../migrations/20260915020000_email_template_storage.sql'),'utf8'));
});
test.after(async()=>db?.close());
test.beforeEach(async()=>db.exec('RESET ROLE; TRUNCATE email_template_files,storage.objects; SET ROLE service_role;'));
test('Storage revisions activate with version checks and store metadata only', async()=>{
  assert.equal((await activate(0)).version,1);
  await assert.rejects(activate(0,2),/template changed/);
  assert.equal((await activate(1,2)).storage_path,file(2));
  const {rows} = await db.query('SELECT * FROM email_template_files');
  assert.deepEqual(Object.keys(rows[0]).sort(), ['kind','storage_path','updated_at','updated_by','version']);
  await assert.rejects(activate(2,3,'00000000-0000-4000-8000-000000000001'),/Admin access/);
  await assert.rejects(db.query("SELECT activate_email_template_files('approved','../outside',2,$1)",[admin]),/Invalid template/);
});
test('private bucket rejects browser access even with a preexisting broad Storage policy', async()=>{
  await db.exec("INSERT INTO storage.objects VALUES('email-templates','approved/template.html'),('other','public.txt')");
  for(const role of ['anon','authenticated']) {
    await db.exec(`RESET ROLE; SET ROLE ${role};`);
    assert.deepEqual((await db.query('SELECT name FROM storage.objects')).rows,[{name:'public.txt'}]);
    await assert.rejects(db.query("INSERT INTO storage.objects VALUES('email-templates','bad.html')"),/row-level security/);
    await assert.rejects(db.query('SELECT * FROM email_template_files'),/permission denied/);
    await assert.rejects(activate(0),/permission denied/);
  }
  await db.exec('RESET ROLE');
  assert.equal((await db.query("SELECT public FROM storage.buckets WHERE id='email-templates'")).rows[0].public,false);
});
