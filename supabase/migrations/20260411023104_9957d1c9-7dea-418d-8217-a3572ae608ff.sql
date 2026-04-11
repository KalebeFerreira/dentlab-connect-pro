
CREATE POLICY "fiscal_cert_upload_own"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'fiscal-certificates' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "fiscal_cert_view_own"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'fiscal-certificates' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "fiscal_cert_delete_own"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'fiscal-certificates' AND auth.uid()::text = (storage.foldername(name))[1]);
