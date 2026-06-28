ALTER TABLE public.tn_settings
  ALTER COLUMN advance_amount SET DEFAULT 200,
  ALTER COLUMN google_sheet_tab SET DEFAULT 'Sheet1';

UPDATE public.tn_settings
SET advance_amount = 200
WHERE advance_amount IS NULL OR advance_amount = 50;

UPDATE public.tn_settings
SET google_sheet_tab = 'Sheet1'
WHERE google_sheet_id = '1lr46WioFekMm16j1W8MQZHgGTM17YWE0EK2gGZNTKJU'
  AND (google_sheet_tab IS NULL OR google_sheet_tab = '' OR google_sheet_tab = 'Bookings');
