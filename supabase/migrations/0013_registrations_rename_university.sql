-- The registrations table has both `university` and `school` columns. Consolidate to `school`.
-- Migrate any data from `university` into `school` (only when school is null) and drop `university`.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'registrations' and column_name = 'university'
  ) then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'registrations' and column_name = 'school'
    ) then
      update public.registrations
        set school = university
        where school is null and university is not null;
      alter table public.registrations drop column university;
    else
      alter table public.registrations rename column university to school;
    end if;
  end if;
end $$;
