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
let formFields = [];

supabase.from = (table) => {
  if (table === 'form_configs') {
    const builder = { select() { return builder; }, eq() { return builder; }, async maybeSingle() { return { data: { fields: formFields }, error: null }; } };
    return builder;
  }
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
  formFields = [];
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

test('organizers can reverse either recorded response without changing decisions or other applicants', async () => {
  for (const previous of ['accepted', 'declined']) {
    const timestamp = '2026-09-14T12:00:00.000Z';
    reset([student(1, 'registration', { released_status: 'approved', invitation_response: previous, invitation_responded_at: timestamp }), student(2)]);
    const response = previous === 'accepted' ? 'declined' : 'accepted';
    const res = await request('post', '/invitation-response', { id: 1, response, expected_response: previous, expected_responded_at: timestamp });
    assert.equal(res.statusCode, 200);
    assert.equal(records[0].invitation_response, response);
    assert.notEqual(records[0].invitation_responded_at, timestamp);
    assert.equal(records[0].status, 'pending');
    assert.equal(records[0].released_status, 'approved');
    assert.equal(records[1].invitation_response, undefined);
    assert.equal(res.body.data.id, 1);
  }
});

test('response corrections reject stale responses, stale timestamps, inactive invitations and other forms', async () => {
  const timestamp = '2026-09-14T12:00:00.000Z';
  for (const extra of [
    { invitation_response: 'declined' },
    { invitation_responded_at: '2026-09-14T13:00:00.000Z' },
    { released_status: 'waitlisted' },
    { released_status: null },
    { form_key: 'workshop' },
    { invitation_response: null, invitation_responded_at: null },
  ]) {
    reset([student(1, 'registration', { released_status: 'approved', invitation_response: 'accepted', invitation_responded_at: timestamp, ...extra })]);
    const before = structuredClone(records);
    const res = await request('post', '/invitation-response', { id: 1, response: 'declined', expected_response: 'accepted', expected_responded_at: timestamp });
    assert.equal(res.statusCode, 409);
    assert.deepEqual(records, before);
  }
});

test('response correction validates input before querying', async () => {
  const valid = { id: 1, response: 'declined', expected_response: 'accepted', expected_responded_at: '2026-09-14T12:00:00Z' };
  for (const extra of [{ response: 'pending' }, { response: 'accepted' }, { id: -1 }, { expected_responded_at: 'invalid' }, { form_key: 'workshop' }]) {
    reset([]);
    const res = await request('post', '/invitation-response', { ...valid, ...extra });
    assert.equal(res.statusCode, 400);
    assert.equal(queryCount, 0);
  }
});

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

test('custom form filters share one cohort across pages, selection and CSV, with form-wide choices', async () => {
  reset([
    ...Array.from({ length: 1105 }, (_, index) => student(index + 1, 'registration', {
      answers: { university: index % 2 ? 'Cornell' : 'RIT', attendance_days: ['Saturday', 'Sunday'], returning: false },
    })),
    student(9000, 'workshop', { answers: { university: 'Another form school', attendance_days: ['Saturday'] } }),
  ]);
  formFields = [
    { id: 'university', label: 'Your university', type: 'dropdown', options: [] },
    { id: 'attendance_days', label: 'Days attending', type: 'checkboxGroup', options: ['Friday', 'Saturday', 'Sunday'] },
    { id: 'returning', label: 'Returning hacker?', type: 'checkbox' },
  ];
  const query = { form_key: 'registration', status: 'pending', answers: JSON.stringify([
    { field: 'university', operator: 'is', values: ['cornell'] },
    { field: 'attendance_days', operator: 'is', values: ['Saturday'] },
    { field: 'returning', operator: 'is', values: ['No'] },
  ]) };
  const list = await request('get', '/students', { ...query, offset: '50', limit: '50' });
  assert.equal(list.statusCode, 200);
  assert.equal(list.body.count, 552);
  assert.equal(list.body.data.length, 50);
  assert.ok(list.body.data.every(row => row.id % 2 === 0));
  assert.deepEqual(list.body.fields.find(field => field.field === 'university').options, ['Cornell', 'RIT']);
  const selection = await request('get', '/selection', query);
  assert.equal(selection.body.count, list.body.count);
  assert.equal(selection.body.data.length, 552);
  assert.ok(selection.body.data.every(row => row.id % 2 === 0 && row.form_key === 'registration'));
  const csv = await request('get', '/export.csv', query);
  assert.equal(csv.statusCode, 200);
  assert.equal(csv.body.split('\r\n').length, 553);
  assert.ok(!csv.body.includes('RIT'));
  assert.ok(!csv.body.includes('Another form school'));
  const empty = await request('get', '/students', { ...query, status: 'approved' });
  assert.equal(empty.body.count, 0);
  assert.deepEqual(empty.body.fields, list.body.fields);
  assert.deepEqual(writes, []);
});

test('malformed and unavailable form filters fail closed for bulk selection', async () => {
  reset([student(1, 'registration', { answers: { custom: 'Yes' } })]);
  formFields = [{ id: 'custom', label: 'Custom question', type: 'text' }];
  for (const answers of [
    '{broken', ['[]', '[]'], JSON.stringify({}),
    JSON.stringify([{ field: 'custom', operator: 'is', values: [] }]),
    JSON.stringify([{ field: 'custom', operator: 'contains', values: [''] }]),
    JSON.stringify([{ field: 'custom', operator: 'lt', values: ['18–20'] }]),
    JSON.stringify([{ field: 'removed_question', operator: 'empty' }]),
    JSON.stringify([{ field: 'custom', row: 'Invalid row', operator: 'empty' }]),
  ]) {
    const result = await request('get', '/selection', { form_key: 'registration', answers });
    assert.equal(result.statusCode, 400, JSON.stringify(answers));
  }
  assert.deepEqual(writes, []);
});

test('an inverted submitted range is rejected rather than answered with an empty list', async () => {
  reset([student(1, 'registration', { created_at: '2026-08-05T00:00:00Z' })]);
  const inverted = await request('get', '/students', { form_key: 'registration', from: '2026-08-20', to: '2026-08-10' });
  assert.equal(inverted.statusCode, 400);
  assert.equal(inverted.body.error, 'Invalid registration filters.');
  // Blank bounds still mean "no filter", and a valid range is unaffected.
  for (const query of [{ from: '', to: '' }, { from: '2026-08-01', to: '2026-08-31' }, { from: '2026-08-05', to: '2026-08-05' }]) {
    const res = await request('get', '/students', { form_key: 'registration', ...query });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.data.map((row) => row.id), [1]);
  }
});

