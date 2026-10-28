-- TRUNCATE, TRIGGER and REFERENCES came from Supabase's default grants. The
-- apps never use them, and TRUNCATE ignores row level security.
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke truncate, trigger, references on tables from anon, authenticated;

-- Booth (side-projects/booth-dj) keeps its cloud save in this project.
-- Cap the size of synced JSON so one account can't fill the database.
alter table public.booth_saves
  add constraint booth_saves_data_size check (octet_length(data::text) <= 5242880);
alter table public.booth_files
  add constraint booth_files_meta_size check (octet_length(meta::text) <= 65536);

-- The bucket enforced 50 MB per file but nothing capped the total, so anyone
-- who signed up could fill the project's storage. Refuse new uploads once a
-- person's folder already holds their 250 MB quota.
create or replace function public.booth_stored_bytes()
returns bigint
language sql
stable
set search_path = ''
as $$
  select coalesce(sum((o.metadata ->> 'size')::bigint), 0)::bigint
  from storage.objects o
  where o.bucket_id = 'booth'
    and (storage.foldername(o.name))[1] = (select auth.uid())::text
$$;
revoke execute on function public.booth_stored_bytes() from public, anon;
grant execute on function public.booth_stored_bytes() to authenticated;

alter policy "booth bucket: add to own folder" on storage.objects
  with check (
    bucket_id = 'booth'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.booth_stored_bytes() < 262144000
  );
alter policy "booth bucket: change own folder" on storage.objects
  using (bucket_id = 'booth' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (
    bucket_id = 'booth'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.booth_stored_bytes() < 262144000
  );
