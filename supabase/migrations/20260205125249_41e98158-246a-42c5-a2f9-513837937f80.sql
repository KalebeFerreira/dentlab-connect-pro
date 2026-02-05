-- Update the trigger to create expense for ANY work record with value, not just finished ones
CREATE OR REPLACE FUNCTION public.sync_work_record_to_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- For INSERT: Create expense transaction immediately if work has a value
  IF TG_OP = 'INSERT' THEN
    IF NEW.value IS NOT NULL AND NEW.value > 0 THEN
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
        'expense',
        NEW.value,
        'Pagamento funcionário - ' || NEW.work_type || COALESCE(' - ' || NEW.patient_name, '') || ' [TRAB:' || NEW.id || ']',
        CASE WHEN NEW.status = 'finished' THEN 'completed' ELSE 'pending' END,
        EXTRACT(MONTH FROM CURRENT_DATE)::integer,
        EXTRACT(YEAR FROM CURRENT_DATE)::integer,
        'Mão de Obra'
      );
    END IF;
    RETURN NEW;
  
  -- For UPDATE: Update existing transaction or create if value was added
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.value IS NOT NULL AND NEW.value > 0 THEN
      -- Check if transaction exists
      IF EXISTS (SELECT 1 FROM public.financial_transactions WHERE description LIKE '%[TRAB:' || NEW.id || ']%') THEN
        -- Update existing transaction
        UPDATE public.financial_transactions
        SET 
          amount = NEW.value,
          description = 'Pagamento funcionário - ' || NEW.work_type || COALESCE(' - ' || NEW.patient_name, '') || ' [TRAB:' || NEW.id || ']',
          status = CASE WHEN NEW.status = 'finished' THEN 'completed' ELSE 'pending' END,
          updated_at = now()
        WHERE description LIKE '%[TRAB:' || NEW.id || ']%';
      ELSE
        -- Create new transaction
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
          'expense',
          NEW.value,
          'Pagamento funcionário - ' || NEW.work_type || COALESCE(' - ' || NEW.patient_name, '') || ' [TRAB:' || NEW.id || ']',
          CASE WHEN NEW.status = 'finished' THEN 'completed' ELSE 'pending' END,
          EXTRACT(MONTH FROM CURRENT_DATE)::integer,
          EXTRACT(YEAR FROM CURRENT_DATE)::integer,
          'Mão de Obra'
        );
      END IF;
    ELSIF OLD.value IS NOT NULL AND OLD.value > 0 AND (NEW.value IS NULL OR NEW.value = 0) THEN
      -- Value was removed, delete the transaction
      DELETE FROM public.financial_transactions WHERE description LIKE '%[TRAB:' || NEW.id || ']%';
    END IF;
    RETURN NEW;
  
  -- For DELETE: Remove the transaction
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.financial_transactions WHERE description LIKE '%[TRAB:' || OLD.id || ']%';
    RETURN OLD;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_sync_work_record ON public.work_records;

-- Create trigger for INSERT, UPDATE, and DELETE
CREATE TRIGGER trigger_sync_work_record
AFTER INSERT OR UPDATE OR DELETE ON public.work_records
FOR EACH ROW
EXECUTE FUNCTION public.sync_work_record_to_transaction();