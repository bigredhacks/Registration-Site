BEGIN;
-- Forward migration: safe even if the earlier email migrations were already applied.
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
    ON CONFLICT (dedupe_key) DO UPDATE SET
      batch_id=excluded.batch_id, recipient=excluded.recipient, first_name=excluded.first_name,
      request_payload=excluded.request_payload, template_version=excluded.template_version,
      created_by=excluded.created_by, state='queued', available_at=clock_timestamp(),
      last_error=NULL, lease_token=NULL, lease_until=NULL
    -- Only replace a cancelled message whose provider key was never used.
    -- Concurrent replacement previews serialize on this row; only the first queues it.
    WHERE email_outbox.state='cancelled' AND email_outbox.first_attempt_at IS NULL
      AND email_outbox.attempts=0 AND email_outbox.resend_id IS NULL AND email_outbox.sent_at IS NULL;
    GET DIAGNOSTICS affected = ROW_COUNT;
    added := added + affected;
  END LOOP;
  UPDATE public.email_batches SET queued_at = clock_timestamp(), queued_count = added,
    skipped_count = jsonb_array_length(b.messages) - added WHERE id = b.id;
  RETURN jsonb_build_object('queued', added, 'skipped', jsonb_array_length(b.messages) - added);
END;
$$;
NOTIFY pgrst,'reload schema';
COMMIT;
