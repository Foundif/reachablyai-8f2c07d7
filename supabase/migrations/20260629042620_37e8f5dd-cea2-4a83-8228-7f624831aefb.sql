ALTER TABLE public.tn_bookings ADD COLUMN IF NOT EXISTS booking_code text;
CREATE INDEX IF NOT EXISTS tn_bookings_booking_code_idx ON public.tn_bookings(booking_code);