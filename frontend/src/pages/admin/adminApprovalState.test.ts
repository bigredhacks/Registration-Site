import test from 'node:test';
import assert from 'node:assert/strict';
import { addToSelection, parseStudentList } from './adminApprovalState.ts';
test('team and pasted selections deduplicate registrations and cannot cross application scope', () => {
  const student = { id: 1, user_id: 'a', email: 'a@example.com', status: 'pending', form_key: 'registration' };
  const original = new Map([[1, student]]);
  const result = addToSelection(original, [student, { ...student, id: 2 }, { ...student, id: 3, form_key: 'workshop' }], 'registration');
  assert.deepEqual([...result.keys()], [1, 2]);
  assert.equal(original.size, 1);
});
test('pasted lists accept common separators without splitting full names', () => {
  assert.deepEqual(parseStudentList(' First Last\n a@example.com; b@example.com,\t Second Person '), ['First Last', 'a@example.com', 'b@example.com', 'Second Person']);
});
