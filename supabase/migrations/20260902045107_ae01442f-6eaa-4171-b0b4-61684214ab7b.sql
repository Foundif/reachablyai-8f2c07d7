ALTER TABLE public.whatsapp_credentials
  ADD COLUMN IF NOT EXISTS profile_picture_url text,
  ADD COLUMN IF NOT EXISTS profile_address text,
  ADD COLUMN IF NOT EXISTS profile_description text,
  ADD COLUMN IF NOT EXISTS profile_email text,
  ADD COLUMN IF NOT EXISTS profile_vertical text,
  ADD COLUMN IF NOT EXISTS profile_websites jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS profile_about text,
  ADD COLUMN IF NOT EXISTS verified_name text,
  ADD COLUMN IF NOT EXISTS quality_rating text,
  ADD COLUMN IF NOT EXISTS messaging_limit text,
  ADD COLUMN IF NOT EXISTS profile_synced_at timestamptz;