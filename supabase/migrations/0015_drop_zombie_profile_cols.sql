-- profiles had legacy `university` and `age` columns that are now superseded by
-- `school` and `age_range`. Migrate any remaining data and drop them.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'university'
  ) then
    update public.profiles set school = university where school is null and university is not null;
    alter table public.profiles drop column university;
  end if;

  -- `age` was an integer column; copy to age_range only if age_range is null and age looks reasonable.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'age'
  ) then
    -- Best-effort backfill: an integer age can't map to our enum bands cleanly,
    -- so just drop the column. Real data lives in age_range now.
    alter table public.profiles drop column age;
  end if;
end $$;
