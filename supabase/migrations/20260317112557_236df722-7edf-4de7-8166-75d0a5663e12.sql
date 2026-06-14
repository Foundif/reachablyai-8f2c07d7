
-- Add trial management columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS trial_start_date timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS trial_end_date timestamptz,
ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'trial';

-- Update existing profiles to have trial dates
UPDATE public.profiles SET 
  trial_start_date = COALESCE(trial_start_date, created_at), 
  trial_end_date = COALESCE(trial_end_date, created_at + interval '14 days'),
  subscription_status = COALESCE(subscription_status, 'trial')
WHERE trial_start_date IS NULL OR trial_end_date IS NULL;

-- Super admin credentials table (no public access - service role only)
CREATE TABLE IF NOT EXISTS public.super_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  session_token text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;
-- No public policies - only accessible via service role in edge functions

-- Insert default super admin
INSERT INTO public.super_admins (username, password_hash) 
VALUES ('Superadmin', 'Superadmin123@')
ON CONFLICT (username) DO NOTHING;
