const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
process.env.SUPABASE_URL = 'https://form-compatibility-test.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-only-key';
delete process.env.RESEND_API_KEY;
require('ts-node').register({ project: path.resolve(__dirname, '../../tsconfig.json'), transpileOnly: true });
const admin = require('./admin.ts').default;
const publicForms = require('./formConfigs.ts').default;
const { supabase } = require('../config/supabase.ts');
const original = { key: 'registration', title: 'Existing form', version: 1, is_active: true,
  fields: [{ id: 'first_name', label: 'First name', type: 'text', required: true }], updated_by: 'private-admin' };
let rows;
let migrated;
let readError;
test.beforeEach(() => { rows = [{ ...original }]; migrated = false; readError = false; });
supabase.from = (table) => {
  assert.equal(table, 'form_configs');
  let columns = '*', key, payload, operation;
  const result = (single = false) => {
    const missing = !migrated && (columns.includes('closes_') || Object.entries(payload ?? {}).some(([name, value]) => name.startsWith('closes_') && value !== undefined));
    if (missing) return { data: null, error: { code: 'PGRST204', message: "Could not find the 'closes_at' column of 'form_configs' in the schema cache" } };
    if (readError) return { data: null, error: { code: 'XX000', message: 'Database unavailable' } };
    let row = rows.find(row => row.key === key);
    if (operation === 'insert') { row = JSON.parse(JSON.stringify(payload)); rows.push(row); }
    if (operation === 'update') Object.assign(row, JSON.parse(JSON.stringify(payload)));
    const project = row => columns === '*' ? { ...row } : Object.fromEntries(columns.split(',').map(name => name.trim()).map(name => [name, row[name]]));
    return { data: single ? (row ? project(row) : null) : rows.map(project), error: null };
  };
  const builder = {
    select(value = '*') { columns = value; return builder; },
    eq(name, value) { if (name === 'key') key = value; return builder; },
    order() { return builder; },
    insert(value) { operation = 'insert'; payload = value; return builder; },
    update(value) { operation = 'update'; payload = value; return builder; },
    async maybeSingle() { return result(true); },
    async single() { return result(true); },
    then(resolve) { return Promise.resolve(result()).then(resolve); },
  };
  return builder;
};
async function request(router, method, route, body = {}, key = 'registration') {
  const layer = router.stack.find(entry => entry.route?.path === route && entry.route.methods[method]);
  const req = { body, params: { key }, query: {}, user: { id: 'admin' } };
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  for (const entry of layer.route.stack) {
    let next = false;
    await entry.handle(req, res, () => { next = true; });
    if (!next) break;
  }
  return res;
}
test('legacy forms remain discoverable and retain editor fields without deadline columns', async () => {
  for (const [router, route] of [[admin, '/form-configs'], [publicForms, '/']]) {
    const response = await request(router, 'get', route);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body[0].key, 'registration');
    assert.equal(response.body[0].deadline_supported, false);
    assert.equal(response.body[0].is_closed, false);
    assert.equal(response.body[0].closes_at, null);
    assert.equal('updated_by' in response.body[0], false);
  }
  const detail = await request(admin, 'get', '/form-configs/:key');
  assert.deepEqual(detail.body.fields, original.fields);
  assert.equal(detail.body.deadline_supported, false);
});
test('legacy forms can be edited and new forms created without a deadline', async () => {
  const edit = await request(admin, 'put', '/form-configs/:key', { title: 'Updated', fields: original.fields });
  assert.equal(edit.statusCode, 200);
  assert.equal(edit.body.title, 'Updated');
  assert.equal(edit.body.version, 2);
  const created = await request(admin, 'post', '/form-configs', { key: 'new', title: 'New', fields: original.fields });
  assert.equal(created.statusCode, 201);
  assert.equal(created.body.deadline_supported, false);
});
test('deadline writes fail clearly before migration without applying any other changes', async () => {
  const response = await request(admin, 'put', '/form-configs/:key', { title: 'Must not save', closes_at: '2026-09-30T00:00:00Z' });
  assert.equal(response.statusCode, 500);
  assert.match(response.body.error, /20260905_registration_closure.sql/);
  assert.equal(rows[0].title, original.title);
});
test('migrated forms expose and save deadlines normally', async () => {
  migrated = true;
  Object.assign(rows[0], { closes_at: null, closes_timezone: 'America/New_York' });
  const response = await request(admin, 'put', '/form-configs/:key', { closes_at: '2020-01-01T00:00:00Z', closes_timezone: 'UTC' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.deadline_supported, true);
  assert.equal(response.body.is_closed, true);
  assert.equal(response.body.closes_timezone, 'UTC');
});
test('real database failures remain errors instead of empty form lists', async () => {
  readError = true;
  const response = await request(admin, 'get', '/form-configs');
  assert.equal(response.statusCode, 500);
  assert.equal(response.body.error, 'Database unavailable');
});
