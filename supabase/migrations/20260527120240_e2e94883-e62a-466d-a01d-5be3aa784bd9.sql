-- 1. Fix campaign-media upload to enforce folder ownership
DROP POLICY IF EXISTS "Authenticated users can upload campaign media" ON storage.objects;
CREATE POLICY "Users can upload to own campaign-media folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'campaign-media'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- 2. Make laboratory-files private
UPDATE storage.buckets SET public = false WHERE id = 'laboratory-files';

-- 3. Make scanned-documents private
UPDATE storage.buckets SET public = false WHERE id = 'scanned-documents';