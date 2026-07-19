
-- Templates: media header + carousel + wider status
ALTER TABLE public.templates
  ADD COLUMN IF NOT EXISTS header_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS header_media_url text,
  ADD COLUMN IF NOT EXISTS header_media_handle text,
  ADD COLUMN IF NOT EXISTS carousel_cards jsonb;

ALTER TABLE public.templates DROP CONSTRAINT IF EXISTS templates_status_check;
ALTER TABLE public.templates ADD CONSTRAINT templates_status_check
  CHECK (status IN ('draft','pending','approved','rejected','paused','disabled','in_appeal','pending_deletion','deleted'));

ALTER TABLE public.templates DROP CONSTRAINT IF EXISTS templates_header_type_check;
ALTER TABLE public.templates ADD CONSTRAINT templates_header_type_check
  CHECK (header_type IN ('none','text','image','video','document','carousel'));

-- Widen category to allow carousel
ALTER TABLE public.templates DROP CONSTRAINT IF EXISTS templates_category_check;
ALTER TABLE public.templates ADD CONSTRAINT templates_category_check
  CHECK (category IN ('marketing','utility','authentication','carousel'));

-- Message credit wallet per workspace
CREATE TABLE IF NOT EXISTS public.message_credits (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0,
  lifetime_purchased integer NOT NULL DEFAULT 0,
  lifetime_used integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.message_credits TO authenticated;
GRANT ALL ON public.message_credits TO service_role;
ALTER TABLE public.message_credits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members read credits" ON public.message_credits;
CREATE POLICY "members read credits" ON public.message_credits FOR SELECT
  TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid,
  kind text NOT NULL, -- 'topup' | 'consume' | 'grant' | 'refund'
  pack_id text,
  msgs integer NOT NULL,
  amount_paise integer NOT NULL DEFAULT 0,
  razorpay_payment_id text,
  razorpay_order_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_credit_tx_ws ON public.credit_transactions(workspace_id, created_at DESC);
GRANT SELECT ON public.credit_transactions TO authenticated;
GRANT ALL ON public.credit_transactions TO service_role;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members read tx" ON public.credit_transactions;
CREATE POLICY "members read tx" ON public.credit_transactions FOR SELECT
  TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));
