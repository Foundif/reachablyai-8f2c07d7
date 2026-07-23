WITH ranked AS (
  SELECT id,
    row_number() OVER (
      PARTITION BY workspace_id, name, language
      ORDER BY synced_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.templates
)
DELETE FROM public.templates t
USING ranked r
WHERE t.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS templates_workspace_name_language_key
ON public.templates (workspace_id, name, language);