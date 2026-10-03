CREATE OR REPLACE FUNCTION public.mark_client_overdue_paid(p_client_name text)
RETURNS TABLE(updated_count integer, updated_amount numeric)
LANGUAGE plpgsql
SECURITY DEFINER
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

REVOKE ALL ON FUNCTION public.mark_client_overdue_paid(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_client_overdue_paid(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_client_overdue_paid(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_client_overdue_paid(text) TO service_role;

CREATE OR REPLACE FUNCTION public.get_client_payment_insights(p_user_id uuid)
RETURNS TABLE(client_name text, total_invoices integer, paid_on_time integer, paid_late integer, open_overdue integer, open_overdue_amount numeric, total_amount numeric, on_time_rate numeric, classification text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      s.client_name,
      s.service_value,
      s.due_date,
      COALESCE(ft.paid_at, s.paid_at) AS effective_paid_at
    FROM public.services s
    LEFT JOIN public.financial_transactions ft
      ON ft.service_id = s.id
     AND ft.user_id = s.user_id
    LEFT JOIN public.client_payment_profiles cpp
      ON cpp.user_id = s.user_id
     AND lower(trim(cpp.client_name)) = lower(trim(s.client_name))
    WHERE s.user_id = p_user_id
      AND p_user_id = auth.uid()
      AND s.client_name IS NOT NULL
      AND s.status = 'active'
      AND s.service_date >= (CURRENT_DATE - INTERVAL '6 months')
      AND cpp.archived_at IS NULL
  ),
  agg AS (
    SELECT
      client_name,
      COUNT(*)::int AS total_invoices,
      COUNT(*) FILTER (WHERE effective_paid_at IS NOT NULL AND (due_date IS NULL OR effective_paid_at <= due_date))::int AS paid_on_time,
      COUNT(*) FILTER (WHERE effective_paid_at IS NOT NULL AND due_date IS NOT NULL AND effective_paid_at > due_date)::int AS paid_late,
      COUNT(*) FILTER (WHERE effective_paid_at IS NULL AND due_date < CURRENT_DATE)::int AS open_overdue,
      COALESCE(SUM(service_value) FILTER (WHERE effective_paid_at IS NULL AND due_date < CURRENT_DATE), 0) AS open_overdue_amount,
      COALESCE(SUM(service_value), 0) AS total_amount
    FROM base
    GROUP BY client_name
  )
  SELECT
    client_name,
    total_invoices,
    paid_on_time,
    paid_late,
    open_overdue,
    open_overdue_amount,
    total_amount,
    CASE WHEN total_invoices > 0
      THEN ROUND((paid_on_time::numeric / total_invoices) * 100, 1)
      ELSE 0 END AS on_time_rate,
    CASE
      WHEN open_overdue > 0 THEN 'inadimplente'
      WHEN total_invoices >= 2 AND (paid_on_time::numeric / total_invoices) >= 0.9 THEN 'bom_pagador'
      ELSE 'regular'
    END AS classification
  FROM agg
  ORDER BY open_overdue_amount DESC, total_amount DESC;
$$;