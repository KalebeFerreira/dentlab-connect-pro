-- Fix 1: Tighten laboratory-files UPDATE policy to exclude certificates/ and signatures/ paths
DROP POLICY IF EXISTS "Users can update their laboratory files" ON storage.objects;

CREATE POLICY "Users can update their laboratory files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'laboratory-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND COALESCE((storage.foldername(name))[2], '') NOT IN ('certificates', 'signatures')
)
WITH CHECK (
  bucket_id = 'laboratory-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND COALESCE((storage.foldername(name))[2], '') NOT IN ('certificates', 'signatures')
);

-- Fix 2: Restrict realtime.messages to topics scoped to the authenticated user
DROP POLICY IF EXISTS "Authenticated users can read realtime messages" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can send realtime messages" ON realtime.messages;

CREATE POLICY "Users can subscribe to their own realtime topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE '%' || auth.uid()::text || '%'
);

CREATE POLICY "Users can send to their own realtime topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() LIKE '%' || auth.uid()::text || '%'
);