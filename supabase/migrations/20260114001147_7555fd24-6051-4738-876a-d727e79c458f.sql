-- Remove the overly permissive policy that exposes all data
DROP POLICY IF EXISTS "Function can manage document numbers" ON public.document_numbers;

-- The existing policies are correct:
-- "Users can read own document numbers" - SELECT with auth.uid() = user_id
-- "Users can insert their own document numbers" - INSERT with auth.uid() = user_id  
-- "Users can update their own document numbers" - UPDATE with auth.uid() = user_id
-- "Users can view their own document numbers" - SELECT with auth.uid() = user_id

-- For the get_next_document_number function to work, we need a SECURITY DEFINER function
-- that can access documents without RLS restrictions
CREATE OR REPLACE FUNCTION public.get_next_document_number(p_document_type text, p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year integer;
  v_next_number integer;
  v_result text;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Try to get existing record and increment
  UPDATE document_numbers 
  SET last_number = last_number + 1, updated_at = now()
  WHERE user_id = p_user_id 
    AND document_type = p_document_type 
    AND year = v_year
  RETURNING last_number INTO v_next_number;
  
  -- If no record exists, create one
  IF v_next_number IS NULL THEN
    INSERT INTO document_numbers (user_id, document_type, year, last_number)
    VALUES (p_user_id, p_document_type, v_year, 1)
    RETURNING last_number INTO v_next_number;
  END IF;
  
  -- Format: TYPE-YEAR-NUMBER (e.g., REC-2026-0001)
  v_result := UPPER(LEFT(p_document_type, 3)) || '-' || v_year || '-' || LPAD(v_next_number::text, 4, '0');
  
  RETURN v_result;
END;
$$;