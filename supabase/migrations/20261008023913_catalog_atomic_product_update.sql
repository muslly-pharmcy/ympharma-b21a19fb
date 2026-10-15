-- Apply only to an approved staging database before deploying the matching server code.
-- No user, role, key, mapping or publication is provisioned by this migration.
CREATE SCHEMA catalog_command_private;
REVOKE ALL ON SCHEMA catalog_command_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA catalog_command_private TO service_role;
ALTER TABLE public.catalog_products ADD COLUMN revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0);

CREATE FUNCTION catalog_command_private.bump_revision() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN NEW.revision := OLD.revision + 1; RETURN NEW; END $$;
CREATE TRIGGER catalog_product_revision BEFORE UPDATE ON public.catalog_products
FOR EACH ROW EXECUTE FUNCTION catalog_command_private.bump_revision();
REVOKE ALL ON FUNCTION catalog_command_private.bump_revision() FROM PUBLIC,anon,authenticated;

CREATE TABLE catalog_command_private.results (
  organization_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  command_key text NOT NULL,
  request jsonb NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(organization_id,actor_id,command_key)
);
ALTER TABLE catalog_command_private.results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON catalog_command_private.results FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON catalog_command_private.results TO service_role;

CREATE FUNCTION public.catalog_update_product_atomic(
 p_actor uuid,p_org uuid,p_product uuid,p_key text,p_patch jsonb,
 p_expected_revision bigint,p_correlation text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE old public.catalog_products; saved catalog_command_private.results;
 req jsonb; answer jsonb; item record; max_length int; next_revision bigint;
BEGIN
 IF p_actor IS NULL OR p_org IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.organization_members WHERE organization_id=p_org AND user_id=p_actor AND status='active'
 ) OR NOT (public.has_org_permission(p_actor,p_org,'catalog.write',NULL) OR EXISTS(
  SELECT 1 FROM public.user_roles WHERE user_id=p_actor AND role::text IN ('admin','superadmin')
 )) THEN
  RAISE EXCEPTION 'CATALOG_WRITE_FORBIDDEN';
 END IF;
 IF p_key IS NULL OR length(p_key) NOT BETWEEN 8 AND 128 OR
    p_correlation IS NULL OR length(p_correlation) NOT BETWEEN 4 AND 128 OR
    p_expected_revision < 0 OR jsonb_typeof(p_patch) IS DISTINCT FROM 'object' OR p_patch='{}'::jsonb OR
    p_patch - ARRAY['name_ar','name_en','category_id','brand','manufacturer','dosage_form','strength','description_ar'] <> '{}'::jsonb THEN
  RAISE EXCEPTION 'INVALID_PRODUCT_UPDATE';
 END IF;
 FOR item IN SELECT key,value FROM jsonb_each(p_patch) LOOP
  IF item.key='category_id' THEN
   IF item.value<>'null'::jsonb AND jsonb_typeof(item.value)<>'string' THEN RAISE EXCEPTION 'INVALID_CATEGORY'; END IF;
  ELSE
   max_length:=CASE item.key WHEN 'description_ar' THEN 2000 WHEN 'name_ar' THEN 200 WHEN 'name_en' THEN 200 WHEN 'brand' THEN 120 WHEN 'manufacturer' THEN 120 ELSE 60 END;
   IF item.value='null'::jsonb THEN
    IF item.key='name_ar' THEN RAISE EXCEPTION 'INVALID_PRODUCT_NAME'; END IF;
   ELSIF jsonb_typeof(item.value)<>'string' OR length(item.value#>>'{}')>max_length OR
    (item.key='name_ar' AND length(btrim(item.value#>>'{}'))=0) THEN RAISE EXCEPTION 'INVALID_PRODUCT_TEXT'; END IF;
  END IF;
 END LOOP;
 req:=jsonb_build_object('product',p_product,'patch',p_patch,'expectedRevision',p_expected_revision);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_org::text||':'||p_actor::text||':'||p_key,0));
 SELECT * INTO saved FROM catalog_command_private.results WHERE organization_id=p_org AND actor_id=p_actor AND command_key=p_key;
 IF FOUND THEN
  IF saved.request<>req THEN RAISE EXCEPTION 'PRODUCT_IDEMPOTENCY_CONFLICT'; END IF;
  RETURN saved.response;
 END IF;
 SELECT * INTO old FROM public.catalog_products WHERE id=p_product AND organization_id=p_org FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_FORBIDDEN'; END IF;
 IF p_expected_revision IS NOT NULL AND old.revision<>p_expected_revision THEN RAISE EXCEPTION 'PRODUCT_REVISION_CONFLICT'; END IF;
 -- Mutable category authorization follows durable replay, so an already committed
 -- request can still recover its receipt after the category is deactivated.
 IF p_patch?'category_id' AND p_patch->'category_id'<>'null'::jsonb THEN
  PERFORM 1 FROM public.catalog_categories WHERE id=(p_patch->>'category_id')::uuid
   AND is_active AND (organization_id=p_org OR organization_id IS NULL) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CATEGORY_FORBIDDEN'; END IF;
 END IF;
 UPDATE public.catalog_products SET
  name_ar=CASE WHEN p_patch?'name_ar' THEN p_patch->>'name_ar' ELSE old.name_ar END,
  name_en=CASE WHEN p_patch?'name_en' THEN p_patch->>'name_en' ELSE old.name_en END,
  category_id=CASE WHEN p_patch?'category_id' THEN (p_patch->>'category_id')::uuid ELSE old.category_id END,
  brand=CASE WHEN p_patch?'brand' THEN p_patch->>'brand' ELSE old.brand END,
  manufacturer=CASE WHEN p_patch?'manufacturer' THEN p_patch->>'manufacturer' ELSE old.manufacturer END,
  dosage_form=CASE WHEN p_patch?'dosage_form' THEN p_patch->>'dosage_form' ELSE old.dosage_form END,
  strength=CASE WHEN p_patch?'strength' THEN p_patch->>'strength' ELSE old.strength END,
  description_ar=CASE WHEN p_patch?'description_ar' THEN p_patch->>'description_ar' ELSE old.description_ar END
 WHERE id=p_product AND organization_id=p_org RETURNING revision INTO next_revision;
 INSERT INTO public.audit_events(actor_user_id,organization_id,action,resource_type,resource_id,correlation_id,payload)
 VALUES(p_actor,p_org,'catalog.product.update','catalog_product',p_product,p_correlation,
  jsonb_build_object('patch',p_patch,'before',jsonb_build_object('name_ar',old.name_ar,'name_en',old.name_en,'category_id',old.category_id,'brand',old.brand,'manufacturer',old.manufacturer,'dosage_form',old.dosage_form,'strength',old.strength,'description_ar',old.description_ar),'beforeRevision',old.revision::text,'revision',next_revision::text));
 PERFORM public.emit_domain_event('ProductUpdated','catalog-mutations',jsonb_build_object('product_id',p_product,'organization_id',p_org,'patch',p_patch,'revision',next_revision::text),'normal',p_correlation);
 answer:=jsonb_build_object('id',p_product,'correlationId',p_correlation,'revision',next_revision::text);
 INSERT INTO catalog_command_private.results VALUES(p_org,p_actor,p_key,req,answer,clock_timestamp());
 RETURN answer;
END $$;
REVOKE ALL ON FUNCTION public.catalog_update_product_atomic(uuid,uuid,uuid,text,jsonb,bigint,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_update_product_atomic(uuid,uuid,uuid,text,jsonb,bigint,text) TO service_role;
