
-- =====================================================================
-- Shipment C4A — Insurance Platform (namespaced insv2_*)
-- =====================================================================

-- ---------- helper: org-scoped access predicate ----------
CREATE OR REPLACE FUNCTION public.insv2_can_access_org(_org uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = _org
      AND om.status = 'active'
  ) OR public.has_role(auth.uid(), 'admin'::app_role);
$$;

CREATE OR REPLACE FUNCTION public.insv2_org_role(_org uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.organization_members
   WHERE user_id = auth.uid() AND organization_id = _org AND status = 'active'
   LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.insv2_can_access_org(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.insv2_org_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.insv2_can_access_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.insv2_org_role(uuid) TO authenticated;

-- =====================================================================
-- 1) providers
-- =====================================================================
CREATE TABLE public.insv2_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  name_en text,
  phone text,
  email text,
  website text,
  address text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, code)
);
CREATE INDEX idx_insv2_providers_org ON public.insv2_providers(organization_id) WHERE is_active;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.insv2_providers TO authenticated;
GRANT ALL ON public.insv2_providers TO service_role;
ALTER TABLE public.insv2_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insv2_providers_read" ON public.insv2_providers
  FOR SELECT TO authenticated
  USING (insv2_can_access_org(organization_id));
CREATE POLICY "insv2_providers_admin_write" ON public.insv2_providers
  FOR ALL TO authenticated
  USING (insv2_can_access_org(organization_id) AND insv2_org_role(organization_id) IN ('owner','admin','manager'))
  WITH CHECK (insv2_can_access_org(organization_id) AND insv2_org_role(organization_id) IN ('owner','admin','manager'));

-- =====================================================================
-- 2) plans
-- =====================================================================
CREATE TABLE public.insv2_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.insv2_providers(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  tier text,
  formulary_ref text,
  copay_percent numeric(5,2) NOT NULL DEFAULT 0,
  deductible numeric(12,2) NOT NULL DEFAULT 0,
  coverage_percent numeric(5,2) NOT NULL DEFAULT 100,
  effective_from date,
  effective_to date,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_id, code)
);
CREATE INDEX idx_insv2_plans_provider ON public.insv2_plans(provider_id) WHERE is_active;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.insv2_plans TO authenticated;
GRANT ALL ON public.insv2_plans TO service_role;
ALTER TABLE public.insv2_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insv2_plans_read" ON public.insv2_plans
  FOR SELECT TO authenticated
  USING (insv2_can_access_org(organization_id));
CREATE POLICY "insv2_plans_admin_write" ON public.insv2_plans
  FOR ALL TO authenticated
  USING (insv2_can_access_org(organization_id) AND insv2_org_role(organization_id) IN ('owner','admin','manager'))
  WITH CHECK (insv2_can_access_org(organization_id) AND insv2_org_role(organization_id) IN ('owner','admin','manager'));

-- =====================================================================
-- 3) patient insurance
-- =====================================================================
CREATE TABLE public.insv2_patient_insurance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.hc_patients(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.insv2_plans(id) ON DELETE RESTRICT,
  policy_number text NOT NULL,
  group_number text,
  holder_name text,
  holder_relation text,
  priority text NOT NULL DEFAULT 'primary' CHECK (priority IN ('primary','secondary','tertiary')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','expired','pending')),
  valid_from date,
  valid_to date,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_insv2_patient_ins_priority
  ON public.insv2_patient_insurance(patient_id, priority)
  WHERE status = 'active';
CREATE INDEX idx_insv2_patient_ins_patient ON public.insv2_patient_insurance(patient_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.insv2_patient_insurance TO authenticated;
GRANT ALL ON public.insv2_patient_insurance TO service_role;
ALTER TABLE public.insv2_patient_insurance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insv2_patient_ins_read" ON public.insv2_patient_insurance
  FOR SELECT TO authenticated
  USING (insv2_can_access_org(organization_id));
CREATE POLICY "insv2_patient_ins_write" ON public.insv2_patient_insurance
  FOR ALL TO authenticated
  USING (insv2_can_access_org(organization_id) AND insv2_org_role(organization_id) IN ('owner','admin','manager','pharmacist'))
  WITH CHECK (insv2_can_access_org(organization_id) AND insv2_org_role(organization_id) IN ('owner','admin','manager','pharmacist'));

-- =====================================================================
-- 4) policy members (dependents)
-- =====================================================================
CREATE TABLE public.insv2_policy_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_insurance_id uuid NOT NULL REFERENCES public.insv2_patient_insurance(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  relation text NOT NULL,
  dob date,
  national_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_insv2_policy_members_policy ON public.insv2_policy_members(patient_insurance_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.insv2_policy_members TO authenticated;
GRANT ALL ON public.insv2_policy_members TO service_role;
ALTER TABLE public.insv2_policy_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insv2_policy_members_read" ON public.insv2_policy_members
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.insv2_patient_insurance pi
                  WHERE pi.id = patient_insurance_id
                    AND insv2_can_access_org(pi.organization_id)));
CREATE POLICY "insv2_policy_members_write" ON public.insv2_policy_members
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.insv2_patient_insurance pi
                  WHERE pi.id = patient_insurance_id
                    AND insv2_can_access_org(pi.organization_id)
                    AND insv2_org_role(pi.organization_id) IN ('owner','admin','manager','pharmacist')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.insv2_patient_insurance pi
                       WHERE pi.id = patient_insurance_id
                         AND insv2_can_access_org(pi.organization_id)
                         AND insv2_org_role(pi.organization_id) IN ('owner','admin','manager','pharmacist')));

