
ALTER TABLE public.tn_settings
  ADD COLUMN IF NOT EXISTS meta_flow_id text,
  ADD COLUMN IF NOT EXISTS meta_flow_cta text DEFAULT 'Book Now',
  ADD COLUMN IF NOT EXISTS flow_json jsonb,
  ADD COLUMN IF NOT EXISTS flow_header text DEFAULT '🚖 TN45 Travel Aid',
  ADD COLUMN IF NOT EXISTS flow_body text DEFAULT 'வணக்கம்! Tap below to book your travel assistance.',
  ADD COLUMN IF NOT EXISTS flow_footer text DEFAULT 'Powered by TN45';

ALTER TABLE public.tn_bookings
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS transport_mode text,
  ADD COLUMN IF NOT EXISTS transport_details text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS landmark text,
  ADD COLUMN IF NOT EXISTS booking_date date,
  ADD COLUMN IF NOT EXISTS booking_time text,
  ADD COLUMN IF NOT EXISTS expected_hours text,
  ADD COLUMN IF NOT EXISTS flow_token text,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'whatsapp_flow';
