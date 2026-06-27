ALTER TABLE public.tn_settings 
  ADD COLUMN IF NOT EXISTS google_sheet_id text,
  ADD COLUMN IF NOT EXISTS google_sheet_tab text DEFAULT 'Bookings',
  ADD COLUMN IF NOT EXISTS google_sheet_enabled boolean NOT NULL DEFAULT false;