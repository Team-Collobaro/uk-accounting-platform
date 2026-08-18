-- Create proctor_sessions table
create table public.proctor_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  module_id text not null,
  token text not null unique,
  status text not null default 'pending', -- 'pending', 'paired'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  expires_at timestamp with time zone not null
);

-- Enable RLS
alter table public.proctor_sessions enable row level security;

-- Policies
create policy "Users can read own proctor sessions"
  on public.proctor_sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert own proctor sessions"
  on public.proctor_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own proctor sessions"
  on public.proctor_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
