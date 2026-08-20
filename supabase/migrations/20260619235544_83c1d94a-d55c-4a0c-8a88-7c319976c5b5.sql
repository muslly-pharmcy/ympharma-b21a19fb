
REVOKE EXECUTE ON FUNCTION public.rebuild_customer_intel() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_customer_intel() TO service_role;
