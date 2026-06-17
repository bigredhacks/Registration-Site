import type { FormField } from "./formConfig";
import {
  hackathonRegistrationFormConfig,
  teamMatchingFormConfig,
} from "./formConfig";

export interface FormPreset {
  id: string;
  name: string;
  description: string;
  defaultKey: string;
  defaultTitle: string;
  defaultDescription: string;
  fields: FormField[];
}

/**
 * Built-in starting points for new forms. The hackathon + team-matching presets
 * mirror the configs that ship with the codebase so admins can fork them.
 */
export const FORM_PRESETS: FormPreset[] = [
  {
    id: "hackathon-registration",
    name: "Hackathon Registration",
    description:
      "16 fields: name, contact, school, demographics, MLH agreements. Use as the starting point for the main application.",
    defaultKey: "registration",
    defaultTitle: hackathonRegistrationFormConfig.title,
    defaultDescription: hackathonRegistrationFormConfig.description ?? "",
    fields: hackathonRegistrationFormConfig.fields,
  },
  {
    id: "team-matching",
    name: "Team Matching",
    description: "Skills + role preferences for the team-matching pool.",
    defaultKey: "team-matching",
    defaultTitle: teamMatchingFormConfig.title,
    defaultDescription: teamMatchingFormConfig.description ?? "",
    fields: teamMatchingFormConfig.fields,
  },
  {
    id: "blank",
    name: "Blank Form",
    description: "Empty form — add fields from scratch.",
    defaultKey: "new-form",
    defaultTitle: "New Form",
    defaultDescription: "",
    fields: [],
  },
];
