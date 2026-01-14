-- Drop the duplicate function with reversed parameter order
DROP FUNCTION IF EXISTS public.get_next_document_number(p_document_type text, p_user_id uuid);

-- Keep only the original function with (p_user_id, p_document_type) order
-- which is already defined correctly