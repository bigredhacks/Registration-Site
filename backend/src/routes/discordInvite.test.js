const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { Readable } = require('node:stream');
process.env.SUPABASE_URL = 'https://discord-invite-test.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-only-key';
require('ts-node').register({ project: path.resolve(__dirname, '../../tsconfig.json'), transpileOnly: true });
const express = require('express');
const router = require('./index.ts').default;
const { supabase } = require('../config/supabase.ts');

const INVITE = 'https://discord.gg/test-invite';
let state;
supabase.auth.getUser = async () => ({ data: { user: { id: 'student', email: 'student@example.com' } }, error: null });
supabase.from = table => {
  const filters = [];
  state.queries.push({ table, filters });
  const query = {
    select() { return query; },
    eq(column, value) { filters.push(['eq', column, value]); return query; },
    is(column, value) { filters.push(['is', column, value]); return query; },
    async maybeSingle() {
      const data = table === 'admin_users' ? state.admin : state.registration;
      return { data: data ? { id: 1 } : null, error: null };
    },
  };
  return query;
};

function request(authenticated) {
  const app = express();
  app.use('/api', router);
  const req = new Readable({ read() { this.push(null); } });
  req.url = '/api/registrations/me/discord';
  req.method = 'GET';
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

async function inviteFor({ admin = false, registration = false, configured = true }) {
  state = { admin, registration, queries: [] };
  if (configured) process.env.DISCORD_INVITE_URL = INVITE;
  else delete process.env.DISCORD_INVITE_URL;
  const response = await request(true);
  assert.equal(response.status, 200);
  return response.body.invite_url;
}

test('discord invite requires authentication', async () => {
  state = { admin: true, registration: true, queries: [] };
  assert.equal((await request(false)).status, 401);
});

test('discord invite is returned only to accepted applicants and admins', async () => {
  assert.equal(await inviteFor({ registration: true }), INVITE);
  assert.equal(await inviteFor({ admin: true }), INVITE);
  assert.equal(await inviteFor({}), null);
  assert.equal(await inviteFor({ admin: true, registration: true, configured: false }), null);
});

test('discord invite only matches an accepted, released, unexpired main-form approval', async () => {
  await inviteFor({});
  const registrationQuery = state.queries.find(query => query.table === 'registrations');
  assert.deepEqual(registrationQuery.filters, [
    ['eq', 'user_id', 'student'], ['eq', 'form_key', 'registration'],
    ['eq', 'released_status', 'approved'], ['eq', 'invitation_response', 'accepted'],
    ['is', 'invitation_expired_at', null],
  ]);
});
