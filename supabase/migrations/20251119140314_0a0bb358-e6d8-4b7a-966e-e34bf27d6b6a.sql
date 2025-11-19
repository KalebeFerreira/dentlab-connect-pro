-- Fix the trigger to use correct transaction_type value
CREATE OR REPLACE FUNCTION sync_service_to_transaction()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Create a new transaction when a service is created
    INSERT INTO financial_transactions (
      user_id,
      service_id,
      transaction_type,
      amount,
      description,
      status,
      month,
      year
    ) VALUES (
      NEW.user_id,
      NEW.id,
      'receipt',
      NEW.service_value,
      CONCAT('Serviço: ', NEW.service_name, COALESCE(' - Cliente: ' || NEW.client_name, '')),
      CASE 
        WHEN NEW.status = 'active' THEN 'completed'
        WHEN NEW.status = 'deleted' THEN 'cancelled'
        ELSE 'pending'
      END,
      EXTRACT(MONTH FROM NEW.service_date)::integer,
      EXTRACT(YEAR FROM NEW.service_date)::integer
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Update the corresponding transaction when service is updated
    UPDATE financial_transactions
    SET 
      amount = NEW.service_value,
      description = CONCAT('Serviço: ', NEW.service_name, COALESCE(' - Cliente: ' || NEW.client_name, '')),
      status = CASE 
        WHEN NEW.status = 'active' THEN 'completed'
        WHEN NEW.status = 'deleted' THEN 'cancelled'
        ELSE 'pending'
      END,
      month = EXTRACT(MONTH FROM NEW.service_date)::integer,
      year = EXTRACT(YEAR FROM NEW.service_date)::integer,
      updated_at = now()
    WHERE service_id = NEW.id;
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Delete the corresponding transaction when service is deleted
    DELETE FROM financial_transactions WHERE service_id = OLD.id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;