BEGIN;
CREATE TABLE public.email_templates (
  kind text PRIMARY KEY CHECK (kind IN ('confirmation','approved','rejected')),
  subject text NOT NULL CHECK (length(btrim(subject)) BETWEEN 1 AND 200),
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 10000),
  button_label text NOT NULL DEFAULT '' CHECK (length(button_label) <= 80),
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid NOT NULL
);
CREATE TABLE public.invitation_settings (
  id text PRIMARY KEY CHECK (id = 'registration'),
  deadline timestamptz, time_zone text NOT NULL DEFAULT 'America/New_York',
  version integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid
);
-- The sample date in the editor is not an active deadline. An admin must save it.
INSERT INTO public.invitation_settings(id) VALUES ('registration');
ALTER TABLE public.registrations ADD COLUMN invitation_expired_at timestamptz;
ALTER TABLE public.email_batches ADD COLUMN invitation_settings_version integer;
ALTER TABLE public.email_outbox ADD COLUMN invitation_settings_version integer;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitation_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_templates, public.invitation_settings FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.email_templates,public.invitation_settings TO service_role;

CREATE FUNCTION public.save_email_template(p_kind text,p_subject text,p_body text,p_button_label text,p_expected_version integer,p_admin_id uuid)
RETURNS public.email_templates LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE saved public.email_templates;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id=p_admin_id) THEN RAISE SQLSTATE 'PT403' USING MESSAGE='Admin access required.'; END IF;
  IF p_expected_version IS NULL OR p_expected_version < 0 THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Invalid template version.'; END IF;
  IF p_expected_version > 0 AND NOT EXISTS (SELECT 1 FROM public.email_templates WHERE kind=p_kind) THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE='This template changed. Reload it before saving.';
  END IF;
  INSERT INTO public.email_templates(kind,subject,body,button_label,updated_by)
  VALUES(p_kind,btrim(p_subject),btrim(p_body),btrim(p_button_label),p_admin_id)
  ON CONFLICT(kind) DO UPDATE SET subject=excluded.subject,body=excluded.body,button_label=excluded.button_label,
    version=email_templates.version+1,updated_at=clock_timestamp(),updated_by=p_admin_id
    WHERE email_templates.version=p_expected_version
  RETURNING * INTO saved;
  IF NOT FOUND THEN RAISE SQLSTATE 'PT409' USING MESSAGE='This template changed. Reload it before saving.'; END IF;
  RETURN saved;
END;
$$;

CREATE FUNCTION public.expire_registration_invitations()
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE settings public.invitation_settings; expired integer;
BEGIN
  SELECT * INTO STRICT settings FROM public.invitation_settings WHERE id='registration' FOR SHARE;
  IF settings.deadline IS NULL OR clock_timestamp() < settings.deadline THEN RETURN 0; END IF;
  PERFORM id FROM public.registrations WHERE form_key='registration' AND released_status='approved'
    AND invitation_response IS NULL ORDER BY id FOR UPDATE;
  UPDATE public.registrations SET status='rejected',released_status='rejected',decision_released_at=clock_timestamp(),
    invitation_response='declined',invitation_responded_at=clock_timestamp(),invitation_expired_at=settings.deadline
    WHERE form_key='registration' AND released_status='approved' AND invitation_response IS NULL;
  GET DIAGNOSTICS expired = ROW_COUNT;
  RETURN expired;
END;
$$;