test('released and RSVP cohorts agree across list, selection and CSV; totals ignore drafts and page filters', async () => {
  reset([
    student(1, 'registration', { status: 'waitlisted', released_status: 'approved', invitation_response: 'accepted' }),
    student(2, 'registration', { status: 'approved', released_status: 'approved', invitation_response: 'declined' }),
    student(3, 'registration', { status: 'rejected', released_status: 'approved', invitation_response: null }),
    student(4, 'registration', { status: 'approved', released_status: null }),
    student(5, 'registration', { status: 'approved', released_status: 'waitlisted', invitation_response: 'accepted' }),
  ]);
  const filters = { form_key: 'registration', released_status: 'approved', invitation_response: 'unanswered', release_state: 'changed' };
  const list = await request('get', '/students', filters);
  assert.deepEqual(list.body.data.map(row => row.id), [3]);
  assert.deepEqual(list.body.invitationCounts, { accepted: 1, declined: 1, unanswered: 1 });
  const selection = await request('get', '/selection', filters);
  assert.deepEqual(selection.body.data, list.body.data);
  const csv = await request('get', '/export.csv', filters);
  assert.match(csv.body, /student3@example.com/);
  assert.doesNotMatch(csv.body, /student[1245]@example.com/);
  const unreleased = await request('get', '/students', { form_key: 'registration', release_state: 'unreleased' });
  assert.deepEqual(unreleased.body.data.map(row => row.id), [4]);
  await request('post', '/decision', { form_key: 'registration', ids: [1], status: 'rejected' });
  assert.equal(records[0].released_status, 'approved');
  assert.equal(records[0].invitation_response, 'accepted');
});

