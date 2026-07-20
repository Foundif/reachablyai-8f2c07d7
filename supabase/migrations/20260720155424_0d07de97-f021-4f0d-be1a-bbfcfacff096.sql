ALTER TABLE public.whatsapp_credentials
  ADD COLUMN IF NOT EXISTS connection_type TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'disconnected';

ALTER TABLE public.whatsapp_credentials
  DROP CONSTRAINT IF EXISTS whatsapp_credentials_connection_type_check;
ALTER TABLE public.whatsapp_credentials
  ADD CONSTRAINT whatsapp_credentials_connection_type_check
  CHECK (connection_type IN ('manual', 'embedded'));