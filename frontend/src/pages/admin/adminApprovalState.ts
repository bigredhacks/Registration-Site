export interface AdminStudent {
  id: number;
  user_id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  status: string;
  form_key?: string | null;
  team_name?: string | null;
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
