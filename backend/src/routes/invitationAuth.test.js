const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { Readable } = require('node:stream');
process.env.SUPABASE_URL = 'https://invitation-auth-test.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-only-key';
require('ts-node').register({ project: path.resolve(__dirname, '../../tsconfig.json'), transpileOnly: true });
const express = require('express');
const router = require('./index.ts').default;
const { supabase } = require('../config/supabase.ts');
let rpcCalls = 0;
supabase.auth.getUser = async () => ({ data: { user: { id: 'student', email: 'student@example.com' } }, error: null });
supabase.from = table => {
  assert.equal(table, 'admin_users');
  const query = { select() { return query; }, eq() { return query; }, async maybeSingle() { return { data: null, error: null }; } };
  return query;
};
supabase.rpc = () => { rpcCalls++; throw new Error('Unauthorized request reached RPC'); };

function request(url, authenticated, method) {
  const app = express();
  app.use('/api', router);
  const req = new Readable({ read() { this.push(null); } });
  req.url = url;
  req.method = method ?? (url.includes('/approval/') ? 'POST' : 'PUT');
  req.headers = authenticated ? { authorization: 'Bearer synthetic-token' } : {};
  return new Promise((resolve, reject) => {
    const res = {
      headers: {},
      setHeader(name, value) { this.headers[name] = value; },
      getHeader(name) { return this.headers[name]; },
      end(body) { resolve({ status: this.statusCode, body: JSON.parse(body) }); },
    };
    app.handle(req, res, reject);
  });
}

test('mounted invitation routes reject missing auth and non-admin release before database functions', async () => {
  for (const url of ['/api/admin/approval/release', '/api/registrations/me/invitation-response']) {
    assert.equal((await request(url, false)).status, 401);
  }
  assert.equal((await request('/api/admin/approval/release', true)).status, 403);
  assert.equal(rpcCalls, 0);
});

 test('all email and team-delete endpoints require authentication and admin access', async () => {
  for (const [url, method] of [
    ['/api/admin/emails/templates/approved', 'GET'], ['/api/admin/emails/templates/approved', 'PUT'],
    ['/api/admin/invitations/deadline', 'GET'], ['/api/admin/invitations/deadline', 'PUT'], ['/api/admin/emails/drafts', 'POST'],
    ['/api/admin/emails/drafts/00000000-0000-4000-8000-000000000001/send', 'POST'],
    ['/api/admin/emails/drafts/00000000-0000-4000-8000-000000000001/test', 'POST'],
    ['/api/admin/emails/jobs', 'GET'], ['/api/teams/admin/00000000-0000-4000-8000-000000000001', 'DELETE'],
  ]) {
    assert.equal((await request(url, false, method)).status, 401, url);
    assert.equal((await request(url, true, method)).status, 403, url);
  }
  assert.equal(rpcCalls, 0);
});
