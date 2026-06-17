
-- Add payment tracking fields to services
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'a_vista',
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS paid_at DATE,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pago';

-- Backfill due_date for existing rows
UPDATE public.services
SET due_date = service_date
WHERE due_date IS NULL;

-- Same fields on financial_transactions
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'a_vista',
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS paid_at DATE,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pago';

-- Trigger to compute payment_status on services
CREATE OR REPLACE FUNCTION public.compute_service_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_method = 'a_vista' AND NEW.paid_at IS NULL THEN
    NEW.paid_at := COALESCE(NEW.paid_at, NEW.service_date);
  END IF;

  IF NEW.due_date IS NULL THEN
    IF NEW.payment_method = 'a_prazo' THEN
      NEW.due_date := NEW.service_date + INTERVAL '30 days';
    ELSE
      NEW.due_date := NEW.service_date;
    END IF;
  END IF;

  IF NEW.paid_at IS NOT NULL THEN
    NEW.payment_status := 'pago';
  ELSIF NEW.due_date < CURRENT_DATE THEN
    NEW.payment_status := 'vencido';
  ELSE
    NEW.payment_status := 'pendente';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_service_payment_status ON public.services;
CREATE TRIGGER trg_compute_service_payment_status
BEFORE INSERT OR UPDATE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.compute_service_payment_status();

-- Update sync_service_to_transaction to propagate payment fields
CREATE OR REPLACE FUNCTION public.sync_service_to_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO financial_transactions (
      user_id, service_id, transaction_type, amount, description, status,
      month, year, payment_method, due_date, paid_at, payment_status
    ) VALUES (
      NEW.user_id, NEW.id, 'receipt', NEW.service_value,
      CONCAT('Serviço: ', NEW.service_name, COALESCE(' - Cliente: ' || NEW.client_name, '')),
      CASE WHEN NEW.status = 'active' THEN 'completed'
           WHEN NEW.status = 'deleted' THEN 'cancelled'
           ELSE 'pending' END,
      EXTRACT(MONTH FROM NEW.service_date)::integer,
      EXTRACT(YEAR FROM NEW.service_date)::integer,
      NEW.payment_method, NEW.due_date, NEW.paid_at, NEW.payment_status
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE financial_transactions
    SET amount = NEW.service_value,
        description = CONCAT('Serviço: ', NEW.service_name, COALESCE(' - Cliente: ' || NEW.client_name, '')),
        status = CASE WHEN NEW.status = 'active' THEN 'completed'
                      WHEN NEW.status = 'deleted' THEN 'cancelled'
                      ELSE 'pending' END,
        month = EXTRACT(MONTH FROM NEW.service_date)::integer,
        year = EXTRACT(YEAR FROM NEW.service_date)::integer,
        payment_method = NEW.payment_method,
        due_date = NEW.due_date,
        paid_at = NEW.paid_at,
        payment_status = NEW.payment_status,
        updated_at = now()
    WHERE service_id = NEW.id;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM financial_transactions WHERE service_id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Client payment classification function
CREATE OR REPLACE FUNCTION public.get_client_payment_insights(p_user_id uuid)
RETURNS TABLE (
  client_name TEXT,
  total_invoices INT,
  paid_on_time INT,
  paid_late INT,
  open_overdue INT,
  open_overdue_amount NUMERIC,
  total_amount NUMERIC,
  on_time_rate NUMERIC,
  classification TEXT
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      s.client_name,
      s.service_value,
      s.due_date,
      s.paid_at,
      s.payment_status
    FROM public.services s
    WHERE s.user_id = p_user_id
      AND s.client_name IS NOT NULL
      AND s.status = 'active'
      AND s.service_date >= (CURRENT_DATE - INTERVAL '6 months')
  ),
  agg AS (
    SELECT
      client_name,
      COUNT(*)::INT AS total_invoices,
      COUNT(*) FILTER (WHERE paid_at IS NOT NULL AND paid_at <= due_date)::INT AS paid_on_time,
      COUNT(*) FILTER (WHERE paid_at IS NOT NULL AND paid_at > due_date)::INT AS paid_late,
      COUNT(*) FILTER (WHERE paid_at IS NULL AND due_date < CURRENT_DATE - INTERVAL '15 days')::INT AS open_overdue,
      COALESCE(SUM(service_value) FILTER (WHERE paid_at IS NULL AND due_date < CURRENT_DATE), 0) AS open_overdue_amount,
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

GRANT EXECUTE ON FUNCTION public.get_client_payment_insights(uuid) TO authenticated, service_role;
