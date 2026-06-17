-- Match existing registrations to auth.users by email.
-- Run after 0001 and before 0003 (NOT NULL constraint).
update public.registrations r
set user_id = u.id
from auth.users u
where lower(r.email) = lower(u.email)
  and r.user_id is null;
