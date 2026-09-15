BEGIN;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('email-templates','email-templates',false,262144,ARRAY['text/html','application/json'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

CREATE TABLE public.email_template_files (
  kind text PRIMARY KEY CHECK (kind IN ('confirmation','approved','rejected')),
  storage_path text NOT NULL UNIQUE,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL
);
ALTER TABLE public.email_template_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_template_files FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.email_template_files TO service_role;
-- Restrictive policies also protect this bucket if another migration grants broad Storage access.
CREATE POLICY email_templates_private ON storage.objects AS RESTRICTIVE FOR ALL TO anon,authenticated
USING(bucket_id <> 'email-templates') WITH CHECK(bucket_id <> 'email-templates');

CREATE FUNCTION public.activate_email_template_files(p_kind text,p_storage_path text,p_expected_version integer,p_admin_id uuid)
RETURNS public.email_template_files LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE saved public.email_template_files;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.admin_users WHERE user_id=p_admin_id) THEN RAISE SQLSTATE 'PT403' USING MESSAGE='Admin access required.'; END IF;
  IF p_kind NOT IN ('confirmation','approved','rejected') OR p_storage_path IS NULL OR p_storage_path !~ ('^'||p_kind||'/[0-9a-f-]{36}$') THEN
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
REVOKE EXECUTE ON FUNCTION public.activate_email_template_files(text,text,integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.activate_email_template_files(text,text,integer,uuid) TO service_role;
-- Legacy table content is retained for export, but the app no longer reads/writes it.
REVOKE EXECUTE ON FUNCTION public.save_email_template(text,text,text,text,integer,uuid) FROM service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
