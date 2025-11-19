-- Drop existing RLS policies on document_numbers if any
DROP POLICY IF EXISTS "Users can read own document numbers" ON public.document_numbers;
DROP POLICY IF EXISTS "Users can insert own document numbers" ON public.document_numbers;
DROP POLICY IF EXISTS "Users can update own document numbers" ON public.document_numbers;

-- Recreate the get_next_document_number function with proper security
CREATE OR REPLACE FUNCTION public.get_next_document_number(p_user_id uuid, p_document_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_year INTEGER;
  v_next_number INTEGER;
  v_formatted_number TEXT;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Insert or update the document number (bypasses RLS due to SECURITY DEFINER)
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

-- Grant execute permissions to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.get_next_document_number(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_document_number(uuid, text) TO service_role;

-- Create RLS policies for document_numbers table
CREATE POLICY "Users can read own document numbers"
  ON public.document_numbers
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Function can manage document numbers"
  ON public.document_numbers
  FOR ALL
  USING (true)
  WITH CHECK (true);