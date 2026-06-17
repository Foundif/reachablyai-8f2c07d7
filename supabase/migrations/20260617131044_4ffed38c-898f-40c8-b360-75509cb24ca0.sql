
CREATE TABLE IF NOT EXISTS public.tn_ai_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start date NOT NULL DEFAULT date_trunc('month', now())::date,
  free_used int NOT NULL DEFAULT 0,
  free_limit int NOT NULL DEFAULT 5,
  purchased_balance int NOT NULL DEFAULT 0,
  total_used int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.tn_ai_credits TO authenticated;
GRANT ALL ON public.tn_ai_credits TO service_role;

ALTER TABLE public.tn_ai_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own AI credits" ON public.tn_ai_credits
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Atomic consume function: resets monthly, decrements free first, then purchased.
CREATE OR REPLACE FUNCTION public.tn_consume_ai_credit(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.tn_ai_credits%ROWTYPE;
  cur_period date := date_trunc('month', now())::date;
BEGIN
  INSERT INTO public.tn_ai_credits(user_id) VALUES (_user_id)
    ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO rec FROM public.tn_ai_credits WHERE user_id = _user_id FOR UPDATE;

  -- Reset monthly window
  IF rec.period_start < cur_period THEN
    UPDATE public.tn_ai_credits
       SET period_start = cur_period, free_used = 0, updated_at = now()
     WHERE user_id = _user_id
    RETURNING * INTO rec;
  END IF;

  IF rec.free_used < rec.free_limit THEN
    UPDATE public.tn_ai_credits
       SET free_used = free_used + 1, total_used = total_used + 1, updated_at = now()
     WHERE user_id = _user_id
    RETURNING * INTO rec;
    RETURN jsonb_build_object('ok', true, 'source', 'free',
      'free_remaining', rec.free_limit - rec.free_used,
      'purchased_balance', rec.purchased_balance);
  ELSIF rec.purchased_balance > 0 THEN
    UPDATE public.tn_ai_credits
       SET purchased_balance = purchased_balance - 1, total_used = total_used + 1, updated_at = now()
     WHERE user_id = _user_id
    RETURNING * INTO rec;
    RETURN jsonb_build_object('ok', true, 'source', 'purchased',
      'free_remaining', 0,
      'purchased_balance', rec.purchased_balance);
  ELSE
    RETURN jsonb_build_object('ok', false, 'reason', 'out_of_credits',
      'free_remaining', 0,
      'purchased_balance', rec.purchased_balance);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tn_consume_ai_credit(uuid) TO authenticated;
