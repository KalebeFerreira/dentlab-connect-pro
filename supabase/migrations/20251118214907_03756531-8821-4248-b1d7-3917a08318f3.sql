-- Add category field to laboratory_documents
ALTER TABLE public.laboratory_documents
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'geral';

-- Create index for better filtering performance
CREATE INDEX IF NOT EXISTS idx_laboratory_documents_category ON public.laboratory_documents(category);