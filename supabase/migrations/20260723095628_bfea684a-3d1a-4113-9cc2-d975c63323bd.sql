ALTER TABLE public.wa_conversations ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS wa_conversations_deleted_at_idx ON public.wa_conversations(workspace_id, deleted_at);