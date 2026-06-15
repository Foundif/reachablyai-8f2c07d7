ALTER TABLE public.tn_messages ADD COLUMN IF NOT EXISTS read_at timestamp with time zone;
ALTER TABLE public.tn_settings ADD COLUMN IF NOT EXISTS meta_template_name text;
ALTER TABLE public.tn_settings ADD COLUMN IF NOT EXISTS meta_template_language text DEFAULT 'en_US';