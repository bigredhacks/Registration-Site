import test from 'node:test';
import assert from 'node:assert/strict';
import { applicationAnswers } from './adminUsersState.ts';

test('user application details include legacy answers without leaking decision fields', () => {
  const answers = applicationAnswers({
    id: 1, user_id: 'user-1', email: 'old@example.com', first_name: 'Legacy', last_name: null,
    status: 'approved', created_at: '2026-09-20T12:00:00Z', released_status: 'waitlisted',
  });
  assert.deepEqual(answers, { email: 'old@example.com', first_name: 'Legacy' });
});

test('submitted JSON answers override legacy values, including empty and false answers', () => {
  const answers = applicationAnswers({
    id: 1, user_id: 'user-1', email: 'old@example.com', first_name: 'Legacy',
    status: 'pending', created_at: '2026-09-20T12:00:00Z',
    answers: { email: 'submitted@example.com', first_name: '', first_time_hacker: false, dietary_restrictions: [] },
  });
  assert.deepEqual(answers, {
    email: 'submitted@example.com', first_name: '', first_time_hacker: false, dietary_restrictions: [],
  });
});
