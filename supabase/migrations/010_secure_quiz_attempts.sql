begin;

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  module_id text not null check (module_id ~ '^m(0[1-9]|[1-7][0-9]|8[0-7])$'),
  questions jsonb not null check (
    jsonb_typeof(questions) = 'array'
    and jsonb_array_length(questions) > 0
  ),
  status text not null default 'active' check (status in ('active', 'submitted', 'expired')),
  expires_at timestamptz not null default (now() + interval '45 minutes'),
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.quiz_attempts enable row level security;

create index if not exists quiz_attempts_student_created_idx
  on public.quiz_attempts (student_id, created_at desc);

create unique index if not exists quiz_attempts_one_active_per_module_idx
  on public.quiz_attempts (student_id, module_id)
  where status = 'active';

alter table public.quiz_results
  add column if not exists attempt_id uuid references public.quiz_attempts(id),
  add column if not exists answers jsonb not null default '{}'::jsonb;

create unique index if not exists quiz_results_attempt_idx
  on public.quiz_results (attempt_id)
  where attempt_id is not null;

-- Assessment truth is written only by authenticated server routes using the
-- service role. Learners retain read-only access to their own results/progress.
drop policy if exists "Students can view own quiz results" on public.quiz_results;
create policy "Students can view own quiz results"
  on public.quiz_results for select to authenticated
  using ((select auth.uid()) = student_id);

drop policy if exists "Students can view own progress" on public.module_progress;
create policy "Students can view own progress"
  on public.module_progress for select to authenticated
  using ((select auth.uid()) = student_id);

drop policy if exists "Students can update own data" on public.students;
drop policy if exists "Students can insert own data" on public.students;

revoke all on table public.quiz_attempts from anon, authenticated;
revoke insert, update, delete on table public.quiz_results from anon, authenticated;
revoke insert, update, delete on table public.module_progress from anon, authenticated;
revoke insert, update on table public.students from anon, authenticated;

grant all on table public.quiz_attempts to service_role;
grant all on table public.quiz_results to service_role;
grant all on table public.module_progress to service_role;
grant all on table public.students to service_role;

notify pgrst, 'reload schema';

commit;
