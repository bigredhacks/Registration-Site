-- The remote `registrations` table already has a `status` column (default 'pending').
-- This migration adds a CHECK constraint to lock down the allowed values.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'registrations' and column_name = 'status'
  ) then
    alter table public.registrations
      add column status text not null default 'submitted';
  end if;
end $$;

alter table public.registrations
  drop constraint if exists registrations_status_check;

alter table public.registrations
  add constraint registrations_status_check
    check (status in ('pending', 'submitted', 'approved', 'rejected', 'waitlisted'));
