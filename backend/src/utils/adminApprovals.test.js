const test = require('node:test');
const assert = require('node:assert/strict');
const { buildApprovalCsv, resolveApprovalIdentities, filterApprovalStudents } = require('./adminApprovals.ts');
const rows = [
  { id: 1, user_id: 'a', email: 'sam@example.com', first_name: 'Sam', last_name: 'Rivera', status: 'pending', checked_in: null },
  { id: 2, user_id: 'b', email: 'other@example.com', first_name: 'Sam', last_name: 'Rivera', status: 'approved', checked_in: true },
  { id: 3, user_id: 'c', email: 'maya@example.com', first_name: 'Maya', last_name: 'Chen', status: 'pending', checked_in: false },
];
test('identity resolution distinguishes exact emails, ambiguous names, duplicate input and missing records', () => {
  const result = resolveApprovalIdentities(rows, [' SAM@example.com ', 'sam@example.com', 'Sam  Rivera', 'Maya Chen', 'Sam', 'absent@example.com']);
  assert.deepEqual(result.map(entry => entry.matches.map(row => row.id)), [[1], [1], [1, 2], [3], [], []]);
  assert.equal(result[1].duplicate, true);
});
test('full-name search and status/attendance filters agree on the selected cohort', () => {
  assert.deepEqual(filterApprovalStudents(rows, { search: 'sam rivera', status: 'pending', checkedIn: 'false' }).map(row => row.id), [1]);
  assert.deepEqual(filterApprovalStudents(rows, { checkedIn: 'true' }).map(row => row.id), [2]);
});
test('export preserves registration fields and dynamic answers with CSV quoting', () => {
  const csv = buildApprovalCsv([{ id: 1, school: 'College, Inc.', answers: { reason: 'Build "things"', special: '=1+1' } }, { id: 2, answers: { roles: ['design', 'frontend'] } }]);
  assert.match(csv, /"answer:reason","answer:roles","answer:special"/);
  assert.match(csv, /"College, Inc\."/);
  assert.match(csv, /"Build ""things"""/);
  assert.ok(csv.includes('"\'=1+1"'));
  assert.ok(csv.includes('[""design"",""frontend""]'));
});

test('form filters combine exact choices, multi-select answers, booleans, text and grid rows', () => {
  const students = [
    { ...rows[0], school: 'Stale School', answers: { school: ' Cornell  University ', age: '18–20', interests: ['Design', 'Hardware'], first_time: false, reason: 'Build accessible tools', skills: { Frontend: 'Advanced', Backend: 'Beginner' } } },
    { ...rows[1], answers: { school: 'Cornell University', age: '18–20', interests: ['Design'], first_time: true, reason: 'Build accessible tools', skills: { Frontend: 'Beginner' } } },
    { ...rows[2], answers: { school: 'Cornell University College', age: '18–20', interests: ['Design'], first_time: false, reason: 'Build accessible tools', skills: { Frontend: 'Advanced' } } },
  ];
  const filters = [
    { field: 'school', operator: 'is', values: ['cornell university', 'RIT'] },
    { field: 'age', operator: 'is', values: ['18-20'] },
    { field: 'interests', operator: 'is', values: ['hardware', 'design'] },
    { field: 'first_time', operator: 'is', values: ['No'] },
    { field: 'reason', operator: 'contains', values: ['ACCESSIBLE'] },
    { field: 'skills', row: 'Frontend', operator: 'is', values: ['Advanced'] },
  ];
  assert.deepEqual(filterApprovalStudents(students, { answers: filters }).map(row => row.id), [1]);
  assert.deepEqual(filterApprovalStudents(students, { answers: filters, status: 'approved' }), []);
  assert.deepEqual(filterApprovalStudents(students, { answers: [{ field: 'interests', operator: 'is_not', values: ['Hardware'] }] }).map(row => row.id), [2, 3]);
  assert.deepEqual(filterApprovalStudents(students, { search: 'stale' }), []);
});

test('unanswered filters distinguish false, zero, empty arrays and explicitly cleared legacy answers', () => {
  const { matchesApprovalAnswer } = require('./adminApprovals.ts');
  const student = { ...rows[0], school: 'Legacy school', answers: { school: '', consent: false, count: 0, tags: [], blanks: [' '] } };
  for (const field of ['school', 'tags', 'blanks', 'missing']) {
    assert.equal(matchesApprovalAnswer(student, { field, operator: 'empty' }), true, field);
    assert.equal(matchesApprovalAnswer(student, { field, operator: 'is_not', values: ['Something'] }), false, field);
  }
  for (const field of ['consent', 'count']) assert.equal(matchesApprovalAnswer(student, { field, operator: 'not_empty' }), true);
  assert.equal(matchesApprovalAnswer(student, { field: 'count', operator: 'gte', values: ['0'] }), true);
  assert.equal(matchesApprovalAnswer(student, { field: 'count', operator: 'gt', values: ['0'] }), false);
  assert.equal(matchesApprovalAnswer({ ...student, answers: { count: '18–20' } }, { field: 'count', operator: 'lt', values: ['21'] }), false);
});

