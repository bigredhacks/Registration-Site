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
let allowLateWaitlist = false;
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
        key: 'registration', title: 'Registration', version: 1, is_active: active, closes_at: closesAt, allow_late_waitlist: allowLateWaitlist,
        fields: [{ id: 'first_name', type: 'text', label: 'First name', required: true }],
      }, error: null };
      if (table === 'admin_users') return { data: admin ? { user_id: 'student' } : null, error: null };
      return { data: registration, error: null };
    },
    async single() { return { data: { ...registration, ...payload }, error: null }; },
    then(resolve) { return Promise.resolve({ data: table === 'registrations' ? [registration] : [], error: null }).then(resolve); },
  };
  return builder;
};
supabase.storage.from = () => ({
  async createSignedUploadUrl() { writes.push({ kind: 'upload-url' }); return { data: { signedUrl: 'unused' }, error: null }; },
});

async function request(method, routePath, body = {}, options = {}) {
  const layer = router.stack.find((entry) => entry.route?.path === routePath && entry.route.methods[method]);
  assert.ok(layer, `Route exists: ${method} ${routePath}`);
  const req = { body, params: { id: '1' }, query: {}, user: { id: 'student', email: 'student@example.com' }, ...options };
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

test('all owner read and update responses hide draft decisions while preserving released status', async () => {
  admin = false; active = true; closesAt = null;
  Object.assign(registration, { status: 'approved', released_status: null, invitation_response: null });
  for (const [method, route, body] of [
    ['get', '/me', {}], ['get', '/:id', {}], ['get', '/me/all', {}],
    ['put', '/me', { first_name: 'Student' }], ['put', '/:id', { first_name: 'Student' }],
    ['post', '/me/resume', { resume_path: 'student/resume.pdf' }],
  ]) {
    const response = await request(method, route, body);
    assert.equal(response.statusCode, 200, route);
    const row = Array.isArray(response.body) ? response.body[0] : response.body;
    assert.equal(row.status, 'pending', route);
    assert.equal('released_status' in row, false, route);
  }
  registration.released_status = 'waitlisted';
  assert.equal((await request('get', '/me')).body.status, 'waitlisted');
  registration.form_key = 'workshop';
  assert.equal((await request('get', '/me')).body.status, 'approved');
  registration.form_key = 'registration';
});

test('answer and generic admin edits cannot overwrite release or RSVP fields', async () => {
  active = true; closesAt = null; admin = false; writes = [];
  await request('put', '/me', { first_name: 'Student', status: 'rejected', invitation_response: 'declined' });
  assert.equal('status' in writes[0].payload, false);
  assert.equal('invitation_response' in writes[0].payload, false);
  admin = true; writes = [];
  const response = await request('put', '/:id', {
    checked_in: true, released_status: 'approved', decision_released_at: null,
    invitation_response: 'accepted', invitation_responded_at: null,
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(writes[0].payload, { checked_in: true });
});

test('RSVP uses authenticated ownership, permits closed/inactive forms, and maps database outcomes', async () => {
  admin = false; active = false; closesAt = '2020-01-01T00:00:00Z'; writes = [];
  let calls = [];
  let failure = null;
  supabase.rpc = (name, args) => {
    calls.push({ name, args });
    return { async single() { return { data: { ...registration, released_status: 'approved', invitation_response: 'accepted' }, error: failure }; } };
  };
  const success = await request('put', '/me/invitation-response', { response: 'accepted' });
  assert.equal(success.statusCode, 200);
  assert.equal(success.body.status, 'approved');
  assert.equal(success.body.invitation_response, 'accepted');
  assert.equal('released_status' in success.body, false);
  assert.deepEqual(calls, [{ name: 'respond_to_registration_invitation', args: { p_user_id: 'student', p_response: 'accepted' } }]);
  assert.deepEqual(writes, []);
  calls = [];
  for (const body of [{}, { response: 'approved' }, { response: 'accepted', user_id: 'someone-else' }, { response: 'accepted', invitation_responded_at: '2000-01-01' }]) {
    assert.equal((await request('put', '/me/invitation-response', body)).statusCode, 400);
  }
  assert.equal((await request('put', '/me/invitation-response', { response: 'accepted' }, { query: { form_key: 'workshop' } })).statusCode, 400);
  assert.equal(calls.length, 0);
  for (const [code, expected] of [['PT400', 400], ['PT404', 404], ['PT409', 409], ['XX000', 500]]) {
    failure = { code, message: 'Database detail' };
    const response = await request('put', '/me/invitation-response', { response: 'accepted' });
    assert.equal(response.statusCode, expected);
    if (expected === 500) assert.notEqual(response.body.error, failure.message);
  }
});

 test('new submissions keep first names required and atomically request a confirmation', async () => {
  active = true; closesAt = null; admin = false; writes = [];
  const originalFrom = supabase.from;
  supabase.from = table => {
    const query = originalFrom(table);
    if (table === 'registrations') query.maybeSingle = async () => ({ data: null, error: null });
    return query;
  };
  const calls = [];
  supabase.rpc = (name, args) => {
    calls.push({ name, args });
    return { async single() { return { data: { ...registration, ...args.p_registration }, error: null }; } };
  };
  try {
    for (const body of [{}, { first_name: '' }, { first_name: '  ' }]) assert.equal((await request('post', '/', body)).statusCode, 400);
    assert.equal(calls.length, 0);
    assert.equal((await request('post', '/', { first_name: ' Alex ', email: 'forged@example.com' })).statusCode, 201);
    assert.equal(calls[0].name, 'create_registration_with_email');
    assert.equal(calls[0].args.p_registration.first_name, 'Alex');
    assert.equal(calls[0].args.p_registration.email, 'student@example.com');
    assert.equal(writes.length, 0, 'no separate application write');
  } finally { supabase.from = originalFrom; }
});


test('waitlist intake requires explicit acknowledgement, validates answers, and keeps all existing edit paths closed', async () => {
  active = true; closesAt = '2020-01-01T00:00:00Z'; allowLateWaitlist = true; admin = false; writes = [];
  const originalFrom = supabase.from;
  supabase.from = table => {
    const query = originalFrom(table);
    if (table === 'registrations') query.maybeSingle = async () => ({ data: null, error: null });
    return query;
  };
  const calls = [];
  supabase.rpc = (name, args) => {
    calls.push({ name, args });
    return { async single() { return { data: { ...registration, ...args.p_registration, status: 'waitlisted', released_status: 'waitlisted' }, error: null }; } };
  };
  try {
    const unacknowledged = await request('post', '/', { first_name: 'Alex', waitlist_acknowledged: true });
    assert.equal(unacknowledged.statusCode, 412);
    assert.equal(unacknowledged.body.code, 'WAITLIST_ACKNOWLEDGEMENT_REQUIRED');
    assert.equal(unacknowledged.body.allow_late_waitlist, true);
    assert.equal(calls.length, 0);
    const options = { query: { waitlist: 'true' } };
    assert.equal((await request('post', '/', { first_name: '' }, options)).statusCode, 400);
    const saved = await request('post', '/', { first_name: 'Alex', status: 'approved', email: 'forged@example.com' }, options);
    assert.equal(saved.statusCode, 201);
    assert.equal(saved.body.status, 'waitlisted');
    assert.equal(calls[0].args.p_registration.waitlist_acknowledged, true);
    assert.equal(calls[0].args.p_registration.email, 'student@example.com');
    assert.equal(calls[0].args.p_registration.status, 'pending', 'database chooses initial decision');
    supabase.from = originalFrom;
    for (const [method, path, body] of [
      ['put', '/me', { first_name: 'Edit' }], ['put', '/:id', { first_name: 'Edit' }],
      ['post', '/me/resume-upload-url', {}], ['post', '/me/resume', { resume_path: 'student/resume.pdf' }], ['delete', '/:id', {}],
    ]) assert.equal((await request(method, path, body, options)).statusCode, 403, path);
    assert.deepEqual(writes, []);
    active = false;
    assert.equal((await request('post', '/', { first_name: 'Alex' }, options)).statusCode, 404);
  } finally { supabase.from = originalFrom; allowLateWaitlist = false; }
});

test('transaction-time closure refreshes intake metadata and distinguishes duplicates from changed forms', async () => {
  active = true; closesAt = null; allowLateWaitlist = true; admin = false;
  const originalFrom = supabase.from;
  supabase.from = table => {
    const query = originalFrom(table);
    if (table === 'registrations') query.maybeSingle = async () => ({ data: null, error: null });
    return query;
  };
  let failure;
  supabase.rpc = () => ({ async single() {
    closesAt = '2020-01-01T00:00:00Z';
    return { data: null, error: { code: failure, message: 'Transaction rejected' } };
  } });
  try {
    for (const [error, status, code] of [
      ['PT412', 412, 'WAITLIST_ACKNOWLEDGEMENT_REQUIRED'], ['PT403', 403, 'REGISTRATION_CLOSED'],
      ['PT409', 409, 'FORM_CHANGED'], ['23505', 409, 'REGISTRATION_EXISTS'],
    ]) {
      closesAt = null; failure = error;
      const response = await request('post', '/', { first_name: 'Alex' });
      assert.equal(response.statusCode, status);
      assert.equal(response.body.code, code);
      if (status !== 409) {
        assert.equal(response.body.closes_at, closesAt);
        assert.equal(response.body.allow_late_waitlist, true);
        assert.ok(response.body.server_now);
      }
    }
  } finally { supabase.from = originalFrom; allowLateWaitlist = false; }
});
