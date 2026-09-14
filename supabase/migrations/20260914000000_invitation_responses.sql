BEGIN;

LOCK TABLE public.registrations IN ACCESS EXCLUSIVE MODE;
CREATE TEMP TABLE invitation_migration_before ON COMMIT DROP AS
SELECT id, to_jsonb(r) AS original FROM public.registrations r;

ALTER TABLE public.registrations
  ADD COLUMN released_status text CHECK (released_status IN ('approved', 'waitlisted', 'rejected')),
  ADD COLUMN decision_released_at timestamptz,
  ADD COLUMN invitation_response text CHECK (invitation_response IN ('accepted', 'declined')),
  ADD COLUMN invitation_responded_at timestamptz,
  ADD CONSTRAINT registrations_release_timestamp_check
    CHECK ((released_status IS NULL) = (decision_released_at IS NULL)),
  ADD CONSTRAINT registrations_response_timestamp_check
    CHECK ((invitation_response IS NULL) = (invitation_responded_at IS NULL));

CREATE FUNCTION public.release_registration_decisions(p_decisions jsonb)
RETURNS SETOF public.registrations
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  IF p_decisions IS NULL OR jsonb_typeof(p_decisions) <> 'array' THEN
    RAISE SQLSTATE 'PT400' USING MESSAGE = 'Invalid selected decisions.';
  END IF;
  IF jsonb_array_length(p_decisions) NOT BETWEEN 1 AND 200 OR EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_decisions) AS d(id bigint, expected_status text)
    WHERE d.id IS NULL OR d.id <= 0 OR d.expected_status IS NULL
      OR d.expected_status NOT IN ('approved', 'waitlisted', 'rejected')
  ) OR (SELECT count(DISTINCT d.id) FROM jsonb_to_recordset(p_decisions) AS d(id bigint)) <> jsonb_array_length(p_decisions) THEN
    RAISE SQLSTATE 'PT400' USING MESSAGE = 'Invalid selected decisions.';
  END IF;

  PERFORM r.id FROM public.registrations r
  JOIN jsonb_to_recordset(p_decisions) AS d(id bigint) ON d.id = r.id
  ORDER BY r.id FOR UPDATE OF r;

  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_decisions) AS d(id bigint, expected_status text)
    LEFT JOIN public.registrations r ON r.id = d.id
    WHERE r.id IS NULL OR r.form_key <> 'registration' OR r.status IS DISTINCT FROM d.expected_status
  ) THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE = 'Selected decisions changed. Refresh and review before releasing.';
  END IF;

  UPDATE public.registrations r
  SET released_status = r.status, decision_released_at = clock_timestamp()
  FROM jsonb_to_recordset(p_decisions) AS d(id bigint)
  WHERE r.id = d.id AND r.released_status IS DISTINCT FROM r.status;

  RETURN QUERY SELECT r.* FROM public.registrations r
  JOIN jsonb_to_recordset(p_decisions) AS d(id bigint) ON d.id = r.id ORDER BY r.id;
END;
$$;

CREATE FUNCTION public.respond_to_registration_invitation(p_user_id uuid, p_response text)
RETURNS public.registrations
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  registration public.registrations;
BEGIN
  IF p_response IS NULL OR p_response NOT IN ('accepted', 'declined') THEN
    RAISE SQLSTATE 'PT400' USING MESSAGE = 'Choose accepted or declined.';
  END IF;

  BEGIN
    SELECT * INTO STRICT registration FROM public.registrations r
    WHERE r.user_id = p_user_id AND r.form_key = 'registration' FOR UPDATE;
  EXCEPTION WHEN no_data_found THEN
    RAISE SQLSTATE 'PT404' USING MESSAGE = 'No registration found.';
  END;

  IF registration.invitation_response = p_response THEN
    RETURN registration;
  END IF;
  IF registration.invitation_response IS NOT NULL THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE = 'Your response is final. Contact the organizers for corrections.';
  END IF;
  IF registration.released_status IS DISTINCT FROM 'approved' THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE = 'No released invitation is available.';
  END IF;

  UPDATE public.registrations r
  SET invitation_response = p_response, invitation_responded_at = clock_timestamp()
  WHERE r.id = registration.id RETURNING r.* INTO registration;
  RETURN registration;
END;
$$;

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.registrations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registrations TO service_role;
REVOKE EXECUTE ON FUNCTION public.release_registration_decisions(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.respond_to_registration_invitation(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_registration_decisions(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.respond_to_registration_invitation(uuid, text) TO service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.registrations r FULL JOIN invitation_migration_before b USING (id)
    WHERE r.id IS NULL OR b.id IS NULL OR
      (to_jsonb(r) - ARRAY['released_status', 'decision_released_at', 'invitation_response', 'invitation_responded_at'])
        IS DISTINCT FROM b.original
  ) THEN
    RAISE EXCEPTION 'Existing registration values changed; rolling back migration.';
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
