import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import ToastProvider from './components/Toast/ToastProvider';
import { ApprovalWorkspace } from './pages/admin/AdminPage';
import AdminSelectionProvider from './pages/admin/AdminSelectionProvider';
import AdminFormEditor from './pages/admin/AdminFormEditor';
import AdminFormList from './pages/admin/AdminFormList';
import type { ApprovalAnswerFilter, ApprovalFilterField } from './pages/admin/AdminApprovalFilters';
import type { AdminStudent } from './pages/admin/adminApprovalState';
import type { FormField } from './lib/formConfig';
import type { MatcherTeam, ParticipantSummary, TeamOverview } from './pages/admin/adminTeamMatchingState';
import './index.css';

// Standalone Vite development entry. No production route, auth override, or
// backend fallback: every /api request is answered by these fictional fixtures.
if (!import.meta.env.DEV) throw new Error('The sample admin preview is development-only.');

interface Student extends AdminStudent {
  first_name: string; last_name: string; school: string; form_key: string;
  created_at: string; checked_in: boolean; checked_in_at: string | null;
  answers: Record<string, unknown>;
}
interface PreviewForm {
  key: string; title: string; description: string; fields: FormField[];
  is_active: boolean; version: number; updated_at: string;
  closes_at: string | null; closes_timezone: string;
}
interface Draft { team_number: number; members: { participant_id: string }[] }
interface Payload extends Partial<PreviewForm> {
  form_key?: string; ids?: number[]; status?: string; checked_in?: boolean;
  entries?: string[]; teams?: Draft[]; pool_id?: string;
}
const normalize = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
const fullName = (student: Student) => `${student.first_name} ${student.last_name}`;
const names = ['Maya Chen', 'Jordan Lee', 'Priya Shah', 'Leo Brooks', 'Sam Rivera', 'Sam Rivera', 'Alex Patel', 'Nora Kim', 'Owen Park', 'Avery Diaz', 'Emery Bell', 'Riley Quinn'];
const firstNames = ['Casey', 'Morgan', 'Taylor', 'Jamie', 'Quinn', 'Robin', 'Ellis', 'Drew', 'Blair'];
const lastNames = ['Adams', 'Bennett', 'Carter', 'Davis', 'Evans', 'Foster'];
const schools = ['Cornell University', 'Columbia University', 'Binghamton University', 'RIT'];
const students: Student[] = Array.from({ length: 66 }, (_, index) => {
  const id = index + 1;
  const name = names[index] ?? `${firstNames[(index - 12) % firstNames.length]} ${lastNames[Math.floor((index - 12) / firstNames.length)]}`;
  const [first_name, last_name] = name.split(' ');
  const email = `${first_name.toLowerCase()}.${last_name.toLowerCase()}${index === 5 ? '2' : ''}@example.com`;
  return {
    id, user_id: `sample-user-${id}`, first_name, last_name, email, form_key: 'registration',
    school: schools[index % schools.length],
    status: index < 4 ? 'approved' : ['pending', 'approved', 'pending', 'waitlisted', 'pending', 'rejected'][index % 6],
    checked_in: index < 2, checked_in_at: index < 2 ? '2026-09-05T14:00:00Z' : null,
    created_at: `2026-08-${String(index % 28 + 1).padStart(2, '0')}T14:00:00Z`,
    answers: { first_name, last_name, email, school: schools[index % schools.length], age: ['Under 18', '18–20', '21–24', '25–30', '31+'][index % 5], level_of_study: ['Freshman', 'Sophomore', 'Junior', 'Senior'][index % 4], major: ['Computer Science', 'Physics', 'Mathematics'][index % 3], shirt_size: ['S', 'M', 'L'][index % 3], why_hack: 'Build a useful project with a team and learn something new.', dietary_restrictions: index % 3 ? ['None'] : ['Vegetarian', 'Gluten-Free'], first_time_hacker: index % 2 === 0, technical_skills: { Frontend: index % 2 ? 'Beginner' : 'Advanced' }, mlh_code_of_conduct: true },
  };
});
students.push(...students.slice(0, 8).map(student => ({ ...student, id: student.id + 100, form_key: 'workshop', status: 'pending', checked_in: false, checked_in_at: null })));
const fields: FormField[] = [
  { id: 'first_name', label: 'First name', type: 'text', required: true },
  { id: 'last_name', label: 'Last name', type: 'text', required: true },
  { id: 'email', label: 'Email', type: 'email', required: true },
  ...[['school', 'School'], ['age', 'Age group'], ['level_of_study', 'Level of study'], ['major', 'Major'], ['shirt_size', 'Shirt size']].map(([id, label]): FormField => ({ id, label, type: 'dropdown', options: [], required: true })),
  { id: 'why_hack', label: 'Why do you want to attend?', type: 'text', required: false },
  { id: 'dietary_restrictions', label: 'Dietary restrictions', type: 'checkboxGroup', options: ['None', 'Vegetarian', 'Gluten-Free'], required: false },
  { id: 'first_time_hacker', label: 'First hackathon', type: 'checkbox', checkboxText: 'This is my first hackathon', required: false },
  { id: 'technical_skills', label: 'Technical skills', type: 'multipleChoiceGrid', rows: ['Frontend'], columns: ['Beginner', 'Advanced'], required: false },
];
const forms: PreviewForm[] = ['registration', 'workshop'].map(key => ({ key,
  title: key === 'registration' ? 'BigRed//Hacks Fall 2026' : 'Workshop RSVP', description: '', fields,
  is_active: true, version: 1, updated_at: '2026-09-05T14:00:00Z',
  closes_at: key === 'registration' ? '2026-09-19T03:59:00Z' : null, closes_timezone: 'America/New_York',
}));
const teams = [
  { id: 'sample-team-1', name: 'Clock Tower', members: [1, 2, 3, 4] },
  { id: 'sample-team-2', name: 'Big Red Builders', members: [5, 6, 7] },
  { id: 'sample-team-3', name: 'Cayuga Coders', members: [8, 9, 900] },
];
const participantIds = Array.from({ length: 23 }, (_, index) => index + 1);
const drafts: Record<string, Draft[]> = { default: [{ team_number: 1, members: [10, 11, 12, 13].map(id => ({ participant_id: `participant-${id}` })) }] };

