
-- 1) New columns on appointments
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS treatment_value numeric,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS paid_at date,
  ADD COLUMN IF NOT EXISTS due_date date;

-- 2) Sync APPOINTMENT -> financial_transactions (treatment receipt + dentist payment expense)
CREATE OR REPLACE FUNCTION public.sync_appointment_to_transactions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_name text;
  v_month int;
  v_year int;
  v_due date;
  v_paid date;
  v_pay_status text;
  v_status text;
  v_rec_amount numeric;
  v_exp_amount numeric;
  v_uid uuid;
  v_appt_id uuid;
  v_appt_date date;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.financial_transactions WHERE description LIKE '%[AGD-REC:' || OLD.id || ']%';
    DELETE FROM public.financial_transactions WHERE description LIKE '%[AGD-DESP:' || OLD.id || ']%';
    RETURN OLD;
  END IF;

  v_uid := NEW.user_id;
  v_appt_id := NEW.id;
  v_appt_date := (NEW.appointment_date)::date;
  v_month := EXTRACT(MONTH FROM v_appt_date)::int;
  v_year := EXTRACT(YEAR FROM v_appt_date)::int;

  SELECT name INTO v_patient_name FROM public.patients WHERE id = NEW.patient_id;

  -- Only sync when status = completed; otherwise remove any existing pair
  IF NEW.status <> 'completed' THEN
    DELETE FROM public.financial_transactions WHERE description LIKE '%[AGD-REC:' || v_appt_id || ']%';
    DELETE FROM public.financial_transactions WHERE description LIKE '%[AGD-DESP:' || v_appt_id || ']%';
    RETURN NEW;
  END IF;

  -- ===== Receita: tratamento =====
  v_rec_amount := COALESCE(NEW.treatment_value, 0);
  IF v_rec_amount > 0 THEN
    v_due := COALESCE(NEW.due_date,
              CASE WHEN COALESCE(NEW.payment_method,'a_vista') = 'a_prazo'
                   THEN v_appt_date + INTERVAL '30 days'
                   ELSE v_appt_date END);
    v_paid := CASE WHEN COALESCE(NEW.payment_method,'a_vista') = 'a_vista'
                   THEN COALESCE(NEW.paid_at, v_appt_date)
                   ELSE NEW.paid_at END;
    v_pay_status := CASE
      WHEN v_paid IS NOT NULL THEN 'pago'
      WHEN v_due < CURRENT_DATE THEN 'vencido'
      ELSE 'pendente' END;
    v_status := CASE WHEN v_paid IS NOT NULL THEN 'completed' ELSE 'pending' END;

    IF EXISTS (SELECT 1 FROM public.financial_transactions WHERE description LIKE '%[AGD-REC:' || v_appt_id || ']%') THEN
      UPDATE public.financial_transactions SET
        amount = v_rec_amount,
        description = 'Tratamento - ' || COALESCE(v_patient_name,'paciente') || COALESCE(' - ' || NEW.procedure_type, '') || ' [AGD-REC:' || v_appt_id || ']',
        status = v_status,
        month = v_month,
        year = v_year,
        category = 'Tratamento',
        payment_method = NEW.payment_method,
        due_date = v_due,
        paid_at = v_paid,
        payment_status = v_pay_status,
        updated_at = now()
      WHERE description LIKE '%[AGD-REC:' || v_appt_id || ']%';
    ELSE
      INSERT INTO public.financial_transactions (
        user_id, transaction_type, amount, description, status, month, year,
        category, payment_method, due_date, paid_at, payment_status
      ) VALUES (
        v_uid, 'receipt', v_rec_amount,
        'Tratamento - ' || COALESCE(v_patient_name,'paciente') || COALESCE(' - ' || NEW.procedure_type, '') || ' [AGD-REC:' || v_appt_id || ']',
        v_status, v_month, v_year, 'Tratamento', NEW.payment_method, v_due, v_paid, v_pay_status
      );
    END IF;
  ELSE
    DELETE FROM public.financial_transactions WHERE description LIKE '%[AGD-REC:' || v_appt_id || ']%';
  END IF;

  -- ===== Despesa: pagamento ao dentista =====
  v_exp_amount := COALESCE(NEW.dentist_payment, 0);
  IF v_exp_amount > 0 THEN
    IF EXISTS (SELECT 1 FROM public.financial_transactions WHERE description LIKE '%[AGD-DESP:' || v_appt_id || ']%') THEN
      UPDATE public.financial_transactions SET
        amount = v_exp_amount,
        description = 'Pagamento dentista - ' || COALESCE(v_patient_name,'paciente') || COALESCE(' - ' || NEW.procedure_type, '') || ' [AGD-DESP:' || v_appt_id || ']',
        status = 'pending',
        month = v_month,
        year = v_year,
        category = 'Pagamento Dentista',
        updated_at = now()
      WHERE description LIKE '%[AGD-DESP:' || v_appt_id || ']%';
    ELSE
      INSERT INTO public.financial_transactions (
        user_id, transaction_type, amount, description, status, month, year, category
      ) VALUES (
        v_uid, 'expense', v_exp_amount,
        'Pagamento dentista - ' || COALESCE(v_patient_name,'paciente') || COALESCE(' - ' || NEW.procedure_type, '') || ' [AGD-DESP:' || v_appt_id || ']',
        'pending', v_month, v_year, 'Pagamento Dentista'
      );
    END IF;
  ELSE
    DELETE FROM public.financial_transactions WHERE description LIKE '%[AGD-DESP:' || v_appt_id || ']%';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_appointment_to_transactions ON public.appointments;
