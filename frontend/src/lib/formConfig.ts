import { z } from "zod";

// Form field types
export type FormFieldType =
  | "text"
  | "email"
  | "dropdown"
  | "radio"
  | "checkbox"
  | "checkboxGroup"
  | "file"
  | "multipleChoiceGrid"
  | "preferenceGrid";

export interface BaseFormField {
  id: string;
  label: string;
  required: boolean;
  type: FormFieldType;
  description?: string;
}

export interface TextFormField extends BaseFormField {
  type: "text";
  placeholder?: string;
}

export interface EmailFormField extends BaseFormField {
  type: "email";
  placeholder?: string;
}

export interface CsvOptionsSource {
  type: "csv";
  url: string;
  csvType: "schools" | "countries";
}

export interface DropdownFormField extends BaseFormField {
  type: "dropdown";
  options: string[];
  searchable?: boolean;
  allowCustomValue?: boolean;
  optionsSource?: CsvOptionsSource;
}

export interface RadioFormField extends BaseFormField {
  type: "radio";
  options: string[];
}

export interface CheckboxFormField extends BaseFormField {
  type: "checkbox";
  checkboxText: string;
  linkUrl?: string;
  linkText?: string;
}

export interface CheckboxGroupFormField extends BaseFormField {
  type: "checkboxGroup";
  options: string[];
}

export interface FileFormField extends BaseFormField {
  type: "file";
  accept?: string;
  multiple?: boolean;
}

export interface MultipleChoiceGridFormField extends BaseFormField {
  type: "multipleChoiceGrid";
  rows: string[];
  columns: string[];
}

export interface PreferenceGridFormField extends BaseFormField {
  type: "preferenceGrid";
  rows: string[];
  columns: string[];
}

export type FormField =
  | TextFormField
  | EmailFormField
  | DropdownFormField
  | RadioFormField
  | CheckboxFormField
  | CheckboxGroupFormField
  | FileFormField
  | MultipleChoiceGridFormField
  | PreferenceGridFormField;

export interface FormConfig {
  title: string;
  description?: string;
  schema: z.ZodType;
  fields: FormField[];
}

// ---------------------------------------------------------------------------
// Shared option constants (used by both the profile page and the application
// form). Kept here so the two surfaces can't drift out of sync.
// ---------------------------------------------------------------------------

export const SCHOOLS_CSV_URL =
  "https://raw.githubusercontent.com/MLH/mlh-policies/main/schools.csv";
export const COUNTRIES_CSV_URL =
  "https://raw.githubusercontent.com/lukes/ISO-3166-Countries-with-Regional-Codes/refs/heads/master/all/all.csv";

export const AGE_RANGES = [
  "Under 18",
  "18–20",
  "21–24",
  "25–30",
  "31+",
] as const;

export const MAJOR_SUGGESTIONS = [
  "Africana Studies",
  "Agricultural Sciences",
  "American Studies",
  "Animal Science",
  "Anthropology",
  "Applied Economics and Management",
  "Archaeology",
  "Architecture",
  "Asian Studies",
  "Astronomy",
  "Atmospheric Science",
  "Biological Engineering",
  "Biological Sciences",
  "Biology and Society",
  "Biomedical Engineering",
  "Biometry and Statistics",
  "Chemical Engineering",
  "Chemistry",
  "China and Asia-Pacific Studies",
  "Civil Engineering",
  "Classics",
  "Cognitive Science",
  "College Scholar",
  "Communication",
  "Comparative Literature",
  "Computer Science",
  "Design and Environmental Analysis",
  "Earth and Atmospheric Sciences",
  "Economics",
  "Electrical and Computer Engineering",
  "Engineering Physics",
  "English",
  "Entomology",
  "Environment and Sustainability",
  "Environmental Engineering",
  "Fashion Design and Management",
  "Feminist, Gender, and Sexuality Studies",
  "Fiber Science",
  "Fine Arts",
  "Food Science",
  "French",
  "German Studies",
  "Global and Public Health Sciences",
  "Global Development",
  "Government",
  "Health Care Policy",
  "History",
  "History of Art",
  "Hotel Administration",
  "Human Biology, Health, and Society",
  "Human Development",
  "Independent Major",
  "Industrial and Labor Relations",
  "Information Science",
  "Information Science, Systems, and Technology",
  "Italian",
  "Jewish Studies",
  "Landscape Architecture",
  "Linguistics",
  "Materials Science and Engineering",
  "Mathematics",
  "Mechanical Engineering",
  "Music",
  "Near Eastern Studies",
  "Nutritional Sciences",
  "Operations Research and Engineering",
  "Performing and Media Arts",
  "Philosophy",
  "Physics",
  "Plant Sciences",
  "Psychology",
  "Public Policy",
  "Religious Studies",
  "Science and Technology Studies",
  "Sociology",
  "Spanish",
  "Statistical Science",
  "Undecided",
  "Urban and Regional Studies",
  "Viticulture and Enology",
] as const;

