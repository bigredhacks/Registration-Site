const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { Readable } = require('node:stream');
process.env.SUPABASE_URL = 'https://admin-users-test.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-only-key';
require('ts-node').register({ project: path.resolve(__dirname, '../../tsconfig.json'), transpileOnly: true });
const express = require('express');
const router = require('./index.ts').default;
const { supabase } = require('../config/supabase.ts');
const userId = '00000000-0000-4000-8000-000000000001';
let admin, calls, result;
supabase.auth.getUser = async () => ({ data: { user: { id: userId } }, error: null });
supabase.from = table => {
  assert.equal(table, 'admin_users');
  const query = { select() { return query; }, eq() { return query; }, async maybeSingle() {
    return { data: admin ? { user_id: userId } : null, error: null };
  } };
  return query;
};
supabase.rpc = async (name, params) => { calls.push({ name, params }); return result; };
function request(url, authenticated = true, method = 'GET') {
  const app = express();
  app.use('/api', router);
  const req = new Readable({ read() { this.push(null); } });
  req.url = `/api/admin/users${url}`;
  req.method = method;
  req.headers = authenticated ? { authorization: 'Bearer synthetic-token' } : {};
  return new Promise((resolve, reject) => {
    const res = { headers: {}, setHeader(name, value) { this.headers[name] = value; },
      getHeader(name) { return this.headers[name]; },
      end(body) { resolve({ status: this.statusCode, body: JSON.parse(body) }); } };
    app.handle(req, res, reject);
  });
}
test.beforeEach(() => { admin = true; calls = []; result = { data: { data: [], count: 0 }, error: null }; });

test('directory and account details enforce mounted authentication and admin membership', async () => {
  for (const url of ['', `/${userId}`]) {
    assert.equal((await request(url, false)).status, 401);
    admin = false;
    assert.equal((await request(url)).status, 403);
  }
  assert.deepEqual(calls, []);
});

test('list applies defaults and forwards validated global filters to one read RPC', async () => {
  const res = await request('');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { data: [], count: 0, limit: 50, offset: 0 });
  assert.deepEqual(calls[0], { name: 'admin_list_users', params: {
    p_form_key: 'registration', p_q: null, p_profile_state: null, p_submitted: null,
    p_email_verified: null, p_from: null, p_to: null, p_sort: 'created_at', p_dir: 'desc',
    p_limit: 50, p_offset: 0,
  } });
  await request('?form_key=workshop&q=%20Alex%20&profile_state=incomplete&submitted=false&email_verified=true&from=2026-09-01&to=2026-09-20&sort=name&dir=asc&limit=25&offset=50');
  assert.deepEqual(calls[1].params, {
    p_form_key: 'workshop', p_q: 'Alex', p_profile_state: 'incomplete', p_submitted: false,
    p_email_verified: true, p_from: '2026-09-01', p_to: '2026-09-20', p_sort: 'name', p_dir: 'asc',
    p_limit: 25, p_offset: 50,
  });
});

test('invalid filters fail before data access', async () => {
  for (const query of ['limit=201', 'limit=0', 'offset=-1', 'offset=0.5', 'sort=email', 'dir=bad',
    'submitted=maybe', 'email_verified=yes', 'profile_state=started', 'from=2026-02-30',
    'from=2026-09-20&to=2026-09-01', 'form_key=', 'q=' + 'x'.repeat(301), 'q=a&q=b']) {
    assert.equal((await request(`?${query}`)).status, 400, query);
  }
  assert.deepEqual(calls, []);
});

test('details preserve nullable records and selected form and reject unknown accounts', async () => {
  result = { data: { account: { user_id: userId }, profile: null, application: null, form_key: 'workshop' }, error: null };
  const res = await request(`/${userId}?form_key=workshop`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, result.data);
  assert.deepEqual(calls, [{ name: 'admin_user_detail', params: { p_user_id: userId, p_form_key: 'workshop' } }]);
  result = { data: null, error: null };
  assert.equal((await request(`/${userId}`)).status, 404);
  calls = [];
  assert.equal((await request('/invalid-id')).status, 400);
  assert.deepEqual(calls, []);
});

test('database failures are generic and empty date/filter values mean no filter', async () => {
  await request('?from=&to=&profile_state=&submitted=&email_verified=');
  assert.equal(calls[0].params.p_from, null);
  assert.equal(calls[0].params.p_submitted, null);
  result = { data: null, error: { message: 'private database information' } };
  for (const url of ['', `/${userId}`]) {
    const res = await request(url);
    assert.equal(res.status, 500);
    assert.ok(!JSON.stringify(res.body).includes('private'));
  }
});
