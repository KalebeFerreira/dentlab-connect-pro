-- Add contact fields to employees table
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS email text;

-- Add value and deadline fields to work_records
ALTER TABLE public.work_records 
ADD COLUMN IF NOT EXISTS value numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS deadline date;

-- Create function to sync work records to financial transactions
CREATE OR REPLACE FUNCTION public.sync_work_record_to_transaction()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create transaction when work is finished and has value
  IF NEW.status = 'finished' AND NEW.value > 0 THEN
    -- Check if transaction already exists for this work record
    IF NOT EXISTS (
      SELECT 1 FROM public.financial_transactions 
      WHERE description LIKE '%[PROD:' || NEW.id || ']%'
    ) THEN
      INSERT INTO public.financial_transactions (
        user_id,
        transaction_type,
        amount,
        description,
        status,
        category,
        month,
        year
      ) VALUES (
        NEW.user_id,
        'receipt',
        NEW.value,
        'Produção: ' || NEW.work_type || ' [PROD:' || NEW.id || ']',
        'completed',
        'Produção Laboratório',
        EXTRACT(MONTH FROM COALESCE(NEW.end_date, CURRENT_DATE))::integer,
        EXTRACT(YEAR FROM COALESCE(NEW.end_date, CURRENT_DATE))::integer
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for automatic financial sync
DROP TRIGGER IF EXISTS trigger_sync_work_record ON public.work_records;
CREATE TRIGGER trigger_sync_work_record
  AFTER INSERT OR UPDATE ON public.work_records
  FOR EACH ROW EXECUTE FUNCTION public.sync_work_record_to_transaction();