-- Create storage policies for laboratory-files bucket signatures folder
-- Allow authenticated users to upload their own signatures
CREATE POLICY "Users can upload their own signatures"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'laboratory-files' 
  AND (storage.foldername(name))[1] = 'signatures'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- Allow authenticated users to view their own signatures
CREATE POLICY "Users can view their own signatures"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'laboratory-files' 
  AND (storage.foldername(name))[1] = 'signatures'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- Allow authenticated users to delete their own signatures
CREATE POLICY "Users can delete their own signatures"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'laboratory-files' 
  AND (storage.foldername(name))[1] = 'signatures'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- Create storage policies for certificates folder
-- Allow authenticated users to upload their own certificates
CREATE POLICY "Users can upload their own certificates"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'laboratory-files' 
  AND (storage.foldername(name))[1] = 'certificates'
);

-- Allow authenticated users to view certificates
CREATE POLICY "Users can view certificates"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'laboratory-files' 
  AND (storage.foldername(name))[1] = 'certificates'
);