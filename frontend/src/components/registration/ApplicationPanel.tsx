import { useEffect, useState } from "react";
import DynamicForm from "./DynamicForm";
import type { FormConfig, FormField } from "@/lib/formConfig";
import { buildSchemaFromFields } from "@/lib/buildSchema";
import { useToast } from "@/components/Toast/ToastContext";
import { apiFetch } from "@/lib/api";
import { extractSubmissionFeedback } from "@/lib/registrationUi";

interface ApplicationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: (registration: RegistrationResponse) => void;
}

export interface RegistrationResponse {
  id: number | string;
  answers?: Record<string, unknown>;
  status?: string | null;
  resume_path?: string | null;
  form_key?: string | null;
}

const FORM_KEY = "registration";

interface ServerProfile {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone_number?: string | null;
  age_range?: string | null;
  school?: string | null;
  country?: string | null;
  major?: string | null;
  gender?: string | null;
  shirt_size?: string | null;
  dietary_restrictions?: string[] | null;
  level_of_study?: string | null;
  linkedin?: string | null;
}

function profileToFormValues(profile: ServerProfile): Record<string, unknown> | null {
  if (!profile.first_name && !profile.last_name && !profile.email) return null;
  return {
    first_name: profile.first_name || "",
    last_name: profile.last_name || "",
    email: profile.email || "",
    phone_number: profile.phone_number || "",
    age: profile.age_range || "",
    school: profile.school || "",
    country: profile.country || "",
    major: profile.major || "",
    level_of_study: profile.level_of_study || "",
    gender: profile.gender || "",
    shirt_size: profile.shirt_size || "",
    dietary_restrictions: profile.dietary_restrictions || [],
    linkedin: profile.linkedin || "",
  };
}

function registrationToFormValues(registration: RegistrationResponse): Record<string, unknown> {
  return registration.answers && typeof registration.answers === "object"
    ? registration.answers
    : {};
}

function formatStatusLabel(status?: string | null): string {
  if (!status) return "Draft";
  return `${status.charAt(0).toUpperCase()}${status.slice(1)}`;
}

