
-- Shipment D1 — CRM Customers foundation
CREATE TABLE IF NOT EXISTS public.crm_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  code text NOT NULL,
  full_name text NOT NULL,
  phone text,
  email text,
  patient_id uuid REFERENCES public.hc_patients(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','merged')),
  merged_into_id uuid REFERENCES public.crm_customers(id) ON DELETE SET NULL,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);
CREATE INDEX IF NOT EXISTS idx_crm_customers_org ON public.crm_customers (organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_customers_patient ON public.crm_customers (patient_id) WHERE patient_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_customers_search ON public.crm_customers USING gin (to_tsvector('simple', coalesce(full_name,'') || ' ' || coalesce(phone,'') || ' ' || coalesce(email,'')));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_customers TO authenticated;
GRANT ALL ON public.crm_customers TO service_role;
ALTER TABLE public.crm_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_customers_org_members" ON public.crm_customers
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.crm_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

CREATE TRIGGER trg_crm_customers_updated
  BEFORE UPDATE ON public.crm_customers
  FOR EACH ROW EXECUTE FUNCTION public.crm_touch_updated_at();

-- Auto-generate CRM code per org: CUS-YYYY-XXXXXX
CREATE SEQUENCE IF NOT EXISTS public.crm_customer_code_seq;
CREATE OR REPLACE FUNCTION public.crm_generate_customer_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'CUS-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.crm_customer_code_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_crm_customers_code
  BEFORE INSERT ON public.crm_customers
  FOR EACH ROW EXECUTE FUNCTION public.crm_generate_customer_code();

-- ---------------- Addresses ----------------
CREATE TABLE IF NOT EXISTS public.crm_customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  customer_id uuid NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'shipping' CHECK (kind IN ('billing','shipping','other')),
  line1 text NOT NULL,
  line2 text,
  city text,
  region text,
  country text,
  postal_code text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_addr_customer ON public.crm_customer_addresses (customer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_customer_addresses TO authenticated;
GRANT ALL ON public.crm_customer_addresses TO service_role;
ALTER TABLE public.crm_customer_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_addr_org_members" ON public.crm_customer_addresses
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE TRIGGER trg_crm_addr_updated
  BEFORE UPDATE ON public.crm_customer_addresses
  FOR EACH ROW EXECUTE FUNCTION public.crm_touch_updated_at();

-- ---------------- Contacts ----------------
CREATE TABLE IF NOT EXISTS public.crm_customer_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  customer_id uuid NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('phone','email','whatsapp','other')),
  value text NOT NULL,
  label text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_customer ON public.crm_customer_contacts (customer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_customer_contacts TO authenticated;
GRANT ALL ON public.crm_customer_contacts TO service_role;
ALTER TABLE public.crm_customer_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_contacts_org_members" ON public.crm_customer_contacts
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE TRIGGER trg_crm_contacts_updated
  BEFORE UPDATE ON public.crm_customer_contacts
  FOR EACH ROW EXECUTE FUNCTION public.crm_touch_updated_at();

-- ---------------- Tags ----------------
CREATE TABLE IF NOT EXISTS public.crm_customer_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  customer_id uuid NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  tag text NOT NULL,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, tag)
);
CREATE INDEX IF NOT EXISTS idx_crm_tags_org_tag ON public.crm_customer_tags (organization_id, tag);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_customer_tags TO authenticated;
GRANT ALL ON public.crm_customer_tags TO service_role;
ALTER TABLE public.crm_customer_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_tags_org_members" ON public.crm_customer_tags
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
