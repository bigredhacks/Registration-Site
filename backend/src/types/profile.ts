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

export const UpdateProfileSchema = z.object({
  first_name: z.string().trim().min(1).optional(),
  last_name: z.string().trim().min(1).optional(),
  full_name: z.string().trim().min(1).optional(),
  avatar_url: z.string().url().optional().or(z.literal('')),
  phone_number: z
    .string()
    .trim()
    .regex(/^\(\d{3}\) \d{3}-\d{4}$/, 'phone_number must use format (XXX) XXX-XXXX')
    .optional()
    .or(z.literal('')),
  school: z.string().trim().optional().or(z.literal('')),
  country: z.string().trim().optional().or(z.literal('')),
  level_of_study: z.enum(LEVEL_OF_STUDY_OPTIONS).optional(),
  graduation_year: z.coerce.number().int().min(2020).max(2035).optional(),
  major: z.string().trim().optional().or(z.literal('')),
  age_range: z.enum(AGE_RANGES).optional(),
  gender: z.enum(GENDER_OPTIONS).optional(),
  dietary_restrictions: z.array(z.enum(DIETARY_OPTIONS)).optional(),
  shirt_size: z.enum(SHIRT_SIZES).optional(),
  linkedin: z.string().url().optional().or(z.literal('')),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required' });

export type UpdateProfileBody = z.infer<typeof UpdateProfileSchema>;
