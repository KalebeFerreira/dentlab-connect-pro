-- First, drop the existing check constraint
ALTER TABLE public.financial_transactions 
DROP CONSTRAINT IF EXISTS financial_transactions_transaction_type_check;

-- Add the new check constraint that includes 'expense' as a valid type
ALTER TABLE public.financial_transactions 
ADD CONSTRAINT financial_transactions_transaction_type_check 
CHECK (transaction_type IN ('receipt', 'expense', 'income', 'payment'));