CREATE TABLE public.tn_meta_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  meta_id text NOT NULL,
  name text NOT NULL,
  category text,
  language text,
  status text,
  components jsonb NOT NULL DEFAULT '[]'::jsonb,
  quality_rating text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, meta_id, language)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tn_meta_templates TO authenticated;
GRANT ALL ON public.tn_meta_templates TO service_role;
ALTER TABLE public.tn_meta_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own Meta templates" ON public.tn_meta_templates FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can add their own Meta templates" ON public.tn_meta_templates FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own Meta templates" ON public.tn_meta_templates FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own Meta templates" ON public.tn_meta_templates FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_tn_meta_templates_updated_at BEFORE UPDATE ON public.tn_meta_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.tn_meta_flows (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  meta_id text NOT NULL,
  name text NOT NULL,
  status text,
  categories text[],
  endpoint_uri text,
  validation_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  preview jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, meta_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tn_meta_flows TO authenticated;
GRANT ALL ON public.tn_meta_flows TO service_role;
ALTER TABLE public.tn_meta_flows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own Meta flows" ON public.tn_meta_flows FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can add their own Meta flows" ON public.tn_meta_flows FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own Meta flows" ON public.tn_meta_flows FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own Meta flows" ON public.tn_meta_flows FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_tn_meta_flows_updated_at BEFORE UPDATE ON public.tn_meta_flows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();