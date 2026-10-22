-- Insurance reference ownership. Apply atomically: any existing invalid link
-- aborts the migration; this migration never repairs, backfills or deletes data.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- The unique parent keys let PostgreSQL enforce tenant equality for both
-- service-role writes and direct authenticated table writes, including updates.
CREATE UNIQUE INDEX insv2_ref_branches_org_uq ON public.branches(id, organization_id);
CREATE UNIQUE INDEX insv2_ref_patients_org_uq ON public.hc_patients(id, organization_id);
CREATE UNIQUE INDEX insv2_ref_prescriptions_org_uq ON public.hc_prescriptions(id, organization_id);
CREATE UNIQUE INDEX insv2_ref_dispenses_org_uq ON public.hc_dispenses(id, organization_id);
CREATE UNIQUE INDEX insv2_ref_providers_org_uq ON public.insv2_providers(id, organization_id);
CREATE UNIQUE INDEX insv2_ref_plans_org_uq ON public.insv2_plans(id, organization_id);
CREATE UNIQUE INDEX insv2_ref_authorizations_org_uq ON public.insv2_authorizations(id, organization_id);

-- Retain the original id-only FKs and their CASCADE / SET NULL delete actions.
-- These additional NO ACTION constraints check the final referential result.
ALTER TABLE public.insv2_plans
  ADD CONSTRAINT insv2_plans_provider_org_fk FOREIGN KEY (provider_id, organization_id)
    REFERENCES public.insv2_providers(id, organization_id) ON UPDATE RESTRICT;
ALTER TABLE public.insv2_patient_insurance
  ADD CONSTRAINT insv2_pi_patient_org_fk FOREIGN KEY (patient_id, organization_id)
    REFERENCES public.hc_patients(id, organization_id) ON UPDATE RESTRICT,
  ADD CONSTRAINT insv2_pi_plan_org_fk FOREIGN KEY (plan_id, organization_id)
    REFERENCES public.insv2_plans(id, organization_id) ON UPDATE RESTRICT;
ALTER TABLE public.insv2_authorizations
  ADD CONSTRAINT insv2_auth_patient_org_fk FOREIGN KEY (patient_id, organization_id)
    REFERENCES public.hc_patients(id, organization_id) ON UPDATE RESTRICT,
  ADD CONSTRAINT insv2_auth_plan_org_fk FOREIGN KEY (plan_id, organization_id)
    REFERENCES public.insv2_plans(id, organization_id) ON UPDATE RESTRICT,
  ADD CONSTRAINT insv2_auth_prescription_org_fk FOREIGN KEY (prescription_id, organization_id)
    REFERENCES public.hc_prescriptions(id, organization_id) ON UPDATE RESTRICT;
ALTER TABLE public.insv2_claims
  ADD CONSTRAINT insv2_claim_branch_org_fk FOREIGN KEY (branch_id, organization_id)
    REFERENCES public.branches(id, organization_id) ON UPDATE RESTRICT,
  ADD CONSTRAINT insv2_claim_patient_org_fk FOREIGN KEY (patient_id, organization_id)
    REFERENCES public.hc_patients(id, organization_id) ON UPDATE RESTRICT,
  ADD CONSTRAINT insv2_claim_dispense_org_fk FOREIGN KEY (dispense_id, organization_id)
    REFERENCES public.hc_dispenses(id, organization_id) ON UPDATE RESTRICT,
  ADD CONSTRAINT insv2_claim_prescription_org_fk FOREIGN KEY (prescription_id, organization_id)
    REFERENCES public.hc_prescriptions(id, organization_id) ON UPDATE RESTRICT,
  ADD CONSTRAINT insv2_claim_provider_org_fk FOREIGN KEY (provider_id, organization_id)
    REFERENCES public.insv2_providers(id, organization_id) ON UPDATE RESTRICT,
  ADD CONSTRAINT insv2_claim_plan_org_fk FOREIGN KEY (plan_id, organization_id)
    REFERENCES public.insv2_plans(id, organization_id) ON UPDATE RESTRICT,
  ADD CONSTRAINT insv2_claim_authorization_org_fk FOREIGN KEY (authorization_id, organization_id)
    REFERENCES public.insv2_authorizations(id, organization_id) ON UPDATE RESTRICT;

-- Item tables inherit ownership. Lock all four tables before the legacy check
-- so no concurrent item/parent write can escape between validation and triggers.
LOCK TABLE public.insv2_claim_items, public.insv2_claims,
  public.hc_dispense_items, public.hc_dispenses, public.catalog_products
  IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.insv2_claim_items i
    JOIN public.insv2_claims c ON c.id = i.claim_id
    LEFT JOIN public.hc_dispense_items di ON di.id = i.dispense_item_id
    LEFT JOIN public.hc_dispenses d ON d.id = di.dispense_id
    LEFT JOIN public.catalog_products p ON p.id = i.product_id
    WHERE (i.dispense_item_id IS NOT NULL AND d.organization_id IS DISTINCT FROM c.organization_id)
       OR (i.product_id IS NOT NULL AND NOT (
         p.organization_id IS NOT DISTINCT FROM c.organization_id
         OR (p.id IS NOT NULL AND p.is_public AND p.status = 'approved')
       ))
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23503',
      MESSAGE = 'Existing insurance item references violate organization ownership; audited repair required';
  END IF;
END;
$$;