function overview(formKey: string, pool: string): TeamOverview {
  const registration = (id: number) => students.find(student => student.user_id === `sample-user-${id}` && student.form_key === formKey) ?? null;
  const currentTeam = (id: number) => teams.find(team => team.members.includes(id));
  const participants: ParticipantSummary[] = (pool === 'default' ? participantIds : []).map(id => {
    const student = students.find(student => student.id === id)!;
    return { id: `participant-${id}`, user_id: student.user_id, full_name: fullName(student), email: student.email,
      hacker_type: id % 2 ? 'FirstTimeHacker' : 'VeteranHacker', registration: registration(id), current_team_name: currentTeam(id)?.name ?? null };
  });
  const savedTeams: MatcherTeam[] = (drafts[pool] ?? []).map(team => ({ team_number: team.team_number,
    members: team.members.flatMap(member => participants.filter(person => person.id === member.participant_id)),
    conflicts: team.members.filter(member => participants.find(person => person.id === member.participant_id)?.current_team_name).length,
    missing_members: team.members.filter(member => !participants.some(person => person.id === member.participant_id)).length,
  }));
  return { participants, looking: participants.filter(person => !person.current_team_name), savedTeams,
    teams: teams.map(team => {
      const members = team.members.map(id => {
        const student = students.find(row => row.id === id);
        return { user_id: `sample-user-${id}`, full_name: student ? fullName(student) : 'Finley Gray', email: student?.email ?? '', registration: registration(id) };
      });
      const statuses = new Set(members.map(member => member.registration?.status ?? 'missing_application'));
      return { id: team.id, name: team.name, invite_code: team.id.slice(-1).repeat(6), members,
        status: statuses.has('missing_application') ? 'missing_application' : statuses.size === 1 ? [...statuses][0] : 'mixed' };
    }),
  };
}
function sampleAnswer(student: Student, field: string, row?: string): string[] {
  let value = Object.prototype.hasOwnProperty.call(student.answers, field) ? student.answers[field] : student[field as keyof Student];
  if (row !== undefined) value = value && typeof value === 'object' ? (value as Record<string, unknown>)[row] : undefined;
  return (Array.isArray(value) ? value : [value]).flatMap(answer => answer == null || answer === '' ? [] : [typeof answer === 'boolean' ? answer ? 'Yes' : 'No' : String(answer)]);
}
function sampleFilterFields(formKey: string): ApprovalFilterField[] {
  return (forms.find(form => form.key === formKey)?.fields ?? []).flatMap(field => {
    if (field.type === 'file' || field.type === 'note') return [];
    const grid = field.type === 'multipleChoiceGrid' || field.type === 'preferenceGrid';
    return (grid ? field.rows : [undefined]).map(row => ({ field: field.id, row,
      label: row === undefined ? field.label : `${field.label} · ${row}`,
      kind: ['text', 'email'].includes(field.type) ? 'text' : 'choice',
      options: [...new Set(students.filter(student => student.form_key === formKey).flatMap(student => sampleAnswer(student, field.id, row)))].sort(),
    }));
  });
}
function sampleMatches(student: Student, filter: ApprovalAnswerFilter) {
  const answers = sampleAnswer(student, filter.field, filter.row).map(normalize);
  if (filter.operator === 'empty') return answers.length === 0;
  if (filter.operator === 'not_empty') return answers.length > 0;
  if (!answers.length) return false;
  const values = (filter.values ?? []).map(normalize);
  if (filter.operator === 'is') return answers.some(answer => values.includes(answer));
  if (filter.operator === 'is_not') return answers.every(answer => !values.includes(answer));
  if (filter.operator === 'contains') return answers.some(answer => answer.includes(values[0]));
  if (filter.operator === 'not_contains') return answers.every(answer => !answer.includes(values[0]));
  return answers.some(answer => {
    const number = Number(answer), target = Number(values[0]);
    if (!Number.isFinite(number) || !Number.isFinite(target)) return false;
    return filter.operator === 'gt' ? number > target : filter.operator === 'gte' ? number >= target : filter.operator === 'lt' ? number < target : number <= target;
  });
}
// Mirrors sortApprovalStudents in backend/src/utils/adminApprovals.ts closely enough
// to exercise the header controls; blanks sink and ties fall back to newest id first.
const SORTABLE = ['created_at', 'status', 'email', 'name', 'first_name', 'last_name', 'school', 'level_of_study'];
const sortKey = (row: Student, sort: string) => sort === 'name'
  ? fullName(row)
  : String((row as unknown as Record<string, unknown>)[sort] ?? '');
