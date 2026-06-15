import { z } from 'zod';

const experienceLevel = z.enum(['Beginner', 'Intermediate', 'Advanced']);
const preferenceScore = z.number().int().min(1).max(5);

export const CreateParticipantSchema = z.object({
  email: z.string().email('email must be a valid email address'),
  full_name: z.string().min(1, 'full_name is required'),
  frontend_experience: experienceLevel,
  backend_experience: experienceLevel,
  design_experience: experienceLevel,
  hardware_experience: experienceLevel,
  frontend_preference: preferenceScore,
  backend_preference: preferenceScore,
  design_preference: preferenceScore,
  hardware_preference: preferenceScore,
  any_role_preference: preferenceScore,
  frontend_skills: z.array(z.string()).default([]),
  backend_skills: z.array(z.string()).default([]),
  design_skills: z.array(z.string()).default([]),
  hardware_skills: z.array(z.string()).default([]),
  hacker_type: z.enum(['FirstTimeHacker', 'VeteranHacker']),
  pool_id: z.string().default('default'),
});

export const ParticipantParamsSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

export interface Participant {
  id: string;
  email: string;
  full_name: string;
  frontend_experience: 'Beginner' | 'Intermediate' | 'Advanced';
  backend_experience: 'Beginner' | 'Intermediate' | 'Advanced';
  design_experience: 'Beginner' | 'Intermediate' | 'Advanced';
  hardware_experience: 'Beginner' | 'Intermediate' | 'Advanced';
  frontend_preference: number;
  backend_preference: number;
  design_preference: number;
  hardware_preference: number;
  any_role_preference: number;
  frontend_skills: string[];
  backend_skills: string[];
  design_skills: string[];
  hardware_skills: string[];
  hacker_type: 'FirstTimeHacker' | 'VeteranHacker';
  pool_id: string;
  created_at: string;
}

export type CreateParticipantBody = z.infer<typeof CreateParticipantSchema>;
