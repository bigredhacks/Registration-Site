-- Private bucket for resumes. Path convention: resumes/{user_id}/<filename>.
insert into storage.buckets (id, name, public)
  values ('resumes', 'resumes', false)
on conflict (id) do nothing;

-- Authenticated users can read/write only their own folder.
-- (The backend service role bypasses these; policies guard direct-from-browser access.)
drop policy if exists "resumes_read_own" on storage.objects;
create policy "resumes_read_own"
  on storage.objects for select
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "resumes_write_own" on storage.objects;
create policy "resumes_write_own"
  on storage.objects for insert
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "resumes_update_own" on storage.objects;
create policy "resumes_update_own"
  on storage.objects for update
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "resumes_delete_own" on storage.objects;
create policy "resumes_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
