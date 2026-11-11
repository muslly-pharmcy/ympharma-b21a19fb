-- Phase 1 security remediation, applied to MUSALLY PHARMA as
-- Supabase migration 20261111213535 / lock_legacy_accounting_inventory_rpcs_20261112.
-- Legacy functions have no caller membership or auth.uid() checks.
-- Restrict to trusted service_role and Postgres owner; no data rows are changed.
REVOKE ALL ON FUNCTION public.acc_next_no(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.acc_post_entry(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inv_consume_fefo(uuid, uuid, numeric, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inv_movements_apply() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sal_approve_invoice(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.acc_next_no(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.acc_post_entry(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.inv_consume_fefo(uuid, uuid, numeric, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.inv_movements_apply() TO service_role;
GRANT EXECUTE ON FUNCTION public.sal_approve_invoice(uuid) TO service_role;

ALTER FUNCTION public.inv_consume_fefo(uuid, uuid, numeric, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.inv_movements_apply() SET search_path = public, pg_temp;

DO $$
DECLARE sig text;
BEGIN
  FOREACH sig IN ARRAY ARRAY[
    'public.acc_next_no(uuid,text)',
    'public.acc_post_entry(uuid,uuid)',
    'public.inv_consume_fefo(uuid,uuid,numeric,uuid)',
    'public.inv_movements_apply()',
    'public.sal_approve_invoice(uuid)'
  ] LOOP
    IF has_function_privilege('anon', sig, 'EXECUTE')
       OR has_function_privilege('authenticated', sig, 'EXECUTE')
       OR NOT has_function_privilege('service_role', sig, 'EXECUTE')
    THEN
      RAISE EXCEPTION 'Unsafe RPC permissions remain on %', sig;
    END IF;
  END LOOP;
END $$;
