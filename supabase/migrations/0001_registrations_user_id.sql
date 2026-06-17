-- Link registrations to auth.users so each submitter owns their row.
-- Initially nullable so we can backfill existing rows by email match.
alter table public.registrations
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- One registration per user. Partial index so existing NULL rows pass during backfill.
create unique index if not exists registrations_user_id_unique
  on public.registrations(user_id)
  where user_id is not null;

alter table public.registrations enable row level security;

drop policy if exists "registrations_select_own" on public.registrations;
create policy "registrations_select_own"
  on public.registrations for select
  using (auth.uid() = user_id);

drop policy if exists "registrations_insert_own" on public.registrations;
create policy "registrations_insert_own"
  on public.registrations for insert
  with check (auth.uid() = user_id);

drop policy if exists "registrations_update_own" on public.registrations;
create policy "registrations_update_own"
  on public.registrations for update
  using (auth.uid() = user_id);

drop policy if exists "registrations_delete_own" on public.registrations;
create policy "registrations_delete_own"
  on public.registrations for delete
  using (auth.uid() = user_id);