function sampleSorted(rows: Student[], sort: string, dir: string) {
  if (!SORTABLE.includes(sort)) return rows;
  const ascending = dir === 'asc' || dir === 'desc' ? dir === 'asc' : sort !== 'created_at';
  return [...rows].sort((a, b) => {
    const left = sortKey(a, sort);
    const right = sortKey(b, sort);
    if (!left || !right) return left ? -1 : right ? 1 : b.id - a.id;
    const order = sort === 'created_at' ? left.localeCompare(right) : left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
    return (ascending ? order : -order) || b.id - a.id;
  });
}
function filtered(params: URLSearchParams) {
  const query = normalize(params.get('q') ?? '');
  const answerFilters = JSON.parse(params.get('answers') ?? '[]') as ApprovalAnswerFilter[];
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const rows = students.filter(student => student.form_key === (params.get('form_key') ?? 'registration')
    && answerFilters.every(filter => sampleMatches(student, filter))
    && (!params.get('status') || student.status === params.get('status'))
    && (!params.get('checked_in') || String(student.checked_in) === params.get('checked_in'))
    && (!from || student.created_at.slice(0, 10) >= from)
    && (!to || student.created_at.slice(0, 10) <= to)
    && (!query || [fullName(student), student.email, student.school].some(value => normalize(value).includes(query))))
    .sort((a, b) => b.id - a.id);
  return sampleSorted(rows, params.get('sort') ?? '', params.get('dir') ?? '');
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input), location.origin);
  if (!url.pathname.startsWith('/api/')) return originalFetch(input, init);
  const path = url.pathname;
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const payload: Payload = typeof init?.body === 'string' ? JSON.parse(init.body) : input instanceof Request && method !== 'GET' ? await input.clone().json() : {};
  const formKey = payload.form_key ?? url.searchParams.get('form_key') ?? 'registration';
  const pool = payload.pool_id ?? url.searchParams.get('pool_id') ?? 'default';

  if (path === '/api/admin/form-configs') {
    if (method === 'GET') return json(forms.map(form => ({ ...form, fields_count: form.fields.length, server_now: new Date().toISOString() })));
    if (method === 'POST' && payload.key && !forms.some(form => form.key === payload.key)) {
      const form: PreviewForm = { key: payload.key, title: payload.title ?? payload.key, description: payload.description ?? '', fields: payload.fields ?? [], is_active: false, version: 1, updated_at: new Date().toISOString(), closes_at: null, closes_timezone: 'America/New_York' };
      forms.push(form); return json(form, 201);
    }
  }
  if (path.startsWith('/api/admin/form-configs/')) {
    const key = decodeURIComponent(path.split('/').pop()!);
    const form = forms.find(entry => entry.key === key);
    if (!form) return json({ error: 'Form not found.' }, 404);
    if (method === 'GET') return json(form);
    if (method === 'PUT') { Object.assign(form, payload, { key, version: form.version + 1, updated_at: new Date().toISOString() }); return json(form); }
    if (method === 'DELETE') { forms.splice(forms.indexOf(form), 1); return json({ message: 'Deleted.' }); }
  }
  if (method === 'GET' && ['/api/admin/approval/students', '/api/admin/approval/selection'].includes(path)) {
    const rows = filtered(url.searchParams);
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const selectionLimit = url.searchParams.has('selection_limit') ? Number(url.searchParams.get('selection_limit')) : undefined;
    if (selectionLimit !== undefined && (!Number.isSafeInteger(selectionLimit) || selectionLimit < 1)) return json({ error: 'Invalid registration filters.' }, 400);
    return json({ data: path.endsWith('/selection') ? rows.slice(0, selectionLimit) : rows.slice(offset, offset + Number(url.searchParams.get('limit') ?? 50)), count: rows.length, fields: sampleFilterFields(formKey) });
  }
  if (method === 'GET' && (path.endsWith('/export.csv') || path.endsWith('/export'))) {
    const rows = filtered(url.searchParams);
    const keys = ['id', 'first_name', 'last_name', 'email', 'school', 'status', 'checked_in', 'form_key', 'answers'] as const;
    const escape = (value: unknown) => `"${String(typeof value === 'object' ? JSON.stringify(value) : value ?? '').replace(/"/g, '""')}"`;
    return new Response([keys.join(','), ...rows.map(row => keys.map(key => escape(row[key])).join(','))].join('\r\n'), { headers: { 'Content-Type': 'text/csv' } });
  }
  if (path === '/api/admin/approval/resolve' && method === 'POST') {
    const seen = new Set<string>();
    return json({ matches: (payload.entries ?? []).map(input => {
      const identity = normalize(input); const duplicate = seen.has(identity); seen.add(identity);
      return { input, duplicate, matches: students.filter(student => student.form_key === formKey && normalize(identity.includes('@') ? student.email : fullName(student)) === identity) };
    }) });
  }
  if (path === '/api/admin/approval/decision' && method === 'POST') {
    const changed = students.filter(student => student.form_key === formKey && payload.ids?.includes(student.id));
    changed.forEach(student => { student.status = payload.status ?? student.status; });
    return json({ data: changed });
  }
  const detail = path.match(/^\/api\/admin\/registrations\/(\d+)(\/check-in)?$/);
  if (detail) {
    const student = students.find(row => row.id === Number(detail[1]));
    if (!student) return json({ error: 'Registration not found.' }, 404);
    if (method === 'GET' && !detail[2]) return json(student);
    if (method === 'POST' && detail[2]) { student.checked_in = !!payload.checked_in; student.checked_in_at = student.checked_in ? new Date().toISOString() : null; return json(student); }
  }
  if (path === '/api/teams/admin' && method === 'GET') return json(overview(formKey, pool));
  if (path === '/api/teams' && method === 'GET') {
    const candidates = overview(formKey, pool).looking;
    const size = Number(url.searchParams.get('team_size') ?? 4);
    const generated: MatcherTeam[] = [];
    let offset = 0;
    for (; offset + 1 < candidates.length; offset += size) generated.push({ team_number: generated.length + 1, members: candidates.slice(offset, offset + size) });
    return json({ pool_id: pool, team_size: size, total_participants: candidates.length, teams: generated, unmatched: candidates.slice(offset) });
  }
  if (path === '/api/teams/save' && method === 'POST') { drafts[pool] = payload.teams ?? []; return json({ message: 'Draft saved.' }, 201); }
  if (path === '/api/teams/publish' && method === 'POST') {
    const saved = drafts[pool] ?? [];
    const candidates = overview(formKey, pool).savedTeams;
    if (candidates.some(team => team.conflicts || team.missing_members)) return json({ error: 'Draft members are no longer available.' }, 409);
    saved.forEach(team => teams.push({ id: `sample-team-${teams.length + 1}`, name: `${pool} Match Team ${team.team_number}`, members: team.members.map(member => Number(member.participant_id.replace('participant-', ''))) }));
    drafts[pool] = [];
    return json({ published_teams: saved.length, affected_users: saved.reduce((count, team) => count + team.members.length, 0) }, 201);
  }
  return json({ error: `No sample handler for ${method} ${path}.` }, 404);
};

