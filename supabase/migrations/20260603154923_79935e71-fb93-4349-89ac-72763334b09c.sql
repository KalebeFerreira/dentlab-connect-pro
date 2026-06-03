
-- 1) Remove overly permissive Realtime policies
DROP POLICY IF EXISTS "Authenticated users can receive realtime broadcasts" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can send realtime broadcasts" ON realtime.messages;

-- 2) Add UPDATE policy to fiscal-certificates bucket scoped to owner folder
DROP POLICY IF EXISTS "Users can update their fiscal certificates" ON storage.objects;
CREATE POLICY "Users can update their fiscal certificates"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'fiscal-certificates'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'fiscal-certificates'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 3) Add DELETE policy for laboratory-files signatures subfolder scoped to owner
DROP POLICY IF EXISTS "Users can delete their laboratory signatures" ON storage.objects;
CREATE POLICY "Users can delete their laboratory signatures"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'laboratory-files'
  AND (storage.foldername(name))[1] = 'signatures'
  AND (storage.foldername(name))[2] = auth.uid()::text
);
