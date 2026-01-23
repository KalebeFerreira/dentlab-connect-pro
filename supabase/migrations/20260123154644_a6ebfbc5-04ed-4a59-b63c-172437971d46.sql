-- Create function to delete related financial transaction when service is deleted
CREATE OR REPLACE FUNCTION public.delete_related_financial_transaction()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete any financial transaction linked to this service
  DELETE FROM public.financial_transactions 
  WHERE service_id = OLD.id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to automatically delete financial transaction when service is deleted
DROP TRIGGER IF EXISTS on_service_delete_cascade_financial ON public.services;

CREATE TRIGGER on_service_delete_cascade_financial
  BEFORE DELETE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_related_financial_transaction();

-- Also create a trigger to auto-create financial transaction when service is created
CREATE OR REPLACE FUNCTION public.create_financial_transaction_from_service()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-create a financial transaction for the new service
  INSERT INTO public.financial_transactions (
    user_id,
    service_id,
    amount,
    transaction_type,
    status,
    description,
    month,
    year
  ) VALUES (
    NEW.user_id,
    NEW.id,
    NEW.service_value,
    'receipt',
    'completed',
    COALESCE(NEW.client_name, '') || ' - ' || NEW.service_name,
    EXTRACT(MONTH FROM NEW.service_date)::integer,
    EXTRACT(YEAR FROM NEW.service_date)::integer
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for auto-creating financial transaction
DROP TRIGGER IF EXISTS on_service_create_financial ON public.services;

CREATE TRIGGER on_service_create_financial
  AFTER INSERT ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.create_financial_transaction_from_service();

-- Create function to update financial transaction when service is updated
CREATE OR REPLACE FUNCTION public.update_financial_transaction_from_service()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the related financial transaction
  UPDATE public.financial_transactions 
  SET 
    amount = NEW.service_value,
    description = COALESCE(NEW.client_name, '') || ' - ' || NEW.service_name,
    month = EXTRACT(MONTH FROM NEW.service_date)::integer,
    year = EXTRACT(YEAR FROM NEW.service_date)::integer,
    updated_at = now()
  WHERE service_id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for auto-updating financial transaction
DROP TRIGGER IF EXISTS on_service_update_financial ON public.services;

CREATE TRIGGER on_service_update_financial
  AFTER UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.update_financial_transaction_from_service();