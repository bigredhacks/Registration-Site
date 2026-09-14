export interface AdminStudent {
  id: number;
  user_id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  status: string;
  released_status?: 'approved' | 'waitlisted' | 'rejected' | null;
  decision_released_at?: string | null;
  invitation_response?: 'accepted' | 'declined' | null;
  invitation_responded_at?: string | null;
  form_key?: string | null;
  team_name?: string | null;
}

export interface ReleaseDecision {
  id: number;
  expected_status: 'approved' | 'waitlisted' | 'rejected';
}

export function buildReleasePreview(ids: number[], students: AdminStudent[]) {
  const selectedIds = new Set(ids);
  const eligible = students.filter(student => selectedIds.has(student.id) && student.form_key === 'registration'
    && ['approved', 'waitlisted', 'rejected'].includes(student.status));
  return {
    students: eligible,
    decisions: eligible.map(student => ({ id: student.id, expected_status: student.status as ReleaseDecision['expected_status'] })),
    skipped: selectedIds.size - eligible.length,
  };
}

export function releaseStateLabel(student: AdminStudent) {
  return !student.released_status ? 'Not released' : student.released_status !== student.status ? 'Draft changes not released' : 'Released';
}

export function studentName(student: AdminStudent): string {
  return [student.first_name, student.last_name].filter(Boolean).join(' ') || student.email;
}

export function addToSelection(current: Map<number, AdminStudent>, students: AdminStudent[], formKey: string) {
  const next = new Map(current);
  for (const student of students) {
    if ((student.form_key ?? 'registration') === formKey) next.set(student.id, { ...next.get(student.id), ...student });
  }
  return next;
}

export function parseStudentList(value: string): string[] {
  return value.split(/[\n,;\t]+/).map(entry => entry.trim()).filter(Boolean);
}

export interface IdentityMatch {
  input: string;
  matches: AdminStudent[];
  duplicate: boolean;
}
