ALTER TABLE public.profiles ALTER COLUMN trial_start_date SET DEFAULT now();
ALTER TABLE public.profiles ALTER COLUMN trial_end_date SET DEFAULT (now() + interval '7 days');

UPDATE public.profiles
SET trial_start_date = COALESCE(trial_start_date, created_at, now()),
    trial_end_date = timestamptz '2026-07-31 18:29:59+00'
WHERE COALESCE(is_staff, false) = false
  AND COALESCE(subscription_status, '') NOT IN ('active','starter','growth','business','pro','professional','enterprise');

UPDATE public.profiles
SET trial_start_date = COALESCE(trial_start_date, created_at, now()),
    trial_end_date = COALESCE(created_at, now()) + interval '7 days'
WHERE trial_end_date IS NULL;