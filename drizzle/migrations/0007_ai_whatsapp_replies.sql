ALTER TABLE public.workspace_settings
  ADD COLUMN IF NOT EXISTS ai_reply_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_reply_instructions text;