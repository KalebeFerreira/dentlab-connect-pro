-- Fix 1: Remove public read on order-files signatures and require authenticated owner access
DROP POLICY IF EXISTS "Public signature access" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own signatures" ON storage.objects;

CREATE POLICY "Users can view their own signatures"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'order-files'
  AND (storage.foldername(name))[1] = 'signatures'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Fix 2: Add UPDATE policy for certificates path in laboratory-files to match INSERT/SELECT/DELETE
DROP POLICY IF EXISTS "Users can update their own certificates" ON storage.objects;

CREATE POLICY "Users can update their own certificates"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'laboratory-files'
  AND (storage.foldername(name))[1] = 'certificates'
  AND (storage.foldername(name))[2] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'laboratory-files'
  AND (storage.foldername(name))[1] = 'certificates'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Fix 3: Restrict Realtime channel subscriptions to authenticated users only
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can receive realtime broadcasts" ON realtime.messages;
CREATE POLICY "Authenticated users can receive realtime broadcasts"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can send realtime broadcasts" ON realtime.messages;
CREATE POLICY "Authenticated users can send realtime broadcasts"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (true);