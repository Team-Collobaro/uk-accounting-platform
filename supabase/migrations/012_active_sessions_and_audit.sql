-- Migration 012: Enforce Single Active Session & Session Audit with Location Tracking
-- Description:
-- 1. active_sessions table: Enforces 1 active web session and 1 active mobile session per student.
-- 2. session_audit table: Records login events, geo-location changes, impossible travel, and superseded sessions.
-- 3. Enables Supabase Realtime on active_sessions so other tabs/devices receive immediate push notifications.

BEGIN;

CREATE TABLE IF NOT EXISTS public.active_sessions (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('web', 'mobile')),
  session_id TEXT NOT NULL,
  current_ip TEXT,
  current_country TEXT,
  current_city TEXT,
  user_agent TEXT,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (user_id, platform)
);

CREATE TABLE IF NOT EXISTS public.session_audit (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('web', 'mobile')),
  session_id TEXT,
  event_type TEXT NOT NULL, -- 'login', 'heartbeat', 'heartbeat_location_change', 'impossible_travel', 'superseded'
  ip TEXT,
  country TEXT,
  city TEXT,
  user_agent TEXT,
  flagged BOOLEAN NOT NULL DEFAULT false,
  flag_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_active_sessions_user_platform 
  ON public.active_sessions (user_id, platform);

CREATE INDEX IF NOT EXISTS idx_session_audit_user_created 
  ON public.session_audit (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_audit_flagged 
  ON public.session_audit (flagged) 
  WHERE flagged = true;

-- Row Level Security
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_audit ENABLE ROW LEVEL SECURITY;

-- Drop any previous policies if re-running
DROP POLICY IF EXISTS "Users can read own active session" ON public.active_sessions;
DROP POLICY IF EXISTS "Users can upsert own active session" ON public.active_sessions;
DROP POLICY IF EXISTS "Users can update own active session" ON public.active_sessions;
DROP POLICY IF EXISTS "Users can view own session audit" ON public.session_audit;

-- Active sessions policies
CREATE POLICY "Users can read own active session"
  ON public.active_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own active session"
  ON public.active_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own active session"
  ON public.active_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Session audit policies (read-only for user audit trail)
CREATE POLICY "Users can view own session audit"
  ON public.session_audit FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Grants
GRANT ALL ON TABLE public.active_sessions TO authenticated;
GRANT ALL ON TABLE public.active_sessions TO service_role;
GRANT ALL ON TABLE public.session_audit TO authenticated;
GRANT ALL ON TABLE public.session_audit TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.session_audit_id_seq TO authenticated, service_role;

-- Add active_sessions to supabase_realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'active_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.active_sessions;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
