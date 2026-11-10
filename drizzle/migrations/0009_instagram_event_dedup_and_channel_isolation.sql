ALTER TABLE public.wa_conversations DROP CONSTRAINT IF EXISTS wa_conversations_workspace_id_contact_phone_key;
CREATE UNIQUE INDEX IF NOT EXISTS wa_conversations_workspace_channel_contact_key ON public.wa_conversations (workspace_id, channel, contact_phone);
GRANT SELECT ON public.instagram_accounts TO authenticated;
GRANT ALL ON public.instagram_accounts, public.instagram_credentials TO service_role;
REVOKE ALL ON public.instagram_credentials FROM anon, authenticated;
CREATE TABLE public.instagram_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 event_key text NOT NULL,
 event_type text NOT NULL,
 status text NOT NULL DEFAULT 'processing',
 error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 UNIQUE (workspace_id, event_key)
);
GRANT SELECT ON public.instagram_events TO authenticated;
GRANT ALL ON public.instagram_events TO service_role;
ALTER TABLE public.instagram_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read Instagram events" ON public.instagram_events FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE INDEX instagram_events_workspace_created_idx ON public.instagram_events(workspace_id, created_at DESC);