export default function ApplicationPanel({ isOpen, onClose, onSubmitted }: ApplicationPanelProps) {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [prefillBannerDismissed, setPrefillBannerDismissed] = useState(false);
  const [initialValues, setInitialValues] = useState<Record<string, unknown>>({});
  const [hasExistingSubmission, setHasExistingSubmission] = useState(false);
  const [submissionMode, setSubmissionMode] = useState<"created" | "updated">("created");
  const [config, setConfig] = useState<FormConfig | null>(null);
  const [configUnavailable, setConfigUnavailable] = useState(false);
  const [profileValues, setProfileValues] = useState<Record<string, unknown> | null>(null);
  const [submissionErrors, setSubmissionErrors] = useState<Record<string, string>>({});
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const loadPanelState = async () => {
      setIsBootstrapping(true);
      setIsSubmitted(false);
      setSubmissionErrors({});

      try {
        const [configRes, profileRes, registrationRes] = await Promise.all([
          apiFetch(`/api/form-configs/${FORM_KEY}`),
          apiFetch("/api/profile"),
          apiFetch(`/api/registrations/me?form_key=${FORM_KEY}`),
        ]);

        if (!cancelled && configRes.ok) {
          const remote = await configRes.json();
          const fields = remote.fields as FormField[];
          setConfig({
            title: remote.title,
            description: remote.description ?? undefined,
            schema: buildSchemaFromFields(fields),
            fields,
          });
          setConfigUnavailable(false);
        } else if (!cancelled) {
          setConfig(null);
          setConfigUnavailable(true);
        }

        if (!cancelled && profileRes.ok) {
          const profile = (await profileRes.json()) as ServerProfile;
          setProfileValues(profileToFormValues(profile));
        }

        if (!cancelled && registrationRes.ok) {
          const registration = (await registrationRes.json()) as RegistrationResponse;
          setHasExistingSubmission(true);
          setSubmissionMode("updated");
          setInitialValues(registrationToFormValues(registration));
          setCurrentStatus(registration.status ?? null);
          setPrefillBannerDismissed(true);
          return;
        }

        if (!cancelled) {
          setHasExistingSubmission(false);
          setSubmissionMode("created");
          setInitialValues({});
          setCurrentStatus(null);
          setPrefillBannerDismissed(false);
        }
      } catch {
        if (!cancelled) {
          setHasExistingSubmission(false);
          setSubmissionMode("created");
          setCurrentStatus(null);
        }
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      }
    };

    loadPanelState().catch(() => {
      if (!cancelled) {
        setIsBootstrapping(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const showPrefillBanner =
    !hasExistingSubmission &&
    profileValues !== null &&
    !prefillBannerDismissed &&
    Object.keys(initialValues).length === 0;

  const handlePrefillAccept = () => {
    setInitialValues(profileValues!);
    setPrefillBannerDismissed(true);
  };

  const handlePrefillDecline = () => {
    setPrefillBannerDismissed(true);
  };

  const handleSubmit = async (data: Record<string, unknown>) => {
    setIsLoading(true);
    setSubmissionErrors({});
    try {
      const method = hasExistingSubmission ? "PUT" : "POST";
      const endpoint = hasExistingSubmission
        ? `/api/registrations/me?form_key=${FORM_KEY}`
        : `/api/registrations?form_key=${FORM_KEY}`;
      const res = await apiFetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        if (res.status === 409) {
          showToast("You've already submitted an application.", "info");
          setHasExistingSubmission(true);
          return;
        }
        const feedback = extractSubmissionFeedback(
          await res.json().catch(() => null),
          "Failed to submit application. Please try again.",
        );
        setSubmissionErrors(feedback.fieldErrors);
        throw new Error(feedback.message);
      }

      const savedRegistration = (await res.json()) as RegistrationResponse;

      setSubmissionMode(hasExistingSubmission ? "updated" : "created");
      setHasExistingSubmission(true);
      setInitialValues(registrationToFormValues(savedRegistration));
      setCurrentStatus(savedRegistration.status ?? null);
      setIsSubmitted(true);
      onSubmitted(savedRegistration);
    } catch (error) {
      console.error(error);
      showToast(error instanceof Error ? error.message : "Failed to submit application. Please try again.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 transition-opacity duration-300"
          style={{ left: "224px" }} // sidebar width = 56 * 4 = 224px
          onClick={onClose}
        />
      )}

      {/* Slide-in panel */}
      <div
        className={`fixed top-0 right-0 bottom-0 z-50 w-[620px] bg-white shadow-2xl flex flex-col transition-transform duration-350 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-8 pt-8 pb-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-4xl font-jersey10 text-gray-900">
              BigRed<span className="text-red5">//</span>Hacks
            </h2>
            <div className="mt-0.5 flex items-center gap-2">
              <p className="font-poppins text-sm text-gray-500">Fall 2026 Application</p>
              {hasExistingSubmission && (
                <span className="rounded-full bg-red7 px-2.5 py-1 text-[11px] font-poppins font-semibold uppercase tracking-widest text-red6">
                  {formatStatusLabel(currentStatus)}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-800 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Profile pre-fill banner */}
        {showPrefillBanner && (
          <div className="mx-8 mt-4 bg-red7 border border-red5/20 rounded-xl px-5 py-3.5 flex items-center justify-between gap-4 shrink-0">
            <p className="font-poppins text-sm text-gray-700">
              Pre-fill from your saved profile?
            </p>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={handlePrefillAccept}
                className="px-4 py-1.5 bg-red5 hover:bg-red3 text-white text-xs font-poppins font-semibold rounded-lg transition-colors"
              >
                Yes, pre-fill
              </button>
              <button
                onClick={handlePrefillDecline}
                className="px-4 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-poppins font-medium rounded-lg transition-colors"
              >
                Start fresh
              </button>
            </div>
          </div>
        )}

        {/* Form content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-8 py-6">
          {isBootstrapping ? (
            <div className="flex h-full items-center justify-center">
              <p className="font-poppins text-sm text-gray-500">Loading application…</p>
            </div>
          ) : configUnavailable || !config ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <p className="text-4xl font-jersey10 text-red5">Unavailable</p>
              <p className="max-w-sm font-poppins text-sm text-gray-500">
                The main application form is not active right now. Check back later or contact the organizers if you expected to apply.
              </p>
              <button
                onClick={onClose}
                className="rounded-lg bg-red5 px-6 py-2.5 text-sm font-poppins font-semibold text-white transition-colors hover:bg-red3"
              >
                Back to Dashboard
              </button>
            </div>
          ) : isSubmitted ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <p className="text-6xl font-jersey10 text-red5">Done!</p>
              <h3 className="text-xl font-poppins font-bold text-red6">
                {submissionMode === "updated" ? "Application Updated" : "Application Submitted"}
              </h3>
              <p className="font-poppins text-sm text-gray-500 max-w-xs leading-relaxed">
                {submissionMode === "updated"
                  ? "Your application changes have been saved."
                  : "Thanks for applying to Big Red Hacks 2026. We'll review your application and reach out soon."}
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-8 py-2.5 bg-red5 hover:bg-red3 text-white font-poppins font-semibold text-sm rounded-lg transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          ) : (
            <DynamicForm
              config={config}
              onSubmit={handleSubmit}
              isLoading={isLoading}
              initialValues={initialValues}
              hideHeader
              submissionErrors={submissionErrors}
              submitLabel={hasExistingSubmission ? "Update Application" : "Submit Application"}
            />
          )}
        </div>
      </div>
    </>
  );
}