export const GENDER_OPTIONS = [
  "Male",
  "Female",
  "Non-binary",
  "Prefer not to say",
  "Other",
] as const;

export const DIETARY_OPTIONS = [
  "None",
  "Vegetarian",
  "Vegan",
  "Gluten-Free",
  "Halal",
  "Kosher",
  "Nut Allergy",
  "Other",
] as const;

export const SHIRT_SIZES = ["XS", "S", "M", "L", "XL", "2XL"] as const;

export const LEVEL_OF_STUDY_OPTIONS = [
  "Secondary / High School",
  "Freshman",
  "Sophomore",
  "Junior",
  "Senior",
  "I'm not currently a student",
] as const;

// ---------------------------------------------------------------------------
// Form configurations
// ---------------------------------------------------------------------------

export const teamMatchingSchema = z.object({
  email: z.email("Enter a valid email address"),
  full_name: z.string().trim().min(1, "Full name is required"),
  technical_skills: z.object({
    Frontend: z.enum(["Beginner", "Intermediate", "Advanced"], {
      message: "Please select an option for all rows",
    }),
    Backend: z.enum(["Beginner", "Intermediate", "Advanced"], {
      message: "Please select an option for all rows",
    }),
    Design: z.enum(["Beginner", "Intermediate", "Advanced"], {
      message: "Please select an option for all rows",
    }),
    Hardware: z.enum(["Beginner", "Intermediate", "Advanced"], {
      message: "Please select an option for all rows",
    }),
  }),
  preferred_role: z.object({
    Frontend: z.enum(["1", "2", "3", "4", "5"], {
      message: "Please select an option for all rows",
    }),
    Backend: z.enum(["1", "2", "3", "4", "5"], {
      message: "Please select an option for all rows",
    }),
    Design: z.enum(["1", "2", "3", "4", "5"], {
      message: "Please select an option for all rows",
    }),
    Hardware: z.enum(["1", "2", "3", "4", "5"], {
      message: "Please select an option for all rows",
    }),
    Any: z.enum(["1", "2", "3", "4", "5"], {
      message: "Please select an option for all rows",
    }),
  }),
  backend_skills: z.string().trim().min(1, "Backend skills are required"),
  frontend_skills: z.string().trim().min(1, "Frontend skills are required"),
  design_skills: z.string().trim().min(1, "Design skills are required"),
  first_time_hacker: z.enum(["Yes", "No"], {
    message: "Please select an option",
  }),
});

