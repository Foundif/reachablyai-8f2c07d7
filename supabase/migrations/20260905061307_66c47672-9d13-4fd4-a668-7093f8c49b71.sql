ALTER TABLE public.credit_settings ADD COLUMN IF NOT EXISTS last_low_balance_alert_at timestamptz;

-- Grant 25 free trial message credits to every newly created workspace
CREATE OR REPLACE FUNCTION public.ensure_personal_workspace(_uid uuid, _email text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ws_id uuid;
BEGIN
  SELECT id INTO ws_id FROM public.workspaces WHERE owner_id = _uid ORDER BY created_at LIMIT 1;
  IF ws_id IS NULL THEN
    INSERT INTO public.workspaces(name, owner_id) VALUES (COALESCE(_email, 'My Workspace'), _uid) RETURNING id INTO ws_id;
    INSERT INTO public.workspace_members(workspace_id, user_id, role) VALUES (ws_id, _uid, 'owner')
      ON CONFLICT DO NOTHING;
    INSERT INTO public.message_credits(workspace_id, balance, lifetime_purchased)
      VALUES (ws_id, 25, 25)
      ON CONFLICT (workspace_id) DO NOTHING;
  END IF;
  UPDATE public.profiles SET active_workspace_id = COALESCE(active_workspace_id, ws_id) WHERE user_id = _uid;
  RETURN ws_id;
END; $$;

-- Backfill: existing workspaces with no wallet row get the same 25 free credits
INSERT INTO public.message_credits(workspace_id, balance, lifetime_purchased)
SELECT w.id, 25, 25 FROM public.workspaces w
WHERE NOT EXISTS (SELECT 1 FROM public.message_credits mc WHERE mc.workspace_id = w.id)
ON CONFLICT (workspace_id) DO NOTHING;