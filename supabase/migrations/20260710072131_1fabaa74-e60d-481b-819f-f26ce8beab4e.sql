
ALTER TABLE public.tn_settings
  ADD COLUMN IF NOT EXISTS public_booking_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_booking_api_key text;

CREATE UNIQUE INDEX IF NOT EXISTS tn_settings_public_booking_api_key_uniq
  ON public.tn_settings (public_booking_api_key)
  WHERE public_booking_api_key IS NOT NULL;

-- Idempotency table for public booking API
CREATE TABLE IF NOT EXISTS public.tn_booking_idempotency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  booking_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tn_booking_idempotency TO authenticated;
GRANT ALL ON public.tn_booking_idempotency TO service_role;
ALTER TABLE public.tn_booking_idempotency ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads idempotency" ON public.tn_booking_idempotency
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
