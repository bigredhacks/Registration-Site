import type { AdminUserDetail, AdminUserRow } from './adminUsersState';

const profileFields = [
  ['first_name', 'First Name'], ['last_name', 'Last Name'], ['phone_number', 'Phone Number'],
  ['age_range', 'Age'], ['graduation_year', 'Graduation Year'], ['school', 'University'],
  ['country', 'Country'], ['level_of_study', 'Level of Study'], ['major', 'Major'],
  ['gender', 'Gender'], ['dietary_restrictions', 'Dietary Restrictions'], ['shirt_size', 'Shirt Size'],
  ['linkedin', 'LinkedIn'],
];
const identities = ['Maya Chen', 'Jordan Lee', 'Priya Shah', 'Leo Brooks', 'Sam Rivera'];
const accounts = Array.from({ length: 73 }, (_, index) => {
  const name = index === 0 ? null : identities[index % identities.length];
  const profile: Record<string, unknown> | null = index === 0 ? null : index === 1 ? {} : {
    first_name: name?.split(' ')[0], last_name: name?.split(' ')[1],
    school: index % 2 ? 'Cornell University' : 'RIT',
    ...(index % 3 === 0 ? {
      phone_number: '(607) 555-0100', age_range: '18–20', graduation_year: 2028,
      country: 'United States', level_of_study: 'Junior', major: 'Computer Science',
      gender: 'Prefer not to say', dietary_restrictions: ['None'], shirt_size: 'M',
      linkedin: 'https://www.linkedin.com/in/example',
    } : {}),
  };
  const missing = profileFields.filter(([key]) => {
    const value = profile?.[key];
    return value == null || value === '' || (Array.isArray(value) && !value.length);
  }).map(([, label]) => label);
  const account = {
    user_id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    email: index === 0 ? 'account.with.a.very.long.email.address.and.no.profile@example.com' : `user${index + 1}@example.com`,
    name,
    created_at: `2026-09-${String(20 - index % 20).padStart(2, '0')}T14:00:00Z`,
    email_confirmed_at: index % 4 === 0 ? null : '2026-09-20T14:01:00Z',
    last_sign_in_at: index % 4 === 0 ? null : '2026-09-20T15:00:00Z',
  };
  return { index, account, profile, missing };
});

function detailFor(user: typeof accounts[number], formKey: string): AdminUserDetail {
  const { index, account, profile, missing } = user;
  const submitted = formKey === 'registration' ? index > 2 && index % 2 === 0 : formKey === 'workshop' && index > 1 && index % 3 === 0;
  return {
    account, profile, form_key: formKey,
    profile_state: missing.length === 13 ? 'not_started' : missing.length ? 'incomplete' : 'complete',
    profile_pct: Math.round((13 - missing.length) / 13 * 100), missing_profile_fields: missing,
    application: submitted ? {
      id: index + (formKey === 'registration' ? 1 : 101), user_id: account.user_id, form_key: formKey,
      email: `submitted${index}@example.com`, first_name: index === 4 ? 'Submitted name' : String(profile?.first_name ?? ''), last_name: String(profile?.last_name ?? ''),
      created_at: '2026-09-19T10:00:00Z', status: index === 4 ? 'approved' : 'pending',
      released_status: index === 4 && formKey === 'registration' ? 'approved' : null,
      decision_released_at: index === 4 && formKey === 'registration' ? '2026-09-20T10:00:00Z' : null,
      invitation_response: index === 4 && formKey === 'registration' ? 'accepted' : null,
      invitation_responded_at: index === 4 && formKey === 'registration' ? '2026-09-20T11:00:00Z' : null,
      invitation_expired_at: null,
      answers: { first_name: index === 4 ? 'Submitted name' : profile?.first_name, email: `submitted${index}@example.com`, why_hack: 'Learn something new with a team.', interests: ['Web', 'Hardware'], first_hackathon: true },
    } : null,
  };
}

export function previewUsers(path: string, params: URLSearchParams): unknown {
  const formKey = params.get('form_key') ?? 'registration';
  if (path !== '/api/admin/users') {
    const user = accounts.find(user => user.account.user_id === path.split('/').pop());
    return user ? detailFor(user, formKey) : null;
  }
  const rows: AdminUserRow[] = accounts.map(user => {
    const detail = detailFor(user, formKey);
    return {
      ...detail.account, school: typeof user.profile?.school === 'string' ? user.profile.school : null,
      profile_state: detail.profile_state, profile_pct: detail.profile_pct,
      registration_id: detail.application?.id ?? null, form_key: formKey,
      submitted_at: detail.application?.created_at ?? null,
    };
  });
  const q = (params.get('q') ?? '').trim().toLowerCase();
  const matched = rows.filter(row =>
    (!q || [row.name, row.email].some(value => value?.toLowerCase().includes(q))) &&
    (!params.get('profile_state') || row.profile_state === params.get('profile_state')) &&
    (!params.get('submitted') || String(row.registration_id != null) === params.get('submitted')) &&
    (!params.get('email_verified') || String(row.email_confirmed_at != null) === params.get('email_verified')) &&
    (!params.get('from') || row.created_at!.slice(0, 10) >= params.get('from')!) &&
    (!params.get('to') || row.created_at!.slice(0, 10) <= params.get('to')!),
  );
  const sort = params.get('sort') ?? 'created_at';
  const dir = params.get('dir') === 'asc' ? 1 : -1;
  matched.sort((a, b) => {
    const left = sort === 'name' ? a.name : sort === 'school' ? a.school : a.created_at;
    const right = sort === 'name' ? b.name : sort === 'school' ? b.school : b.created_at;
    if (left == null || right == null) return left == null && right == null ? a.user_id.localeCompare(b.user_id) : left == null ? 1 : -1;
    return dir * left.localeCompare(right, undefined, { sensitivity: 'base' }) || a.user_id.localeCompare(b.user_id);
  });
  const limit = Number(params.get('limit') ?? 50);
  const offset = Number(params.get('offset') ?? 0);
  return { data: matched.slice(offset, offset + limit), count: matched.length, limit, offset };
}
