-- Add section columns to course_chunks
alter table course_chunks
  add column if not exists section_id text not null default '',
  add column if not exists section_title text not null default '',
  add column if not exists section_order integer not null default 0;

-- Index for efficient section queries
create index if not exists course_chunks_section_idx
  on course_chunks(module_id, section_id, section_order);

-- Track which sections a student has completed within a module
create table if not exists section_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  module_id text not null,
  section_id text not null,       -- e.g. "1.1"
  section_title text not null,
  status text not null default 'not_started',  -- not_started | in_progress | completed
  notes text default '',          -- student's own notes for this section
  key_points text[] default '{}', -- auto-generated bullet points from Alex
  completed_at timestamptz,
  unique(student_id, module_id, section_id)
);

alter table section_progress enable row level security;

create policy "Students can manage own section progress"
  on section_progress for all using (auth.uid() = student_id);

-- Index for fast lookup
create index if not exists section_progress_student_module_idx
  on section_progress(student_id, module_id);
