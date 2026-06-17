-- Convert dietary_restrictions from text to text[].
-- Subqueries aren't allowed in `ALTER COLUMN ... USING`, so do it through a temp column.

create or replace function public._dietary_to_array(v text)
returns text[]
language plpgsql
immutable
as $$
begin
  if v is null then return null; end if;
  if v ~ '^\[' then
    return (select array_agg(value::text) from jsonb_array_elements_text(v::jsonb));
  end if;
  return array[v];
exception
  when others then
    return array[v];
end;
$$;

-- profiles
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'dietary_restrictions'
      and data_type = 'text'
  ) then
    alter table public.profiles add column _dr_new text[];
    update public.profiles set _dr_new = public._dietary_to_array(dietary_restrictions);
    alter table public.profiles drop column dietary_restrictions;
    alter table public.profiles rename column _dr_new to dietary_restrictions;
    alter table public.profiles alter column dietary_restrictions set default '{}';
  end if;
end $$;

-- registrations
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'registrations'
      and column_name = 'dietary_restrictions'
      and data_type = 'text'
  ) then
    alter table public.registrations add column _dr_new text[];
    update public.registrations set _dr_new = public._dietary_to_array(dietary_restrictions);
    alter table public.registrations drop column dietary_restrictions;
    alter table public.registrations rename column _dr_new to dietary_restrictions;
    alter table public.registrations alter column dietary_restrictions set default '{}';
  end if;
end $$;

drop function public._dietary_to_array(text);
