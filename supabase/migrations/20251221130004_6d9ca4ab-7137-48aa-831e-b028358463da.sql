-- Create table for scanned documents history
CREATE TABLE public.scanned_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  clinic_name TEXT,
  patient_name TEXT,
  service_name TEXT,
  service_value NUMERIC,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scanned_documents ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own scanned documents"
ON public.scanned_documents FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scanned documents"
ON public.scanned_documents FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scanned documents"
ON public.scanned_documents FOR DELETE
USING (auth.uid() = user_id);

-- Create storage bucket for scanned document images
INSERT INTO storage.buckets (id, name, public)
VALUES ('scanned-documents', 'scanned-documents', true);

-- Storage policies
CREATE POLICY "Users can upload scanned documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'scanned-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their scanned documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'scanned-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their scanned documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'scanned-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public can view scanned documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'scanned-documents');