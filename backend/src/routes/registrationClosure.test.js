const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// Route tests use an in-memory Supabase adapter and never contact a database.
process.env.SUPABASE_URL = 'https://registration-deadline-test.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-only-key';
delete process.env.RESEND_API_KEY;
require('ts-node').register({ project: path.resolve(__dirname, '../../tsconfig.json'), transpileOnly: true });
const router = require('./registrations.ts').default;
const { supabase } = require('../config/supabase.ts');

const registration = { id: 1, user_id: 'student', form_key: 'registration', status: 'pending', email: 'student@example.com' };
let admin = false;
let closesAt = '2020-01-01T00:00:00Z';
let active = true;
let writes = [];

supabase.from = (table) => {
  let payload;
  const builder = {
    select() { return builder; },
    eq() { return builder; },
    order() { return builder; },
    update(data) { payload = data; writes.push({ table, kind: 'update', payload }); return builder; },
    insert(data) { payload = data; writes.push({ table, kind: 'insert', payload }); return builder; },
    delete() { writes.push({ table, kind: 'delete' }); return builder; },
    async maybeSingle() {
      if (table === 'form_configs') return { data: {
        key: 'registration', title: 'Registration', version: 1, is_active: active, closes_at: closesAt,
        fields: [{ id: 'first_name', type: 'text', label: 'First name', required: true }],
      }, error: null };
      if (table === 'admin_users') return { data: admin ? { user_id: 'student' } : null, error: null };
      return { data: registration, error: null };
    },
    async single() { return { data: { ...registration, ...payload }, error: null }; },
    then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); },
  };
  return builder;
};
supabase.storage.from = () => ({
  async createSignedUploadUrl() { writes.push({ kind: 'upload-url' }); return { data: { signedUrl: 'unused' }, error: null }; },
});

async function request(method, routePath, body = {}) {
  const layer = router.stack.find((entry) => entry.route?.path === routePath && entry.route.methods[method]);
  assert.ok(layer, `Route exists: ${method} ${routePath}`);
  const req = { body, params: { id: '1' }, query: {}, user: { id: 'student', email: 'student@example.com' } };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    send(value) { this.body = value; return this; },
  };
  for (const entry of layer.route.stack) {
    let next = false;
    await entry.handle(req, res, () => { next = true; });
    if (!next) break;
  }
  return res;
}

test('closed registrations reject every student write path before any database or storage mutation', async () => {
  admin = false;
  closesAt = '2020-01-01T00:00:00Z';
  active = true;
  writes = [];
  for (const [method, route, body] of [
    ['post', '/', { first_name: 'Student' }],
    ['put', '/me', { first_name: 'Student' }],
    ['put', '/:id', { answers: { first_name: 'Student' } }],
    ['put', '/:id', { first_name: 'Student', form_key: 'another-form' }],
    ['post', '/me/resume', { resume_path: 'student/resume.pdf' }],
    ['post', '/me/resume-upload-url', { filename: 'resume.pdf' }],
    ['delete', '/:id', {}],
  ]) {
    const res = await request(method, route, body);
    assert.equal(res.statusCode, 403, `${method} ${route}`);
    assert.equal(res.body.code, 'REGISTRATION_CLOSED');
  }
  assert.deepEqual(writes, []);
});

test('closed registrations remain readable and admin edits remain available', async () => {
  closesAt = '2020-01-01T00:00:00Z';
  active = true;
  admin = false;
  writes = [];
  const read = await request('get', '/me');
  assert.equal(read.statusCode, 200);
  assert.equal(read.body.status, 'pending');
  assert.deepEqual(writes, []);
  admin = true;
  const edit = await request('put', '/:id', { answers: { first_name: 'Corrected' } });
  assert.equal(edit.statusCode, 200);
  assert.equal(writes[0].payload.first_name, 'Corrected');
});

test('open owner updates cannot change approval, ownership, or move to a different form', async () => {
  admin = false;
  closesAt = null;
  active = true;
  writes = [];
  const response = await request('put', '/:id', {
    first_name: 'Updated', status: 'approved', user_id: 'other-student', form_key: 'closed-form', checked_in: true,
  });
  assert.equal(response.statusCode, 200);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].payload.first_name, 'Updated');
  for (const key of ['status', 'user_id', 'form_key', 'checked_in']) assert.equal(key in writes[0].payload, false);
});

test('clearing a deadline reopens active student editing while inactive forms remain unavailable', async () => {
  admin = false;
  closesAt = null;
  active = true;
  writes = [];
  assert.equal((await request('put', '/me', { first_name: 'Updated' })).statusCode, 200);
  assert.equal(writes.length, 1);
  active = false;
  writes = [];
  assert.equal((await request('put', '/me', { first_name: 'Updated' })).statusCode, 404);
  assert.deepEqual(writes, []);
});
