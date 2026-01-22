-- Create table for financial document scan history
CREATE TABLE public.financial_scanned_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT DEFAULT 'image/jpeg',
  transaction_type TEXT, -- 'receipt' or 'payment'
  amount NUMERIC,
  description TEXT,
  vendor_name TEXT,
  document_number TEXT,
  document_date DATE,
  transaction_id UUID REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.financial_scanned_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own financial scanned documents"
ON public.financial_scanned_documents FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own financial scanned documents"
ON public.financial_scanned_documents FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own financial scanned documents"
ON public.financial_scanned_documents FOR DELETE
USING (auth.uid() = user_id);