CREATE FUNCTION public.update_invitation_deadline(p_deadline timestamptz,p_time_zone text,p_expected_version integer,p_admin_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE settings public.invitation_settings; expired integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id=p_admin_id) THEN RAISE SQLSTATE 'PT403' USING MESSAGE='Admin access required.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=p_time_zone) THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Invalid time zone.'; END IF;
  SELECT * INTO STRICT settings FROM public.invitation_settings WHERE id='registration' FOR UPDATE;
  IF settings.version IS DISTINCT FROM p_expected_version THEN RAISE SQLSTATE 'PT409' USING MESSAGE='The deadline changed. Reload it before saving.'; END IF;
  -- Extending or clearing the deadline must not revive invitations that already expired.
  expired := public.expire_registration_invitations();
  IF settings.deadline IS NOT DISTINCT FROM p_deadline AND settings.time_zone=p_time_zone THEN
    RETURN to_jsonb(settings) || jsonb_build_object('expired_count',expired);
  END IF;
  UPDATE public.invitation_settings SET deadline=p_deadline,time_zone=p_time_zone,version=version+1,
    updated_at=clock_timestamp(),updated_by=p_admin_id WHERE id='registration' RETURNING * INTO settings;
  expired := expired + public.expire_registration_invitations();
  -- An unsent approval must not advertise a deadline that is no longer current.
  UPDATE public.email_outbox SET state=CASE WHEN first_attempt_at IS NULL THEN 'cancelled' ELSE 'needs_review' END,
    last_error='Invitation deadline changed. Check any previous delivery attempt in Resend before preparing a new email.',lease_token=NULL,lease_until=NULL
    WHERE kind='approved' AND state IN ('queued','failed') AND invitation_settings_version IS DISTINCT FROM settings.version;
  RETURN to_jsonb(settings) || jsonb_build_object('expired_count',expired);
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_registration_invitation(p_user_id uuid,p_response text)
RETURNS public.registrations LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE registration public.registrations; settings public.invitation_settings;
BEGIN
  IF p_response IS NULL OR p_response NOT IN ('accepted','declined') THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Choose accepted or declined.'; END IF;
  SELECT * INTO STRICT settings FROM public.invitation_settings WHERE id='registration' FOR SHARE;
  BEGIN
    SELECT * INTO STRICT registration FROM public.registrations WHERE user_id=p_user_id AND form_key='registration' FOR UPDATE;
  EXCEPTION WHEN no_data_found THEN RAISE SQLSTATE 'PT404' USING MESSAGE='No registration found.'; END;
  IF registration.invitation_expired_at IS NOT NULL THEN RAISE SQLSTATE 'PT409' USING MESSAGE='The invitation deadline has passed.'; END IF;
  IF registration.invitation_response=p_response THEN RETURN registration; END IF;
  IF registration.invitation_response IS NOT NULL THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Your response is final. Contact the organizers for corrections.'; END IF;
  IF registration.released_status IS DISTINCT FROM 'approved' THEN RAISE SQLSTATE 'PT409' USING MESSAGE='No released invitation is available.'; END IF;
  IF settings.deadline IS NOT NULL AND clock_timestamp() >= settings.deadline THEN RAISE SQLSTATE 'PT409' USING MESSAGE='The invitation deadline has passed.'; END IF;
  UPDATE public.registrations SET invitation_response=p_response,invitation_responded_at=clock_timestamp()
    WHERE id=registration.id RETURNING * INTO registration;
  RETURN registration;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_registration_decisions(p_decisions jsonb)
RETURNS SETOF public.registrations
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  PERFORM id FROM public.invitation_settings WHERE id='registration' FOR SHARE;
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

  IF EXISTS (SELECT 1 FROM public.invitation_settings WHERE id='registration' AND deadline <= clock_timestamp())
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(p_decisions) d WHERE d->>'expected_status'='approved') THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE='The invitation deadline has passed. Set a future deadline before releasing new approvals.';
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
  SET released_status = r.status, decision_released_at = clock_timestamp(),
    invitation_response = CASE WHEN r.invitation_expired_at IS NOT NULL AND r.status='approved' THEN NULL ELSE r.invitation_response END,
    invitation_responded_at = CASE WHEN r.invitation_expired_at IS NOT NULL AND r.status='approved' THEN NULL ELSE r.invitation_responded_at END,
    invitation_expired_at = CASE WHEN r.status='approved' THEN NULL ELSE r.invitation_expired_at END
  FROM jsonb_to_recordset(p_decisions) AS d(id bigint)
  WHERE r.id = d.id AND r.released_status IS DISTINCT FROM r.status;

  RETURN QUERY SELECT r.* FROM public.registrations r
  JOIN jsonb_to_recordset(p_decisions) AS d(id bigint) ON d.id = r.id ORDER BY r.id;
END;
$$;


