BEGIN;

-- Requires the invitation-response and registration-closure migrations.
-- No backfill: existing applicants must not receive another confirmation.
CREATE TABLE public.email_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('approved', 'rejected')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  queued_at timestamptz,
  messages jsonb NOT NULL CHECK (jsonb_typeof(messages) = 'array'),
  queued_count integer,
  skipped_count integer
);

CREATE TABLE public.email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key text NOT NULL UNIQUE,
  registration_id bigint REFERENCES public.registrations(id) ON DELETE SET NULL,
  batch_id uuid REFERENCES public.email_batches(id),
  kind text NOT NULL CHECK (kind IN ('confirmation', 'approved', 'rejected', 'test')),
  recipient text NOT NULL,
  first_name text,
  form_title text,
  expected_released_at timestamptz,
  -- Frozen before the first Resend call; every retry uses precisely this payload.
  request_payload jsonb,
  template_version text NOT NULL DEFAULT '2026-09-15-v1',
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued', 'sending', 'sent', 'failed', 'needs_review', 'cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  first_attempt_at timestamptz,
  lease_until timestamptz,
  lease_token uuid,
  resend_id text,
  last_error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX email_outbox_pending_idx ON public.email_outbox(available_at, created_at)
  WHERE state IN ('queued', 'sending');
CREATE INDEX email_outbox_registration_idx ON public.email_outbox(registration_id);
ALTER TABLE public.email_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_batches, public.email_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_batches, public.email_outbox TO service_role;

-- The new backend uses this instead of a separate INSERT and email send.
-- Saving the application and its confirmation job either both succeed or neither does.
CREATE FUNCTION public.create_registration_with_email(p_registration jsonb)
RETURNS public.registrations
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE r public.registrations; f public.form_configs;
BEGIN
  SELECT * INTO f FROM public.form_configs WHERE key = p_registration->>'form_key' FOR SHARE;
  IF NOT FOUND OR NOT f.is_active THEN
    RAISE SQLSTATE 'PT404' USING MESSAGE = 'Active form not found.';
  END IF;
  IF f.closes_at IS NOT NULL AND f.closes_at <= clock_timestamp() THEN
    RAISE SQLSTATE 'PT403' USING MESSAGE = 'Registration is closed.';
  END IF;
  IF f.version IS DISTINCT FROM (p_registration->>'form_version')::integer THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE = 'The application form changed. Refresh before submitting.';
  END IF;
  INSERT INTO public.registrations(user_id, form_key, form_version, answers, status,
    email, first_name, last_name, school, level_of_study, shirt_size)
  VALUES ((p_registration->>'user_id')::uuid, f.key, f.version, p_registration->'answers', 'pending',
    p_registration->>'email', p_registration->>'first_name', p_registration->>'last_name',
    p_registration->>'school', p_registration->>'level_of_study', p_registration->>'shirt_size') RETURNING * INTO r;
  INSERT INTO public.email_outbox(dedupe_key, registration_id, kind, recipient, first_name, form_title)
    VALUES ('confirmation/' || r.id, r.id, 'confirmation', coalesce(r.email, ''), r.first_name, f.title);
  RETURN r;
END;
$$;

-- A reviewed draft is immutable. Repeating Send on it returns the original result.
CREATE FUNCTION public.queue_decision_email_batch(p_batch_id uuid, p_admin_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE b public.email_batches; m jsonb; r public.registrations; added integer := 0; affected integer;
BEGIN
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
      expected_released_at, request_payload, created_by)
    VALUES ('decision/' || r.id || '/' || b.kind || '/' || extract(epoch FROM r.decision_released_at),
      r.id, b.id, b.kind, m->>'recipient', r.first_name, r.decision_released_at, m->'payload', p_admin_id)
    ON CONFLICT (dedupe_key) DO NOTHING;
    GET DIAGNOSTICS affected = ROW_COUNT;
    added := added + affected;
  END LOOP;
  UPDATE public.email_batches SET queued_at = clock_timestamp(), queued_count = added,
    skipped_count = jsonb_array_length(b.messages) - added WHERE id = b.id;
  RETURN jsonb_build_object('queued', added, 'skipped', jsonb_array_length(b.messages) - added);
END;
$$;

-- Only one process can hold a job. Expired leases are recoverable after a crash.
-- Resend's idempotency window is 24h: stop uncertain retries at 23h, never silently
-- create a new key and risk sending a duplicate after the provider forgets the old one.
CREATE FUNCTION public.claim_email_job()
RETURNS SETOF public.email_outbox LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE job public.email_outbox; r public.registrations;
BEGIN
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

CREATE FUNCTION public.retry_email_job(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  UPDATE public.email_outbox SET state = 'queued', available_at = now(), last_error = NULL
    WHERE id = p_id AND state = 'failed' AND (first_attempt_at IS NULL OR first_attempt_at > now() - interval '23 hours');
  RETURN FOUND;
END;
$$;

-- Explicit membership deletion + team deletion is one transaction; accounts,
-- profiles, applications, RSVP answers and matching submissions are untouched.
CREATE FUNCTION public.admin_delete_user_team(p_team_id uuid, p_expected_name text, p_expected_members uuid[], p_admin_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE team public.user_teams; members uuid[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = p_admin_id) THEN
    RAISE SQLSTATE 'PT403' USING MESSAGE = 'Admin access required.';
  END IF;
  SELECT * INTO team FROM public.user_teams WHERE id = p_team_id FOR UPDATE;
  IF NOT FOUND THEN RAISE SQLSTATE 'PT404' USING MESSAGE = 'Team no longer exists.'; END IF;
  PERFORM user_id FROM public.user_team_members WHERE team_id = p_team_id ORDER BY user_id FOR UPDATE;
  SELECT coalesce(array_agg(user_id ORDER BY user_id), '{}'::uuid[]) INTO members FROM public.user_team_members WHERE team_id = p_team_id;
  IF team.name IS DISTINCT FROM p_expected_name OR p_expected_members IS NULL OR members IS DISTINCT FROM
    ARRAY(SELECT DISTINCT u FROM unnest(p_expected_members) u ORDER BY u) THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE = 'This team changed. Refresh and review its members before deleting.';
  END IF;
  DELETE FROM public.user_team_members WHERE team_id = p_team_id;
  DELETE FROM public.user_teams WHERE id = p_team_id;
  RETURN jsonb_build_object('deleted_team_id', p_team_id, 'removed_members', cardinality(members));
END;
$$;

-- Account emails are used only by the admin team overview when no application
-- email exists. Expose only requested current team members to the backend role.
CREATE FUNCTION public.admin_team_account_emails(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, email text)
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT u.id, u.email::text FROM auth.users u
  WHERE u.id = ANY(p_user_ids) AND EXISTS
    (SELECT 1 FROM public.user_team_members m WHERE m.user_id = u.id);
$$;
REVOKE EXECUTE ON FUNCTION public.admin_team_account_emails(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_team_account_emails(uuid[]) TO service_role;

REVOKE EXECUTE ON FUNCTION public.create_registration_with_email(jsonb), public.queue_decision_email_batch(uuid,uuid),
  public.claim_email_job(), public.retry_email_job(uuid), public.admin_delete_user_team(uuid,text,uuid[],uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_registration_with_email(jsonb), public.queue_decision_email_batch(uuid,uuid),
  public.claim_email_job(), public.retry_email_job(uuid), public.admin_delete_user_team(uuid,text,uuid[],uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
