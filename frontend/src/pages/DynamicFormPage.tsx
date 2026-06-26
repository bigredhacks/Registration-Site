import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import RegistrationLayout from "@/components/layouts/RegistrationLayout";
import DynamicForm from "@/components/registration/DynamicForm";
import { useToast } from "@/components/Toast/ToastContext";
import { apiFetch } from "@/lib/api";
import { buildSchemaFromFields } from "@/lib/buildSchema";
import type { FormConfig, FormField } from "@/lib/formConfig";
import { extractSubmissionFeedback } from "@/lib/registrationUi";

interface RegistrationResponse {
  answers?: Record<string, unknown>;
}

export default function DynamicFormPage() {
  const { key = "" } = useParams();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [config, setConfig] = useState<FormConfig | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, unknown>>({});
  const [hasExistingSubmission, setHasExistingSubmission] = useState(false);
  const [submissionErrors, setSubmissionErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const [configRes, registrationRes] = await Promise.all([
        apiFetch(`/api/form-configs/${key}`),
        apiFetch(`/api/registrations/me?form_key=${encodeURIComponent(key)}`),
      ]);

      if (!configRes.ok) {
        if (!cancelled) {
          showToast("Could not load this form.", "error");
          setConfig(null);
          setLoading(false);
        }
        return;
      }

      const remote = await configRes.json();
      const fields = remote.fields as FormField[];

      if (!cancelled) {
        setConfig({
          title: remote.title,
          description: remote.description ?? undefined,
          schema: buildSchemaFromFields(fields),
          fields,
        });
      }

      if (registrationRes.ok) {
        const registration = (await registrationRes.json()) as RegistrationResponse;
        if (!cancelled) {
          setInitialValues(registration.answers ?? {});
          setHasExistingSubmission(true);
          setSubmissionErrors({});
        }
      } else if (!cancelled) {
        setInitialValues({});
        setHasExistingSubmission(false);
        setSubmissionErrors({});
      }

      if (!cancelled) {
        setLoading(false);
      }
    };

    load().catch(() => {
      if (!cancelled) {
        showToast("Could not load this form.", "error");
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [key, showToast]);

  const handleSubmit = async (data: Record<string, unknown>) => {
    setSubmitting(true);
    setSubmissionErrors({});
    const res = await apiFetch(
      hasExistingSubmission
        ? `/api/registrations/me?form_key=${encodeURIComponent(key)}`
        : `/api/registrations?form_key=${encodeURIComponent(key)}`,
      {
        method: hasExistingSubmission ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const feedback = extractSubmissionFeedback(body, "Could not save this form.");
      setSubmissionErrors(feedback.fieldErrors);
      showToast(feedback.message, "error");
      return;
    }

    const registration = (await res.json()) as RegistrationResponse;
    setInitialValues(registration.answers ?? data);
    setHasExistingSubmission(true);
    showToast("Form saved.", "success");
  };

  return (
    <RegistrationLayout>
      <div className="mx-auto max-w-4xl">
        {loading && <p className="font-poppins text-sm text-gray-500">Loading form…</p>}
        {!loading && !config && (
          <p className="font-poppins text-sm text-gray-500">This form is unavailable.</p>
        )}
        {!loading && config && (
          <DynamicForm
            config={config}
            onSubmit={handleSubmit}
            isLoading={submitting}
            initialValues={initialValues}
            submissionErrors={submissionErrors}
            submitLabel={hasExistingSubmission ? "Update Form" : "Save Form"}
          />
        )}
      </div>
    </RegistrationLayout>
  );
}
