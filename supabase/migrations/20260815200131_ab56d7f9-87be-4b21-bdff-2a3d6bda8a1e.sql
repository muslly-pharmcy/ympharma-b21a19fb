DO $$
DECLARE
  r record;
  allowlist text[] := ARRAY[
    'pn_get_pharmacy_public(text)',
    'pn_list_pharmacy_products(text,text,integer,integer)',
    'pn_search_medicine_nearby(text,double precision,double precision,integer,integer)',
    'public_feature_flags()',
    'public_pharmacy_status()',
    'search_medicines_public(text,integer)'
  ];
  fnname text;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig,
           pg_get_function_result(p.oid) = 'trigger' AS is_trigger,
           p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    fnname := regexp_replace(r.sig, '^public\.', '');
    IF r.is_trigger OR r.proname LIKE '\_%' THEN
      -- trigger functions and internal helpers are never called through the API
      EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fnname);
    ELSIF NOT (fnname = ANY(allowlist)) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', fnname);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', fnname);
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO anon, authenticated', fnname);
    END IF;
  END LOOP;
END $$;