-- =====================================================================
-- 5) authorizations (pre-auth)
-- =====================================================================
CREATE TABLE public.insv2_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.hc_patients(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.insv2_plans(id) ON DELETE RESTRICT,
  prescription_id uuid REFERENCES public.hc_prescriptions(id) ON DELETE SET NULL,
  reference text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','expired','cancelled')),
  approved_amount numeric(12,2),
  valid_from date,
  valid_to date,
  reason text,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_insv2_auth_patient ON public.insv2_authorizations(patient_id);
CREATE INDEX idx_insv2_auth_rx ON public.insv2_authorizations(prescription_id) WHERE prescription_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.insv2_authorizations TO authenticated;
GRANT ALL ON public.insv2_authorizations TO service_role;
ALTER TABLE public.insv2_authorizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insv2_auth_read" ON public.insv2_authorizations
  FOR SELECT TO authenticated
  USING (insv2_can_access_org(organization_id));
CREATE POLICY "insv2_auth_write" ON public.insv2_authorizations
  FOR ALL TO authenticated
  USING (insv2_can_access_org(organization_id) AND insv2_org_role(organization_id) IN ('owner','admin','manager','pharmacist'))
  WITH CHECK (insv2_can_access_org(organization_id) AND insv2_org_role(organization_id) IN ('owner','admin','manager','pharmacist'));

-- =====================================================================
-- 6) claims
-- =====================================================================
CREATE TABLE public.insv2_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  claim_no text UNIQUE,
  patient_id uuid NOT NULL REFERENCES public.hc_patients(id) ON DELETE RESTRICT,
  dispense_id uuid REFERENCES public.hc_dispenses(id) ON DELETE SET NULL,
  prescription_id uuid REFERENCES public.hc_prescriptions(id) ON DELETE SET NULL,
  provider_id uuid NOT NULL REFERENCES public.insv2_providers(id) ON DELETE RESTRICT,
  plan_id uuid NOT NULL REFERENCES public.insv2_plans(id) ON DELETE RESTRICT,
  authorization_id uuid REFERENCES public.insv2_authorizations(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','in_review','approved','partially_approved','rejected','paid','closed','cancelled')),
  total_billed numeric(12,2) NOT NULL DEFAULT 0,
  total_allowed numeric(12,2) NOT NULL DEFAULT 0,
  total_copay numeric(12,2) NOT NULL DEFAULT 0,
  total_deductible numeric(12,2) NOT NULL DEFAULT 0,
  total_paid numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'YER',
  diagnosis text,
  submitted_at timestamptz,
  adjudicated_at timestamptz,
  paid_at timestamptz,
  reject_reason text,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_insv2_claims_org_status ON public.insv2_claims(organization_id, status);
CREATE INDEX idx_insv2_claims_patient ON public.insv2_claims(patient_id);
CREATE INDEX idx_insv2_claims_provider ON public.insv2_claims(provider_id);
CREATE INDEX idx_insv2_claims_created ON public.insv2_claims(created_at DESC);

-- claim_no generator: CLM-YYYYMMDD-NNNNNN
CREATE OR REPLACE FUNCTION public.insv2_gen_claim_no()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  today_prefix text := 'CLM-' || to_char(now(), 'YYYYMMDD') || '-';
  seq int;
BEGIN
  IF NEW.claim_no IS NULL THEN
    SELECT COALESCE(MAX(CAST(regexp_replace(claim_no, '^CLM-\d+-', '') AS int)), 0) + 1
      INTO seq
      FROM public.insv2_claims
     WHERE claim_no LIKE today_prefix || '%';
    NEW.claim_no := today_prefix || lpad(seq::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_insv2_claims_no BEFORE INSERT ON public.insv2_claims
  FOR EACH ROW EXECUTE FUNCTION public.insv2_gen_claim_no();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.insv2_claims TO authenticated;
GRANT ALL ON public.insv2_claims TO service_role;
ALTER TABLE public.insv2_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insv2_claims_read" ON public.insv2_claims
  FOR SELECT TO authenticated
  USING (insv2_can_access_org(organization_id));
CREATE POLICY "insv2_claims_write" ON public.insv2_claims
  FOR ALL TO authenticated
  USING (insv2_can_access_org(organization_id) AND insv2_org_role(organization_id) IN ('owner','admin','manager','pharmacist'))
  WITH CHECK (insv2_can_access_org(organization_id) AND insv2_org_role(organization_id) IN ('owner','admin','manager','pharmacist'));

-- =====================================================================
-- 7) claim items
-- =====================================================================
CREATE TABLE public.insv2_claim_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.insv2_claims(id) ON DELETE CASCADE,
  dispense_item_id uuid REFERENCES public.hc_dispense_items(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.catalog_products(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity numeric(12,3) NOT NULL DEFAULT 1,
  unit_billed numeric(12,2) NOT NULL DEFAULT 0,
  billed_amount numeric(12,2) NOT NULL DEFAULT 0,
  allowed_amount numeric(12,2) NOT NULL DEFAULT 0,
  copay_amount numeric(12,2) NOT NULL DEFAULT 0,
  coinsurance_amount numeric(12,2) NOT NULL DEFAULT 0,
  deductible_amount numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  reason_code text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_insv2_claim_items_claim ON public.insv2_claim_items(claim_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.insv2_claim_items TO authenticated;
GRANT ALL ON public.insv2_claim_items TO service_role;
ALTER TABLE public.insv2_claim_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insv2_claim_items_read" ON public.insv2_claim_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.insv2_claims c
                  WHERE c.id = claim_id AND insv2_can_access_org(c.organization_id)));
CREATE POLICY "insv2_claim_items_write" ON public.insv2_claim_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.insv2_claims c
                  WHERE c.id = claim_id
                    AND insv2_can_access_org(c.organization_id)
                    AND insv2_org_role(c.organization_id) IN ('owner','admin','manager','pharmacist')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.insv2_claims c
                       WHERE c.id = claim_id
                         AND insv2_can_access_org(c.organization_id)
                         AND insv2_org_role(c.organization_id) IN ('owner','admin','manager','pharmacist')));

