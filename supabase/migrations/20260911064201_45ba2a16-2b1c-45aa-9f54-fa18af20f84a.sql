CREATE POLICY "Users can upload their own feedback screenshots"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'feedback-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND lower(storage.extension(name)) IN ('png', 'jpg', 'jpeg', 'webp')
);
CREATE POLICY "Users can view their own feedback screenshots"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'feedback-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
CREATE POLICY "Users can remove their own feedback screenshots"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'feedback-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);