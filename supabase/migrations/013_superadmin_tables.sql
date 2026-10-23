-- Migration 013: Superadmin Management Table
BEGIN;

CREATE TABLE IF NOT EXISTS public.superadmins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'superadmin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.superadmins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmins can read superadmins" ON public.superadmins;

CREATE POLICY "Superadmins can read superadmins"
  ON public.superadmins FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

GRANT ALL ON TABLE public.superadmins TO service_role;
GRANT SELECT ON TABLE public.superadmins TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
