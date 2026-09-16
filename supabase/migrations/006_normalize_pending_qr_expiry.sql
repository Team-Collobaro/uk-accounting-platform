-- Migration 005 backfilled legacy rows from the former general expires_at
-- column. Some old pending rows therefore received the longer exam lifetime.
-- Pairing QR codes must always be short-lived.
update public.proctor_sessions
set pairing_expires_at = least(
  pairing_expires_at,
  created_at + interval '15 minutes'
)
where status = 'pending';

notify pgrst, 'reload schema';
