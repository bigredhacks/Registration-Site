-- User-facing team routes and admin publishing both require one live team per account.
-- This also protects concurrent requests running on different server instances.
create unique index if not exists user_team_members_one_team_per_user_idx
  on public.user_team_members (user_id);
