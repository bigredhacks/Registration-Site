import { z } from 'zod';

export const RegistrationParamsSchema = z.object({
  id: z.coerce.number().int().positive('id must be a positive integer'),
});

export const RegistrationStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'waitlisted',
]);

export type RegistrationStatus = z.infer<typeof RegistrationStatusSchema>;
