-- User-managed teams (distinct from the matcher's `teams`/`team_members`).
-- A user can create a team, share an invite_code, and others can join.
create table if not exists public.user_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.user_team_members (
  team_id uuid not null references public.user_teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

-- A user belongs to at most one team at a time.
create unique index if not exists user_team_members_user_unique
  on public.user_team_members(user_id);

alter table public.user_teams enable row level security;
alter table public.user_team_members enable row level security;

-- Members can read their team; anyone authenticated can resolve an invite_code via the backend
-- (the backend uses the service role and bypasses RLS, so this policy is defense-in-depth).
drop policy if exists "user_teams_select_member" on public.user_teams;
create policy "user_teams_select_member"
  on public.user_teams for select
  using (
    id in (select team_id from public.user_team_members where user_id = auth.uid())
  );

drop policy if exists "user_teams_insert_self_creator" on public.user_teams;
create policy "user_teams_insert_self_creator"
  on public.user_teams for insert
  with check (auth.uid() = created_by);

drop policy if exists "user_team_members_select_own_team" on public.user_team_members;
create policy "user_team_members_select_own_team"
  on public.user_team_members for select
  using (
    team_id in (select team_id from public.user_team_members where user_id = auth.uid())
  );

drop policy if exists "user_team_members_insert_self" on public.user_team_members;
create policy "user_team_members_insert_self"
  on public.user_team_members for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_team_members_delete_self" on public.user_team_members;
create policy "user_team_members_delete_self"
  on public.user_team_members for delete
  using (auth.uid() = user_id);
