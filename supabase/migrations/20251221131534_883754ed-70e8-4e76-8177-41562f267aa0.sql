-- Add file_type column to scanned_documents to support different file types
ALTER TABLE public.scanned_documents 
ADD COLUMN IF NOT EXISTS file_type TEXT DEFAULT 'image/jpeg';

-- Add file_name column to store original file name
ALTER TABLE public.scanned_documents 
ADD COLUMN IF NOT EXISTS file_name TEXT;