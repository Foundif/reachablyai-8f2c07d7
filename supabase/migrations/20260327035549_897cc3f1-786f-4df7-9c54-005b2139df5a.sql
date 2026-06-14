
-- Create storage bucket for salon assets (logos, etc.)
INSERT INTO storage.buckets (id, name, public) VALUES ('salon-assets', 'salon-assets', true) ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload their own logos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'salon-assets' AND (storage.foldername(name))[1] = 'logos' AND (storage.foldername(name))[2] = auth.uid()::text);

-- Allow public read access
CREATE POLICY "Public read access for salon assets" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'salon-assets');

-- Allow users to update their own logos
CREATE POLICY "Users can update their own logos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'salon-assets' AND (storage.foldername(name))[1] = 'logos' AND (storage.foldername(name))[2] = auth.uid()::text);
