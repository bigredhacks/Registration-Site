-- Seed admin: grant admin to the auth user whose email contains 'rx77'.
-- Idempotent: on conflict, do nothing.
insert into public.admin_users (user_id)
select id from auth.users where email ilike '%rx77%'
on conflict (user_id) do nothing;
