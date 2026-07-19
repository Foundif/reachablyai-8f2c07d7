DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.leads; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.campaigns; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.templates; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.automations; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_credentials; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

ALTER TABLE public.leads REPLICA IDENTITY FULL;
ALTER TABLE public.campaigns REPLICA IDENTITY FULL;
ALTER TABLE public.templates REPLICA IDENTITY FULL;
ALTER TABLE public.automations REPLICA IDENTITY FULL;
ALTER TABLE public.whatsapp_credentials REPLICA IDENTITY FULL;
ALTER TABLE public.wa_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.wa_messages REPLICA IDENTITY FULL;