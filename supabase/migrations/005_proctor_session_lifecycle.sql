-- Separate short-lived QR pairing validity from the active assessment lifetime.
alter table public.proctor_sessions
  add column if not exists pairing_expires_at timestamptz,
  add column if not exists session_expires_at timestamptz,
  add column if not exists paired_at timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists paused_at timestamptz,
  add column if not exists ended_at timestamptz;

update public.proctor_sessions
set pairing_expires_at = coalesce(pairing_expires_at, expires_at),
    session_expires_at = coalesce(session_expires_at, expires_at)
where pairing_expires_at is null or session_expires_at is null;

alter table public.proctor_sessions
  alter column pairing_expires_at set not null,
  alter column session_expires_at set not null;

drop policy if exists "Proctor session owners may receive broadcasts" on realtime.messages;
drop policy if exists "Users can subscribe to own session" on realtime.messages;
create policy "Proctor session owners may receive broadcasts"
  on realtime.messages for select to authenticated
  using (
    exists (
      select 1 from public.proctor_sessions
      where public.proctor_sessions.id::text = replace(realtime.topic(), 'proctor:', '')
        and public.proctor_sessions.user_id = auth.uid()
        and public.proctor_sessions.status in ('pending', 'paired', 'active', 'paused')
        and (
          (public.proctor_sessions.status = 'pending' and public.proctor_sessions.pairing_expires_at > now())
          or
          (public.proctor_sessions.status <> 'pending' and public.proctor_sessions.session_expires_at > now())
        )
    )
  );

drop policy if exists "Proctor session owners may send broadcasts" on realtime.messages;
drop policy if exists "Users can broadcast to own session" on realtime.messages;
create policy "Proctor session owners may send broadcasts"
  on realtime.messages for insert to authenticated
  with check (
    exists (
      select 1 from public.proctor_sessions
      where public.proctor_sessions.id::text = replace(realtime.topic(), 'proctor:', '')
        and public.proctor_sessions.user_id = auth.uid()
        and public.proctor_sessions.status in ('paired', 'active', 'paused')
        and public.proctor_sessions.session_expires_at > now()
    )
  );

create index if not exists proctor_sessions_pairing_expiry_idx
  on public.proctor_sessions (status, pairing_expires_at);

-- Make the new columns visible to PostgREST immediately after this migration.
notify pgrst, 'reload schema';
