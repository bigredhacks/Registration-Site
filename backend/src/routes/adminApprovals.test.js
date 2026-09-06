const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// Exercise the actual route handlers against an in-memory adapter, never a DB.
process.env.SUPABASE_URL = 'https://admin-approvals-test.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-only-key';
require('ts-node').register({ project: path.resolve(__dirname, '../../tsconfig.json'), transpileOnly: true });
const router = require('./adminApprovals.ts').default;
const { supabase } = require('../config/supabase.ts');

let records = [];
let reads = [];
let writes = [];
let queryCount = 0;

supabase.from = (table) => {
  assert.equal(table, 'registrations');
  queryCount += 1;
  const query = { filters: [], columns: '*', range: null, payload: null };
  const builder = {
    select(columns) { query.columns = columns; return builder; },
    eq(column, value) { query.filters.push({ column, value }); return builder; },
    in(column, values) { query.filters.push({ column, values }); return builder; },
    order() { return builder; },
    range(from, to) { query.range = [from, to]; return builder; },
    update(payload) { query.payload = payload; return builder; },
    then(resolve, reject) {
      const matched = records.filter((row) => query.filters.every((filter) => filter.values
        ? filter.values.includes(row[filter.column]) : row[filter.column] === filter.value));
      if (query.payload) {
        writes.push({ ...query, ids: matched.map((row) => row.id) });
        matched.forEach((row) => Object.assign(row, query.payload));
      } else reads.push(query);
      const sorted = [...matched].sort((a, b) => b.id - a.id);
      const page = query.range ? sorted.slice(query.range[0], query.range[1] + 1) : sorted;
      const data = query.columns === '*' ? page : page.map((row) => Object.fromEntries(
        query.columns.split(',').map((column) => [column, row[column]]),
      ));
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    },
  };
  return builder;
};

function reset(nextRecords) {
  records = nextRecords;
  reads = [];
  writes = [];
  queryCount = 0;
}

function student(id, formKey = 'registration', extra = {}) {
  return {
    id, user_id: `student-${id}`, email: `student${id}@example.com`, first_name: 'Student', last_name: `${id}`,
    form_key: formKey, status: 'pending', checked_in: false, ...extra,
  };
}

async function request(method, routePath, input = {}) {
  const layer = router.stack.find((entry) => {
    const paths = Array.isArray(entry.route?.path) ? entry.route.path : [entry.route?.path];
    return paths.includes(routePath) && entry.route.methods[method];
  });
  assert.ok(layer, `Route exists: ${method} ${routePath}`);
  const req = { path: routePath, query: method === 'get' ? input : {}, body: method === 'post' ? input : {} };
  const res = {
    statusCode: 200, headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; return this; },
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

test('bulk decisions update only selected ids in the requested form and report actual changed records', async () => {
  reset([student(1), student(2, 'workshop'), student(3)]);
  const res = await request('post', '/decision', { form_key: ' registration ', ids: [1, 1, 2, 999], status: 'approved' });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data.map((row) => row.id), [1]);
  assert.equal(records[0].status, 'approved');
  assert.equal(records[1].status, 'pending');
  assert.equal(records[2].status, 'pending');
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].filters, [
    { column: 'form_key', value: 'registration' },
    { column: 'id', values: [1, 2, 999] },
  ]);
});

test('invalid bulk ids, statuses, and form scope reject without querying or writing', async () => {
  reset([student(1)]);
  for (const patch of [
    { ids: [] }, { ids: [0] }, { ids: [-1] }, { ids: [1.5] }, { ids: ['1'] },
    { ids: Array.from({ length: 201 }, (_, index) => index + 1) },
    { status: 'accepted' }, { status: '' }, { form_key: '' }, { form_key: undefined },
  ]) {
    const res = await request('post', '/decision', { form_key: 'registration', ids: [1], status: 'approved', ...patch });
    assert.equal(res.statusCode, 400, JSON.stringify(patch));
  }
  assert.equal(queryCount, 0);
  assert.deepEqual(writes, []);
  assert.equal(records[0].status, 'pending');
});

test('selection and filtered student reads page past the database 1000-row limit before counting', async () => {
  reset([
    ...Array.from({ length: 2403 }, (_, index) => student(index + 1)),
    student(9999, 'workshop'),
  ]);
  const selection = await request('get', '/selection', { form_key: 'registration' });
  assert.equal(selection.statusCode, 200);
  assert.equal(selection.body.count, 2403);
  assert.equal(selection.body.data.length, 2403);
  assert.deepEqual(reads.map((query) => query.range), [[0, 999], [1000, 1999], [2000, 2999]]);
  assert.ok(reads.every((query) => query.filters.some((filter) => filter.column === 'form_key' && filter.value === 'registration')));
  reads = [];
  const filtered = await request('get', '/students', { form_key: 'registration', q: 'student1@example.com', offset: '0', limit: '20' });
  assert.equal(filtered.statusCode, 200);
  assert.equal(filtered.body.count, 1);
  assert.deepEqual(filtered.body.data.map((row) => row.id), [1]);
  assert.equal(reads.length, 3);
});

test('identity resolution preserves ambiguous full names and only matches the requested form', async () => {
  reset([
    student(1, 'registration', { first_name: 'Sam', last_name: 'Rivera' }),
    student(2, 'registration', { first_name: 'Sam', last_name: 'Rivera' }),
    student(3, 'workshop', { first_name: 'Sam', last_name: 'Rivera' }),
    student(4, 'workshop', { first_name: 'Maya', last_name: 'Chen' }),
  ]);
  const res = await request('post', '/resolve', {
    form_key: 'registration', entries: ['Sam  Rivera', 'STUDENT1@example.com', 'Maya Chen', 'student3@example.com', 'sam rivera'],
  });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.matches.map((entry) => entry.matches.map((row) => row.id)), [[2, 1], [1], [], [], [2, 1]]);
  assert.equal(res.body.matches[4].duplicate, true);
  assert.deepEqual(writes, []);
});

test('CSV export fetches complete records and dynamic answers within the same form and filters', async () => {
  reset([
    student(1, 'registration', { status: 'approved', phone_number: '555-0101', answers: { reason: 'Build "tools", together', roles: ['design', 'frontend'] } }),
    student(2, 'registration', { status: 'pending', answers: { private: 'Pending response' } }),
    student(3, 'workshop', { status: 'approved', answers: { private: 'Other form response' } }),
  ]);
  const res = await request('get', '/export.csv', { form_key: 'registration', status: 'approved' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Content-Type'], 'text/csv; charset=utf-8');
  assert.match(res.headers['Content-Disposition'], /registrations\.csv/);
  assert.equal(reads[0].columns, '*');
  assert.ok(res.body.includes('"phone_number"'));
  assert.ok(res.body.includes('"555-0101"'));
  assert.ok(res.body.includes('"answer:reason","answer:roles"'));
  assert.ok(res.body.includes('"Build ""tools"", together"'));
  assert.ok(res.body.includes('[""design"",""frontend""]'));
  assert.equal(res.body.includes('Pending response'), false);
  assert.equal(res.body.includes('Other form response'), false);
  assert.deepEqual(writes, []);
});
