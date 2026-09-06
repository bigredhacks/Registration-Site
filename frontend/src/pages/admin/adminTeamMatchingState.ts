import type { AdminStudent } from './adminApprovalState';

export interface ParticipantSummary {
  id: string;
  user_id?: string;
  email: string;
  full_name: string;
  hacker_type: string;
  registration?: AdminStudent | null;
  current_team_name?: string | null;
  frontend_experience?: string;
  backend_experience?: string;
  design_experience?: string;
  hardware_experience?: string;
  frontend_preference?: number;
  backend_preference?: number;
  design_preference?: number;
  hardware_preference?: number;
  any_role_preference?: number;
  frontend_skills?: string[];
  backend_skills?: string[];
  design_skills?: string[];
  hardware_skills?: string[];
}

export interface MatcherTeam {
  id?: string;
  team_number: number;
  members: ParticipantSummary[];
  conflicts?: number;
  missing_members?: number;
}

export interface ExistingTeam {
  id: string;
  name: string;
  invite_code: string;
  status: string;
  members: Array<{
    user_id: string;
    full_name: string;
    email: string;
    registration: AdminStudent | null;
  }>;
}

export interface TeamOverview {
  teams: ExistingTeam[];
  participants: ParticipantSummary[];
  looking: ParticipantSummary[];
  savedTeams: MatcherTeam[];
  registrations?: AdminStudent[];
}

export function uniqueTeamStudents(students: Array<AdminStudent | null | undefined>, formKey: string): AdminStudent[] {
  return [...new Map(students.filter((student): student is AdminStudent => !!student && (student.form_key ?? 'registration') === formKey)
    .map((student) => [student.id, student])).values()];
}

export function teamMatchesSearch(team: ExistingTeam, query: string): boolean {
  const search = query.trim().toLocaleLowerCase();
  return [team.name, team.invite_code, ...team.members.flatMap((member) => [member.full_name, member.email])]
    .some((value) => value.toLocaleLowerCase().includes(search));
}

export interface GenerateDraftState {
  participantsCount: number | null;
  draftTeams: MatcherTeam[];
  unmatched: ParticipantSummary[];
  generateError: string | null;
}

export function buildGenerateDraftErrorState(message: string): GenerateDraftState {
  return {
    participantsCount: null,
    draftTeams: [],
    unmatched: [],
    generateError: message,
  };
}

export function buildGenerateDraftSuccessState(body: {
  total_participants?: number | null;
  teams?: MatcherTeam[] | null;
  unmatched?: ParticipantSummary[] | null;
}): GenerateDraftState {
  return {
    participantsCount: body.total_participants ?? 0,
    draftTeams: body.teams ?? [],
    unmatched: body.unmatched ?? [],
    generateError: null,
  };
}
