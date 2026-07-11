ALTER TABLE public.tn_settings
  ADD COLUMN IF NOT EXISTS public_booking_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_booking_api_key text UNIQUE;
CREATE INDEX IF NOT EXISTS tn_settings_public_booking_api_key_idx ON public.tn_settings(public_booking_api_key) WHERE public_booking_api_key IS NOT NULL;