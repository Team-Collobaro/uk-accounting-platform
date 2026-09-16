alter table public.proctor_events
  add column if not exists schema_version integer not null default 1,
  add column if not exists incident_key text,
  add column if not exists model_version text,
  add column if not exists occurred_at timestamptz not null default now(),
  add column if not exists resolved_at timestamptz;

create unique index if not exists proctor_events_one_open_incident_idx
  on public.proctor_events (session_id, incident_key)
  where incident_key is not null and resolved_at is null and status = 'pending_review';

create index if not exists proctor_events_open_incidents_idx
  on public.proctor_events (session_id, status, resolved_at, created_at desc);

