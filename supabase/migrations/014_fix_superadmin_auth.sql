-- Migration 014: Fix RLS recursion and clean up auth identities
BEGIN;

-- 1. Fix infinite recursion policy on public.superadmins
DROP POLICY IF EXISTS "Superadmins can read superadmins" ON public.superadmins;

CREATE POLICY "Superadmins can read superadmins"
  ON public.superadmins FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 2. Clean up any manually inserted auth records that broke GoTrue schema validation
DELETE FROM auth.identities 
WHERE lower(identity_data->>'email') = 'naja@teamcollaboro.com' 
   OR user_id IN (SELECT id FROM auth.users WHERE lower(email) = 'naja@teamcollaboro.com');

DELETE FROM public.superadmins WHERE lower(email) = 'naja@teamcollaboro.com';

DELETE FROM auth.users WHERE lower(email) = 'naja@teamcollaboro.com';

NOTIFY pgrst, 'reload schema';

COMMIT;
