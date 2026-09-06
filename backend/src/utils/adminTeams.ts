import type { Participant } from '../types/participant';

export interface TeamRegistration {
  id: number;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  status: string;
  form_key: string;
  team_name?: string | null;
}

export interface UserTeamRow {
  id: string;
  name: string;
  invite_code: string;
}

export interface MembershipRow { team_id: string; user_id: string }
export interface MatchingParticipant extends Participant { user_id: string }
export interface TeamCandidate extends MatchingParticipant {
  registration: TeamRegistration | null;
  current_team_name: string | null;
}
export interface SavedTeamRow { id: string; team_number: number }
export interface SavedMemberRow { id: string; team_id: string; participant_id: string }
export interface ProfileRow { id: string; full_name: string | null; first_name: string | null; last_name: string | null }

export function deriveTeamStatus(registrations: Array<TeamRegistration | null>): string {
  if (!registrations.length || registrations.some((registration) => !registration)) return 'missing_application';
  const statuses = new Set(registrations.map((registration) => registration!.status));
  return statuses.size === 1 ? registrations[0]!.status : 'mixed';
}

export function buildTeamOverview(input: {
  teams: UserTeamRow[];
  memberships: MembershipRow[];
  participants: MatchingParticipant[];
  registrations: TeamRegistration[];
  profiles: ProfileRow[];
  savedTeams: SavedTeamRow[];
  savedMembers: SavedMemberRow[];
}) {
  const teamById = new Map(input.teams.map((team) => [team.id, team]));
  const membershipByUser = new Map(input.memberships.map((member) => [member.user_id, member]));
  const registrationByUser = new Map(input.registrations.map((registration) => [registration.user_id, registration]));
  const profileByUser = new Map(input.profiles.map((profile) => [profile.id, profile]));
  const registrationFor = (userId: string): TeamRegistration | null => {
    const registration = registrationByUser.get(userId);
    if (!registration) return null;
    const membership = membershipByUser.get(userId);
    return { ...registration, email: registration.email ?? '', team_name: membership ? teamById.get(membership.team_id)?.name ?? null : null };
  };
  const teams = input.teams.map((team) => {
    const members = input.memberships.filter((member) => member.team_id === team.id).map((member) => {
      const registration = registrationFor(member.user_id);
      const profile = profileByUser.get(member.user_id);
      return {
        user_id: member.user_id,
        full_name: [registration?.first_name, registration?.last_name].filter(Boolean).join(' ')
          || profile?.full_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Unnamed student',
        email: registration?.email ?? '',
        registration,
      };
    });
    return { ...team, members, status: deriveTeamStatus(members.map((member) => member.registration)) };
  });
  const participants: TeamCandidate[] = input.participants.map((participant) => {
    const membership = membershipByUser.get(participant.user_id);
    return {
      ...participant,
      registration: registrationFor(participant.user_id),
      current_team_name: membership ? teamById.get(membership.team_id)?.name ?? 'Existing team' : null,
    };
  });
  const participantById = new Map(participants.map((participant) => [participant.id, participant]));
  const savedTeams = input.savedTeams.map((team) => {
    const memberRows = input.savedMembers.filter((member) => member.team_id === team.id);
    const members = memberRows.map((member) => participantById.get(member.participant_id)).filter((member): member is TeamCandidate => !!member);
    return {
      ...team,
      members,
      conflicts: members.filter((member) => member.current_team_name !== null).length,
      missing_members: memberRows.length - members.length,
    };
  });
  return { teams, participants, looking: participants.filter((participant) => !membershipByUser.has(participant.user_id)), savedTeams,
    registrations: input.registrations.map((registration) => registrationFor(registration.user_id)!),
  };
}

export async function rollbackSavedDraft(
  previous: { teams: SavedTeamRow[]; members: SavedMemberRow[] },
  createdIds: string[],
  store: {
    deleteTeams: (ids: string[]) => Promise<void>;
    listTeams: () => Promise<SavedTeamRow[]>;
    restoreTeams: (teams: SavedTeamRow[]) => Promise<void>;
    restoreMembers: (members: SavedMemberRow[]) => Promise<void>;
  },
): Promise<void> {
  if (createdIds.length) await store.deleteTeams(createdIds);
  if (!previous.teams.length) return;
  if ((await store.listTeams()).length) {
    throw new Error('Another request changed this draft. Its teams were preserved; refresh before retrying.');
  }
  await store.restoreTeams(previous.teams);
  if (previous.members.length) await store.restoreMembers(previous.members);
}

/** Validate the whole batch before creating any live memberships. */
export function validateTeamAssignment(
  teams: Array<{ members: Array<{ participant_id: string }> }>,
  participants: MatchingParticipant[],
  memberships: MembershipRow[],
): string | null {
  const participantById = new Map(participants.map((participant) => [participant.id, participant]));
  const existingUsers = new Set(memberships.map((member) => member.user_id));
  const seenUsers = new Set<string>();
  if (!teams.length) return 'No draft teams to publish.';
  for (const team of teams) {
    if (!team.members.length || team.members.length > 4) return 'Each team must contain between 1 and 4 students.';
    for (const member of team.members) {
      const participant = participantById.get(member.participant_id);
      if (!participant?.user_id) return 'A draft member no longer has a matching submission in this pool.';
      if (seenUsers.has(participant.user_id)) return 'A student appears in more than one draft team.';
      if (existingUsers.has(participant.user_id)) return 'A draft member already belongs to a team. Refresh and generate a new draft.';
      seenUsers.add(participant.user_id);
    }
  }
  return null;
}

export async function readAllRows<T>(readPage: (from: number, to: number) => PromiseLike<{
  data: T[] | null;
  error: { message: string } | null;
}>, pageSize = 500): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await readPage(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
