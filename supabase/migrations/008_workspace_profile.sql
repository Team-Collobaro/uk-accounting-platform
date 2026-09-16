-- Add workspace_profile JSONB column to proctor_sessions
ALTER TABLE public.proctor_sessions
ADD COLUMN workspace_profile JSONB;

COMMENT ON COLUMN public.proctor_sessions.workspace_profile IS 'Versioned JSON profile of approved visual zones (student, desk, expected device) established during mobile camera setup.';