CREATE OR REPLACE FUNCTION public.queue_decision_email_batch(p_batch_id uuid, p_admin_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE b public.email_batches; m jsonb; r public.registrations; added integer := 0; affected integer; settings public.invitation_settings;
BEGIN
  SELECT * INTO STRICT settings FROM public.invitation_settings WHERE id='registration' FOR SHARE;
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = p_admin_id) THEN
    RAISE SQLSTATE 'PT403' USING MESSAGE = 'Admin access required.';
  END IF;
  SELECT * INTO b FROM public.email_batches WHERE id = p_batch_id AND created_by = p_admin_id FOR UPDATE;
  IF NOT FOUND THEN RAISE SQLSTATE 'PT404' USING MESSAGE = 'Email draft not found.'; END IF;
  IF b.queued_at IS NOT NULL THEN
    RETURN jsonb_build_object('queued', b.queued_count, 'skipped', b.skipped_count);
  END IF;
  IF b.created_at < now() - interval '1 hour' THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE = 'This preview expired. Create a fresh preview.';
  END IF;
  IF b.kind='approved' AND (settings.deadline IS NULL OR settings.deadline <= clock_timestamp() OR b.invitation_settings_version IS DISTINCT FROM settings.version) THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE='The invitation deadline changed or has passed. Create a new preview.';
  END IF;
  -- Lock in ID order, matching the decision-release function, across different batches.
  PERFORM id FROM public.registrations WHERE id IN
    (SELECT (value->>'id')::bigint FROM jsonb_array_elements(b.messages)) ORDER BY id FOR UPDATE;
  FOR m IN SELECT value FROM jsonb_array_elements(b.messages) LOOP
    SELECT * INTO r FROM public.registrations WHERE id = (m->>'id')::bigint;
    IF NOT FOUND OR r.form_key IS DISTINCT FROM 'registration' OR r.released_status IS DISTINCT FROM b.kind
      OR r.decision_released_at IS DISTINCT FROM (m->>'released_at')::timestamptz
      OR btrim(r.email) IS DISTINCT FROM m->>'recipient' THEN
      RAISE SQLSTATE 'PT409' USING MESSAGE = 'A selected applicant or released decision changed. Create a fresh preview.';
    END IF;
    INSERT INTO public.email_outbox(dedupe_key, registration_id, batch_id, kind, recipient, first_name,
      expected_released_at, request_payload, created_by, invitation_settings_version, template_version)
    VALUES ('decision/' || r.id || '/' || b.kind || '/' || extract(epoch FROM r.decision_released_at) || CASE WHEN b.kind='approved' THEN '/deadline-' || settings.version ELSE '' END,
      r.id, b.id, b.kind, m->>'recipient', r.first_name, r.decision_released_at, m->'payload', p_admin_id, b.invitation_settings_version, coalesce(m->>'template_version','2026-09-15-v2'))
    ON CONFLICT (dedupe_key) DO NOTHING;
    GET DIAGNOSTICS affected = ROW_COUNT;
    added := added + affected;
  END LOOP;
  UPDATE public.email_batches SET queued_at = clock_timestamp(), queued_count = added,
    skipped_count = jsonb_array_length(b.messages) - added WHERE id = b.id;
  RETURN jsonb_build_object('queued', added, 'skipped', jsonb_array_length(b.messages) - added);
END;
$$;


CREATE OR REPLACE FUNCTION public.claim_email_job()
RETURNS SETOF public.email_outbox LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE job public.email_outbox; r public.registrations; settings public.invitation_settings;
BEGIN
  SELECT * INTO STRICT settings FROM public.invitation_settings WHERE id='registration' FOR SHARE;
  LOOP
    SELECT * INTO job FROM public.email_outbox
    WHERE (state = 'queued' AND available_at <= now()) OR (state = 'sending' AND lease_until <= now())
    ORDER BY created_at, id FOR UPDATE SKIP LOCKED LIMIT 1;
    IF NOT FOUND THEN RETURN; END IF;
    IF job.first_attempt_at < now() - interval '23 hours' THEN
      UPDATE public.email_outbox SET state = 'needs_review', lease_token = NULL, lease_until = NULL,
        last_error = 'Retry window expired. Check Resend before sending anything else.' WHERE id = job.id;
      CONTINUE;
    END IF;
    IF job.kind='approved' AND (settings.deadline IS NULL OR settings.deadline <= clock_timestamp() OR job.invitation_settings_version IS DISTINCT FROM settings.version) THEN
      UPDATE public.email_outbox SET state=CASE WHEN first_attempt_at IS NULL THEN 'cancelled' ELSE 'needs_review' END,lease_token=NULL,lease_until=NULL,last_error='Invitation deadline changed or passed. Check any previous attempt in Resend.' WHERE id=job.id;
      CONTINUE;
    END IF;
    IF job.kind <> 'test' THEN
      SELECT * INTO r FROM public.registrations WHERE id = job.registration_id;
      IF NOT FOUND OR btrim(r.email) IS DISTINCT FROM job.recipient OR
        (job.kind IN ('approved','rejected') AND (r.form_key IS DISTINCT FROM 'registration'
          OR r.released_status IS DISTINCT FROM job.kind OR r.decision_released_at IS DISTINCT FROM job.expected_released_at)) THEN
        UPDATE public.email_outbox SET state = 'cancelled', lease_token = NULL, lease_until = NULL,
          last_error = 'Application, recipient, or released decision changed before sending.' WHERE id = job.id;
        CONTINUE;
      END IF;
    END IF;
    RETURN QUERY UPDATE public.email_outbox SET state = 'sending', attempts = attempts + 1,
      first_attempt_at = coalesce(first_attempt_at, clock_timestamp()), lease_token = gen_random_uuid(),
      lease_until = now() + interval '2 minutes' WHERE id = job.id RETURNING *;
    RETURN;
  END LOOP;
END;
$$;


REVOKE EXECUTE ON FUNCTION public.save_email_template(text,text,text,text,integer,uuid),public.expire_registration_invitations(),
  public.update_invitation_deadline(timestamptz,text,integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_email_template(text,text,text,text,integer,uuid),public.expire_registration_invitations(),
  public.update_invitation_deadline(timestamptz,text,integer,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
