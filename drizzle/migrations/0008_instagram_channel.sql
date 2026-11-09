ALTER TABLE public.wa_conversations ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'whatsapp';
CREATE INDEX IF NOT EXISTS wa_conversations_channel_idx ON public.wa_conversations(workspace_id, channel);

CREATE TABLE public.instagram_accounts (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  page_id text NOT NULL,
  ig_user_id text NOT NULL UNIQUE,
  username text,
  profile_picture_url text,
  status text NOT NULL DEFAULT 'connected',
  last_error text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_event_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.instagram_accounts TO authenticated;
GRANT ALL ON public.instagram_accounts TO service_role;
ALTER TABLE public.instagram_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read ig" ON public.instagram_accounts FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "admins update ig" ON public.instagram_accounts FOR UPDATE TO authenticated USING (public.is_workspace_admin(workspace_id, auth.uid())) WITH CHECK (public.is_workspace_admin(workspace_id, auth.uid()));
CREATE TRIGGER trg_instagram_accounts_updated BEFORE UPDATE ON public.instagram_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.instagram_credentials (
  workspace_id uuid PRIMARY KEY REFERENCES public.instagram_accounts(workspace_id) ON DELETE CASCADE,
  page_token text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.instagram_credentials TO service_role;
ALTER TABLE public.instagram_credentials ENABLE ROW LEVEL SECURITY;