export const teamMatchingFormConfig: FormConfig = {
  title: "BigRed//Hacks Fall 2026 Team Matching",
  description: "Help us match you with the perfect team!",
  schema: teamMatchingSchema,
  fields: [
    {
      id: "email",
      label: "Email",
      type: "email",
      required: true,
      placeholder: "your.email@example.com",
    },
    {
      id: "full_name",
      label: "Full Name",
      type: "text",
      required: true,
      placeholder: "John Doe",
    },
    {
      id: "technical_skills",
      label: "How would you define your technical skills and experience?",
      type: "multipleChoiceGrid",
      required: true,
      rows: ["Frontend", "Backend", "Design", "Hardware"],
      columns: ["Beginner", "Intermediate", "Advanced"],
    },
    {
      id: "preferred_role",
      label: "What is your preferred role in a team?",
      type: "preferenceGrid",
      required: true,
      description: "Rate each role from 1 (Least Preferred) to 5 (Most Preferred)",
      rows: ["Frontend", "Backend", "Design", "Hardware", "Any"],
      columns: ["1", "2", "3", "4", "5"],
    },
    {
      id: "backend_skills",
      label: "Backend skills",
      type: "text",
      required: true,
      placeholder: "Express, Flask, Django, Spring Boot, Firebase",
      description: "Separate skills with commas",
    },
    {
      id: "frontend_skills",
      label: "Frontend skills",
      type: "text",
      required: true,
      placeholder: "React, Next.JS, Tailwind, Angular",
      description: "Separate skills with commas",
    },
    {
      id: "design_skills",
      label: "Design skills",
      type: "text",
      required: true,
      placeholder: "Figma, Canva, Adobe, Blender, Unity",
      description: "Separate skills with commas",
    },
    {
      id: "first_time_hacker",
      label: "Are you a first time hacker?",
      type: "radio",
      required: true,
      options: ["Yes", "No"],
    },
  ],
};

// Schema used by the standalone Profile page.
export const profileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.email("Enter a valid email address"),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^\(\d{3}\) \d{3}-\d{4}$/, "Use format (XXX) XXX-XXXX"),
  age: z.enum(AGE_RANGES, { message: "Please select an age range" }),
  graduationYear: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Enter a 4-digit year")
    .refine((v) => {
      const n = parseInt(v, 10);
      return n >= 2020 && n <= 2035;
    }, "Year must be between 2020 and 2035"),
  university: z.string().trim().min(1, "School is required"),
  country: z.string().trim().optional().or(z.literal("")),
  levelOfStudy: z.enum(LEVEL_OF_STUDY_OPTIONS).optional().or(z.literal("")),
  major: z.string().trim().optional().or(z.literal("")),
  gender: z.enum(GENDER_OPTIONS).optional().or(z.literal("")),
  dietaryRestrictions: z.array(z.enum(DIETARY_OPTIONS)).optional(),
  shirtSize: z.enum(SHIRT_SIZES).optional().or(z.literal("")),
  linkedin: z.url("Enter a valid LinkedIn URL").optional().or(z.literal("")),
});

export const hackathonRegistrationApplicationSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required"),
  last_name: z.string().trim().min(1, "Last name is required"),
  age: z.enum(AGE_RANGES, { message: "Please select an age range" }),
  phone_number: z
    .string()
    .trim()
    .regex(/^\(\d{3}\) \d{3}-\d{4}$/, "Use format (XXX) XXX-XXXX"),
  email: z.email("Enter a valid email address"),
  linkedin: z.url("Enter a valid LinkedIn URL").optional().or(z.literal("")),
  school: z.string().trim().min(1, "School is required"),
  country: z.string().trim().min(1, "Country is required"),
  level_of_study: z.enum(LEVEL_OF_STUDY_OPTIONS, {
    message: "Please select a level of study",
  }),
  major: z.string().trim().optional().or(z.literal("")),
  gender: z.enum(GENDER_OPTIONS, { message: "Please select an option" }),
  dietary_restrictions: z.array(z.enum(DIETARY_OPTIONS)).optional(),
  shirt_size: z.enum(SHIRT_SIZES, { message: "Please select a shirt size" }),
  mlh_code_of_conduct: z.literal(true, {
    message: "You must agree to the MLH Code of Conduct",
  }),
  mlh_data_sharing_consent: z.literal(true, {
    message: "You must agree to the MLH data sharing terms",
  }),
  mlh_emails_opt_in: z.boolean().optional(),
});