CREATE TRIGGER trg_sync_appointment_to_transactions
AFTER INSERT OR UPDATE OR DELETE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.sync_appointment_to_transactions();

-- 3) Sync ORDER -> financial_transactions (laboratory expense on completion)
CREATE OR REPLACE FUNCTION public.sync_order_to_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month int;
  v_year int;
  v_base_date date;
  v_amount numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.financial_transactions WHERE description LIKE '%[ORD:' || OLD.id || ']%';
    RETURN OLD;
  END IF;

  v_amount := COALESCE(NEW.amount, 0);
  v_base_date := COALESCE((NEW.delivery_date)::date, (NEW.entry_date)::date, (NEW.created_at)::date);
  v_month := EXTRACT(MONTH FROM v_base_date)::int;
  v_year := EXTRACT(YEAR FROM v_base_date)::int;

  IF NEW.status <> 'completed' OR v_amount <= 0 THEN
    DELETE FROM public.financial_transactions WHERE description LIKE '%[ORD:' || NEW.id || ']%';
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.financial_transactions WHERE description LIKE '%[ORD:' || NEW.id || ']%') THEN
    UPDATE public.financial_transactions SET
      amount = v_amount,
      description = 'Laboratório - ' || NEW.work_type || COALESCE(' - ' || NEW.patient_name, '') || ' [ORD:' || NEW.id || ']',
      status = 'pending',
      month = v_month,
      year = v_year,
      category = 'Laboratório',
      order_id = NEW.id,
      updated_at = now()
    WHERE description LIKE '%[ORD:' || NEW.id || ']%';
  ELSE
    INSERT INTO public.financial_transactions (
      user_id, order_id, transaction_type, amount, description, status, month, year, category
    ) VALUES (
      NEW.user_id, NEW.id, 'expense', v_amount,
      'Laboratório - ' || NEW.work_type || COALESCE(' - ' || NEW.patient_name, '') || ' [ORD:' || NEW.id || ']',
      'pending', v_month, v_year, 'Laboratório'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_order_to_transaction ON public.orders;
CREATE TRIGGER trg_sync_order_to_transaction
AFTER INSERT OR UPDATE OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.sync_order_to_transaction();

-- 4) Bind already-existing functions that had no trigger
DROP TRIGGER IF EXISTS trg_sync_service_to_transaction ON public.services;
CREATE TRIGGER trg_sync_service_to_transaction
AFTER INSERT OR UPDATE OR DELETE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.sync_service_to_transaction();

DROP TRIGGER IF EXISTS trg_sync_work_record_to_transaction ON public.work_records;
CREATE TRIGGER trg_sync_work_record_to_transaction
AFTER INSERT OR UPDATE OR DELETE ON public.work_records
FOR EACH ROW EXECUTE FUNCTION public.sync_work_record_to_transaction();