test('release validates main form, unique reviewed statuses and batch limits before the RPC', async () => {
  let calls = [];
  let failure = null;
  supabase.rpc = async (name, args) => {
    calls.push({ name, args });
    return { data: [student(1, 'registration', { released_status: 'approved' })], error: failure };
  };
  const valid = { form_key: 'registration', decisions: [{ id: 1, expected_status: 'approved' }] };
  for (const patch of [
    { form_key: 'workshop' }, { decisions: [] }, { decisions: [{ id: 1, expected_status: 'pending' }] },
    { decisions: [valid.decisions[0], valid.decisions[0]] },
    { decisions: Array.from({ length: 201 }, (_, index) => ({ id: index + 1, expected_status: 'approved' })) },
  ]) assert.equal((await request('post', '/release', { ...valid, ...patch })).statusCode, 400);
  assert.deepEqual(calls, []);
  assert.equal((await request('post', '/release', valid)).statusCode, 200);
  assert.deepEqual(calls, [{ name: 'release_registration_decisions', args: { p_decisions: valid.decisions } }]);
  failure = { code: 'PT409', message: 'Selected decisions changed.' };
  const conflict = await request('post', '/release', valid);
  assert.equal(conflict.statusCode, 409);
  assert.equal(conflict.body.error, failure.message);
});

