
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.chatbots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  system_prompt text NOT NULL DEFAULT 'You are a helpful customer support assistant. Answer based on the provided context. If unsure, say you will connect the user to a human.',
  welcome_message text NOT NULL DEFAULT 'Hi! 👋 How can I help you today?',
  tone text NOT NULL DEFAULT 'friendly',
  brand_color text NOT NULL DEFAULT '#111827',
  position text NOT NULL DEFAULT 'bottom-right',
  avatar_url text,
  launcher_text text NOT NULL DEFAULT 'Chat with us',
  enabled boolean NOT NULL DEFAULT true,
  public_key text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chatbots_workspace_idx ON public.chatbots(workspace_id);
CREATE INDEX chatbots_public_key_idx ON public.chatbots(public_key);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatbots TO authenticated;
GRANT ALL ON public.chatbots TO service_role;
ALTER TABLE public.chatbots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chatbots_workspace_members" ON public.chatbots FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
CREATE TRIGGER trg_chatbots_updated BEFORE UPDATE ON public.chatbots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.chatbot_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id uuid NOT NULL REFERENCES public.chatbots(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('url','pdf','faq','text')),
  source_ref text,
  title text,
  status text NOT NULL DEFAULT 'pending',
  error text,
  chars_ingested integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chatbot_sources_chatbot_idx ON public.chatbot_sources(chatbot_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatbot_sources TO authenticated;
GRANT ALL ON public.chatbot_sources TO service_role;
ALTER TABLE public.chatbot_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chatbot_sources_workspace_members" ON public.chatbot_sources FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
CREATE TRIGGER trg_chatbot_sources_updated BEFORE UPDATE ON public.chatbot_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.chatbot_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id uuid NOT NULL REFERENCES public.chatbots(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.chatbot_sources(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  content text NOT NULL,
  embedding vector(3072) NOT NULL,
  token_count integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chatbot_chunks_chatbot_idx ON public.chatbot_chunks(chatbot_id);
CREATE INDEX chatbot_chunks_embedding_idx ON public.chatbot_chunks
  USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatbot_chunks TO authenticated;
GRANT ALL ON public.chatbot_chunks TO service_role;
ALTER TABLE public.chatbot_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chatbot_chunks_workspace_members" ON public.chatbot_chunks FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.match_chatbot_chunks(
  _chatbot_id uuid,
  query_embedding vector(3072),
  match_count int DEFAULT 5
) RETURNS TABLE (id uuid, content text, similarity float)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.content,
    1 - (c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) AS similarity
  FROM public.chatbot_chunks c
  WHERE c.chatbot_id = _chatbot_id
  ORDER BY c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  LIMIT match_count;
$$;

CREATE TABLE public.chatbot_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id uuid NOT NULL REFERENCES public.chatbots(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  visitor_name text,
  visitor_email text,
  page_url text,
  human_takeover boolean NOT NULL DEFAULT false,
  last_message_at timestamptz,
  last_message_preview text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chatbot_conv_bot_idx ON public.chatbot_conversations(chatbot_id, last_message_at DESC);
CREATE UNIQUE INDEX chatbot_conv_bot_visitor_idx ON public.chatbot_conversations(chatbot_id, visitor_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatbot_conversations TO authenticated;
GRANT ALL ON public.chatbot_conversations TO service_role;
ALTER TABLE public.chatbot_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chatbot_conv_workspace_members" ON public.chatbot_conversations FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
CREATE TRIGGER trg_chatbot_conv_updated BEFORE UPDATE ON public.chatbot_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.chatbot_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chatbot_conversations(id) ON DELETE CASCADE,
  chatbot_id uuid NOT NULL REFERENCES public.chatbots(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','agent','system')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chatbot_msg_conv_idx ON public.chatbot_messages(conversation_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatbot_messages TO authenticated;
GRANT ALL ON public.chatbot_messages TO service_role;
ALTER TABLE public.chatbot_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chatbot_msg_workspace_members" ON public.chatbot_messages FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.chatbot_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chatbot_conversations;

CREATE POLICY "chatbot_uploads_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chatbot-uploads');
CREATE POLICY "chatbot_uploads_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chatbot-uploads');
CREATE POLICY "chatbot_uploads_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chatbot-uploads');
