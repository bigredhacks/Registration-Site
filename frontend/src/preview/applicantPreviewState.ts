import type { ApplicantInvitation } from '../lib/invitations.ts';

export const APPLICANT_PERSONAS = [
  { id: 'new', label: 'Alex · Not started', name: 'Alex Chen', description: 'Registration is open. No application or team yet.' },
  { id: 'review', label: 'Maya · Under review', name: 'Maya Patel', description: 'Application submitted; team matching requested.' },
  { id: 'draft-approved', label: 'Jordan · Unreleased approval', name: 'Jordan Lee', description: 'An organizer drafted an approval. The applicant still sees Under review.' },
  { id: 'late', label: 'Priya · Apply on waitlist', name: 'Priya Shah', description: 'Registration closed; new waitlist applications are accepted.' },
  { id: 'waitlisted', label: 'Leo · Waitlisted', name: 'Leo Brooks', description: 'The applicant is already on the waitlist.' },
  { id: 'invited', label: 'Sam · Invited', name: 'Sam Rivera', description: 'An invitation is available to accept or decline.' },
  { id: 'accepted', label: 'Nora · Accepted', name: 'Nora Kim', description: 'Invitation accepted; already in a team.' },
  { id: 'declined', label: 'Owen · Declined', name: 'Owen Park', description: 'The applicant declined their invitation.' },
  { id: 'expired', label: 'Avery · Expired', name: 'Avery Diaz', description: 'The invitation expired without a response.' },
  { id: 'rejected', label: 'Emery · Not selected', name: 'Emery Bell', description: 'A rejection has been released to the applicant.' },
  { id: 'closed', label: 'Riley · Registration closed', name: 'Riley Quinn', description: 'Registration closed with no waitlist intake or existing application.' },
] as const;
export type PersonaId = typeof APPLICANT_PERSONAS[number]['id'];
export function resolvePersona(id: string | null): PersonaId {
  return APPLICANT_PERSONAS.find(persona => persona.id === id)?.id ?? 'new';
}
export interface PreviewRegistration extends ApplicantInvitation {
  id: number;
  user_id: string;
  form_key: string;
  form_version: number;
  created_at: string;
  answers: Record<string, unknown>;
}
interface PreviewTeam {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  members: { user_id: string; full_name: string; joined_at: string }[];
}
export interface PreviewApplicant {
  id: PersonaId;
  userId: string;
  email: string;
  profile: Record<string, unknown>;
  registration: PreviewRegistration | null;
  closesAt: string;
  allowLateWaitlist: boolean;
  invitationDeadline: string;
  team: PreviewTeam | null;
  participant: Record<string, unknown> | null;
}

export function createPreviewApplicant(id: PersonaId, now = Date.now()): PreviewApplicant {
  const persona = APPLICANT_PERSONAS.find(persona => persona.id === id)!;
  const [first_name, last_name] = persona.name.split(' ');
  const userId = `preview-${id}`;
  const email = `${first_name.toLowerCase()}@example.com`;
  const before = new Date(now - 86400000).toISOString();
  const after = new Date(now + 7 * 86400000).toISOString();
  const profile = {
    id: userId, first_name, last_name, full_name: persona.name, email,
    phone_number: '(607) 555-0100', age_range: '18–20', graduation_year: 2028,
    school: 'Cornell University', country: 'United States of America', level_of_study: 'Sophomore',
    major: 'Computer Science', gender: 'Prefer not to say', shirt_size: 'M',
    dietary_restrictions: ['Vegetarian'], linkedin: 'https://www.linkedin.com/in/example',
  };
  const status = ['invited', 'accepted', 'declined'].includes(id) ? 'approved'
    : ['expired', 'rejected'].includes(id) ? 'rejected' : id === 'waitlisted' ? 'waitlisted' : 'pending';
  const registration: PreviewRegistration | null = ['new', 'late', 'closed'].includes(id) ? null : {
    id: APPLICANT_PERSONAS.findIndex(persona => persona.id === id) + 1,
    user_id: userId, form_key: 'registration', form_version: 1, created_at: before,
    status, decision_released_at: status === 'pending' ? null : before,
    invitation_response: id === 'accepted' ? 'accepted' : ['declined', 'expired'].includes(id) ? 'declined' : null,
    invitation_responded_at: ['accepted', 'declined', 'expired'].includes(id) ? before : null,
    invitation_expired_at: id === 'expired' ? before : null,
    answers: { ...profile, age: profile.age_range, mlh_code_of_conduct: true, mlh_data_sharing_consent: true, mlh_emails_opt_in: false },
  };
  const applicant: PreviewApplicant = {
    id, userId, email, profile, registration,
    closesAt: ['new', 'review', 'draft-approved'].includes(id) ? after : before,
    allowLateWaitlist: id !== 'closed', invitationDeadline: id === 'expired' ? before : after,
    team: null, participant: null,
  };
  if (id === 'accepted') applicant.team = sampleTeam(applicant, 'Clock Tower', now);
  if (id === 'review') applicant.participant = {
    email, full_name: persona.name,
    frontend_experience: 'Intermediate', backend_experience: 'Beginner', design_experience: 'Advanced', hardware_experience: 'Beginner',
    frontend_preference: 1, backend_preference: 3, design_preference: 2, hardware_preference: 4, any_role_preference: 5,
    frontend_skills: ['React'], backend_skills: ['Node.js'], design_skills: ['Figma'], hardware_skills: [], hacker_type: 'FirstTimeHacker',
  };
  return applicant;
}
function sampleTeam(applicant: PreviewApplicant, name: string, now: number): PreviewTeam {
  const joined_at = new Date(now).toISOString();
  return { id: `team-${applicant.id}`, name, invite_code: 'BRH026', created_by: applicant.userId,
    members: [{ user_id: applicant.userId, full_name: String(applicant.profile.full_name), joined_at },
      { user_id: 'preview-teammate', full_name: 'Casey Morgan', joined_at }] };
}