test('filter catalog uses custom question labels, options and grid rows, with legacy fallbacks', () => {
  const { approvalFilterFields } = require('./adminApprovals.ts');
  const students = [{ ...rows[0], school: 'Legacy school', answers: { university: 'Custom school', consent: false } }];
  const fields = approvalFilterFields(students, [
    { id: 'university', label: 'Where do you study?', type: 'dropdown', options: ['Cornell University'] },
    { id: 'consent', label: 'I agree', type: 'checkbox' },
    { id: 'skills', label: 'Skills', type: 'multipleChoiceGrid', rows: ['Frontend'], columns: ['Beginner', 'Advanced'] },
    { id: 'essay', label: 'Why join?', type: 'text' },
    { id: 'info', label: 'Instructions', type: 'note' },
    { id: 'attachment', label: 'Upload', type: 'file' },
  ]);
  assert.deepEqual(fields.find(field => field.field === 'university').options, ['Cornell University', 'Custom school']);
  assert.equal(fields.find(field => field.field === 'university').label, 'Where do you study?');
  assert.deepEqual(fields.find(field => field.field === 'consent').options, ['No', 'Yes']);
  assert.equal(fields.find(field => field.field === 'skills').row, 'Frontend');
  assert.equal(fields.find(field => field.field === 'essay').kind, 'text');
  assert.ok(fields.some(field => field.field === 'school'));
  assert.ok(!fields.some(field => ['attachment', 'info'].includes(field.field)));
});

test('sorting orders by answers or columns, honours per-column defaults and sinks blanks', () => {
  const { sortApprovalStudents } = require('./adminApprovals.ts');
  const students = [
    { ...rows[0], created_at: '2026-01-02T00:00:00Z', answers: { school: 'Cornell' } },
    { ...rows[1], created_at: '2026-03-04T00:00:00Z', answers: { school: 'anderson college' } },
    { ...rows[2], created_at: '2026-02-03T00:00:00Z', answers: {} },
  ];
  // Dates open newest-first; names and schools open A-Z.
  assert.deepEqual(sortApprovalStudents(students, 'created_at').map(row => row.id), [2, 3, 1]);
  assert.deepEqual(sortApprovalStudents(students, 'created_at', 'asc').map(row => row.id), [1, 3, 2]);
  // Case-insensitive, and the unanswered school stays last in both directions.
  assert.deepEqual(sortApprovalStudents(students, 'school').map(row => row.id), [2, 1, 3]);
  assert.deepEqual(sortApprovalStudents(students, 'school', 'desc').map(row => row.id), [1, 2, 3]);
  // Answers win over the stale column, matching how the list and filters read school.
  assert.deepEqual(sortApprovalStudents([{ ...students[0], school: 'Zzz College' }, students[1]], 'school').map(row => row.id), [2, 1]);
  // Ties fall back to newest id first, so paging over equal values stays stable.
  assert.deepEqual(sortApprovalStudents(students, 'first_name').map(row => row.id), [3, 2, 1]);
  // The Student column renders "First Last", so its sort breaks first-name ties on
  // the surname rather than leaving every shared first name unordered.
  const sams = [
    { ...rows[0], id: 10, first_name: 'Sam', last_name: 'Alvarez' },
    { ...rows[0], id: 11, first_name: 'Sam', last_name: 'Rivera' },
    { ...rows[0], id: 12, first_name: 'Alex', last_name: 'Zhang' },
  ];
  assert.deepEqual(sortApprovalStudents(sams, 'name').map(row => row.id), [12, 10, 11]);
  // first_name alone can't separate the two Sams, so they keep the id tiebreak order.
  assert.deepEqual(sortApprovalStudents(sams, 'first_name').map(row => row.id), [12, 11, 10]);
  // An unrecognised column leaves the order untouched rather than erroring.
  assert.deepEqual(sortApprovalStudents(students, 'answers').map(row => row.id), [1, 2, 3]);
  assert.deepEqual(sortApprovalStudents(students).map(row => row.id), [1, 2, 3]);
});

test('submitted date range uses inclusive UTC days and excludes rows without a date', () => {
  const students = [
    { ...rows[0], created_at: '2026-01-01T23:59:59Z' },
    { ...rows[1], created_at: '2026-01-02T00:00:00Z' },
    { ...rows[2], created_at: null },
  ];
  // Both bounds are inclusive whole UTC days, matching buildMetrics.
  assert.deepEqual(filterApprovalStudents(students, { from: '2026-01-02' }).map(row => row.id), [2]);
  assert.deepEqual(filterApprovalStudents(students, { to: '2026-01-01' }).map(row => row.id), [1]);
  assert.deepEqual(filterApprovalStudents(students, { from: '2026-01-01', to: '2026-01-02' }).map(row => row.id), [1, 2]);
  // No bounds means no date filtering, so the undated row survives.
  assert.deepEqual(filterApprovalStudents(students, {}).map(row => row.id), [1, 2, 3]);
});
