REVOKE EXECUTE ON FUNCTION public.admin_list_cron_jobs() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_cron_runs(integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.monitor_cron_failures() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_invoice_number() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prescription_file_count(text) FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_list_cron_jobs() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_cron_runs(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.monitor_cron_failures() TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_invoice_number() TO service_role;
GRANT EXECUTE ON FUNCTION public.prescription_file_count(text) TO authenticated, service_role;
