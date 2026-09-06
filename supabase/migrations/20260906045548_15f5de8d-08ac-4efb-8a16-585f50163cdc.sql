
DROP POLICY IF EXISTS "Public read access for salon assets" ON storage.objects;

CREATE POLICY "salon assets logo read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'salon-assets' AND (storage.foldername(name))[1] IN ('logos','pricelists'));

CREATE POLICY "chat media read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'salon-assets' AND (storage.foldername(name))[1] = 'chat-media'
       AND public.is_workspace_member(((storage.foldername(name))[2])::uuid, auth.uid()));

CREATE POLICY "template media read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'salon-assets' AND (storage.foldername(name))[1] = 'template-media'
       AND public.is_workspace_member(((storage.foldername(name))[2])::uuid, auth.uid()));
