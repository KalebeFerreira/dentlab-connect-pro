-- Create table for document numbering control
CREATE TABLE public.document_numbers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('receipt', 'invoice')),
  last_number INTEGER NOT NULL DEFAULT 0,
  year INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, document_type, year)
);

-- Enable RLS
ALTER TABLE public.document_numbers ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own document numbers"
ON public.document_numbers
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own document numbers"
ON public.document_numbers
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own document numbers"
ON public.document_numbers
FOR UPDATE
USING (auth.uid() = user_id);

-- Create function to get next document number
CREATE OR REPLACE FUNCTION public.get_next_document_number(
  p_user_id UUID,
  p_document_type TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INTEGER;
  v_next_number INTEGER;
  v_formatted_number TEXT;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Insert or update the document number
  INSERT INTO public.document_numbers (user_id, document_type, year, last_number)
  VALUES (p_user_id, p_document_type, v_year, 1)
  ON CONFLICT (user_id, document_type, year)
  DO UPDATE SET 
    last_number = document_numbers.last_number + 1,
    updated_at = now()
  RETURNING last_number INTO v_next_number;
  
  -- Format the number based on document type
  IF p_document_type = 'receipt' THEN
    v_formatted_number := 'REC-' || v_year || '-' || LPAD(v_next_number::TEXT, 6, '0');
  ELSIF p_document_type = 'invoice' THEN
    v_formatted_number := 'NF-' || v_year || '-' || LPAD(v_next_number::TEXT, 6, '0');
  END IF;
  
  RETURN v_formatted_number;
END;
$$;

-- Add trigger for updated_at
CREATE TRIGGER update_document_numbers_updated_at
BEFORE UPDATE ON public.document_numbers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();