ALTER TABLE public.tn_settings
  ADD COLUMN IF NOT EXISTS razorpay_key_id text,
  ADD COLUMN IF NOT EXISTS razorpay_key_secret text,
  ADD COLUMN IF NOT EXISTS razorpay_webhook_secret text,
  ADD COLUMN IF NOT EXISTS razorpay_enabled boolean NOT NULL DEFAULT false;