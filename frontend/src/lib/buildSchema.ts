import { z } from "zod";
import type { FormField } from "./formConfig";

/**
 * Build a Zod schema from a list of FormField definitions.
 * Used to validate dynamic, admin-edited form configs at runtime.
 */
export function buildSchemaFromFields(fields: FormField[]): z.ZodType {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    let s: z.ZodTypeAny;

    switch (field.type) {
      case "text":
      case "dropdown":
      case "radio":
        s = field.required
          ? z.string().trim().min(1, `${field.label} is required`)
          : z.string().trim().optional().or(z.literal(""));
        break;

      case "email":
        s = field.required
          ? z.string().email(`Enter a valid email`)
          : z.string().email().optional().or(z.literal(""));
        break;

      case "checkbox":
        s = field.required
          ? z.literal(true, { message: `You must agree to ${field.label}` })
          : z.boolean().optional();
        break;

      case "checkboxGroup":
        s = field.required
          ? z.array(z.string()).min(1, `${field.label} is required`)
          : z.array(z.string()).optional();
        break;

      case "file":
        // Files are typed as File in the form data; validation is done at the field level.
        s = z.any().optional();
        break;

      case "multipleChoiceGrid":
      case "preferenceGrid":
        s = z.record(z.string(), z.unknown()).optional();
        break;

      default:
        // FormField.type is statically exhaustive, but the data arrives over
        // the network and may not match the TypeScript union — fail loudly
        // rather than silently accept anything.
        throw new Error(
          `buildSchemaFromFields: unsupported field type "${(field as { type: string }).type}"`,
        );
    }

    shape[field.id] = s;
  }

  return z.object(shape);
}
