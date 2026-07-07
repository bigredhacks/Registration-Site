import { z } from 'zod';

export type DynamicFormFieldType =
  | 'text'
  | 'email'
  | 'dropdown'
  | 'radio'
  | 'checkbox'
  | 'checkboxGroup'
  | 'file'
  | 'multipleChoiceGrid'
  | 'preferenceGrid'
  | 'note';

interface BaseDynamicFormField {
  id: string;
  label: string;
  type: DynamicFormFieldType;
  required: boolean;
}

export type DynamicFormField =
  | (BaseDynamicFormField & { type: 'text' | 'email' | 'dropdown' | 'radio' })
  | (BaseDynamicFormField & { type: 'checkbox' })
  | (BaseDynamicFormField & { type: 'checkboxGroup' })
  | (BaseDynamicFormField & { type: 'file' })
  | (BaseDynamicFormField & { type: 'note' })
  | (BaseDynamicFormField & {
      type: 'multipleChoiceGrid' | 'preferenceGrid';
      rows: string[];
      columns: string[];
    });

function buildGridSchema(field: Extract<DynamicFormField, { type: 'multipleChoiceGrid' | 'preferenceGrid' }>) {
  if (!field.required) {
    return z.record(z.string(), z.string()).optional();
  }

  const rowShape = Object.fromEntries(
    field.rows.map((row) => [
      row,
      z
        .unknown()
        .refine((value) => typeof value === 'string' && value.trim().length > 0, `${field.label}: ${row} is required`)
        .refine(
          (value) => typeof value === 'string' && field.columns.includes(value),
          `${field.label}: ${row} must be one of the configured options`,
        ),
    ]),
  );

  return z.object(rowShape);
}

export function buildAnswersSchema(fields: DynamicFormField[]) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    // Display-only fields carry no answer and aren't validated.
    if (field.type === 'note') {
      continue;
    }

    switch (field.type) {
      case 'text':
      case 'dropdown':
      case 'radio':
        shape[field.id] = field.required
          ? z.string().trim().min(1, `${field.label} is required`)
          : z.string().trim().optional().or(z.literal(''));
        break;
      case 'email':
        shape[field.id] = field.required
          ? z.string().trim().email(`${field.label} must be a valid email`)
          : z.string().trim().email(`${field.label} must be a valid email`).optional().or(z.literal(''));
        break;
      case 'checkbox':
        shape[field.id] = field.required
          ? z.literal(true, { message: `${field.label} is required` })
          : z.boolean().optional();
        break;
      case 'checkboxGroup':
        shape[field.id] = field.required
          ? z.array(z.string()).min(1, `${field.label} is required`)
          : z.array(z.string()).optional();
        break;
      case 'file':
        shape[field.id] = z.any().optional();
        break;
      case 'multipleChoiceGrid':
      case 'preferenceGrid':
        shape[field.id] = buildGridSchema(field);
        break;
      default:
        throw new Error(`Unsupported field type: ${(field as DynamicFormField).type}`);
    }
  }

  return z.object(shape);
}

const SUMMARY_KEYS = [
  'first_name',
  'last_name',
  'school',
  'level_of_study',
  'shirt_size',
] as const;

type SummaryProjection = Record<(typeof SUMMARY_KEYS)[number] | 'email', string | null>;

export function projectRegistrationColumns(
  answers: Record<string, unknown>,
  user: { email?: string | null },
): SummaryProjection {
  const projection = Object.fromEntries(
    SUMMARY_KEYS.map((key) => {
      const value = answers[key];
      return [key, typeof value === 'string' && value.trim() ? value.trim() : null];
    }),
  ) as Omit<SummaryProjection, 'email'>;

  return {
    ...projection,
    email: user.email ?? null,
  };
}
