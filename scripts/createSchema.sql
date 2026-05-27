-- ─── FULL SCHEMA — idempotent, safe to run multiple times ────────────────────
-- Run in Supabase SQL Editor.
-- @dialect postgresql

-- ─── DROP EVERYTHING ──────────────────────────────────────────────────────────
drop table if exists section_progress cascade;
drop table if exists token_usage cascade;
drop table if exists quiz_results cascade;
drop table if exists module_progress cascade;
drop table if exists certificates cascade;
drop table if exists tutor_sessions cascade;
drop table if exists course_chunks cascade;
drop table if exists employers cascade;
drop table if exists students cascade;

-- ─── STUDENTS ─────────────────────────────────────────────────────────────────
create table students (
  id uuid primary key references auth.users(id),
  name text not null,
  email text unique not null,
  enrolled_courses text[] default '{}',
  completed_modules text[] default '{}',
  weak_topics text[] default '{}',
  avg_quiz_score numeric default 0,
  total_tokens_used integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── COURSE CHUNKS ────────────────────────────────────────────────────────────
create table course_chunks (
  id text primary key,
  module_id text not null,
  module_title text not null,
  part_number integer not null,
  section_id text not null default '',
  section_title text not null default '',
  section_order integer not null default 0,
  chunk_index integer not null default 0,
  content text not null,
  token_count integer not null,
  content_tsv tsvector generated always as (to_tsvector('english', content)) stored,
  created_at timestamptz default now()
);

create index course_chunks_tsv_idx on course_chunks using gin (content_tsv);
create index course_chunks_module_idx on course_chunks(module_id);
create index course_chunks_section_idx on course_chunks(module_id, section_id, section_order);

-- ─── TUTOR SESSIONS ───────────────────────────────────────────────────────────
create table tutor_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  module_id text not null,
  messages jsonb default '[]',
  total_tokens integer default 0,
  total_cost_usd numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── QUIZ RESULTS ─────────────────────────────────────────────────────────────
create table quiz_results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  module_id text not null,
  score integer not null,
  total integer not null,
  percentage numeric not null,
  passed boolean not null,
  weak_areas text[] default '{}',
  answers jsonb default '{}',
  completed_at timestamptz default now()
);

-- ─── MODULE PROGRESS ──────────────────────────────────────────────────────────
create table module_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  module_id text not null,
  status text default 'not_started',
  quiz_score integer,
  completed_at timestamptz,
  unique(student_id, module_id)
);

-- ─── SECTION PROGRESS ─────────────────────────────────────────────────────────
create table section_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  module_id text not null,
  section_id text not null,
  section_title text not null,
  status text not null default 'not_started',
  notes text default '',
  key_points text[] default '{}',
  completed_at timestamptz,
  teaching_point_idx integer not null default 0,
  teaching_points jsonb not null default '[]',
  unique(student_id, module_id, section_id)
);

create index section_progress_student_module_idx on section_progress(student_id, module_id);

-- ─── CERTIFICATES ─────────────────────────────────────────────────────────────
create table certificates (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  student_name text not null,
  course_title text not null,
  completion_date timestamptz default now(),
  verification_code text unique not null,
  verification_url text not null,
  final_score numeric not null,
  is_valid boolean default true
);

-- ─── EMPLOYERS ────────────────────────────────────────────────────────────────
create table employers (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  email text unique not null,
  plan text default 'starter',
  seats integer default 5,
  used_seats integer default 0,
  stripe_customer_id text,
  stripe_subscription_id text,
  team_members uuid[] default '{}',
  created_at timestamptz default now()
);

-- ─── TOKEN USAGE ──────────────────────────────────────────────────────────────
create table token_usage (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  session_id uuid references tutor_sessions(id) on delete cascade,
  input_tokens integer not null,
  output_tokens integer not null,
  cost_usd numeric not null,
  model text not null,
  created_at timestamptz default now()
);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
alter table students enable row level security;
alter table tutor_sessions enable row level security;
alter table quiz_results enable row level security;
alter table module_progress enable row level security;
alter table section_progress enable row level security;
alter table certificates enable row level security;
alter table token_usage enable row level security;
alter table course_chunks enable row level security;

-- ─── POLICIES ─────────────────────────────────────────────────────────────────
create policy "Students can view own data" on students for select using (auth.uid() = id);
create policy "Students can update own data" on students for update using (auth.uid() = id);
create policy "Students can insert own data" on students for insert with check (auth.uid() = id);
create policy "Students can view own sessions" on tutor_sessions for all using (auth.uid() = student_id);
create policy "Students can view own quiz results" on quiz_results for all using (auth.uid() = student_id);
create policy "Students can view own progress" on module_progress for all using (auth.uid() = student_id);
create policy "Students can manage own section progress" on section_progress for all using (auth.uid() = student_id);
create policy "Certificates are public for verification" on certificates for select using (true);
create policy "Students can view own token usage" on token_usage for select using (auth.uid() = student_id);
create policy "Course chunks are public" on course_chunks for select using (true);
