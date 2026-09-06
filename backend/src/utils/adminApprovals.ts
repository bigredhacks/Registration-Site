export interface ApprovalStudent {
  id: number;
  user_id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  school?: string | null;
  status: string;
  form_key?: string | null;
  checked_in?: boolean | null;
}

export function normalizeIdentity(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function filterApprovalStudents<T extends ApprovalStudent>(rows: T[], filters: {
  status?: string; search?: string; checkedIn?: string;
}): T[] {
  const search = normalizeIdentity(filters.search ?? '');
  return rows.filter(row => {
    if (filters.status && row.status !== filters.status) return false;
    if (filters.checkedIn === 'true' && row.checked_in !== true) return false;
    if (filters.checkedIn === 'false' && row.checked_in === true) return false;
    return !search || [row.email, `${row.first_name ?? ''} ${row.last_name ?? ''}`, row.school]
      .some(value => normalizeIdentity(value ?? '').includes(search));
  });
}

export function resolveApprovalIdentities<T extends ApprovalStudent>(rows: T[], entries: string[]) {
  const seen = new Set<string>();
  return entries.map(input => {
    const identity = normalizeIdentity(input);
    const duplicate = seen.has(identity);
    seen.add(identity);
    const matches = rows.filter(row => identity.includes('@')
      ? normalizeIdentity(row.email ?? '') === identity
      : normalizeIdentity(`${row.first_name ?? ''} ${row.last_name ?? ''}`) === identity);
    return { input, matches, duplicate };
  });
}

export function buildApprovalCsv(rows: Record<string, unknown>[]): string {
  const fields = [...new Set(rows.flatMap(row => Object.keys(row).filter(key => key !== 'answers')))];
  const answerKeys = [...new Set(rows.flatMap(row => row.answers && typeof row.answers === 'object' && !Array.isArray(row.answers) ? Object.keys(row.answers) : []))].sort();
  const escape = (value: unknown) => {
    const text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    // Treat spreadsheet formula prefixes as text when exporting user-provided answers.
    return `"${(/^[=+\-@\t\r]/.test(text) ? "'" + text : text).replace(/"/g, '""')}"`;
  };
  return [[...fields, ...answerKeys.map(key => `answer:${key}`)].map(escape).join(','), ...rows.map(row => {
    const answers = (row.answers && typeof row.answers === 'object' ? row.answers : {}) as Record<string, unknown>;
    return [...fields.map(field => row[field]), ...answerKeys.map(key => answers[key])].map(escape).join(',');
  })].join('\r\n');
}
