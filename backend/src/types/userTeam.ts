import { z } from 'zod';

export const CreateUserTeamSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(60),
});

export const JoinUserTeamSchema = z.object({
  invite_code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6}$/, 'invite_code must be 6 alphanumeric characters'),
});

export type CreateUserTeamBody = z.infer<typeof CreateUserTeamSchema>;
export type JoinUserTeamBody = z.infer<typeof JoinUserTeamSchema>;

export function generateInviteCode(): string {
  // Avoid ambiguous characters (0/O, 1/I).
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}
