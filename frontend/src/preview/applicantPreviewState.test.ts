import test from 'node:test';
import assert from 'node:assert/strict';
import { APPLICANT_PERSONAS, createPreviewApplicant, handleApplicantPreviewRequest, resolvePersona } from './applicantPreviewState.ts';
import { invitationPresentation } from '../lib/invitations.ts';
import { buildApplicationCards } from '../lib/registrationUi.ts';

const now = Date.parse('2026-09-21T12:00:00Z');
const call = (applicant: ReturnType<typeof createPreviewApplicant>, method: string, path: string, body = {}, query = '') =>
  handleApplicantPreviewRequest(applicant, method, path, new URLSearchParams(query), body, [], now);

test('personas cover every applicant stage with released decisions and consistent deadline presentation', () => {
  const headlines: Record<string, string> = { review: 'Under review', 'draft-approved': 'Under review', waitlisted: 'Waitlisted', invited: "You're invited!", accepted: 'Invitation accepted', declined: 'Invitation declined', expired: 'Invitation expired', rejected: 'Not selected' };
  for (const persona of APPLICANT_PERSONAS) {
    const applicant = createPreviewApplicant(persona.id, now);
    if (applicant.registration) assert.equal(invitationPresentation(applicant.registration).headline, headlines[persona.id]);
    else assert.ok(['new', 'late', 'closed'].includes(persona.id));
  }
  assert.equal(resolvePersona('unknown'), 'new');
  for (const [id, label] of [['new', 'Start Application'], ['late', 'Apply on waitlist'], ['closed', 'Registration closed']] as const) {
    const applicant = createPreviewApplicant(id, now);
    const form = { key: 'registration', title: 'Application', description: null, version: 1, closes_at: applicant.closesAt, allow_late_waitlist: applicant.allowLateWaitlist };
    assert.equal(buildApplicationCards([form], [], now)[0].primaryActionLabel, label);
  }
});

test('preview RSVPs stay final, support identical retries, and do not alter another applicant', () => {
  for (const response of ['accepted', 'declined']) {
    const applicant = createPreviewApplicant('invited', now);
    const other = createPreviewApplicant('accepted', now);
    const saved = call(applicant, 'PUT', '/api/registrations/me/invitation-response', { response });
    assert.equal(saved.status, 200);
    assert.equal(applicant.registration?.invitation_response, response);
    assert.deepEqual(call(applicant, 'PUT', '/api/registrations/me/invitation-response', { response }), saved);
    assert.equal(call(applicant, 'PUT', '/api/registrations/me/invitation-response', { response: response === 'accepted' ? 'declined' : 'accepted' }).status, 409);
    assert.equal(other.registration?.invitation_response, 'accepted');
    assert.equal(createPreviewApplicant('invited', now).registration?.invitation_response, null, 'reset restores the starting state');
  }
  for (const id of ['waitlisted', 'expired', 'rejected'] as const) assert.equal(call(createPreviewApplicant(id, now), 'PUT', '/api/registrations/me/invitation-response', { response: 'accepted' }).status, 409);
});

test('preview applications respect waitlist acknowledgement, closure, uniqueness, and account ownership', () => {
  const late = createPreviewApplicant('late', now);
  assert.equal(call(late, 'POST', '/api/registrations', { first_name: 'Test' }).status, 412);
  assert.equal(call(late, 'POST', '/api/registrations', { email: 'forged@example.com', status: 'approved' }, 'waitlist=true').status, 201);
  assert.equal(late.registration?.status, 'waitlisted');
  assert.equal(late.registration?.answers.email, late.email);
  assert.equal(call(late, 'POST', '/api/registrations', {}, 'waitlist=true').status, 409);
  assert.equal(call(late, 'PUT', '/api/registrations/me', {}, 'waitlist=true').status, 403);
  assert.equal(call(createPreviewApplicant('closed', now), 'POST', '/api/registrations', {}, 'waitlist=true').status, 403);
  const open = createPreviewApplicant('new', now);
  assert.equal(call(open, 'POST', '/api/registrations', { first_name: 'Alex' }).status, 201);
  assert.equal(open.registration?.status, 'pending');
  assert.equal(call(open, 'PUT', '/api/registrations/me', { first_name: 'Updated' }).status, 200);
  assert.equal(open.registration?.answers.first_name, 'Updated');
  assert.equal(call(open, 'POST', '/api/registrations', {}, 'form_key=other').status, 404);
});

test('profile, matching, and team actions use independent in-memory applicants', () => {
  const applicant = createPreviewApplicant('new', now);
  const other = createPreviewApplicant('review', now);
  call(applicant, 'PUT', '/api/profile', { first_name: 'Edited', email: 'forged@example.com' });
  assert.equal(applicant.profile.first_name, 'Edited');
  assert.equal(applicant.profile.email, applicant.email);
  assert.equal(other.profile.first_name, 'Maya');
  assert.equal(call(applicant, 'GET', '/api/participants/me').status, 404);
  assert.equal(call(applicant, 'POST', '/api/participants', { full_name: 'Edited Chen', frontend_skills: ['React'] }).status, 201);
  assert.equal(call(applicant, 'GET', '/api/participants/me').status, 200);
  assert.equal(call(applicant, 'POST', '/api/teams/join', { invite_code: 'WRONG1' }).status, 404);
  assert.equal(call(applicant, 'POST', '/api/teams/create', { name: 'My sample team' }).status, 201);
  assert.equal(applicant.team?.members.length, 1);
  assert.equal(call(applicant, 'POST', '/api/teams/join', { invite_code: 'BRH026' }).status, 409);
  call(applicant, 'POST', '/api/teams/leave');
  assert.equal(call(applicant, 'POST', '/api/teams/join', { invite_code: 'BRH026' }).status, 201);
  assert.equal(applicant.team?.members.length, 2);
  assert.equal(other.team, null);
});

test('preview API rejects unknown actions and returns detached response snapshots', () => {
  const applicant = createPreviewApplicant('new', now);
  for (const path of ['/api/admin/emails/tests', '/api/admin/approval/release', '/api/unknown']) {
    assert.equal(call(applicant, 'POST', path).status, 501);
  }
  assert.deepEqual(call(applicant, 'GET', '/api/admin/me').body, { admin: false });
  const response = call(applicant, 'GET', '/api/profile').body as Record<string, unknown>;
  response.first_name = 'Tampered';
  assert.equal(applicant.profile.first_name, 'Alex');
});
