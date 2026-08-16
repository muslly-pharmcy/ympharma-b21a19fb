-- DB-P1-005 — Lock down SECURITY DEFINER functions in schema public
DO $$
DECLARE
  fn record;
  revoke_count integer := 0;
  grant_count  integer := 0;
BEGIN
  FOR fn IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS fn_name,
      pg_get_function_identity_arguments(p.oid) AS fn_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.prokind = 'f'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC',
      fn.schema_name, fn.fn_name, fn.fn_args);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon',
      fn.schema_name, fn.fn_name, fn.fn_args);
    revoke_count := revoke_count + 1;
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated',
      fn.schema_name, fn.fn_name, fn.fn_args);
    grant_count := grant_count + 1;
  END LOOP;
  RAISE NOTICE 'DB-P1-005: revoked from PUBLIC+anon on % function(s)', revoke_count;
  RAISE NOTICE 'DB-P1-005: granted to authenticated on % function(s)', grant_count;
END;
$$;
