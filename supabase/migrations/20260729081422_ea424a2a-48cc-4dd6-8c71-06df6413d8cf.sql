CREATE TABLE public.scrape_topups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid,
  leads_granted integer NOT NULL DEFAULT 150,
  month_key text NOT NULL,
  amount_paise integer NOT NULL DEFAULT 29900,
  razorpay_order_id text,
  razorpay_payment_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX scrape_topups_ws_month_idx ON public.scrape_topups (workspace_id, month_key);

GRANT SELECT ON public.scrape_topups TO authenticated;
GRANT ALL ON public.scrape_topups TO service_role;

ALTER TABLE public.scrape_topups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view scrape topups" ON public.scrape_topups
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));