export const hackathonRegistrationFormConfig: FormConfig = {
  title: "BigRed//Hacks Fall 2026 Registration",
  description: "Complete your registration for the hackathon",
  schema: hackathonRegistrationApplicationSchema,
  fields: [
    {
      id: "first_name",
      label: "First Name",
      type: "text",
      required: true,
      placeholder: "First Name",
    },
    {
      id: "last_name",
      label: "Last Name",
      type: "text",
      required: true,
      placeholder: "Last Name",
    },
    {
      id: "age",
      label: "Age Range",
      type: "dropdown",
      required: true,
      options: [...AGE_RANGES],
    },
    {
      id: "phone_number",
      label: "Phone Number",
      type: "text",
      required: true,
      placeholder: "(123) 456-7890",
    },
    {
      id: "email",
      label: "Email Address",
      type: "email",
      required: true,
      placeholder: "bigredhacks@gmail.com",
    },
    {
      id: "linkedin",
      label: "LinkedIn",
      type: "text",
      required: false,
      placeholder: "https://www.linkedin.com/in/your-profile",
    },
    {
      id: "school",
      label: "School",
      type: "dropdown",
      required: true,
      searchable: true,
      allowCustomValue: true,
      options: [],
      optionsSource: {
        type: "csv",
        url: SCHOOLS_CSV_URL,
        csvType: "schools",
      },
    },
    {
      id: "country",
      label: "Country of Residence",
      type: "dropdown",
      required: true,
      searchable: true,
      options: [],
      optionsSource: {
        type: "csv",
        url: COUNTRIES_CSV_URL,
        csvType: "countries",
      },
    },
    {
      id: "level_of_study",
      label: "Level of Study",
      type: "dropdown",
      required: true,
      options: [...LEVEL_OF_STUDY_OPTIONS],
    },
    {
      id: "major",
      label: "Major",
      type: "dropdown",
      required: false,
      searchable: true,
      allowCustomValue: true,
      options: [...MAJOR_SUGGESTIONS],
    },
    {
      id: "gender",
      label: "Gender",
      type: "radio",
      required: true,
      options: [...GENDER_OPTIONS],
    },
    {
      id: "dietary_restrictions",
      label: "Dietary Restrictions",
      type: "checkboxGroup",
      required: false,
      options: [...DIETARY_OPTIONS],
    },
    {
      id: "shirt_size",
      label: "Shirt Size",
      type: "radio",
      required: true,
      options: [...SHIRT_SIZES],
    },
    {
      id: "mlh_code_of_conduct",
      label: "MLH Code of Conduct",
      type: "checkbox",
      required: true,
      checkboxText: "I have read and agree to the",
      linkText: "MLH Code of Conduct.",
      linkUrl: "https://github.com/MLH/mlh-policies/blob/main/code-of-conduct.md",
    },
    {
      id: "mlh_data_sharing_consent",
      label: "MLH Data Sharing and Terms",
      type: "checkbox",
      required: true,
      checkboxText:
        "I authorize you to share my application/registration information with Major League Hacking for event administration, ranking, and MLH administration in-line with the MLH Privacy Policy (https://github.com/MLH/mlh-policies/blob/main/privacy-policy.md). I further agree to the terms of both the MLH Contest Terms and Conditions (https://github.com/MLH/mlh-policies/blob/main/contest-terms.md) and the MLH Privacy Policy (https://github.com/MLH/mlh-policies/blob/main/privacy-policy.md).",
    },
    {
      id: "mlh_emails_opt_in",
      label: "MLH Emails",
      type: "checkbox",
      required: false,
      checkboxText:
        "I authorize MLH to send me occasional emails about relevant events, career opportunities, and community announcements.",
    },
  ],
};
