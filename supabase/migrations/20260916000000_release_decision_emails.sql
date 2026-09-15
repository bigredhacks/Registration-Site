BEGIN;
-- Add waitlist templates and jobs without changing existing saved files or messages.
ALTER TABLE public.email_batches DROP CONSTRAINT email_batches_kind_check;
ALTER TABLE public.email_batches ADD CONSTRAINT email_batches_kind_check CHECK(kind IN ('approved','rejected','waitlisted'));
ALTER TABLE public.email_outbox DROP CONSTRAINT email_outbox_kind_check;
ALTER TABLE public.email_outbox ADD CONSTRAINT email_outbox_kind_check CHECK(kind IN ('confirmation','approved','rejected','waitlisted','test'));
ALTER TABLE public.email_template_files DROP CONSTRAINT email_template_files_kind_check;
ALTER TABLE public.email_template_files ADD CONSTRAINT email_template_files_kind_check CHECK(kind IN ('confirmation','approved','rejected','waitlisted'));

CREATE OR REPLACE FUNCTION public.activate_email_template_files(p_kind text,p_storage_path text,p_expected_version integer,p_admin_id uuid)
RETURNS public.email_template_files LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE saved public.email_template_files;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.admin_users WHERE user_id=p_admin_id) THEN RAISE SQLSTATE 'PT403' USING MESSAGE='Admin access required.'; END IF;
  IF p_kind NOT IN ('confirmation','approved','rejected','waitlisted') OR p_storage_path IS NULL OR p_storage_path !~ ('^'||p_kind||'/[0-9a-f-]{36}$') THEN
    RAISE SQLSTATE 'PT400' USING MESSAGE='Invalid template file revision.';
  END IF;
  IF p_expected_version IS NULL OR p_expected_version < 0 THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Invalid template version.'; END IF;
  IF p_expected_version > 0 AND NOT EXISTS(SELECT 1 FROM public.email_template_files WHERE kind=p_kind) THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE='This template changed. Reload it before saving.';
  END IF;
  INSERT INTO public.email_template_files(kind,storage_path,updated_by) VALUES(p_kind,p_storage_path,p_admin_id)
  ON CONFLICT(kind) DO UPDATE SET storage_path=excluded.storage_path,version=email_template_files.version+1,
    updated_at=clock_timestamp(),updated_by=p_admin_id WHERE email_template_files.version=p_expected_version
  RETURNING * INTO saved;
  IF NOT FOUND THEN RAISE SQLSTATE 'PT409' USING MESSAGE='This template changed. Reload it before saving.'; END IF;
  RETURN saved;
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
        (job.kind IN ('approved','rejected','waitlisted') AND (r.form_key IS DISTINCT FROM 'registration'
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


-- A reviewed release freezes each chosen email before any applicant sees a decision.
CREATE TABLE public.email_decision_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  decisions jsonb NOT NULL CHECK(jsonb_typeof(decisions)='array' AND jsonb_array_length(decisions) BETWEEN 1 AND 1000),
  messages jsonb NOT NULL CHECK(jsonb_typeof(messages)='array'),
  invitation_settings_version integer NOT NULL,
  completed_at timestamptz,
  result jsonb
);
ALTER TABLE public.email_decision_releases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_decision_releases FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.email_decision_releases TO service_role;

CREATE FUNCTION public.release_decisions_with_emails(p_release_id uuid,p_admin_id uuid,p_delivery_enabled boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE preview public.email_decision_releases; settings public.invitation_settings;
  batch_id uuid; email_kind text; batch_messages jsonb; chunk jsonb; queued_result jsonb;
  saved_result jsonb; added integer:=0; skipped integer:=0;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.admin_users WHERE user_id=p_admin_id) THEN
    RAISE SQLSTATE 'PT403' USING MESSAGE='Admin access required.';
  END IF;
  SELECT * INTO preview FROM public.email_decision_releases WHERE id=p_release_id AND created_by=p_admin_id FOR UPDATE;
  IF NOT FOUND THEN RAISE SQLSTATE 'PT404' USING MESSAGE='Release preview not found.'; END IF;
  -- A lost HTTP response can be retried without releasing or sending again, even after the deadline.
  IF preview.completed_at IS NOT NULL THEN RETURN preview.result; END IF;
  IF preview.created_at < now()-interval '1 hour' THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE='This preview expired. Review the decisions again.';
  END IF;
  IF jsonb_array_length(preview.messages)>0 AND p_delivery_enabled IS DISTINCT FROM true THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE='Email delivery is paused. Enable delivery or review a release without emails.';
  END IF;
  -- Match the deadline/release lock order, then lock all applicants before changing any.
  SELECT * INTO STRICT settings FROM public.invitation_settings WHERE id='registration' FOR SHARE;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(preview.messages) m WHERE m->>'kind'='approved')
    AND (settings.deadline IS NULL OR settings.deadline<=clock_timestamp() OR settings.version IS DISTINCT FROM preview.invitation_settings_version) THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE='The invitation deadline changed or has passed. Review the emails again.';
  END IF;
  PERFORM r.id FROM public.registrations r JOIN jsonb_to_recordset(preview.decisions) AS d(id bigint) ON r.id=d.id ORDER BY r.id FOR UPDATE OF r;
  IF EXISTS(SELECT 1 FROM jsonb_to_recordset(preview.decisions) AS d(id bigint,expected_status text)
    LEFT JOIN public.registrations r ON r.id=d.id
    WHERE r.id IS NULL OR r.form_key IS DISTINCT FROM 'registration' OR r.status IS DISTINCT FROM d.expected_status) THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE='Selected decisions changed. Review the decisions again.';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(preview.messages) m
    LEFT JOIN public.registrations r ON r.id=(m->>'id')::bigint
    WHERE r.id IS NULL OR r.status IS DISTINCT FROM m->>'kind' OR btrim(r.email) IS DISTINCT FROM m->>'recipient'
      OR r.first_name IS DISTINCT FROM m->>'first_name'
      OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(preview.decisions) d WHERE d->>'id'=m->>'id')) THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE='An email recipient changed. Review the emails again.';
  END IF;
  -- The existing release function validates each group; the surrounding transaction covers every group.
  FOR chunk IN SELECT jsonb_agg(value ORDER BY ordinal) FROM jsonb_array_elements(preview.decisions) WITH ORDINALITY AS d(value,ordinal)
    GROUP BY (ordinal-1)/200 ORDER BY (ordinal-1)/200 LOOP
    PERFORM public.release_registration_decisions(chunk);
  END LOOP;
  FOR email_kind IN SELECT DISTINCT m->>'kind' FROM jsonb_array_elements(preview.messages) m LOOP
    SELECT jsonb_agg(m || jsonb_build_object('released_at',r.decision_released_at) ORDER BY r.id) INTO batch_messages
      FROM jsonb_array_elements(preview.messages) m JOIN public.registrations r ON r.id=(m->>'id')::bigint WHERE m->>'kind'=email_kind;
    INSERT INTO public.email_batches(kind,created_by,messages,invitation_settings_version)
      VALUES(email_kind,p_admin_id,batch_messages,preview.invitation_settings_version) RETURNING id INTO batch_id;
    queued_result:=public.queue_decision_email_batch(batch_id,p_admin_id);
    added:=added+(queued_result->>'queued')::integer;
    skipped:=skipped+(queued_result->>'skipped')::integer;
  END LOOP;
  SELECT jsonb_build_object('data',jsonb_agg(jsonb_build_object('id',d->'id')),'queued',added,'skipped',skipped) INTO saved_result
    FROM jsonb_array_elements(preview.decisions) d;
  UPDATE public.email_decision_releases SET completed_at=clock_timestamp(),result=saved_result WHERE id=p_release_id;
  RETURN saved_result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.release_decisions_with_emails(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.release_decisions_with_emails(uuid,uuid,boolean) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
