BEGIN;

ALTER TABLE public.form_configs
  ADD COLUMN IF NOT EXISTS allow_late_waitlist boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.form_configs.allow_late_waitlist IS
  'Allow new applications after closes_at while active; immediately waitlist them. Existing submissions remain read-only after the deadline.';

-- Keep deadline/config evaluation, initial public status, and the confirmation
-- outbox job atomic. Form updates cannot race this decision while FOR SHARE holds.
CREATE OR REPLACE FUNCTION public.create_registration_with_email(p_registration jsonb)
RETURNS public.registrations
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  r public.registrations;
  f public.form_configs;
  submitted_at timestamptz;
  late boolean;
BEGIN
  SELECT * INTO f FROM public.form_configs WHERE key = p_registration->>'form_key' FOR SHARE;
  IF NOT FOUND OR NOT f.is_active THEN
    RAISE SQLSTATE 'PT404' USING MESSAGE = 'Active form not found.';
  END IF;
  submitted_at := clock_timestamp();
  late := f.closes_at IS NOT NULL AND f.closes_at <= submitted_at;
  IF late AND NOT f.allow_late_waitlist THEN
    RAISE SQLSTATE 'PT403' USING MESSAGE = 'Registration is closed.';
  END IF;
  IF late AND (p_registration->'waitlist_acknowledged') IS DISTINCT FROM 'true'::jsonb THEN
    RAISE SQLSTATE 'PT412' USING MESSAGE = 'Registration has closed. Review the waitlist notice, then choose Apply on waitlist to submit.';
  END IF;
  IF f.version IS DISTINCT FROM (p_registration->>'form_version')::integer THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE = 'The application form changed. Refresh before submitting.';
  END IF;
  INSERT INTO public.registrations(user_id, form_key, form_version, answers, status,
    released_status, decision_released_at,
    email, first_name, last_name, school, level_of_study, shirt_size)
  VALUES ((p_registration->>'user_id')::uuid, f.key, f.version, p_registration->'answers',
    CASE WHEN late THEN 'waitlisted' ELSE 'pending' END,
    CASE WHEN late AND f.key = 'registration' THEN 'waitlisted' ELSE NULL END,
    CASE WHEN late AND f.key = 'registration' THEN submitted_at ELSE NULL END,
    p_registration->>'email', p_registration->>'first_name', p_registration->>'last_name',
    p_registration->>'school', p_registration->>'level_of_study', p_registration->>'shirt_size') RETURNING * INTO r;
  INSERT INTO public.email_outbox(dedupe_key, registration_id, kind, recipient, first_name, form_title)
    VALUES ('confirmation/' || r.id, r.id, 'confirmation', coalesce(r.email, ''), r.first_name, f.title);
  RETURN r;
END;
$$;

REVOKE ALL ON FUNCTION public.create_registration_with_email(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_registration_with_email(jsonb) TO service_role;

COMMIT;
