import { z } from 'zod';

export const metricFields = ['status', 'school', 'level_of_study', 'form_key', 'checked_in', 'released_status', 'release_state', 'invitation_response'] as const;
type MetricField = typeof metricFields[number];
export type MetricRow = Record<Exclude<MetricField, 'checked_in' | 'released_status' | 'release_state' | 'invitation_response'>, string | null> & {
  released_status?: string | null;
  invitation_response?: string | null;
  checked_in: boolean | null;
  created_at: string;
};

const stateOptions = {
  released_status: ['approved', 'waitlisted', 'rejected', 'unreleased', 'not_applicable'],
  release_state: ['unreleased', 'changed', 'current', 'not_applicable'],
  invitation_response: ['accepted', 'declined', 'unanswered', 'no_invitation', 'not_applicable'],
} as const;

export const metricsQuerySchema = z.object({
  status: z.string().optional(),
  school: z.string().optional(),
  level_of_study: z.string().optional(),
  form_key: z.string().optional(),
  checked_in: z.enum(['true', 'false', '']).optional(),
  released_status: z.enum(stateOptions.released_status).optional(),
  release_state: z.enum(stateOptions.release_state).optional(),
  invitation_response: z.enum(stateOptions.invitation_response).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
}).refine((value) => !value.from || !value.to || value.from <= value.to, {
  message: 'Start date must be on or before end date.',
});

export function buildMetrics(rows: MetricRow[], filters: z.infer<typeof metricsQuerySchema>) {
  // Empty strings represent missing values, including nullable check-in records.
  const valueOf = (row: MetricRow, field: MetricField): string => {
    if (['released_status', 'release_state', 'invitation_response'].includes(field) && row.form_key !== 'registration') return 'not_applicable';
    if (field === 'released_status') return row.released_status ?? 'unreleased';
    if (field === 'release_state') return !row.released_status ? 'unreleased' : row.released_status === row.status ? 'current' : 'changed';
    if (field === 'invitation_response') return row.invitation_response ?? (row.released_status === 'approved' ? 'unanswered' : 'no_invitation');
    return String(row[field] ?? '');
  };
  const filtered = rows.filter((row) => {
    if (!metricFields.every((field) => filters[field] === undefined || valueOf(row, field) === filters[field])) return false;
    const day = row.created_at.slice(0, 10);
    return (!filters.from || day >= filters.from) && (!filters.to || day <= filters.to);
  });
  const tally = (field: MetricField) => {
    const counts: Record<string, number> = Object.create(null);
    for (const row of filtered) {
      const value = valueOf(row, field);
      counts[value] = (counts[value] ?? 0) + 1;
    }
    return counts;
  };
  const invitations = filtered.filter(row => row.form_key === 'registration' && row.released_status === 'approved');
  return {
    released_invitations: invitations.length,
    invitation_counts: {
      accepted: invitations.filter(row => row.invitation_response === 'accepted').length,
      declined: invitations.filter(row => row.invitation_response === 'declined').length,
      unanswered: invitations.filter(row => !row.invitation_response).length,
    },
    by_released_status: tally('released_status'),
    by_release_state: tally('release_state'),
    by_invitation_response: tally('invitation_response'),
    total: filtered.length,
    overall_total: rows.length,
    by_status: tally('status'),
    by_school: tally('school'),
    by_level_of_study: tally('level_of_study'),
    by_form_key: tally('form_key'),
    by_checked_in: tally('checked_in'),
    approved_checked_in: filtered.filter((row) => row.status === 'approved' && row.checked_in === true).length,
    options: Object.fromEntries(metricFields.map((field) => [field,
      field in stateOptions ? stateOptions[field as keyof typeof stateOptions]
        : [...new Set(rows.map((row) => valueOf(row, field)))].sort((a, b) => a.localeCompare(b)),
    ])),
  };
}
