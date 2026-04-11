-- Create function to get monthly invoice stats for dashboard
CREATE OR REPLACE FUNCTION public.get_monthly_invoice_stats(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  total_count INTEGER;
  emitted_count INTEGER;
  error_count INTEGER;
  current_month INTEGER := EXTRACT(MONTH FROM CURRENT_DATE);
  current_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
BEGIN
  -- Total invoices this month
  SELECT COUNT(*) INTO total_count
  FROM public.invoices
  WHERE user_id = p_user_id
    AND EXTRACT(MONTH FROM created_at) = current_month
    AND EXTRACT(YEAR FROM created_at) = current_year;

  -- Emitted invoices this month
  SELECT COUNT(*) INTO emitted_count
  FROM public.invoices
  WHERE user_id = p_user_id
    AND status = 'emitida'
    AND EXTRACT(MONTH FROM created_at) = current_month
    AND EXTRACT(YEAR FROM created_at) = current_year;

  -- Error invoices this month
  SELECT COUNT(*) INTO error_count
  FROM public.invoices
  WHERE user_id = p_user_id
    AND status = 'erro'
    AND EXTRACT(MONTH FROM created_at) = current_month
    AND EXTRACT(YEAR FROM created_at) = current_year;

  RETURN json_build_object(
    'total', COALESCE(total_count, 0),
    'emitted', COALESCE(emitted_count, 0),
    'error', COALESCE(error_count, 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;