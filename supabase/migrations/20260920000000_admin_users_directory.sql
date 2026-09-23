BEGIN;

CREATE FUNCTION public.admin_user_profile_progress(p_profile jsonb)
RETURNS TABLE(profile_state text, profile_pct integer, missing_profile_fields text[])
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $$
  WITH fields(key, label, position) AS (VALUES
    ('first_name', 'First Name', 1), ('last_name', 'Last Name', 2),
    ('phone_number', 'Phone Number', 3), ('age_range', 'Age', 4),
    ('graduation_year', 'Graduation Year', 5), ('school', 'University', 6),
    ('country', 'Country', 7), ('level_of_study', 'Level of Study', 8),
    ('major', 'Major', 9), ('gender', 'Gender', 10),
    ('dietary_restrictions', 'Dietary Restrictions', 11), ('shirt_size', 'Shirt Size', 12),
    ('linkedin', 'LinkedIn', 13)
  ), missing AS (
    SELECT label, position FROM fields
    WHERE p_profile->key IS NULL OR p_profile->key IN ('null'::jsonb, '""'::jsonb, '[]'::jsonb)
  )
  SELECT CASE count(*) WHEN 13 THEN 'not_started' WHEN 0 THEN 'complete' ELSE 'incomplete' END,
    round((13 - count(*)) * 100.0 / 13)::integer,
    coalesce(array_agg(label ORDER BY position), '{}'::text[])
  FROM missing;
$$;

CREATE FUNCTION public.admin_list_users(
  p_form_key text DEFAULT 'registration', p_q text DEFAULT NULL,
  p_profile_state text DEFAULT NULL, p_submitted boolean DEFAULT NULL,
  p_email_verified boolean DEFAULT NULL, p_from date DEFAULT NULL, p_to date DEFAULT NULL,
  p_sort text DEFAULT 'created_at', p_dir text DEFAULT 'desc',
  p_limit integer DEFAULT 50, p_offset bigint DEFAULT 0
)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH users AS (
    SELECT u.id AS user_id, u.email::text, u.created_at, u.email_confirmed_at, u.last_sign_in_at,
      coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''),
        nullif(btrim(p.full_name), ''), nullif(btrim(u.raw_user_meta_data->>'full_name'), ''),
        nullif(btrim(u.raw_user_meta_data->>'name'), '')) AS name,
      p.school, progress.profile_state, progress.profile_pct,
      r.id AS registration_id, p_form_key AS form_key, r.created_at AS submitted_at
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    LEFT JOIN public.registrations r ON r.user_id = u.id AND r.form_key = p_form_key
    CROSS JOIN LATERAL public.admin_user_profile_progress(to_jsonb(p)) progress
  ), filtered AS (
    SELECT * FROM users
    WHERE (p_q IS NULL OR strpos(lower(coalesce(name, '') || ' ' || coalesce(email, '')), lower(p_q)) > 0)
      AND (p_profile_state IS NULL OR profile_state = p_profile_state)
      AND (p_submitted IS NULL OR (registration_id IS NOT NULL) = p_submitted)
      AND (p_email_verified IS NULL OR (email_confirmed_at IS NOT NULL) = p_email_verified)
      AND (p_from IS NULL OR created_at >= (p_from::timestamp AT TIME ZONE 'UTC'))
      AND (p_to IS NULL OR created_at < ((p_to + 1)::timestamp AT TIME ZONE 'UTC'))
  ), page AS (
    SELECT * FROM filtered ORDER BY
      CASE WHEN p_sort = 'name' AND p_dir = 'asc' THEN lower(name) END ASC NULLS LAST,
      CASE WHEN p_sort = 'name' AND p_dir = 'desc' THEN lower(name) END DESC NULLS LAST,
      CASE WHEN p_sort = 'school' AND p_dir = 'asc' THEN lower(school) END ASC NULLS LAST,
      CASE WHEN p_sort = 'school' AND p_dir = 'desc' THEN lower(school) END DESC NULLS LAST,
      CASE WHEN p_sort = 'created_at' AND p_dir = 'asc' THEN created_at END ASC NULLS LAST,
      CASE WHEN p_sort = 'created_at' AND p_dir = 'desc' THEN created_at END DESC NULLS LAST,
      user_id ASC
    LIMIT least(greatest(p_limit, 1), 200) OFFSET greatest(p_offset, 0)
  )
  SELECT jsonb_build_object('data', coalesce((SELECT jsonb_agg(to_jsonb(page)) FROM page), '[]'::jsonb),
    'count', (SELECT count(*) FROM filtered));
$$;

CREATE FUNCTION public.admin_user_detail(p_user_id uuid, p_form_key text DEFAULT 'registration')
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'account', jsonb_build_object('user_id', u.id, 'email', u.email,
      'name', coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''),
        nullif(btrim(p.full_name), ''), nullif(btrim(u.raw_user_meta_data->>'full_name'), ''),
        nullif(btrim(u.raw_user_meta_data->>'name'), '')),
      'created_at', u.created_at, 'email_confirmed_at', u.email_confirmed_at, 'last_sign_in_at', u.last_sign_in_at),
    'profile', CASE WHEN p.id IS NULL THEN NULL ELSE (
      SELECT jsonb_object_agg(key, value) FROM jsonb_each(to_jsonb(p))
      WHERE key = ANY(ARRAY['id','first_name','last_name','full_name','avatar_url','phone_number',
        'school','country','level_of_study','graduation_year','major','age_range','gender',
        'dietary_restrictions','shirt_size','linkedin','created_at','updated_at'])
    ) END,
    'application', CASE WHEN r.id IS NULL THEN NULL ELSE (
      SELECT jsonb_object_agg(key, value) FROM jsonb_each(to_jsonb(r))
      WHERE key = ANY(ARRAY['id','user_id','form_key','form_version','answers','email','first_name',
        'last_name','school','age','phone_number','linkedin','country','level_of_study','major',
        'gender','dietary_restrictions','shirt_size','created_at','updated_at','resume_path',
        'status','released_status','decision_released_at','invitation_response','invitation_responded_at',
        'invitation_expired_at','checked_in','checked_in_at'])
    ) END,
    'profile_state', progress.profile_state, 'profile_pct', progress.profile_pct,
    'missing_profile_fields', to_jsonb(progress.missing_profile_fields), 'form_key', p_form_key)
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.registrations r ON r.user_id = u.id AND r.form_key = p_form_key
  CROSS JOIN LATERAL public.admin_user_profile_progress(to_jsonb(p)) progress
  WHERE u.id = p_user_id;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_user_profile_progress(jsonb),
  public.admin_list_users(text,text,text,boolean,boolean,date,date,text,text,integer,bigint),
  public.admin_user_detail(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_profile_progress(jsonb),
  public.admin_list_users(text,text,text,boolean,boolean,date,date,text,text,integer,bigint),
  public.admin_user_detail(uuid,text) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
