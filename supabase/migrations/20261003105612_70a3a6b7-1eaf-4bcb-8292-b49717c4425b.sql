ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.client_payment_profiles ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_patients_user_active ON public.patients (user_id, name) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_user_active_date ON public.appointments (user_id, appointment_date) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_user_active_created ON public.orders (user_id, created_at DESC) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_employees_user_active ON public.employees (user_id, name) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_client_profiles_user_active ON public.client_payment_profiles (user_id, client_name) WHERE archived_at IS NULL;

CREATE OR REPLACE FUNCTION public.sync_financial_payment_to_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.service_id IS NOT NULL AND (
    NEW.paid_at IS DISTINCT FROM OLD.paid_at OR
    NEW.payment_status IS DISTINCT FROM OLD.payment_status OR
    NEW.status IS DISTINCT FROM OLD.status
  ) THEN
    UPDATE public.services
    SET paid_at = NEW.paid_at,
        payment_status = CASE
          WHEN NEW.paid_at IS NOT NULL OR NEW.payment_status = 'pago' THEN 'pago'
          WHEN due_date IS NOT NULL AND due_date < CURRENT_DATE THEN 'vencido'
          ELSE 'pendente'
        END
    WHERE id = NEW.service_id
      AND (paid_at IS DISTINCT FROM NEW.paid_at OR payment_status IS DISTINCT FROM CASE
        WHEN NEW.paid_at IS NOT NULL OR NEW.payment_status = 'pago' THEN 'pago'
        WHEN due_date IS NOT NULL AND due_date < CURRENT_DATE THEN 'vencido'
        ELSE 'pendente'
      END);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_financial_payment_to_source ON public.financial_transactions;
CREATE TRIGGER trg_sync_financial_payment_to_source
AFTER UPDATE OF paid_at, payment_status, status ON public.financial_transactions
FOR EACH ROW
EXECUTE FUNCTION public.sync_financial_payment_to_source();

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
      COUNT(*) FILTER (WHERE effective_paid_at IS NULL AND due_date < CURRENT_DATE - INTERVAL '15 days')::int AS open_overdue,
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