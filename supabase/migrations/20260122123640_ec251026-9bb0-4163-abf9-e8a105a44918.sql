-- Add category column to financial_transactions table
ALTER TABLE public.financial_transactions 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT NULL;

-- Add category column to financial_scanned_documents table
ALTER TABLE public.financial_scanned_documents 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.financial_transactions.category IS 'Category for expenses: materials, fixed_costs, suppliers, services, other';
COMMENT ON COLUMN public.financial_scanned_documents.category IS 'Category for expenses: materials, fixed_costs, suppliers, services, other';