-- =====================================================================
-- 8) payment responses
-- =====================================================================
CREATE TABLE public.insv2_payment_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.insv2_claims(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  method text,
  reference text,
  received_at timestamptz NOT NULL DEFAULT now(),
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_insv2_payment_claim ON public.insv2_payment_responses(claim_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.insv2_payment_responses TO authenticated;
GRANT ALL ON public.insv2_payment_responses TO service_role;
ALTER TABLE public.insv2_payment_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insv2_payment_read" ON public.insv2_payment_responses
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.insv2_claims c
                  WHERE c.id = claim_id AND insv2_can_access_org(c.organization_id)));
CREATE POLICY "insv2_payment_write" ON public.insv2_payment_responses
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.insv2_claims c
                  WHERE c.id = claim_id
                    AND insv2_can_access_org(c.organization_id)
                    AND insv2_org_role(c.organization_id) IN ('owner','admin','manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.insv2_claims c
                       WHERE c.id = claim_id
                         AND insv2_can_access_org(c.organization_id)
                         AND insv2_org_role(c.organization_id) IN ('owner','admin','manager')));

-- =====================================================================
-- 9) claim status history
-- =====================================================================
CREATE TABLE public.insv2_claim_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.insv2_claims(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid REFERENCES auth.users(id),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_insv2_claim_hist_claim ON public.insv2_claim_status_history(claim_id, created_at);

GRANT SELECT, INSERT ON public.insv2_claim_status_history TO authenticated;
GRANT ALL ON public.insv2_claim_status_history TO service_role;
ALTER TABLE public.insv2_claim_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insv2_claim_hist_read" ON public.insv2_claim_status_history
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.insv2_claims c
                  WHERE c.id = claim_id AND insv2_can_access_org(c.organization_id)));
CREATE POLICY "insv2_claim_hist_insert" ON public.insv2_claim_status_history
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.insv2_claims c
                       WHERE c.id = claim_id
                         AND insv2_can_access_org(c.organization_id)
                         AND insv2_org_role(c.organization_id) IN ('owner','admin','manager','pharmacist')));

-- =====================================================================
-- updated_at triggers
-- =====================================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'insv2_providers','insv2_plans','insv2_patient_insurance','insv2_policy_members',
    'insv2_authorizations','insv2_claims','insv2_claim_items','insv2_payment_responses'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_touch BEFORE UPDATE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();',
      t
    );
  END LOOP;
END $$;
