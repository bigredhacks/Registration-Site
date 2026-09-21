BEGIN;
-- Extend the existing templates, reviewed batches, and outbox. No emails are backfilled.
ALTER TABLE public.email_batches DROP CONSTRAINT email_batches_kind_check;
ALTER TABLE public.email_batches ADD CONSTRAINT email_batches_kind_check CHECK(kind IN ('approved','rejected','waitlisted','announcement'));
ALTER TABLE public.email_batches ADD COLUMN audience jsonb;
ALTER TABLE public.email_batches ADD CONSTRAINT announcement_audience_required CHECK(kind <> 'announcement' OR audience IS NOT NULL);
ALTER TABLE public.email_outbox DROP CONSTRAINT email_outbox_kind_check;
ALTER TABLE public.email_outbox ADD CONSTRAINT email_outbox_kind_check CHECK(kind IN ('confirmation','approved','rejected','waitlisted','announcement','test'));
ALTER TABLE public.email_template_files DROP CONSTRAINT email_template_files_kind_check;
ALTER TABLE public.email_template_files ADD CONSTRAINT email_template_files_kind_check CHECK(kind IN ('confirmation','approved','rejected','waitlisted','announcement'));

-- Use the same audience rules at confirmation and again immediately before delivery.
CREATE FUNCTION public.matches_announcement_audience(r public.registrations, audience jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT coalesce(r.form_key = 'registration' AND CASE audience->>'type'
    WHEN 'all' THEN true
    WHEN 'acceptance' THEN r.status = audience->>'status'
    WHEN 'invitation' THEN CASE audience->>'status'
      WHEN 'expired' THEN r.invitation_expired_at IS NOT NULL
      WHEN 'unanswered' THEN r.released_status = 'approved' AND r.invitation_response IS NULL AND r.invitation_expired_at IS NULL
      WHEN 'accepted' THEN r.released_status = 'approved' AND r.invitation_response = 'accepted' AND r.invitation_expired_at IS NULL
      WHEN 'declined' THEN r.released_status = 'approved' AND r.invitation_response = 'declined' AND r.invitation_expired_at IS NULL
      ELSE false END
    ELSE false END, false);
$$;
REVOKE EXECUTE ON FUNCTION public.matches_announcement_audience(public.registrations,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.matches_announcement_audience(public.registrations,jsonb) TO service_role;

CREATE FUNCTION public.queue_announcement_email_batch(p_batch_id uuid, p_admin_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE b public.email_batches; m jsonb; r public.registrations; added integer := 0; affected integer;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.admin_users WHERE user_id=p_admin_id) THEN
    RAISE SQLSTATE 'PT403' USING MESSAGE='Admin access required.';
  END IF;
  -- Keep deadline/registration lock order consistent with decision releases.
  PERFORM public.expire_registration_invitations();
  SELECT * INTO b FROM public.email_batches WHERE id=p_batch_id AND created_by=p_admin_id AND kind='announcement' FOR UPDATE;
  IF NOT FOUND THEN RAISE SQLSTATE 'PT404' USING MESSAGE='Announcement preview not found.'; END IF;
  IF b.queued_at IS NOT NULL THEN RETURN jsonb_build_object('queued',b.queued_count,'skipped',b.skipped_count); END IF;
  IF b.created_at < now()-interval '1 hour' THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE='This preview expired. Review the announcement again.';
  END IF;
  IF jsonb_array_length(b.messages) NOT BETWEEN 1 AND 1000 OR NOT coalesce(
    b.audience->>'type'='all'
    OR (b.audience->>'type'='acceptance' AND b.audience->>'status' IN ('pending','approved','waitlisted','rejected'))
    OR (b.audience->>'type'='invitation' AND b.audience->>'status' IN ('unanswered','accepted','declined','expired')),false) THEN
    RAISE SQLSTATE 'PT400' USING MESSAGE='Invalid announcement audience.';
  END IF;
  PERFORM id FROM public.registrations WHERE id IN
    (SELECT (value->>'id')::bigint FROM jsonb_array_elements(b.messages)) ORDER BY id FOR UPDATE;
  FOR m IN SELECT value FROM jsonb_array_elements(b.messages) LOOP
    SELECT * INTO r FROM public.registrations WHERE id=(m->>'id')::bigint;
    IF NOT FOUND OR NOT public.matches_announcement_audience(r,b.audience)
      OR btrim(r.email) IS DISTINCT FROM m->>'recipient'
      OR r.first_name IS DISTINCT FROM m->>'first_name'
      OR m->'payload'->>'to' IS DISTINCT FROM m->>'recipient' THEN
      RAISE SQLSTATE 'PT409' USING MESSAGE='An applicant or recipient changed. Review the announcement again.';
    END IF;
    INSERT INTO public.email_outbox(dedupe_key,registration_id,batch_id,kind,recipient,first_name,request_payload,template_version,created_by)
    VALUES('announcement/'||b.id||'/'||r.id,r.id,b.id,'announcement',m->>'recipient',r.first_name,m->'payload',m->>'template_version',p_admin_id)
    ON CONFLICT(dedupe_key) DO NOTHING;
    GET DIAGNOSTICS affected = ROW_COUNT;
    added := added + affected;
  END LOOP;
  UPDATE public.email_batches SET queued_at=clock_timestamp(),queued_count=added,skipped_count=jsonb_array_length(b.messages)-added WHERE id=b.id;
  RETURN jsonb_build_object('queued',added,'skipped',jsonb_array_length(b.messages)-added);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.queue_announcement_email_batch(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.queue_announcement_email_batch(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.activate_email_template_files(p_kind text,p_storage_path text,p_expected_version integer,p_admin_id uuid)
RETURNS public.email_template_files LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE saved public.email_template_files;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.admin_users WHERE user_id=p_admin_id) THEN RAISE SQLSTATE 'PT403' USING MESSAGE='Admin access required.'; END IF;
  IF p_kind NOT IN ('confirmation','approved','rejected','waitlisted','announcement') OR p_storage_path IS NULL OR p_storage_path !~ ('^'||p_kind||'/[0-9a-f-]{36}$') THEN
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
          OR r.released_status IS DISTINCT FROM job.kind OR r.decision_released_at IS DISTINCT FROM job.expected_released_at)) OR
        (job.kind = 'announcement' AND NOT coalesce(public.matches_announcement_audience(r,
          (SELECT audience FROM public.email_batches WHERE id = job.batch_id)), false)) THEN
        -- A previous send may have succeeded even if its receipt was not saved.
        UPDATE public.email_outbox SET state = CASE WHEN first_attempt_at IS NULL THEN 'cancelled' ELSE 'needs_review' END,
          lease_token = NULL, lease_until = NULL,
          last_error = CASE WHEN first_attempt_at IS NULL
            THEN 'Application, recipient, or email audience changed before sending.'
            ELSE 'Application, recipient, or email audience changed after a send attempt. Check Resend before sending anything else.' END
          WHERE id = job.id;
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


NOTIFY pgrst,'reload schema';
COMMIT;
