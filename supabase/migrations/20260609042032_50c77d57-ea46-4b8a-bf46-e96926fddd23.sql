
CREATE TABLE public.tn_ai_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  avatar TEXT,
  system_prompt TEXT NOT NULL DEFAULT 'You are a helpful WhatsApp business assistant.',
  model TEXT NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  temperature NUMERIC NOT NULL DEFAULT 0.7,
  tools JSONB NOT NULL DEFAULT '[]'::jsonb,
  knowledge JSONB NOT NULL DEFAULT '[]'::jsonb,
  greeting TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tn_ai_agents TO authenticated;
GRANT ALL ON public.tn_ai_agents TO service_role;

ALTER TABLE public.tn_ai_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own agents"
  ON public.tn_ai_agents FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER tn_ai_agents_updated_at
  BEFORE UPDATE ON public.tn_ai_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX tn_ai_agents_user_idx ON public.tn_ai_agents(user_id);
