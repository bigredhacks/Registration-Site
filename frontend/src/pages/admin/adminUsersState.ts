import type { AdminStudent } from './adminApprovalState';

export type ProfileState = 'not_started' | 'incomplete' | 'complete';

export interface AdminUserRow {
  user_id: string;
  email: string | null;
  name: string | null;
  school: string | null;
  created_at: string;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  profile_state: ProfileState;
  profile_pct: number;
  registration_id: number | null;
  form_key: string;
  submitted_at: string | null;
}

export interface AdminUserApplication extends AdminStudent {
  created_at: string;
  checked_in?: boolean | null;
  checked_in_at?: string | null;
  answers?: Record<string, unknown> | null;
}

export interface AdminUserDetail {
  account: Pick<AdminUserRow, 'user_id' | 'email' | 'name' | 'created_at' | 'email_confirmed_at' | 'last_sign_in_at'>;
  profile: Record<string, unknown> | null;
  application: AdminUserApplication | null;
  profile_state: ProfileState;
  profile_pct: number;
  missing_profile_fields: string[];
  form_key: string;
}

export const PROFILE_STATE_OPTIONS: { value: ProfileState; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'incomplete', label: 'Incomplete' },
  { value: 'complete', label: 'Complete' },
];

export const PROFILE_STATUS_CLASS: Record<ProfileState, string> = {
  complete: 'admin-status-approved', incomplete: 'admin-status-waitlisted', not_started: 'admin-status-rejected',
};

export function profileStateLabel(state: ProfileState): string {
  return PROFILE_STATE_OPTIONS.find(option => option.value === state)?.label ?? state;
}

export function userName(user: { name: string | null }): string {
  return user.name || 'Unnamed user';
}

const APPLICATION_ANSWER_FIELDS = new Set([
  'email', 'first_name', 'last_name', 'school', 'age', 'phone_number', 'linkedin', 'country',
  'level_of_study', 'major', 'gender', 'dietary_restrictions', 'shirt_size',
]);

export function applicationAnswers(application: AdminUserApplication): Record<string, unknown> {
  const legacy = Object.fromEntries(Object.entries(application)
    .filter(([key, value]) => APPLICATION_ANSWER_FIELDS.has(key) && value != null && value !== ''));
  return { ...legacy, ...application.answers };
}

export function formatUserAnswer(value: unknown): string {
  if (value == null || value === '') return '—';
  if (Array.isArray(value)) return value.map(formatUserAnswer).join(', ') || '—';
  if (typeof value === 'object') return Object.entries(value as Record<string, unknown>)
    .map(([key, inner]) => `${key}: ${formatUserAnswer(inner)}`).join(' | ') || '—';
  return typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
}
