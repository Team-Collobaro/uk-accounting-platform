-- Enforce the allowed proctor-session lifecycle.
alter table public.proctor_sessions
  add constraint proctor_sessions_status_check
  check (status in ('pending', 'paired', 'active', 'paused', 'ended', 'expired'));

-- Private Realtime Broadcast channels. Only the owner of proctor:<session UUID>
-- may subscribe to or publish on that channel.
alter table realtime.messages enable row level security;

create policy "Proctor session owners may receive broadcasts"
  on realtime.messages for select to authenticated
  using (
    exists (
      select 1
      from public.proctor_sessions
      where public.proctor_sessions.id::text = replace(realtime.topic(), 'proctor:', '')
        and public.proctor_sessions.user_id = auth.uid()
        and public.proctor_sessions.status in ('pending', 'paired', 'active', 'paused')
        and public.proctor_sessions.expires_at > now()
    )
  );

create policy "Proctor session owners may send broadcasts"
  on realtime.messages for insert to authenticated
  with check (
    exists (
      select 1
      from public.proctor_sessions
      where public.proctor_sessions.id::text = replace(realtime.topic(), 'proctor:', '')
        and public.proctor_sessions.user_id = auth.uid()
        and public.proctor_sessions.status in ('paired', 'active', 'paused')
        and public.proctor_sessions.expires_at > now()
    )
  );
