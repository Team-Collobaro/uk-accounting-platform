-- 1. Secure Realtime Broadcasts
-- We assume the realtime.messages table exists (standard in Supabase for Realtime Auth)
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables WHERE schemaname = 'realtime' AND tablename = 'messages'
  ) THEN
    ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users can broadcast to own session" ON realtime.messages;
    CREATE POLICY "Users can broadcast to own session"
      ON realtime.messages FOR INSERT
      WITH CHECK (
        topic LIKE 'proctor:%' AND
        auth.uid() = (
          SELECT user_id FROM public.proctor_sessions 
          WHERE id::text = split_part(topic, 'proctor:', 2)
        )
      );

    DROP POLICY IF EXISTS "Users can subscribe to own session" ON realtime.messages;
    CREATE POLICY "Users can subscribe to own session"
      ON realtime.messages FOR SELECT
      USING (
        topic LIKE 'proctor:%' AND
        auth.uid() = (
          SELECT user_id FROM public.proctor_sessions 
          WHERE id::text = split_part(topic, 'proctor:', 2)
        )
      );
  END IF;
END $$;

-- 2. State Model Validation (pending -> paired -> active -> paused/ended)
CREATE OR REPLACE FUNCTION validate_proctor_session_state()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'paired', 'active', 'paused', 'ended', 'expired') THEN
    RAISE EXCEPTION 'Invalid session state: %', NEW.status;
  END IF;

  -- Ensure valid transitions (simplified)
  IF OLD.status = 'ended' OR OLD.status = 'expired' THEN
    RAISE EXCEPTION 'Cannot transition from ended or expired state';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS proctor_session_state_trigger ON public.proctor_sessions;
CREATE TRIGGER proctor_session_state_trigger
  BEFORE UPDATE ON public.proctor_sessions
  FOR EACH ROW
  EXECUTE FUNCTION validate_proctor_session_state();
