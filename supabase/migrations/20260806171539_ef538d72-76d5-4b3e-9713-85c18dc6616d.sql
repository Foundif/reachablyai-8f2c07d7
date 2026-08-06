ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS org_size text,
  ADD COLUMN IF NOT EXISTS job_role text,
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS sells text;

ALTER TABLE public.message_credits
  ADD COLUMN IF NOT EXISTS ai_balance integer NOT NULL DEFAULT 25;