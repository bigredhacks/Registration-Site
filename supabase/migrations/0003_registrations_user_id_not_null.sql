-- Apply only after 0002 succeeds and you've verified no rows have NULL user_id.
-- Check first:
--   select count(*) from public.registrations where user_id is null;
-- Should return 0 before running this migration.
alter table public.registrations
  alter column user_id set not null;
