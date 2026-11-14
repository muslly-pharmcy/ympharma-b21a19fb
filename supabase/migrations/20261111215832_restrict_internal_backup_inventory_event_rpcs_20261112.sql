-- Applied to linked MUSALLY PHARMA database on 2026-11-12
-- Supabase migration 20261111215832 / restrict_internal_backup_inventory_event_rpcs_20261112.
-- These internal tasks are executed by postgres-owned cron jobs or trusted
-- server-side producers; browser roles must not trigger them.
-- This migration changes only function ACLs, not financial or inventory rows.
REVOKE EXECUTE ON FUNCTION public.create_scheduled_backup(text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.inv_intel_snapshot()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.inv_emit_event(text, uuid, text, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_scheduled_backup(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.inv_intel_snapshot() TO service_role;
GRANT EXECUTE ON FUNCTION public.inv_emit_event(text, uuid, text, uuid, jsonb) TO service_role;

DO $$
DECLARE sig text;
BEGIN
  FOREACH sig IN ARRAY ARRAY[
    'public.create_scheduled_backup(text)',
    'public.inv_intel_snapshot()',
    'public.inv_emit_event(text,uuid,text,uuid,jsonb)'
  ] LOOP
    IF has_function_privilege('anon',sig,'EXECUTE')
       OR has_function_privilege('authenticated',sig,'EXECUTE')
       OR NOT has_function_privilege('service_role',sig,'EXECUTE') THEN
      RAISE EXCEPTION 'Unexpected privileged routine grants for %', sig;
    END IF;
  END LOOP;
END $$;
