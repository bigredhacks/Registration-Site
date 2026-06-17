-- Tie team-matching submissions to a user so they can read/update their own.
alter table public.participants
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

update public.participants p
set user_id = u.id
from auth.users u
where lower(p.email) = lower(u.email)
  and p.user_id is null;

-- Drop pre-existing rows with no matching auth user before tightening the constraint.
-- (Comment out if you want to keep them and resolve manually.)
delete from public.participants where user_id is null;

alter table public.participants
  alter column user_id set not null;

create unique index if not exists participants_user_pool_unique
  on public.participants(user_id, pool_id);

alter table public.participants enable row level security;

drop policy if exists "participants_select_own" on public.participants;
create policy "participants_select_own"
  on public.participants for select
  using (auth.uid() = user_id);

drop policy if exists "participants_insert_own" on public.participants;
create policy "participants_insert_own"
  on public.participants for insert
  with check (auth.uid() = user_id);

drop policy if exists "participants_update_own" on public.participants;
create policy "participants_update_own"
  on public.participants for update
  using (auth.uid() = user_id);

drop policy if exists "participants_delete_own" on public.participants;
create policy "participants_delete_own"
  on public.participants for delete
  using (auth.uid() = user_id);
