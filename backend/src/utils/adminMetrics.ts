import { z } from 'zod';

export const metricFields = ['status', 'school', 'level_of_study', 'form_key', 'checked_in'] as const;
type MetricField = typeof metricFields[number];
export type MetricRow = Record<Exclude<MetricField, 'checked_in'>, string | null> & {
  checked_in: boolean | null;
  created_at: string;
};

export const metricsQuerySchema = z.object({
  status: z.string().optional(),
  school: z.string().optional(),
  level_of_study: z.string().optional(),
  form_key: z.string().optional(),
  checked_in: z.enum(['true', 'false', '']).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
}).refine((value) => !value.from || !value.to || value.from <= value.to, {
  message: 'Start date must be on or before end date.',
});

export function buildMetrics(rows: MetricRow[], filters: z.infer<typeof metricsQuerySchema>) {
  // Empty strings represent missing values, including nullable check-in records.
  const valueOf = (row: MetricRow, field: MetricField) => String(row[field] ?? '');
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
  return {
    total: filtered.length,
    overall_total: rows.length,
    by_status: tally('status'),
    by_school: tally('school'),
    by_level_of_study: tally('level_of_study'),
    by_form_key: tally('form_key'),
    by_checked_in: tally('checked_in'),
    options: Object.fromEntries(metricFields.map((field) => [field,
      [...new Set(rows.map((row) => valueOf(row, field)))].sort((a, b) => a.localeCompare(b)),
    ])),
  };
}
