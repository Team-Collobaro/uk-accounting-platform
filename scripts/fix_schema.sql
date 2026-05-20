-- ─── Safe schema repair — run this in Supabase SQL Editor ───────────────────
-- This is idempotent: safe to run multiple times.
-- NOTE: This is PostgreSQL syntax. Run in Supabase SQL Editor, not VS Code.
-- @dialect postgresql

-- 1. Add content_tsv to course_chunks if missing
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'course_chunks' and column_name = 'content_tsv'
  ) then
    alter table course_chunks
      add column content_tsv tsvector
        generated always as (to_tsvector('english', content)) stored;
  end if;
end $$;

-- 2. Add section columns to course_chunks if missing
alter table course_chunks
  add column if not exists section_id    text    not null default '',
  add column if not exists section_title text    not null default '',
  add column if not exists section_order integer not null default 0;

-- 3. Add chunk_index if missing (used by fallback in sections route)
alter table course_chunks
  add column if not exists chunk_index integer not null default 0;

-- 4. Indexes
create index if not exists course_chunks_tsv_idx
  on course_chunks using gin (content_tsv);

create index if not exists course_chunks_module_idx
  on course_chunks(module_id);

create index if not exists course_chunks_section_idx
  on course_chunks(module_id, section_id, section_order);

-- 5. section_progress table
create table if not exists section_progress (
  id            uuid        primary key default gen_random_uuid(),
  student_id    uuid        references students(id) on delete cascade,
  module_id     text        not null,
  section_id    text        not null,
  section_title text        not null,
  status        text        not null default 'not_started',
  notes         text        default '',
  key_points    text[]      default '{}',
  completed_at  timestamptz,
  unique(student_id, module_id, section_id)
);

alter table section_progress enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'section_progress'
    and policyname = 'Students can manage own section progress'
  ) then
    create policy "Students can manage own section progress"
      on section_progress for all using (auth.uid() = student_id);
  end if;
end $$;

create index if not exists section_progress_student_module_idx
  on section_progress(student_id, module_id);

-- 6. Teaching point tracking columns on section_progress
alter table section_progress
  add column if not exists teaching_point_idx integer not null default 0,
  add column if not exists teaching_points    jsonb   not null default '[]';
