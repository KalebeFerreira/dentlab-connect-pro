-- Add patient_name and color columns to work_records
ALTER TABLE public.work_records 
ADD COLUMN IF NOT EXISTS patient_name text,
ADD COLUMN IF NOT EXISTS color text;

-- Fix the financial sync trigger - paying employee = expense (despesa)
CREATE OR REPLACE FUNCTION public.sync_work_record_to_transaction()
RETURNS TRIGGER AS $$
BEGIN
  -- When work is finished and has a value, create an EXPENSE transaction (paying the employee)
  IF NEW.status = 'finished' AND NEW.value IS NOT NULL AND NEW.value > 0 THEN
    -- Check if transaction already exists for this work record
    IF NOT EXISTS (
      SELECT 1 FROM public.financial_transactions 
      WHERE description LIKE '%[TRAB:' || NEW.id || ']%'
    ) THEN
      INSERT INTO public.financial_transactions (
        user_id,
        transaction_type,
        amount,
        description,
        status,
        month,
        year,
        category
      ) VALUES (
        NEW.user_id,
        'expense',  -- Changed from 'receipt' to 'expense' - paying employee is an expense
        NEW.value,
        'Pagamento funcionário - ' || NEW.work_type || COALESCE(' - ' || NEW.patient_name, '') || ' [TRAB:' || NEW.id || ']',
        'completed',
        EXTRACT(MONTH FROM CURRENT_DATE)::integer,
        EXTRACT(YEAR FROM CURRENT_DATE)::integer,
        'Mão de Obra'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;