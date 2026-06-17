
-- 1. Expenses table for manual accounting entries
CREATE TABLE IF NOT EXISTS public.tn_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL DEFAULT 'general',
  vendor TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'cash',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tn_expenses TO authenticated;
GRANT ALL ON public.tn_expenses TO service_role;

ALTER TABLE public.tn_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own expenses" ON public.tn_expenses
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER tn_expenses_updated_at
  BEFORE UPDATE ON public.tn_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Profile preference: notification sound on/off
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_sound_enabled BOOLEAN NOT NULL DEFAULT true;
