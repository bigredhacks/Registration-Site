export interface ParticipantSummary {
  id: string;
  user_id?: string;
  email: string;
  full_name: string;
  hacker_type: string;
}

export interface MatcherTeam {
  team_number: number;
  members: ParticipantSummary[];
}

export interface GenerateDraftState {
  participantsCount: number | null;
  draftTeams: MatcherTeam[];
  generateError: string | null;
}

export function buildGenerateDraftErrorState(message: string): GenerateDraftState {
  return {
    participantsCount: null,
    draftTeams: [],
    generateError: message,
  };
}

export function buildGenerateDraftSuccessState(body: {
  total_participants?: number | null;
  teams?: MatcherTeam[] | null;
}): GenerateDraftState {
  return {
    participantsCount: body.total_participants ?? 0,
    draftTeams: body.teams ?? [],
    generateError: null,
  };
}
