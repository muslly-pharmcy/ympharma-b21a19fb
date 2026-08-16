
REVOKE EXECUTE ON FUNCTION public.run_retention_policy() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_retention_policy() TO service_role;