test('selection limits apply after filtering and time sorting across database batches', async () => {
  reset([
    ...Array.from({ length: 2400 }, (_, index) => student(index + 1, 'registration', {
      created_at: new Date(Date.UTC(2026, 7, 1, 0, index)).toISOString(),
      status: index % 2 === 0 ? 'pending' : 'approved',
      answers: { school: index % 4 === 0 ? 'Cornell' : 'RIT' },
    })),
    student(9999, 'workshop', { status: 'pending', school: 'Cornell' }),
  ]);
  const query = {
    form_key: 'registration', status: 'pending', sort: 'created_at', dir: 'asc', selection_limit: '450',
    answers: JSON.stringify([{ field: 'school', operator: 'is', values: ['Cornell'] }]),
  };
  const res = await request('get', '/selection', { ...query, offset: '100', limit: '25' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.count, 600);
  assert.deepEqual(res.body.data.map(row => row.id), Array.from({ length: 450 }, (_, index) => index * 4 + 1));
  assert.deepEqual(reads.map(query => query.range), [[0, 999], [1000, 1999], [2000, 2999]]);
  const descending = await request('get', '/selection', { ...query, dir: 'desc' });
  assert.deepEqual(descending.body.data.map(row => row.id), Array.from({ length: 450 }, (_, index) => 2397 - index * 4));
  assert.deepEqual(writes, []);
});

test('limited selections preserve timestamp ties, missing values, and other table orders', async () => {
  reset([
    student(1, 'registration', { created_at: '2026-08-01T12:00:00Z', first_name: 'Charlie' }),
    student(2, 'registration', { created_at: '2026-08-01T12:00:00Z', first_name: 'Bob' }),
    student(3, 'registration', { created_at: '2026-08-02T12:00:00Z', first_name: 'Alice' }),
    student(4, 'registration', { created_at: null, first_name: 'Zoe' }),
  ]);
  for (const [sort, dir, expected] of [
    ['created_at', 'asc', [2, 1, 3]], ['created_at', 'desc', [3, 2, 1]],
    ['name', 'asc', [3, 2, 1]], ['name', 'desc', [4, 1, 2]], ['', '', [4, 3, 2]],
  ]) {
    const res = await request('get', '/selection', { form_key: 'registration', sort, dir, selection_limit: '3' });
    assert.equal(res.body.count, 4);
    assert.deepEqual(res.body.data.map(row => row.id), expected);
  }
});

test('selection limit boundaries preserve match counts and never cap table pages or exports', async () => {
  reset([student(1), student(2), student(3)]);
  for (const [selection_limit, expected] of [['2', [3, 2]], ['3', [3, 2, 1]], ['450', [3, 2, 1]], [undefined, [3, 2, 1]]]) {
    const res = await request('get', '/selection', { form_key: 'registration', selection_limit });
    assert.equal(res.body.count, 3);
    assert.deepEqual(res.body.data.map(row => row.id), expected);
  }
  const empty = await request('get', '/selection', { form_key: 'registration', status: 'approved', selection_limit: '450' });
  assert.equal(empty.body.count, 0);
  assert.deepEqual(empty.body.data, []);
  const list = await request('get', '/students', { form_key: 'registration', selection_limit: '1', offset: '1', limit: '2' });
  assert.equal(list.body.count, 3);
  assert.deepEqual(list.body.data.map(row => row.id), [2, 1]);
  const csv = await request('get', '/export.csv', { form_key: 'registration', selection_limit: '1' });
  assert.equal(csv.body.split('\r\n').length, 4);
});

test('invalid selection limits reject before any database reads', async () => {
  reset([student(1)]);
  for (const selection_limit of ['', ' ', '0', '-1', '1.5', 'abc', 'Infinity', '9007199254740992', ['1'], ['1', '2'], { value: '1' }]) {
    const res = await request('get', '/selection', { form_key: 'registration', selection_limit });
    assert.equal(res.statusCode, 400, JSON.stringify(selection_limit));
  }
  assert.equal(queryCount, 0);
});

test('selection limits follow invitation filters without limiting invitation totals or exports', async () => {
  reset([
    student(1, 'registration', { status: 'waitlisted', released_status: 'approved', created_at: '2026-08-01T00:00:00Z' }),
    student(2, 'registration', { status: 'approved', released_status: 'approved', created_at: '2026-08-02T00:00:00Z' }),
    student(3, 'registration', { status: 'rejected', released_status: 'approved', created_at: '2026-08-03T00:00:00Z' }),
    student(4, 'registration', { status: 'rejected', released_status: 'approved', invitation_response: 'accepted', created_at: '2026-07-01T00:00:00Z' }),
    student(5, 'registration', { status: 'approved', released_status: null, created_at: '2026-07-01T00:00:00Z' }),
  ]);
  const query = {
    form_key: 'registration', released_status: 'approved', release_state: 'changed',
    invitation_response: 'unanswered', sort: 'created_at', dir: 'asc', selection_limit: '1',
  };
  const selection = await request('get', '/selection', query);
  assert.equal(selection.statusCode, 200);
  assert.equal(selection.body.count, 2);
  assert.deepEqual(selection.body.data.map(row => row.id), [1]);
  const list = await request('get', '/students', query);
  assert.deepEqual(list.body.data.map(row => row.id), [1, 3]);
  assert.deepEqual(list.body.invitationCounts, { accepted: 1, declined: 0, unanswered: 3 });
  const csv = await request('get', '/export.csv', query);
  assert.equal(csv.body.split('\r\n').length, 3);
  assert.match(csv.body, /student1@example.com/);
  assert.match(csv.body, /student3@example.com/);
  assert.deepEqual(writes, []);
});

test('task views share full matching IDs, counts, ordered selection and CSV cohorts', async () => {
  reset([
    student(1, 'registration', { status: 'approved' }),
    student(2, 'registration', { status: 'waitlisted' }),
    student(3, 'registration', { status: 'rejected' }),
    student(4, 'registration', { status: 'approved', released_status: 'approved', invitation_response: 'accepted' }),
    student(5, 'registration', { status: 'rejected', released_status: 'approved', invitation_response: 'declined' }),
    student(6, 'registration', { status: 'pending', released_status: 'approved' }),
    student(7, 'registration', { status: 'approved', released_status: 'waitlisted', invitation_response: 'accepted' }),
    student(8, 'registration', { status: 'pending' }),
    student(9, 'workshop', { status: 'approved' }),
  ]);
  for (const [view, ids] of [['all', [8, 7, 6, 5, 4, 3, 2, 1]], ['ready', [7, 5, 3, 2, 1]], ['invitations', [6, 5, 4]]]) {
    const query = { form_key: 'registration', view, selection_limit: '2', limit: '1' };
    const list = await request('get', '/students', query);
    assert.equal(list.body.count, ids.length);
    assert.deepEqual(list.body.matchingIds, ids);
    assert.deepEqual(list.body.data.map(row => row.id), ids.slice(0, 1));
    const selection = await request('get', '/selection', query);
    assert.deepEqual(selection.body.data.map(row => row.id), ids.slice(0, 2));
    const csv = await request('get', '/export.csv', query);
    assert.equal(csv.body.split('\r\n').length, ids.length + 1);
    for (const id of ids) assert.ok(csv.body.includes(`student${id}@example.com`));
  }
  for (const [invitation_response, id] of [['accepted', 4], ['declined', 5], ['unanswered', 6]]) {
    const list = await request('get', '/students', { form_key: 'registration', view: 'invitations', invitation_response });
    assert.deepEqual(list.body.matchingIds, [id]);
  }
  const omitted = await request('get', '/students', { form_key: 'registration' });
  assert.equal(omitted.body.count, 8);
  const invalid = await request('get', '/students', { form_key: 'registration', view: 'invalid' });
  assert.equal(invalid.statusCode, 400);
  assert.deepEqual(writes, []);
});
