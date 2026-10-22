-- Empty by default. Identity mappings require explicit provisioning; no live activation.
CREATE TABLE catalog_command_private.bridge_actors(
 source text NOT NULL, external_actor uuid NOT NULL, site_actor uuid NOT NULL,
 organization_id uuid NOT NULL, active boolean NOT NULL DEFAULT false,
 PRIMARY KEY(source,external_actor)
);
CREATE TABLE catalog_command_private.bridge_receipts(
 source text NOT NULL, command_id uuid NOT NULL, envelope jsonb NOT NULL, receipt jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(source,command_id)
);
ALTER TABLE catalog_command_private.bridge_actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_command_private.bridge_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON catalog_command_private.bridge_actors,catalog_command_private.bridge_receipts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON catalog_command_private.bridge_actors TO service_role;
GRANT SELECT,INSERT ON catalog_command_private.bridge_receipts TO service_role;

CREATE FUNCTION public.erp_catalog_apply(p_source text,p_body jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE editor catalog_command_private.bridge_actors; reviewer catalog_command_private.bridge_actors;
 saved catalog_command_private.bridge_receipts; product public.catalog_products; content jsonb; result jsonb; receipt jsonb; command uuid;
BEGIN
 IF jsonb_typeof(p_body) IS DISTINCT FROM 'object' OR p_body-ARRAY['sourceSystem','command_id','editor','reviewer','payload','payload_hash']<>'{}'::jsonb OR
 p_body->>'sourceSystem' IS DISTINCT FROM p_source OR p_body->>'editor' IS NOT DISTINCT FROM p_body->>'reviewer' OR
 jsonb_typeof(p_body->'payload') IS DISTINCT FROM 'string' OR length(p_body->>'payload')>12000 OR
 p_body->>'payload_hash' IS DISTINCT FROM encode(sha256(convert_to(p_body->>'payload','UTF8')),'hex') THEN RAISE EXCEPTION 'CATALOG_ENVELOPE_INVALID'; END IF;
 command:=(p_body->>'command_id')::uuid;IF command IS NULL THEN RAISE EXCEPTION 'CATALOG_COMMAND_REQUIRED'; END IF;
 SELECT * INTO editor FROM catalog_command_private.bridge_actors WHERE source=p_source AND external_actor=(p_body->>'editor')::uuid AND active;
 SELECT * INTO reviewer FROM catalog_command_private.bridge_actors WHERE source=p_source AND external_actor=(p_body->>'reviewer')::uuid AND active;
 IF editor.site_actor IS NULL OR reviewer.site_actor IS NULL OR editor.site_actor=reviewer.site_actor OR editor.organization_id<>reviewer.organization_id OR
 NOT public.has_org_permission(editor.site_actor,editor.organization_id,'catalog.write',NULL) OR
 NOT public.has_org_permission(reviewer.site_actor,reviewer.organization_id,'catalog.write',NULL) THEN RAISE EXCEPTION 'CATALOG_BRIDGE_ACTOR_FORBIDDEN'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('catalog-bridge:'||p_source||':'||command::text,0));
 SELECT * INTO saved FROM catalog_command_private.bridge_receipts WHERE source=p_source AND command_id=command;
 IF FOUND THEN IF saved.envelope<>p_body THEN RAISE EXCEPTION 'CATALOG_COMMAND_CONFLICT'; END IF;RETURN saved.receipt; END IF;
 content:=(p_body->>'payload')::jsonb;
 IF jsonb_typeof(content) IS DISTINCT FROM 'object' OR content-ARRAY['product','expectedRevision','before','patch','reason']<>'{}'::jsonb OR
 jsonb_typeof(content->'product') IS DISTINCT FROM 'string' OR jsonb_typeof(content->'expectedRevision') IS DISTINCT FROM 'string' OR jsonb_typeof(content->'reason') IS DISTINCT FROM 'string' OR
 coalesce(content->>'expectedRevision','')!~'^[0-9]{1,18}$' OR jsonb_typeof(content->'patch') IS DISTINCT FROM 'object' OR
 (content->'patch')-ARRAY['name_ar','description_ar']<>'{}'::jsonb OR jsonb_typeof(content->'before') IS DISTINCT FROM 'object' OR
 NOT(content->'before' ?& ARRAY['name_ar','description_ar']) OR (content->'before')-ARRAY['name_ar','description_ar']<>'{}'::jsonb THEN RAISE EXCEPTION 'CATALOG_PAYLOAD_INVALID'; END IF;
 SELECT p.* INTO product FROM public.catalog_products p JOIN public.erp_item_map m ON m.product_id=p.id
 WHERE m.source_id=p_source AND m.erp_item_id=content->>'product' AND m.verified AND p.organization_id=editor.organization_id AND NOT p.requires_prescription FOR UPDATE OF p;
 IF NOT FOUND THEN RAISE EXCEPTION 'CATALOG_PRODUCT_MAPPING_FORBIDDEN'; END IF;
 IF product.revision::text<>content->>'expectedRevision' OR content->'before'<>jsonb_build_object('name_ar',product.name_ar,'description_ar',product.description_ar) THEN
  receipt:=jsonb_build_object('command_id',command,'payload_hash',p_body->>'payload_hash','state','CONFLICT','currentRevision',product.revision::text,'current',jsonb_build_object('name_ar',product.name_ar,'description_ar',product.description_ar));
 ELSE
  result:=public.catalog_update_product_atomic(editor.site_actor,editor.organization_id,product.id,'bridge:'||encode(sha256(convert_to(p_source||':'||command::text,'UTF8')),'hex'),content->'patch',(content->>'expectedRevision')::bigint,command::text);
  INSERT INTO public.audit_events(actor_user_id,organization_id,action,resource_type,resource_id,correlation_id,payload) VALUES(reviewer.site_actor,reviewer.organization_id,'catalog.product.bridge_approval','catalog_product',product.id,command::text,jsonb_build_object('source',p_source,'editor',editor.site_actor,'reviewer',reviewer.site_actor,'payload_hash',p_body->>'payload_hash','reason',content->>'reason'));
  SELECT p.* INTO product FROM public.catalog_products p WHERE p.id=product.id;
  receipt:=jsonb_build_object('command_id',command,'payload_hash',p_body->>'payload_hash','state','APPLIED','revision',result->>'revision','applied',jsonb_build_object('name_ar',product.name_ar,'description_ar',product.description_ar));
 END IF;
 INSERT INTO catalog_command_private.bridge_receipts(source,command_id,envelope,receipt) VALUES(p_source,command,p_body,receipt);
 RETURN receipt;
END $$;
REVOKE ALL ON FUNCTION public.erp_catalog_apply(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.erp_catalog_apply(text,jsonb) TO service_role;
CREATE FUNCTION public.erp_catalog_preview(p_source text,p_product text) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 SELECT jsonb_build_object('product',m.erp_item_id,'revision',p.revision::text,'fields',jsonb_build_object('name_ar',p.name_ar,'description_ar',p.description_ar)) INTO result FROM public.catalog_products p JOIN public.erp_item_map m ON m.product_id=p.id WHERE m.source_id=p_source AND m.erp_item_id=p_product AND m.verified AND NOT p.requires_prescription AND EXISTS(SELECT 1 FROM catalog_command_private.bridge_actors a WHERE a.source=p_source AND a.organization_id=p.organization_id AND a.active);
 IF result IS NULL THEN RAISE EXCEPTION 'CATALOG_PREVIEW_FORBIDDEN'; END IF;RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.erp_catalog_preview(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.erp_catalog_preview(text,text) TO service_role;
