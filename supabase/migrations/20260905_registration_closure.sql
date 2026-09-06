begin;

alter table public.form_configs
  add column if not exists closes_at timestamptz,
  add column if not exists closes_timezone text not null default 'America/New_York';

comment on column public.form_configs.closes_at is
  'Optional absolute deadline. Student registration submissions and changes close at this instant; active forms remain readable.';
comment on column public.form_configs.closes_timezone is
  'IANA time zone used to enter and display the registration deadline in admin.';

commit;
