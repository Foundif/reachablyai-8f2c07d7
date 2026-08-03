ALTER TABLE public.templates
  ADD COLUMN IF NOT EXISTS parameter_format text NOT NULL DEFAULT 'POSITIONAL';

ALTER TABLE public.templates DROP CONSTRAINT IF EXISTS templates_parameter_format_check;
ALTER TABLE public.templates ADD CONSTRAINT templates_parameter_format_check
  CHECK (parameter_format IN ('POSITIONAL', 'NAMED'));