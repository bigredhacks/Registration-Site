import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import RegistrationLayout from "@/components/layouts/RegistrationLayout";
import DynamicForm from "@/components/registration/DynamicForm";
import { useToast } from "@/components/Toast/ToastContext";
import { apiFetch } from "@/lib/api";
import { buildSchemaFromFields } from "@/lib/buildSchema";
import type { FormConfig, FormField } from "@/lib/formConfig";
import { extractSubmissionFeedback } from "@/lib/registrationUi";
import { isRegistrationClosed, isWaitlistApplication } from "@/lib/registrationClosure";
import { useRegistrationClock } from "@/lib/useRegistrationClock";

import RegistrationDeadlineNotice from "@/components/registration/RegistrationDeadlineNotice";

interface RegistrationResponse {
  status?: string;
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
  const [savedStatus, setSavedStatus] = useState<string | null>(null);
  const [submissionErrors, setSubmissionErrors] = useState<Record<string, string>>({});
  const now = useRegistrationClock(config?.server_now);
  const closed = isRegistrationClosed(config?.closes_at, now);
  const waitlistApplication = isWaitlistApplication(config, hasExistingSubmission, now);
  const readOnly = closed && !waitlistApplication;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setConfig(null);
      setSavedStatus(null);
      const [configRes, registrationRes] = await Promise.all([
        apiFetch(`/api/form-configs/${key}`),
        apiFetch(`/api/registrations/me?form_key=${encodeURIComponent(key)}`),
      ]);

      if (!registrationRes.ok && registrationRes.status !== 404) throw new Error("Could not load your application.");

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
          closes_at: remote.closes_at,
          closes_timezone: remote.closes_timezone,
          server_now: remote.server_now,
          allow_late_waitlist: remote.allow_late_waitlist,
        });
      }

      if (registrationRes.ok) {
        const registration = (await registrationRes.json()) as RegistrationResponse;
        if (!cancelled) {
          setInitialValues(registration.answers ?? {});
          setHasExistingSubmission(true);
          setSavedStatus(registration.status ?? null);
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
        setConfig(null);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [key, showToast]);

  const handleSubmit = async (data: Record<string, unknown>) => {
    if (readOnly || submitting) return;
    setSubmitting(true);
    setSubmissionErrors({});
    try {
      const res = await apiFetch(
        hasExistingSubmission
          ? `/api/registrations/me?form_key=${encodeURIComponent(key)}`
          : `/api/registrations?form_key=${encodeURIComponent(key)}${waitlistApplication ? '&waitlist=true' : ''}`,
        {
          method: hasExistingSubmission ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.code === 'REGISTRATION_EXISTS') {
          const existing = await apiFetch(`/api/registrations/me?form_key=${encodeURIComponent(key)}`);
          if (!existing.ok) throw new Error('Your application already exists. Reload to view your submitted answers.');
          const saved = await existing.json() as RegistrationResponse;
          setInitialValues(saved.answers ?? {});
          setHasExistingSubmission(true);
          setSavedStatus(saved.status ?? null);
          showToast("You've already submitted this application.", 'info');
          return;
        }
        if (body.code === "REGISTRATION_CLOSED" || body.code === 'WAITLIST_ACKNOWLEDGEMENT_REQUIRED') {
          setConfig((current) => current ? { ...current, closes_at: body.closes_at, server_now: body.server_now, allow_late_waitlist: body.allow_late_waitlist === true } : current);
        }
        if (res.status === 404) setConfig(null);
        const feedback = extractSubmissionFeedback(body, "Could not save this form.");
        setSubmissionErrors(feedback.fieldErrors);
        throw new Error(feedback.message);
      }

      const registration = (await res.json()) as RegistrationResponse;
      setInitialValues(registration.answers ?? data);
      setHasExistingSubmission(true);
      setSavedStatus(registration.status ?? null);
      showToast(registration.status === 'waitlisted' ? "Application submitted. You're on the waitlist." : "Form saved.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save this form. Check your connection and try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RegistrationLayout>
      <div className="mx-auto max-w-4xl">
        {loading && <p className="font-poppins text-sm text-gray-500">Loading form…</p>}
        {!loading && !config && (
          <p className="font-poppins text-sm text-gray-500">This form is unavailable.</p>
        )}
        {!loading && config && (
          <>
          <RegistrationDeadlineNotice form={config} closed={closed} waitlistApplication={waitlistApplication} hasSubmission={hasExistingSubmission} />
          {savedStatus === 'waitlisted' && <p role="status" className="mb-4 font-poppins text-sm font-semibold text-red6">You're on the waitlist. Your application has been received.</p>}
          {(!readOnly || hasExistingSubmission) && <DynamicForm
            key={key}
            config={config}
            onSubmit={handleSubmit}
            isLoading={submitting}
            initialValues={initialValues}
            submissionErrors={submissionErrors}
            submitLabel={waitlistApplication ? "Apply on waitlist" : hasExistingSubmission ? "Update Form" : "Save Form"}
            readOnly={readOnly}
          />}
          </>
        )}
      </div>
    </RegistrationLayout>
  );
}
