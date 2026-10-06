begin;

alter table public.employers
  add column if not exists owner_id uuid references auth.users(id) on delete restrict;

update public.employers employers
set owner_id = users.id
from auth.users users
where employers.owner_id is null
  and lower(employers.email) = lower(users.email);

create unique index if not exists employers_owner_idx
  on public.employers (owner_id)
  where owner_id is not null;

create table if not exists public.employer_invites (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers(id) on delete cascade,
  email text not null check (email = lower(email) and length(email) between 3 and 320),
  auth_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'invited', 'accepted', 'failed', 'revoked')),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (employer_id, email)
);

create index if not exists employer_invites_employer_status_idx
  on public.employer_invites (employer_id, status, invited_at desc);

alter table public.employers enable row level security;
alter table public.employer_invites enable row level security;

-- Employer data includes employee learning records and is exposed only through
-- authenticated server routes that verify owner_id. No browser-direct access.
revoke all on table public.employers from anon, authenticated;
revoke all on table public.employer_invites from anon, authenticated;
grant all on table public.employers to service_role;
grant all on table public.employer_invites to service_role;

notify pgrst, 'reload schema';

commit;
