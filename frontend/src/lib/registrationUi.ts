export interface ActiveFormSummary {
  key: string;
  title: string;
  description: string | null;
  version: number;
}

export interface RegistrationSummaryLike {
  form_key?: string | null;
  status?: string | null;
}

export interface ApplicationCard {
  key: string;
  title: string;
  description: string | null;
  version: number;
  status: string | null;
  stateLabel: string;
  started: boolean;
  primaryActionLabel: string;
}

export interface SubmissionFeedback {
  message: string;
  fieldErrors: Record<string, string>;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  waitlisted: "Waitlisted",
};

function titleCaseStatus(status: string): string {
  return STATUS_LABELS[status] ?? `${status.charAt(0).toUpperCase()}${status.slice(1)}`;
}

export function buildApplicationCards(
  forms: ActiveFormSummary[],
  registrations: RegistrationSummaryLike[],
): ApplicationCard[] {
  const registrationsByKey = new Map(
    registrations
      .filter((registration) => typeof registration.form_key === "string" && registration.form_key.length > 0)
      .map((registration) => [registration.form_key as string, registration]),
  );

  return [...forms]
    .sort((left, right) => {
      if (left.key === "registration") return -1;
      if (right.key === "registration") return 1;
      return left.title.localeCompare(right.title);
    })
    .map((form) => {
      const registration = registrationsByKey.get(form.key);
      const status =
        typeof registration?.status === "string" && registration.status.length > 0
          ? registration.status
          : null;
      const started = registration !== undefined;

      return {
        key: form.key,
        title: form.title,
        description: form.description,
        version: form.version,
        status,
        stateLabel: status ? titleCaseStatus(status) : "Not Started",
        started,
        primaryActionLabel: form.key === "registration"
          ? started
            ? "View Application"
            : "Start Application"
          : started
            ? "Open Form"
            : "Start Form",
      };
    });
}

export function extractSubmissionFeedback(
  payload: unknown,
  fallbackMessage = "Failed to submit application. Please try again.",
): SubmissionFeedback {
  if (!payload || typeof payload !== "object") {
    return { message: fallbackMessage, fieldErrors: {} };
  }

  const body = payload as {
    error?: unknown;
    message?: unknown;
    errors?: Array<{ field?: unknown; message?: unknown }>;
  };

  const fieldErrors: Record<string, string> = {};
  for (const issue of body.errors ?? []) {
    if (typeof issue?.field !== "string" || typeof issue?.message !== "string") {
      continue;
    }
    if (!fieldErrors[issue.field]) {
      fieldErrors[issue.field] = issue.message;
    }
  }

  const message =
    Object.values(fieldErrors)[0] ||
    (typeof body.error === "string" && body.error) ||
    (typeof body.message === "string" && body.message) ||
    fallbackMessage;

  return { message, fieldErrors };
}
