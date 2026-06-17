
DROP POLICY IF EXISTS "Users can view their laboratory files" ON storage.objects;
CREATE POLICY "Users can view their laboratory files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'laboratory-files'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND COALESCE((storage.foldername(name))[1], '') NOT IN ('certificates','signatures')
);

ALTER PUBLICATION supabase_realtime DROP TABLE public.mercadopago_webhook_logs;

DROP POLICY IF EXISTS "Employees can view their own work records" ON public.work_records;
CREATE POLICY "Employees can view their own work records"
ON public.work_records FOR SELECT
USING (
  employee_id = get_employee_id(auth.uid())
  AND user_id = get_employee_owner_id(auth.uid())
);
