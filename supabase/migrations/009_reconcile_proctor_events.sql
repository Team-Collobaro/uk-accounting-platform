begin;

create table if not exists public.proctor_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.proctor_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  severity text,
  confidence numeric,
  source text not null,
  status text not null default 'pending_review',
  metadata jsonb not null default '{}'::jsonb,
  schema_version integer not null default 1,
  incident_key text,
  model_version text,
  occurred_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- Reconcile databases where the original table exists but the lifecycle
-- migration was not applied.
alter table public.proctor_events
  add column if not exists schema_version integer not null default 1,
  add column if not exists incident_key text,
  add column if not exists model_version text,
  add column if not exists occurred_at timestamptz not null default now(),
  add column if not exists resolved_at timestamptz;

alter table public.proctor_events enable row level security;

drop policy if exists "Users can read own proctor events" on public.proctor_events;
create policy "Users can read own proctor events"
  on public.proctor_events
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own proctor events" on public.proctor_events;
create policy "Users can insert own proctor events"
  on public.proctor_events
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.proctor_sessions sessions
      where sessions.id = session_id
        and sessions.user_id = (select auth.uid())
        and sessions.status in ('paired', 'active')
        and sessions.session_expires_at > now()
    )
  );

create index if not exists proctor_events_session_created_idx
  on public.proctor_events (session_id, created_at desc);

create unique index if not exists proctor_events_one_open_incident_idx
  on public.proctor_events (session_id, incident_key)
  where incident_key is not null
    and resolved_at is null
    and status = 'pending_review';

create index if not exists proctor_events_open_incidents_idx
  on public.proctor_events (session_id, status, resolved_at, created_at desc);

revoke all on table public.proctor_events from anon;
grant select, insert on table public.proctor_events to authenticated;
grant all on table public.proctor_events to service_role;

-- Make the new table immediately visible to the Supabase REST API.
notify pgrst, 'reload schema';

commit;
