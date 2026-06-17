import { z } from 'zod';

export interface Team {
  id: string;
  team_number: number;
  pool_id: string;
  created_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  participant_id: string;
}

export interface TeamWithMembers extends Team {
  members: {
    id: string;
    participant_id: string;
    participant: {
      id: string;
      email: string;
      full_name: string;
      hacker_type: string;
      frontend_experience: string;
      backend_experience: string;
      design_experience: string;
      hardware_experience: string;
      frontend_preference: number;
      backend_preference: number;
      design_preference: number;
      hardware_preference: number;
      any_role_preference: number;
      frontend_skills: string[];
      backend_skills: string[];
      design_skills: string[];
      hardware_skills: string[];
    };
  }[];
}

const teamMemberSchema = z.object({
  participant_id: z.string().uuid(),
});

const teamSchema = z.object({
  team_number: z.number().int().min(1),
  pool_id: z.string().min(1),
  members: z.array(teamMemberSchema).min(1),
});

export const SaveTeamsSchema = z.object({
  pool_id: z.string().min(1, 'pool_id is required'),
  teams: z.array(teamSchema).min(1, 'at least one team is required'),
});

export type SaveTeamsBody = z.infer<typeof SaveTeamsSchema>;
