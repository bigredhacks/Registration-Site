export interface team {
  name: string;
  owner: string;
}

export interface teamData {
  name: string;
  owner: string;
  members: string[];
}

export function isTeam(t: object): t is team {
  return "name" in t && "owner" in t;
}

export function isTeamData(t: object): t is teamData {
  return isTeam(t) && "members" in t;
}