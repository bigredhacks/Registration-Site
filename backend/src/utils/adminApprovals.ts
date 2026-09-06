export interface ApprovalStudent {
  id: number;
  user_id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  school?: string | null;
  age?: string | null;
  level_of_study?: string | null;
  major?: string | null;
  answers?: Record<string, unknown> | null;
  status: string;
  form_key?: string | null;
  checked_in?: boolean | null;
  created_at?: string | null;
}

export interface ApprovalAnswerFilter {
  field: string;
  row?: string;
  operator: 'is' | 'is_not' | 'contains' | 'not_contains' | 'empty' | 'not_empty' | 'gt' | 'gte' | 'lt' | 'lte';
  values?: string[];
}
export interface ApprovalFilterField {
  field: string;
  row?: string;
  label: string;
  kind: 'choice' | 'text' | 'number';
  options: string[];
}
interface FormQuestion {
  id: string; label: string; type: string; options?: string[]; rows?: string[]; columns?: string[];
}
const LEGACY_FIELDS = ['first_name', 'last_name', 'email', 'school', 'age', 'level_of_study', 'major', 'shirt_size'] as const;

export function approvalAnswerValue(student: ApprovalStudent, field: string, row?: string): unknown {
  const value = student.answers && Object.prototype.hasOwnProperty.call(student.answers, field)
    ? student.answers[field]
    : LEGACY_FIELDS.some(key => key === field) ? (student as unknown as Record<string, unknown>)[field] : undefined;
  return row === undefined ? value : value && typeof value === 'object' && !Array.isArray(value)
    && Object.prototype.hasOwnProperty.call(value, row) ? (value as Record<string, unknown>)[row] : undefined;
}
function answerValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(answerValues);
  if (typeof value === 'boolean') return [value ? 'Yes' : 'No'];
  if (typeof value === 'number' && Number.isFinite(value)) return [String(value)];
  return typeof value === 'string' && value.trim() ? [value.normalize('NFKC').trim().replace(/\s+/g, ' ')] : [];
}
function answerIdentity(value: string, field: string): string {
  const identity = normalizeIdentity(value);
  return field === 'age' ? identity.replace(/[–—−]/g, '-') : identity;
}
export function approvalFilterFields(students: ApprovalStudent[], questions: FormQuestion[]): ApprovalFilterField[] {
  const fields = [...questions];
  for (const id of LEGACY_FIELDS) {
    if (!fields.some(field => field.id === id) && students.some(student => answerValues(approvalAnswerValue(student, id)).length)) {
      fields.push({ id, label: id.replace(/_/g, ' '), type: ['first_name', 'last_name', 'email'].includes(id) ? 'text' : 'dropdown' });
    }
  }
  return fields.flatMap(question => {
    if (question.type === 'note' || question.type === 'file') return [];
    const grid = question.type === 'multipleChoiceGrid' || question.type === 'preferenceGrid';
    return (grid ? question.rows ?? [] : [undefined]).map(row => {
      const observed = students.flatMap(student => answerValues(approvalAnswerValue(student, question.id, row)));
      const choice = grid || ['dropdown', 'radio', 'checkbox', 'checkboxGroup'].includes(question.type);
      const options = new Map<string, string>();
      if (choice) for (const value of [...(question.type === 'checkbox' ? ['Yes', 'No'] : grid ? question.columns ?? [] : question.options ?? []), ...observed]) {
        if (value.trim()) options.set(answerIdentity(value, question.id), value);
      }
      return { field: question.id, ...(row === undefined ? {} : { row }), label: grid ? `${question.label} · ${row}` : question.label,
        kind: choice ? 'choice' as const : question.type === 'number' ? 'number' as const : 'text' as const,
        options: [...options.values()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })) };
    });
  });
}
export function matchesApprovalAnswer(student: ApprovalStudent, filter: ApprovalAnswerFilter): boolean {
  const answers = answerValues(approvalAnswerValue(student, filter.field, filter.row)).map(value => answerIdentity(value, filter.field));
  if (filter.operator === 'empty') return answers.length === 0;
  if (filter.operator === 'not_empty') return answers.length > 0;
  // Missing answers are a separate cohort, including for negative comparisons.
  if (!answers.length) return false;
  const values = (filter.values ?? []).map(value => answerIdentity(value, filter.field));
  switch (filter.operator) {
    case 'is': return answers.some(answer => values.includes(answer));
    case 'is_not': return answers.every(answer => !values.includes(answer));
    case 'contains': return answers.some(answer => answer.includes(values[0]));
    case 'not_contains': return answers.every(answer => !answer.includes(values[0]));
    default: {
      const target = Number(values[0]);
      return answers.some(answer => {
        const number = Number(answer);
        if (!Number.isFinite(number) || !Number.isFinite(target)) return false;
        if (filter.operator === 'gt') return number > target;
        if (filter.operator === 'gte') return number >= target;
        if (filter.operator === 'lt') return number < target;
        return number <= target;
      });
    }
  }
}

