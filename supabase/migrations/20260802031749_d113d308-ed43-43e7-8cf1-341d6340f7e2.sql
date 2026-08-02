CREATE POLICY "chat media write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'salon-assets' AND (storage.foldername(name))[1] = 'chat-media');

CREATE POLICY "chat media update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'salon-assets' AND (storage.foldername(name))[1] = 'chat-media');

CREATE POLICY "chat media delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'salon-assets' AND (storage.foldername(name))[1] = 'chat-media');