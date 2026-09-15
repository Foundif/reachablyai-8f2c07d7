-- Granular per-member permissions
ALTER TABLE public.workspace_members
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Business records (bookings / orders / appointments / enquiries)
CREATE TABLE IF NOT EXISTS public.business_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  record_code text NOT NULL,
  record_type text NOT NULL DEFAULT 'booking',
  title text,
  customer_name text NOT NULL,
  customer_phone text,
  customer_email text,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.wa_conversations(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'new',
  assigned_to uuid,
  service text,
  scheduled_at timestamptz,
  amount numeric NOT NULL DEFAULT 0,
  advance_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'pending',
  custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  source text NOT NULL DEFAULT 'manual',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS business_records_ws_code_idx ON public.business_records (workspace_id, record_code);
CREATE INDEX IF NOT EXISTS business_records_ws_created_idx ON public.business_records (workspace_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_records TO authenticated;
GRANT ALL ON public.business_records TO service_role;
ALTER TABLE public.business_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members manage workspace records" ON public.business_records;
CREATE POLICY "Members manage workspace records" ON public.business_records
  FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

DROP TRIGGER IF EXISTS trg_business_records_updated ON public.business_records;
CREATE TRIGGER trg_business_records_updated BEFORE UPDATE ON public.business_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Timeline of every important action on a record
CREATE TABLE IF NOT EXISTS public.record_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES public.business_records(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  event text NOT NULL,
  detail text,
  actor_id uuid,
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS record_timeline_record_idx ON public.record_timeline (record_id, created_at);
GRANT SELECT, INSERT ON public.record_timeline TO authenticated;
GRANT ALL ON public.record_timeline TO service_role;
ALTER TABLE public.record_timeline ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members read record timeline" ON public.record_timeline;
CREATE POLICY "Members read record timeline" ON public.record_timeline
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));
DROP POLICY IF EXISTS "Members add record timeline" ON public.record_timeline;
CREATE POLICY "Members add record timeline" ON public.record_timeline
  FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

-- Payments attached to records
CREATE TABLE IF NOT EXISTS public.record_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES public.business_records(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'advance',
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  payment_link text,
  razorpay_link_id text,
  razorpay_order_id text,
  razorpay_payment_id text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS record_payments_record_idx ON public.record_payments (record_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.record_payments TO authenticated;
GRANT ALL ON public.record_payments TO service_role;
ALTER TABLE public.record_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members manage record payments" ON public.record_payments;
CREATE POLICY "Members manage record payments" ON public.record_payments
  FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

DROP TRIGGER IF EXISTS trg_record_payments_updated ON public.record_payments;
CREATE TRIGGER trg_record_payments_updated BEFORE UPDATE ON public.record_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sequential per-workspace record code: PREFIX-YYMM-001
CREATE OR REPLACE FUNCTION public.next_record_code(_ws uuid, _prefix text DEFAULT 'BK')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ym text := to_char(now(), 'YYMM');
  seq int;
BEGIN
  IF NOT public.is_workspace_member(_ws, auth.uid()) THEN
    RAISE EXCEPTION 'not a workspace member';
  END IF;
  SELECT count(*) + 1 INTO seq FROM public.business_records
   WHERE workspace_id = _ws AND record_code LIKE upper(_prefix) || '-' || ym || '-%';
  RETURN upper(_prefix) || '-' || ym || '-' || lpad(seq::text, 3, '0');
END;
$$;
REVOKE ALL ON FUNCTION public.next_record_code(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_record_code(uuid, text) TO authenticated, service_role;