export function normalizeIdentity(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function filterApprovalStudents<T extends ApprovalStudent>(rows: T[], filters: {
  status?: string; search?: string; checkedIn?: string; answers?: ApprovalAnswerFilter[];
  from?: string; to?: string;
}): T[] {
  const search = normalizeIdentity(filters.search ?? '');
  return rows.filter(row => {
    if (filters.status && row.status !== filters.status) return false;
    if (filters.checkedIn === 'true' && row.checked_in !== true) return false;
    if (filters.checkedIn === 'false' && row.checked_in === true) return false;
    if (filters.from || filters.to) {
      // Inclusive UTC days compared as date prefixes, the same way buildMetrics slices
      // created_at — so a count here matches the equivalent range on the Stats tab.
      const day = (row.created_at ?? '').slice(0, 10);
      if (!day) return false;
      if (filters.from && day < filters.from) return false;
      if (filters.to && day > filters.to) return false;
    }
    if (filters.answers && !filters.answers.every(filter => matchesApprovalAnswer(row, filter))) return false;
    return !search || [row.email, `${row.first_name ?? ''} ${row.last_name ?? ''}`, String(approvalAnswerValue(row, 'school') ?? '')]
      .some(value => normalizeIdentity(value ?? '').includes(search));
  });
}

export const sortableApprovalColumns = ['created_at', 'status', 'email', 'name', 'first_name', 'last_name', 'school', 'level_of_study'] as const;
export type SortableApprovalColumn = typeof sortableApprovalColumns[number];

function sortValue(row: ApprovalStudent, column: SortableApprovalColumn): string {
  // The Student column renders "First Last", so sorting it has to use both parts —
  // ordering on first_name alone leaves everyone sharing a first name unsorted.
  if (column === 'name') {
    return [...answerValues(approvalAnswerValue(row, 'first_name')), ...answerValues(approvalAnswerValue(row, 'last_name'))].join(' ');
  }
  // `created_at` and `status` are row columns only; the rest may be answered on the
  // form, so they go through the same answers-first lookup the list and filters use.
  const raw = column === 'created_at' || column === 'status'
    ? row[column]
    : approvalAnswerValue(row, column);
  return answerValues(raw).join(' ');
}

/**
 * Orders the filtered list. Sorting happens here rather than in PostgREST because
 * answers live in JSONB and the rows are already filtered in memory by this point.
 * An unrecognised column falls back to the unsorted order rather than erroring, so a
 * stale bookmark reorders the table instead of breaking it.
 */
export function sortApprovalStudents<T extends ApprovalStudent>(rows: T[], sort?: string, dir?: string): T[] {
  if (!(sortableApprovalColumns as readonly string[]).includes(sort ?? '')) return rows;
  const column = sort as SortableApprovalColumn;
  // Newest-first reads better for a date; everything else reads better A–Z.
  const ascending = dir === 'asc' || dir === 'desc' ? dir === 'asc' : column !== 'created_at';
  return [...rows].sort((a, b) => {
    const left = sortValue(a, column);
    const right = sortValue(b, column);
    // Unanswered rows sink to the bottom in both directions rather than forming a
    // leading block of blanks when the sort is flipped.
    if (!left || !right) return left ? -1 : right ? 1 : b.id - a.id;
    const order = column === 'created_at'
      ? left.localeCompare(right)
      : left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
    // Ties keep the newest-id-first order the unsorted list uses, so paging is stable.
    return (ascending ? order : -order) || b.id - a.id;
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
