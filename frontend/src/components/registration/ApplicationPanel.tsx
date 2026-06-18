import { useEffect, useState } from "react";
import DynamicForm from "./DynamicForm";
import { hackathonRegistrationFormConfig, type FormConfig, type FormField } from "@/lib/formConfig";
import { buildSchemaFromFields } from "@/lib/buildSchema";
import { useToast } from "@/components/Toast/ToastContext";
import { apiFetch } from "@/lib/api";

interface ApplicationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

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

async function uploadResume(file: File): Promise<void> {
  const urlRes = await apiFetch("/api/registrations/me/resume-upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name }),
  });
  if (!urlRes.ok) throw new Error("Could not get upload URL");
  const { signedUrl, path } = await urlRes.json();

  if (!signedUrl) throw new Error("Storage upload URL missing");
  const putRes = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/pdf" },
    body: file,
  });
  if (!putRes.ok) throw new Error("Storage upload failed");

  const persistRes = await apiFetch("/api/registrations/me/resume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resume_path: path }),
  });
  if (!persistRes.ok) throw new Error("Could not save resume reference");
}

export default function ApplicationPanel({ isOpen, onClose, onSubmitted }: ApplicationPanelProps) {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [prefillBannerDismissed, setPrefillBannerDismissed] = useState(false);
  const [initialValues, setInitialValues] = useState<Record<string, unknown>>({});
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [config, setConfig] = useState<FormConfig>(hackathonRegistrationFormConfig);
  const [profileValues, setProfileValues] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    apiFetch("/api/form-configs/registration")
      .then(async (res) => {
        if (!res.ok) return;
        const remote = await res.json();
        const fields = remote.fields as FormField[];
        setConfig({
          title: remote.title,
          description: remote.description ?? undefined,
          schema: buildSchemaFromFields(fields),
          fields,
        });
      })
      .catch(() => { /* fall back to bundled config */ });

    apiFetch("/api/profile")
      .then(async (res) => {
        if (!res.ok) return;
        const profile = (await res.json()) as ServerProfile;
        setProfileValues(profileToFormValues(profile));
      })
      .catch(() => { /* leave null — banner won't show */ });
  }, []);

  const showPrefillBanner = profileValues !== null && !prefillBannerDismissed && Object.keys(initialValues).length === 0;

  const handlePrefillAccept = () => {
    setInitialValues(profileValues!);
    setPrefillBannerDismissed(true);
  };

  const handlePrefillDecline = () => {
    setPrefillBannerDismissed(true);
  };

  const handleSubmit = async (data: Record<string, unknown>) => {
    setIsLoading(true);
    try {
      const res = await apiFetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        if (res.status === 409) {
          showToast("You've already submitted an application.", "info");
          setIsSubmitted(true);
          onSubmitted();
          return;
        }
        const err = await res.json();
        throw new Error(err.errors?.[0]?.message || err.error || err.message || "Failed to submit");
      }

      if (resumeFile) {
        try {
          await uploadResume(resumeFile);
        } catch {
          showToast("Application submitted, but resume upload failed. You can upload it later.", "info");
        }
      }

      setIsSubmitted(true);
      onSubmitted();
    } catch (error) {
      console.error(error);
      showToast("Failed to submit application. Please try again.", "error");
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
            <p className="font-poppins text-sm text-gray-500 mt-0.5">Fall 2026 Application</p>
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
          {isSubmitted ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <p className="text-6xl font-jersey10 text-red5">Done!</p>
              <h3 className="text-xl font-poppins font-bold text-red6">Application Submitted</h3>
              <p className="font-poppins text-sm text-gray-500 max-w-xs leading-relaxed">
                Thanks for applying to Big Red Hacks 2026. We'll review your application and reach out soon.
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-8 py-2.5 bg-red5 hover:bg-red3 text-white font-poppins font-semibold text-sm rounded-lg transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          ) : (
            <>
              <div className="mb-5 bg-red7 border border-red5/20 rounded-xl px-5 py-4">
                <label className="font-poppins text-sm font-semibold text-gray-800 block mb-2">
                  Resume (optional)
                </label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
                  className="text-sm font-poppins text-gray-700"
                />
                {resumeFile && (
                  <p className="mt-1 text-xs font-poppins text-gray-500">
                    Selected: {resumeFile.name}
                  </p>
                )}
              </div>
              <DynamicForm
                config={config}
                onSubmit={handleSubmit}
                isLoading={isLoading}
                initialValues={initialValues}
                hideHeader
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}
