begin;

alter table public.registrations
  add column if not exists form_key text not null default 'registration',
  add column if not exists form_version integer not null default 1,
  add column if not exists answers jsonb not null default '{}'::jsonb;

alter table public.registrations
  alter column status set default 'pending';

update public.registrations as registrations
set answers = coalesce(registrations.answers, '{}'::jsonb) || jsonb_strip_nulls(
  to_jsonb(registrations) - array[
    'id',
    'created_at',
    'status',
    'checked_in',
    'checked_in_at',
    'user_id',
    'form_key',
    'form_version',
    'answers'
  ]
)
where coalesce(registrations.answers, '{}'::jsonb) = '{}'::jsonb;

create unique index if not exists registrations_user_id_form_key_idx
  on public.registrations (user_id, form_key);

commit;
