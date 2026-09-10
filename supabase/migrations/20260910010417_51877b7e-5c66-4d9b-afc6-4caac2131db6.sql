-- 1. Remove duplicated triggers
DROP TRIGGER IF EXISTS trigger_sync_service_to_transaction ON public.services;
DROP TRIGGER IF EXISTS trigger_sync_work_record ON public.work_records;

-- 2. Cleanup duplicates by service_id (keep oldest)
DELETE FROM public.financial_transactions ft
USING (
  SELECT service_id, MIN(created_at) AS min_created, MIN(id::text) AS min_id
  FROM public.financial_transactions
  WHERE service_id IS NOT NULL
  GROUP BY service_id
  HAVING COUNT(*) > 1
) d
WHERE ft.service_id = d.service_id
  AND ft.id::text <> d.min_id;

-- 3. Cleanup duplicates by order_id (keep oldest)
DELETE FROM public.financial_transactions ft
USING (
  SELECT order_id, MIN(id::text) AS min_id
  FROM public.financial_transactions
  WHERE order_id IS NOT NULL
  GROUP BY order_id
  HAVING COUNT(*) > 1
) d
WHERE ft.order_id = d.order_id
  AND ft.id::text <> d.min_id;

-- 4. Cleanup duplicates by marker in description ([TRAB:...], [AGD-REC:...], [AGD-DESP:...])
WITH marked AS (
  SELECT id, description,
         (regexp_match(description, '\[(TRAB|AGD-REC|AGD-DESP):[0-9a-fA-F-]+\]'))[0] AS marker
  FROM public.financial_transactions
  WHERE description ~ '\[(TRAB|AGD-REC|AGD-DESP):[0-9a-fA-F-]+\]'
),
dups AS (
  SELECT marker, MIN(id::text) AS min_id
  FROM marked
  GROUP BY marker
  HAVING COUNT(*) > 1
)
DELETE FROM public.financial_transactions ft
USING marked m, dups d
WHERE ft.id = m.id
  AND m.marker = d.marker
  AND ft.id::text <> d.min_id;

-- 5. Prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS uniq_financial_tx_service
  ON public.financial_transactions (service_id) WHERE service_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_financial_tx_order
  ON public.financial_transactions (order_id) WHERE order_id IS NOT NULL;

-- 6. Performance indexes
CREATE INDEX IF NOT EXISTS idx_ft_user_year_month ON public.financial_transactions (user_id, year, month);
CREATE INDEX IF NOT EXISTS idx_ft_user_created_at ON public.financial_transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ft_user_due_open ON public.financial_transactions (user_id, due_date) WHERE paid_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders (user_id);
CREATE INDEX IF NOT EXISTS idx_work_records_user_employee ON public.work_records (user_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_appointments_user_date ON public.appointments (user_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_patients_user_id ON public.patients (user_id);