export function Preview() {
  const [tab, setTab] = useState<'users' | 'teams' | 'editor'>('users');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  return <main className="admin-surface mx-auto min-h-screen max-w-[1600px] bg-red7 px-4 py-6 font-poppins sm:px-8">
    <div className="admin-toolbar mb-5"><h1 className="text-3xl font-semibold text-red6">Admin</h1><span className="text-xs text-red6">Sample data preview</span></div>
    <nav aria-label="Admin sections" className="mb-5 flex flex-wrap gap-2">
      {([['users', 'Approvals'], ['teams', 'Team Matching'], ['editor', 'Application Editor']] as const).map(([key, label]) => <button key={key} aria-pressed={tab === key} className={`admin-button ${tab === key ? 'admin-button-primary' : ''}`} onClick={() => setTab(key)}>{label}</button>)}
    </nav>
    <div hidden={tab === 'editor'}><ApprovalWorkspace tab={tab} /></div>
    {tab === 'editor' && (editingKey ? <AdminFormEditor formKey={editingKey} onBack={() => setEditingKey(null)} /> : <AdminFormList onSelect={setEditingKey} />)}
  </main>;
}
createRoot(document.getElementById('root')!).render(<ToastProvider><AdminSelectionProvider><Preview /></AdminSelectionProvider></ToastProvider>);
