
-- 1. Fix user_subscriptions: Remove user INSERT and UPDATE policies (only service role/stripe webhook should manage)
DROP POLICY IF EXISTS "Users can insert their own subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can update their own subscription" ON public.user_subscriptions;

-- 2. Fix scanned-documents storage: Remove public SELECT policy, add user-scoped one
DROP POLICY IF EXISTS "Public can view scanned documents" ON storage.objects;

CREATE POLICY "Users can view their own scanned documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'scanned-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 3. Fix function search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
