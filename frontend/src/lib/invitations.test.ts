import test from 'node:test';
import assert from 'node:assert/strict';
import { invitationPresentation } from './invitations.ts';

test('only a released approval with no recorded response offers RSVP', () => {
  for (const status of ['pending', 'submitted', 'waitlisted', 'rejected', null]) {
    assert.equal(invitationPresentation({ status }).canRespond, false);
  }
  assert.equal(invitationPresentation({ status: 'approved' }).canRespond, true);
  for (const invitation_response of ['accepted', 'declined'] as const) {
    const view = invitationPresentation({ status: 'approved', invitation_response });
    assert.equal(view.canRespond, false);
    assert.match(view.headline, new RegExp(invitation_response));
    assert.equal(invitationPresentation({ status: 'waitlisted', invitation_response }).headline, 'Waitlisted');
  }
  assert.equal(invitationPresentation({ status: 'pending' }).headline, 'Under review');
});

test('automatic expiry is shown separately from an applicant decline', () => {
  const view = invitationPresentation({ status: 'rejected', invitation_response: 'declined', invitation_expired_at: '2026-09-21T04:00:00Z' });
  assert.equal(view.headline, 'Invitation expired');
  assert.equal(view.canRespond, false);
  assert.match(view.body, /deadline/);
});
