-- Extend profiles to hold all 11 fields collected by the profile form.
-- Enum values mirror backend/src/types/registration.ts so a profile can
-- pre-fill a registration without translation.
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists phone_number text,
  add column if not exists school text,
  add column if not exists country text,
  add column if not exists level_of_study text,
  add column if not exists graduation_year int,
  add column if not exists major text,
  add column if not exists age_range text,
  add column if not exists gender text,
  add column if not exists dietary_restrictions text[] default '{}',
  add column if not exists shirt_size text,
  add column if not exists linkedin text;

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);