/** Synthetic API only. Unknown requests are rejected, never forwarded. */
export function handleApplicantPreviewRequest(applicant: PreviewApplicant, method: string, path: string,
  query: URLSearchParams, body: Record<string, unknown>, fields: unknown[], now = Date.now()): { status: number; body: unknown } {
  const result = (body: unknown, status = 200) => ({ status, body: structuredClone(body) });
  const fail = (error: string, status: number, extra = {}) => result({ error, ...extra }, status);
  const form = { key: 'registration', title: 'BigRed//Hacks Fall 2026 Registration', description: 'Complete your registration for the hackathon',
    fields, version: 1, is_active: true, closes_at: applicant.closesAt, closes_timezone: 'America/New_York',
    allow_late_waitlist: applicant.allowLateWaitlist, is_closed: now >= Date.parse(applicant.closesAt), server_now: new Date(now).toISOString() };
  if (path === '/api/admin/me' && method === 'GET') return result({ admin: false });
  if (path === '/api/profile') {
    if (method === 'GET') return result(applicant.profile);
    if (method === 'PUT') {
      applicant.profile = { ...applicant.profile, ...body, email: applicant.email, id: applicant.userId };
      return result(applicant.profile);
    }
  }
  if (method === 'GET' && path === '/api/form-configs') return result([form]);
  if (method === 'GET' && path === '/api/form-configs/registration') return result(form);
  if (path.startsWith('/api/registrations') && query.has('form_key') && query.get('form_key') !== 'registration') return fail('Form not found in this preview.', 404);
  if (method === 'GET' && path === '/api/registrations/me/all') return result(applicant.registration ? [applicant.registration] : []);
  if (method === 'GET' && path === '/api/registrations/me') return applicant.registration ? result(applicant.registration) : fail('No application yet.', 404);
  if (method === 'GET' && path === '/api/registrations/me/invitation-settings') return result({ deadline: applicant.invitationDeadline, time_zone: 'America/New_York', version: 1, expired_count: 0, server_now: new Date(now).toISOString() });
  if (method === 'PUT' && path === '/api/registrations/me/invitation-response') {
    const registration = applicant.registration;
    if (!registration || registration.status !== 'approved') return fail('No invitation available.', 409);
    if (body.response !== 'accepted' && body.response !== 'declined') return fail('Choose accepted or declined.', 400);
    if (registration.invitation_response === body.response) return result(registration);
    if (registration.invitation_response) return fail('Your response is final. Reset this applicant to try again.', 409);
    if (now >= Date.parse(applicant.invitationDeadline)) return fail('The invitation deadline has passed.', 409);
    registration.invitation_response = body.response;
    registration.invitation_responded_at = new Date(now).toISOString();
    return result(registration);
  }
  if ((method === 'POST' && path === '/api/registrations') || (method === 'PUT' && path === '/api/registrations/me')) {
    const creating = method === 'POST';
    if (creating && applicant.registration) return fail('Application already exists.', 409, { code: 'REGISTRATION_EXISTS' });
    if (!creating && !applicant.registration) return fail('No application found.', 404);
    if (form.is_closed && (!creating || !applicant.allowLateWaitlist)) return fail('Registration is closed.', 403, { ...form, code: 'REGISTRATION_CLOSED' });
    if (form.is_closed && query.get('waitlist') !== 'true') return fail('Review the waitlist notice before submitting.', 412, { ...form, code: 'WAITLIST_ACKNOWLEDGEMENT_REQUIRED' });
    const status = form.is_closed ? 'waitlisted' : 'pending';
    applicant.registration = { ...(applicant.registration ?? {
      id: 100, user_id: applicant.userId, form_key: 'registration', form_version: 1,
      created_at: new Date(now).toISOString(), status, decision_released_at: status === 'waitlisted' ? new Date(now).toISOString() : null,
    }), answers: { ...body, email: applicant.email } };
    return result(applicant.registration, creating ? 201 : 200);
  }
  if (method === 'GET' && path === '/api/teams/me') return applicant.team ? result(applicant.team) : fail('No team yet.', 404);
  if (method === 'POST' && ['/api/teams/create', '/api/teams/join'].includes(path)) {
    if (applicant.team) return fail('You already belong to a team.', 409);
    const joining = path.endsWith('/join');
    if (joining && String(body.invite_code).toUpperCase() !== 'BRH026') return fail('Use BRH026 to join the sample team.', 404);
    if (!joining && !String(body.name ?? '').trim()) return fail('Enter a team name.', 400);
    applicant.team = sampleTeam(applicant, joining ? 'Clock Tower' : String(body.name).trim(), now);
    if (!joining) applicant.team.members = applicant.team.members.slice(0, 1);
    return result(applicant.team, 201);
  }
  if (method === 'POST' && path === '/api/teams/leave') { applicant.team = null; return result({ message: 'Left team.' }); }
  if (method === 'GET' && path === '/api/participants/me') return applicant.participant ? result(applicant.participant) : fail('No matching request.', 404);
  if ((method === 'POST' && path === '/api/participants') || (method === 'PUT' && path === '/api/participants/me')) {
    applicant.participant = { ...body, email: applicant.email };
    return result(applicant.participant, method === 'POST' ? 201 : 200);
  }
  return fail(`This action is unavailable in the local preview: ${method} ${path}`, 501);
}
