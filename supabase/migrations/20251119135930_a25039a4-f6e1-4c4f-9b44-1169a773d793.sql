-- Add service_id column to financial_transactions to link with services
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES services(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_financial_transactions_service_id ON financial_transactions(service_id);

-- Function to sync service to financial transaction
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
      'income',
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

-- Create trigger for automatic sync
DROP TRIGGER IF EXISTS trigger_sync_service_to_transaction ON services;
CREATE TRIGGER trigger_sync_service_to_transaction
  AFTER INSERT OR UPDATE OR DELETE ON services
  FOR EACH ROW
  EXECUTE FUNCTION sync_service_to_transaction();

-- Enable realtime for both tables
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE services;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE financial_transactions;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;