CREATE FUNCTION public.insv2_check_item_reference_ownership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  claim_org uuid;
BEGIN
  SELECT organization_id INTO claim_org FROM public.insv2_claims
    WHERE id = NEW.claim_id FOR SHARE;
  IF NOT FOUND OR claim_org IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Insurance reference is not in organization';
  END IF;
  IF NEW.product_id IS NOT NULL THEN
    -- Match the catalog's approved public-read contract, including products
    -- published by another organization. Private products require ownership.
    PERFORM 1 FROM public.catalog_products p WHERE p.id = NEW.product_id
      AND (p.organization_id = claim_org OR
        (p.is_public AND p.status = 'approved'))
      FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Insurance reference is not in organization';
    END IF;
  END IF;
  IF NEW.dispense_item_id IS NOT NULL THEN
    PERFORM 1 FROM public.hc_dispense_items di
      JOIN public.hc_dispenses d ON d.id = di.dispense_id
      WHERE di.id = NEW.dispense_item_id AND d.organization_id = claim_org
      FOR SHARE OF di, d;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Insurance reference is not in organization';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.insv2_check_item_reference_ownership() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER insv2_claim_items_reference_ownership
  BEFORE INSERT OR UPDATE ON public.insv2_claim_items
  FOR EACH ROW EXECUTE FUNCTION public.insv2_check_item_reference_ownership();

-- A child check alone is insufficient: a parent could subsequently move tenant
-- or a shared product could become private. Child FOR SHARE locks serialize
-- with those parent updates; these guards reject updates that invalidate links.
CREATE FUNCTION public.insv2_guard_referenced_parent_ownership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  new_org uuid;
BEGIN
  IF TG_TABLE_NAME IN ('insv2_claims', 'hc_dispenses') THEN
    IF NEW.organization_id IS NOT DISTINCT FROM OLD.organization_id THEN RETURN NEW; END IF;
  ELSIF TG_TABLE_NAME = 'hc_dispense_items' THEN
    IF NEW.dispense_id IS NOT DISTINCT FROM OLD.dispense_id THEN RETURN NEW; END IF;
  ELSIF TG_TABLE_NAME = 'catalog_products' THEN
    IF ROW(NEW.organization_id, NEW.is_public, NEW.status)
      IS NOT DISTINCT FROM ROW(OLD.organization_id, OLD.is_public, OLD.status) THEN RETURN NEW; END IF;
  END IF;
  -- The reverse-reference queries below require a fresh command snapshot after
  -- waiting for child FOR SHARE locks. Fail closed on ownership-changing parent
  -- operations at stronger isolation levels rather than trust a stale snapshot.
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION USING ERRCODE = '40001',
      MESSAGE = 'Insurance reference parent changes require a read committed transaction';
  END IF;
  IF TG_TABLE_NAME = 'insv2_claims' THEN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id AND EXISTS (
      SELECT 1 FROM public.insv2_claim_items WHERE claim_id = OLD.id
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Insurance claim with items cannot change organization';
    END IF;
  ELSIF TG_TABLE_NAME = 'hc_dispenses' THEN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id AND EXISTS (
      SELECT 1 FROM public.insv2_claim_items i
      JOIN public.hc_dispense_items di ON di.id = i.dispense_item_id
      WHERE di.dispense_id = OLD.id
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Insurance referenced dispense cannot change organization';
    END IF;
  ELSIF TG_TABLE_NAME = 'hc_dispense_items' THEN
    IF NEW.dispense_id IS DISTINCT FROM OLD.dispense_id THEN
      SELECT organization_id INTO new_org FROM public.hc_dispenses
        WHERE id = NEW.dispense_id FOR SHARE;
      IF EXISTS (
        SELECT 1 FROM public.insv2_claim_items i
        JOIN public.insv2_claims c ON c.id = i.claim_id
        WHERE i.dispense_item_id = OLD.id AND c.organization_id IS DISTINCT FROM new_org
      ) THEN
        RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Insurance referenced dispense item cannot change organization';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'catalog_products' THEN
    IF EXISTS (
      SELECT 1 FROM public.insv2_claim_items i
      JOIN public.insv2_claims c ON c.id = i.claim_id
      WHERE i.product_id = OLD.id AND NOT (
        NEW.organization_id IS NOT DISTINCT FROM c.organization_id
        OR (NEW.is_public AND NEW.status = 'approved')
      )
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Insurance referenced product must remain owned or shared';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.insv2_guard_referenced_parent_ownership() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER insv2_claims_guard_item_ownership
  BEFORE UPDATE OF organization_id ON public.insv2_claims
  FOR EACH ROW EXECUTE FUNCTION public.insv2_guard_referenced_parent_ownership();
CREATE TRIGGER insv2_dispenses_guard_item_ownership
  BEFORE UPDATE OF organization_id ON public.hc_dispenses
  FOR EACH ROW EXECUTE FUNCTION public.insv2_guard_referenced_parent_ownership();
CREATE TRIGGER insv2_dispense_items_guard_ownership
  BEFORE UPDATE OF dispense_id ON public.hc_dispense_items
  FOR EACH ROW EXECUTE FUNCTION public.insv2_guard_referenced_parent_ownership();
CREATE TRIGGER insv2_products_guard_item_ownership
  BEFORE UPDATE OF organization_id, is_public, status ON public.catalog_products
  FOR EACH ROW EXECUTE FUNCTION public.insv2_guard_referenced_parent_ownership();

COMMIT;
