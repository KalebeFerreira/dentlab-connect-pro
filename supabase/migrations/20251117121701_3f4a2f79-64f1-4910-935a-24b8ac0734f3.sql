-- Allow public read access to signature files
CREATE POLICY "Public signature access"
ON storage.objects
FOR SELECT
USING (bucket_id = 'order-files' AND (storage.foldername(name))[1] = 'signatures');

-- Allow authenticated users to upload signatures
CREATE POLICY "Users can upload signatures"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'order-files' AND (storage.foldername(name))[1] = 'signatures');