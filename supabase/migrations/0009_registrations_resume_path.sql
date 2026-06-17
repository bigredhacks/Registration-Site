alter table public.registrations
  add column if not exists resume_path text;
