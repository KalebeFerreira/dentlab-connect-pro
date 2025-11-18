-- Add address and logo fields to laboratory_info
ALTER TABLE public.laboratory_info
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS zip_code TEXT,
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Brasil';

-- Create storage bucket for laboratory files
INSERT INTO storage.buckets (id, name, public)
VALUES ('laboratory-files', 'laboratory-files', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for laboratory-files bucket
CREATE POLICY "Users can view their laboratory files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'laboratory-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload their laboratory files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'laboratory-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their laboratory files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'laboratory-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their laboratory files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'laboratory-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Create table for laboratory documents
CREATE TABLE IF NOT EXISTS public.laboratory_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  laboratory_id UUID REFERENCES public.laboratory_info(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on laboratory_documents
ALTER TABLE public.laboratory_documents ENABLE ROW LEVEL SECURITY;

-- Create policies for laboratory_documents
CREATE POLICY "Users can view their own documents"
ON public.laboratory_documents FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own documents"
ON public.laboratory_documents FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents"
ON public.laboratory_documents FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents"
ON public.laboratory_documents FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_laboratory_documents_updated_at
BEFORE UPDATE ON public.laboratory_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();