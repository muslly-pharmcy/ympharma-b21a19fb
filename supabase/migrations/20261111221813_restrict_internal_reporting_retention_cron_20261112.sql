-- Mirrors linked MUSALLY PHARMA Supabase migration 20261111221813
-- Restrict internal SECURITY DEFINER maintenance helpers to trusted server roles.
-- PostgreSQL owner retains cron execution. No business records mutated.
REVOKE EXECUTE ON FUNCTION public.monitor_cron_failures() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reconcile_inventory_mismatch() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_retention_policy() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.weekly_exec_report_build() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.monitor_cron_failures() TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_inventory_mismatch() TO service_role;
GRANT EXECUTE ON FUNCTION public.run_retention_policy() TO service_role;
GRANT EXECUTE ON FUNCTION public.weekly_exec_report_build() TO service_role;

DO $$
DECLARE signature text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.monitor_cron_failures()',
    'public.reconcile_inventory_mismatch()',
    'public.run_retention_policy()',
    'public.weekly_exec_report_build()'
  ] LOOP
    IF has_function_privilege('anon', signature, 'EXECUTE')
       OR has_function_privilege('authenticated', signature, 'EXECUTE')
       OR NOT has_function_privilege('service_role', signature, 'EXECUTE')
       OR NOT has_function_privilege('postgres', signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'Unsafe effective grant for %', signature;
    END IF;
  END LOOP;
END $$;
