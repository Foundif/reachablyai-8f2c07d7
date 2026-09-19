-- Chatbot visual flows
ALTER TABLE public.chatbots
  ADD COLUMN IF NOT EXISTS flow jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS flow_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.chatbot_conversations
  ADD COLUMN IF NOT EXISTS flow_state jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Public API keys for external admin panels / apps
CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY['send','contacts','records','read']::text[],
  active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  call_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_keys_hash_idx ON public.api_keys (key_hash);
CREATE INDEX IF NOT EXISTS api_keys_ws_idx ON public.api_keys (workspace_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace admins manage api keys" ON public.api_keys;
CREATE POLICY "Workspace admins manage api keys"
ON public.api_keys FOR ALL TO authenticated
USING (public.is_workspace_admin(workspace_id, auth.uid()))
WITH CHECK (public.is_workspace_admin(workspace_id, auth.uid()));

-- Log of external API calls
CREATE TABLE IF NOT EXISTS public.api_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  api_key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  endpoint text NOT NULL,
  status integer NOT NULL,
  error text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_logs_ws_idx ON public.api_logs (workspace_id, created_at DESC);

GRANT SELECT ON public.api_logs TO authenticated;
GRANT ALL ON public.api_logs TO service_role;

ALTER TABLE public.api_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members read api logs" ON public.api_logs;
CREATE POLICY "Workspace members read api logs"
ON public.api_logs FOR SELECT TO authenticated
USING (public.is_workspace_member(workspace_id, auth.uid()));