ALTER TABLE public.tn_bookings
  ADD COLUMN IF NOT EXISTS balance_msg_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS balance_msg_sent_by uuid;