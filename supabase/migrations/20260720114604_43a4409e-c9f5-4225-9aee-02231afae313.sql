
-- ============ Shipment D4: Promotions & Coupons ============

CREATE TABLE public.crm_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  kind text NOT NULL CHECK (kind IN ('percentage','fixed','bogo','free_shipping','free_gift','category_discount','tier_discount')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','archived','expired')),
  priority int NOT NULL DEFAULT 100,
  stackable boolean NOT NULL DEFAULT false,
  min_spend numeric(14,2),
  max_discount numeric(14,2),
  starts_at timestamptz,
  expires_at timestamptz,
  usage_limit int,
  usage_count int NOT NULL DEFAULT 0,
  per_customer_limit int,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);
CREATE INDEX idx_crm_promotions_org_status ON public.crm_promotions(organization_id, status);
CREATE INDEX idx_crm_promotions_window ON public.crm_promotions(starts_at, expires_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_promotions TO authenticated;
GRANT ALL ON public.crm_promotions TO service_role;
ALTER TABLE public.crm_promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY promotions_org_read ON public.crm_promotions FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY promotions_org_write ON public.crm_promotions FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE TRIGGER trg_crm_promotions_updated BEFORE UPDATE ON public.crm_promotions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.crm_promotion_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  promotion_id uuid NOT NULL REFERENCES public.crm_promotions(id) ON DELETE CASCADE,
  target_kind text NOT NULL CHECK (target_kind IN ('include','exclude')),
  entity_kind text NOT NULL CHECK (entity_kind IN ('product','category','manufacturer','branch','loyalty_tier')),
  entity_ref text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_promo_targets_promo ON public.crm_promotion_targets(promotion_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_promotion_targets TO authenticated;
GRANT ALL ON public.crm_promotion_targets TO service_role;
ALTER TABLE public.crm_promotion_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY promo_targets_org_all ON public.crm_promotion_targets FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE TABLE public.crm_promotion_eligibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  promotion_id uuid NOT NULL REFERENCES public.crm_promotions(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('first_purchase','customer','segment','loyalty_tier','all')),
  value text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_promo_elig_promo ON public.crm_promotion_eligibility(promotion_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_promotion_eligibility TO authenticated;
GRANT ALL ON public.crm_promotion_eligibility TO service_role;
ALTER TABLE public.crm_promotion_eligibility ENABLE ROW LEVEL SECURITY;
CREATE POLICY promo_elig_org_all ON public.crm_promotion_eligibility FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE TABLE public.crm_promotion_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  promotion_id uuid NOT NULL REFERENCES public.crm_promotions(id) ON DELETE CASCADE,
  customer_id uuid,
  coupon_code_id uuid,
  order_ref text,
  discount_amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EGP',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE INDEX idx_promo_redemptions_promo ON public.crm_promotion_redemptions(promotion_id);
CREATE INDEX idx_promo_redemptions_customer ON public.crm_promotion_redemptions(customer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_promotion_redemptions TO authenticated;
GRANT ALL ON public.crm_promotion_redemptions TO service_role;
ALTER TABLE public.crm_promotion_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY promo_redemptions_org_all ON public.crm_promotion_redemptions FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE TABLE public.crm_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  promotion_id uuid REFERENCES public.crm_promotions(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  mode text NOT NULL DEFAULT 'single' CHECK (mode IN ('single','multi','one_per_customer')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','archived')),
  global_limit int,
  per_customer_limit int DEFAULT 1,
  min_spend numeric(14,2),
  max_discount numeric(14,2),
  stackable boolean NOT NULL DEFAULT false,
  starts_at timestamptz,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_coupons_org_status ON public.crm_coupons(organization_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_coupons TO authenticated;
GRANT ALL ON public.crm_coupons TO service_role;
ALTER TABLE public.crm_coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY coupons_org_all ON public.crm_coupons FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE TRIGGER trg_crm_coupons_updated BEFORE UPDATE ON public.crm_coupons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.crm_coupon_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  coupon_id uuid NOT NULL REFERENCES public.crm_coupons(id) ON DELETE CASCADE,
  code text NOT NULL,
  usage_limit int,
  usage_count int NOT NULL DEFAULT 0,
  branch_scope text[] DEFAULT '{}'::text[],
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);
CREATE INDEX idx_coupon_codes_coupon ON public.crm_coupon_codes(coupon_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_coupon_codes TO authenticated;
GRANT ALL ON public.crm_coupon_codes TO service_role;
ALTER TABLE public.crm_coupon_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY coupon_codes_org_all ON public.crm_coupon_codes FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE TABLE public.crm_coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  coupon_id uuid NOT NULL REFERENCES public.crm_coupons(id) ON DELETE CASCADE,
  coupon_code_id uuid NOT NULL REFERENCES public.crm_coupon_codes(id) ON DELETE CASCADE,
  customer_id uuid,
  order_ref text,
  discount_amount numeric(14,2) NOT NULL DEFAULT 0,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE INDEX idx_coupon_redemptions_code ON public.crm_coupon_redemptions(coupon_code_id);
CREATE INDEX idx_coupon_redemptions_customer ON public.crm_coupon_redemptions(customer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_coupon_redemptions TO authenticated;
GRANT ALL ON public.crm_coupon_redemptions TO service_role;
ALTER TABLE public.crm_coupon_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY coupon_redemptions_org_all ON public.crm_coupon_redemptions FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

-- Atomic redemption: enforce limits + increment counter + record redemption in one call.
CREATE OR REPLACE FUNCTION public.crm_coupon_redeem(
  p_org uuid,
  p_code text,
  p_customer uuid,
  p_order_ref text,
  p_discount numeric,
  p_created_by uuid
) RETURNS TABLE(redemption_id uuid, coupon_id uuid, promotion_id uuid) AS $$
DECLARE
  v_code record;
  v_coupon record;
  v_customer_uses int;
  v_rid uuid;
BEGIN
  SELECT * INTO v_code FROM public.crm_coupon_codes
    WHERE organization_id = p_org AND code = p_code FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'coupon_not_found'; END IF;
  IF NOT v_code.is_active THEN RAISE EXCEPTION 'coupon_inactive'; END IF;
  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < now() THEN RAISE EXCEPTION 'coupon_expired'; END IF;
  IF v_code.usage_limit IS NOT NULL AND v_code.usage_count >= v_code.usage_limit THEN
    RAISE EXCEPTION 'coupon_exhausted';
  END IF;

  SELECT * INTO v_coupon FROM public.crm_coupons WHERE id = v_code.coupon_id;
  IF v_coupon.status <> 'active' THEN RAISE EXCEPTION 'coupon_disabled'; END IF;
  IF v_coupon.starts_at IS NOT NULL AND v_coupon.starts_at > now() THEN RAISE EXCEPTION 'coupon_not_started'; END IF;
  IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < now() THEN RAISE EXCEPTION 'coupon_expired'; END IF;
  IF v_coupon.global_limit IS NOT NULL THEN
    IF (SELECT count(*) FROM public.crm_coupon_redemptions WHERE coupon_id = v_coupon.id) >= v_coupon.global_limit THEN
      RAISE EXCEPTION 'coupon_global_limit';
    END IF;
  END IF;
  IF v_coupon.per_customer_limit IS NOT NULL AND p_customer IS NOT NULL THEN
    SELECT count(*) INTO v_customer_uses FROM public.crm_coupon_redemptions
      WHERE coupon_id = v_coupon.id AND customer_id = p_customer;
    IF v_customer_uses >= v_coupon.per_customer_limit THEN RAISE EXCEPTION 'coupon_per_customer_limit'; END IF;
  END IF;

  INSERT INTO public.crm_coupon_redemptions
    (organization_id, coupon_id, coupon_code_id, customer_id, order_ref, discount_amount, created_by)
  VALUES (p_org, v_coupon.id, v_code.id, p_customer, p_order_ref, p_discount, p_created_by)
  RETURNING id INTO v_rid;

  UPDATE public.crm_coupon_codes SET usage_count = usage_count + 1 WHERE id = v_code.id;
  IF v_coupon.promotion_id IS NOT NULL THEN
    UPDATE public.crm_promotions SET usage_count = usage_count + 1 WHERE id = v_coupon.promotion_id;
    INSERT INTO public.crm_promotion_redemptions
      (organization_id, promotion_id, customer_id, coupon_code_id, order_ref, discount_amount, created_by)
    VALUES (p_org, v_coupon.promotion_id, p_customer, v_code.id, p_order_ref, p_discount, p_created_by);
  END IF;

  RETURN QUERY SELECT v_rid, v_coupon.id, v_coupon.promotion_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION public.crm_coupon_redeem(uuid, text, uuid, text, numeric, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_coupon_redeem(uuid, text, uuid, text, numeric, uuid) TO service_role;
