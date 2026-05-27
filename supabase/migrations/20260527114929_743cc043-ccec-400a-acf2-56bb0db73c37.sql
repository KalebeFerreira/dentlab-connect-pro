
-- Fix storage policies
DROP POLICY IF EXISTS "Users can upload their own certificates" ON storage.objects;
DROP POLICY IF EXISTS "Users can view certificates" ON storage.objects;

CREATE POLICY "Users can upload their own certificates"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'laboratory-files'
  AND (storage.foldername(name))[1] = 'certificates'
  AND (auth.uid())::text = (storage.foldername(name))[2]
);

CREATE POLICY "Users can view their own certificates"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'laboratory-files'
  AND (storage.foldername(name))[1] = 'certificates'
  AND (auth.uid())::text = (storage.foldername(name))[2]
);

-- Fix order-files signatures upload: scope to owning user folder
DROP POLICY IF EXISTS "Users can upload signatures" ON storage.objects;
CREATE POLICY "Users can upload signatures"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'order-files'
  AND (storage.foldername(name))[1] = 'signatures'
  AND (auth.uid())::text = (storage.foldername(name))[2]
);

-- Restrict campaign-media SELECT to authenticated users (owner-scoped read)
DROP POLICY IF EXISTS "Users can view campaign media" ON storage.objects;
CREATE POLICY "Users can view their own campaign media"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'campaign-media'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Make campaign-media bucket private to stop public listing/reading
UPDATE storage.buckets SET public = false WHERE id = 'campaign-media';

-- Restrict public laboratory_info exposure to clinics and dentists only
DROP POLICY IF EXISTS "Public laboratories are viewable by authenticated users" ON public.laboratory_info;
CREATE POLICY "Public laboratories viewable by clinics and dentists"
ON public.laboratory_info FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR (
    is_public = true
    AND (
      public.has_role(auth.uid(), 'clinic'::app_role)
      OR public.has_role(auth.uid(), 'dentist'::app_role)
    )
  )
);
