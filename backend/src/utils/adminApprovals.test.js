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
