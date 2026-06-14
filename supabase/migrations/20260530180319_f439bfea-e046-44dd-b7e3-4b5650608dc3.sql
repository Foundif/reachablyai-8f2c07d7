
-- =========================================
-- TN45 Travel Aid schema
-- =========================================

CREATE TABLE public.tn_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  wa_id TEXT NOT NULL,
  name TEXT,
  language TEXT DEFAULT 'ta',
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, wa_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tn_customers TO authenticated;
GRANT ALL ON public.tn_customers TO service_role;
ALTER TABLE public.tn_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own customers select" ON public.tn_customers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own customers insert" ON public.tn_customers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own customers update" ON public.tn_customers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own customers delete" ON public.tn_customers FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.tn_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  code TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_ta TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'terminal',
  base_hours NUMERIC,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tn_services TO authenticated;
GRANT ALL ON public.tn_services TO service_role;
ALTER TABLE public.tn_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own services select" ON public.tn_services FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own services insert" ON public.tn_services FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own services update" ON public.tn_services FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own services delete" ON public.tn_services FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.tn_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  customer_id UUID,
  wa_id TEXT NOT NULL,
  service_code TEXT,
  service_name TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  addons JSONB DEFAULT '[]'::jsonb,
  details JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  advance_amount NUMERIC NOT NULL DEFAULT 50,
  balance_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tn_bookings TO authenticated;
GRANT ALL ON public.tn_bookings TO service_role;
ALTER TABLE public.tn_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bookings select" ON public.tn_bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own bookings insert" ON public.tn_bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own bookings update" ON public.tn_bookings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own bookings delete" ON public.tn_bookings FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.tn_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  booking_id UUID,
  amount NUMERIC NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'upi_qr',
  upi_ref TEXT,
  screenshot_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tn_payments TO authenticated;
GRANT ALL ON public.tn_payments TO service_role;
ALTER TABLE public.tn_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own payments select" ON public.tn_payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own payments insert" ON public.tn_payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own payments update" ON public.tn_payments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own payments delete" ON public.tn_payments FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.tn_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  wa_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  type TEXT,
  payload JSONB,
  wa_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tn_messages TO authenticated;
GRANT ALL ON public.tn_messages TO service_role;
ALTER TABLE public.tn_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own messages select" ON public.tn_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own messages insert" ON public.tn_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.tn_flow_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  wa_id TEXT NOT NULL,
  current_step TEXT NOT NULL DEFAULT 'greeting',
  draft_booking JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, wa_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tn_flow_sessions TO authenticated;
GRANT ALL ON public.tn_flow_sessions TO service_role;
ALTER TABLE public.tn_flow_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sessions select" ON public.tn_flow_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own sessions insert" ON public.tn_flow_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own sessions update" ON public.tn_flow_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own sessions delete" ON public.tn_flow_sessions FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.tn_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  upi_id TEXT,
  payee_name TEXT,
  qr_image_url TEXT,
  advance_amount NUMERIC NOT NULL DEFAULT 50,
  business_name TEXT DEFAULT 'TN45 Travel Aid',
  greeting_template TEXT,
  meta_phone_number_id TEXT,
  meta_waba_id TEXT,
  verify_token_hint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tn_settings TO authenticated;
GRANT ALL ON public.tn_settings TO service_role;
ALTER TABLE public.tn_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settings select" ON public.tn_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own settings insert" ON public.tn_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own settings update" ON public.tn_settings FOR UPDATE USING (auth.uid() = user_id);

-- updated_at triggers
CREATE TRIGGER tn_customers_updated BEFORE UPDATE ON public.tn_customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tn_services_updated BEFORE UPDATE ON public.tn_services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tn_bookings_updated BEFORE UPDATE ON public.tn_bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tn_payments_updated BEFORE UPDATE ON public.tn_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tn_settings_updated BEFORE UPDATE ON public.tn_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('tn-qr-codes', 'tn-qr-codes', true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('tn-payment-screenshots', 'tn-payment-screenshots', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "tn qr public read" ON storage.objects FOR SELECT USING (bucket_id = 'tn-qr-codes');
CREATE POLICY "tn qr owner write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tn-qr-codes' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "tn qr owner update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'tn-qr-codes' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "tn qr owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'tn-qr-codes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "tn screenshots owner read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'tn-payment-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "tn screenshots owner write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tn-payment-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
