-- Admin marker table. Seed manually after migration:
--   insert into public.admin_users (user_id) values ('<auth-user-uuid>');
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- Admins can read the table to verify their own membership; nobody can write through RLS.
-- The backend service role manages writes.
drop policy if exists "admin_users_select_self" on public.admin_users;
create policy "admin_users_select_self"
  on public.admin_users for select
  using (auth.uid() = user_id);
