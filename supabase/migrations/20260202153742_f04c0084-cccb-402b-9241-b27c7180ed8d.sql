-- Remove duplicate triggers that are causing double entries
DROP TRIGGER IF EXISTS on_service_create_financial ON public.services;
DROP TRIGGER IF EXISTS on_service_update_financial ON public.services;
DROP TRIGGER IF EXISTS on_service_delete_cascade_financial ON public.services;

-- Keep only the sync_service_to_transaction trigger which handles all operations (INSERT, UPDATE, DELETE)
-- The trigger_sync_service_to_transaction already exists and handles everything

-- Also remove the duplicate functions that are no longer needed
DROP FUNCTION IF EXISTS public.create_financial_transaction_from_service();
DROP FUNCTION IF EXISTS public.update_financial_transaction_from_service();
DROP FUNCTION IF EXISTS public.delete_related_financial_transaction();