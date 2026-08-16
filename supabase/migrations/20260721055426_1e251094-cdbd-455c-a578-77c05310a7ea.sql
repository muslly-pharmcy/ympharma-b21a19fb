
CREATE OR REPLACE FUNCTION public.catalog_products_audit_trg()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public','auth'
AS $function$
DECLARE ev text; uid uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN ev := 'PRODUCT_CREATED';
  ELSIF TG_OP = 'UPDATE' AND OLD.status <> NEW.status AND NEW.status = 'approved' THEN ev := 'PRODUCT_VERIFIED';
  ELSIF TG_OP = 'UPDATE' THEN ev := 'PRODUCT_UPDATED';
  END IF;
  BEGIN uid := auth.uid(); EXCEPTION WHEN OTHERS THEN uid := NULL; END;
  IF ev IS NOT NULL THEN
    BEGIN
      INSERT INTO public.organization_audit_events (organization_id, actor_user_id, event_type, payload)
      VALUES (NEW.organization_id, uid, ev,
        jsonb_build_object('product_id', NEW.id, 'status', NEW.status, 'name_ar', NEW.name_ar));
    EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN
      INSERT INTO public.agent_events (event_name, entity_type, entity_id, payload, source)
      VALUES (ev, 'catalog_product', NEW.id::text,
        jsonb_build_object('product_id', NEW.id, 'organization_id', NEW.organization_id), 'catalog_trigger');
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  RETURN NEW;
END $function$;

REVOKE EXECUTE ON FUNCTION public.catalog_products_audit_trg() FROM PUBLIC, anon;
