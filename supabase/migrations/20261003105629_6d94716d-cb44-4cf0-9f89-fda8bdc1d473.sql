REVOKE ALL ON FUNCTION public.sync_financial_payment_to_source() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_financial_payment_to_source() FROM anon;
REVOKE ALL ON FUNCTION public.sync_financial_payment_to_source() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_financial_payment_to_source() TO service_role;