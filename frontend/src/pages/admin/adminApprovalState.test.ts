import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReleasePreview, releaseStateLabel } from './adminApprovalState.ts';
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

test('release preview uses refreshed decisions, skips pending and other forms, and retains exact reviewed statuses', () => {
  const base = { user_id: 'a', email: 'a@example.com', form_key: 'registration' };
  const rows = [
    { ...base, id: 1, status: 'approved', released_status: 'approved' as const, invitation_response: 'accepted' as const },
    { ...base, id: 2, status: 'pending' },
    { ...base, id: 3, status: 'rejected', form_key: 'workshop' },
    { ...base, id: 4, status: 'waitlisted', released_status: 'approved' as const },
  ];
  const preview = buildReleasePreview([1, 2, 3, 4, 5], rows);
  assert.deepEqual(preview.decisions, [{ id: 1, expected_status: 'approved' }, { id: 4, expected_status: 'waitlisted' }]);
  assert.equal(preview.skipped, 3);
  assert.equal(preview.students[0].invitation_response, 'accepted');
  assert.deepEqual(rows.map(releaseStateLabel), ['Released', 'Not released', 'Not released', 'Unpublished changes']);
});
