CREATE OR REPLACE FUNCTION public.mark_client_overdue_paid(p_client_name text)
RETURNS TABLE(updated_count integer, updated_amount numeric)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_today date := CURRENT_DATE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NULLIF(trim(p_client_name), '') IS NULL THEN
    RAISE EXCEPTION 'Client name is required';
  END IF;

  RETURN QUERY
  WITH targets AS (
    SELECT s.id, s.service_value
    FROM public.services s
    WHERE s.user_id = v_user_id
      AND s.status = 'active'
      AND s.paid_at IS NULL
      AND s.due_date < v_today
      AND lower(trim(s.client_name)) = lower(trim(p_client_name))
    FOR UPDATE
  ), updated AS (
    UPDATE public.services s
    SET paid_at = v_today,
        payment_status = 'pago'
    FROM targets t
    WHERE s.id = t.id
    RETURNING t.service_value
  )
  SELECT COUNT(*)::integer, COALESCE(SUM(updated.service_value), 0)::numeric
  FROM updated;
END;
$$;