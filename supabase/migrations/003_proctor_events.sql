create table public.proctor_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.proctor_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  event_type text not null,
  severity text,
  confidence numeric,
  source text not null,
  status text not null default 'pending_review',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.proctor_events enable row level security;

-- Users can read their own events
create policy "Users can read own proctor events"
  on public.proctor_events for select
  using (auth.uid() = user_id);

-- Users can insert events for their own active sessions
create policy "Users can insert own proctor events"
  on public.proctor_events for insert
  with check (
    auth.uid() = user_id and
    exists (
      select 1 from public.proctor_sessions
      where id = session_id and user_id = auth.uid() and status in ('active', 'paired')
    )
  );

create index proctor_sessions_owner_state_expiry_idx
  on public.proctor_sessions (user_id, status, expires_at);

create index proctor_events_session_created_idx
  on public.proctor_events (session_id, created_at desc);
