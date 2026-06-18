import { z } from 'zod';

const AGE_RANGES = ['Under 18', '18–20', '21–24', '25–30', '31+'] as const;
const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say', 'Other'] as const;
const DIETARY_OPTIONS = [
  'None',
  'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Halal',
  'Kosher',
  'Nut Allergy',
  'Other',
] as const;
const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL'] as const;
const LEVEL_OF_STUDY_OPTIONS = [
  'Secondary / High School',
  'Freshman',
  'Sophomore',
  'Junior',
  'Senior',
  "I'm not currently a student",
] as const;

export const CreateRegistrationSchema = z.object({
  first_name: z.string().trim().min(1, 'first_name is required'),
  last_name: z.string().trim().min(1, 'last_name is required'),
  age: z.enum(AGE_RANGES, { message: 'age is required' }),
  phone_number: z
    .string()
    .trim()
    .regex(/^\(\d{3}\) \d{3}-\d{4}$/, 'phone_number must use format (XXX) XXX-XXXX'),
  linkedin: z.string().url('linkedin must be a valid URL').optional().or(z.literal('')),
  school: z.string().trim().min(1, 'school is required'),
  country: z.string().trim().min(1, 'country is required'),
  level_of_study: z.enum(LEVEL_OF_STUDY_OPTIONS, { message: 'level_of_study is required' }),
  major: z.string().trim().optional().or(z.literal('')),
  gender: z.enum(GENDER_OPTIONS, { message: 'gender is required' }),
  dietary_restrictions: z.array(z.enum(DIETARY_OPTIONS)).default([]),
  shirt_size: z.enum(SHIRT_SIZES, { message: 'shirt_size is required' }),
  mlh_code_of_conduct: z.literal(true, {
    message: 'MLH Code of Conduct agreement is required',
  }),
  mlh_data_sharing_consent: z.literal(true, {
    message: 'MLH data sharing agreement is required',
  }),
  mlh_emails_opt_in: z.boolean().optional().default(false),
});

export const UpdateRegistrationSchema = CreateRegistrationSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field is required' },
);

export const RegistrationParamsSchema = z.object({
  id: z.coerce.number().int().positive('id must be a positive integer'),
});

export const ResumePathSchema = z.object({
  resume_path: z.string().min(1).optional(),
});

export interface Registration extends CreateRegistrationBody {
  id: string;
  email: string;
  created_at: string;
}

export type CreateRegistrationBody = z.infer<typeof CreateRegistrationSchema>;
export type UpdateRegistrationBody = z.infer<typeof UpdateRegistrationSchema>;
