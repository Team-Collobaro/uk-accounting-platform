-- Create private bucket for proctor frames
insert into storage.buckets (id, name, public)
values ('proctor-frames', 'proctor-frames', false)
on conflict (id) do nothing;

-- Enable RLS for the objects table if not already enabled
alter table storage.objects enable row level security;

-- Mobile apps can upload frames if the path starts with their active session ID and they own the session
create policy "Authenticated users can upload frames to their session folder"
  on storage.objects for insert
  with check (
    bucket_id = 'proctor-frames' and
    auth.role() = 'authenticated' and
    (select user_id from public.proctor_sessions where id::text = split_part(name, '/', 1)) = auth.uid() and
    (select status from public.proctor_sessions where id::text = split_part(name, '/', 1)) in ('active', 'paired')
  );

-- Backend service role (Next.js server/Inngest) skips RLS automatically due to service_role key.
-- We can add a SELECT policy for the user just in case, but they usually don't need to read their own frames back.
create policy "Users can view their own frames"
  on storage.objects for select
  using (
    bucket_id = 'proctor-frames' and
    auth.role() = 'authenticated' and
    (select user_id from public.proctor_sessions where id::text = split_part(name, '/', 1)) = auth.uid()
  );

-- Automatically delete objects older than 30 days (This is usually configured via Storage UI, but we can do it via a pg_cron or pg_net if enabled, or leave as a manual setting on the Dashboard).
