ALTER TABLE public.tn_settings
  ADD COLUMN IF NOT EXISTS tpl_booking_received text,
  ADD COLUMN IF NOT EXISTS tpl_payment_reminder text,
  ADD COLUMN IF NOT EXISTS tpl_payment_confirmed text;