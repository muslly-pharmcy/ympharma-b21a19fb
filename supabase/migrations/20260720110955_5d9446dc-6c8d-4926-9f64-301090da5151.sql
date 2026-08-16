
CREATE TABLE IF NOT EXISTS public.crm_loyalty_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  min_lifetime_points INTEGER NOT NULL DEFAULT 0 CHECK (min_lifetime_points >= 0),
  multiplier NUMERIC(5,2) NOT NULL DEFAULT 1.0 CHECK (multiplier >= 0),
  color TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);
CREATE INDEX IF NOT EXISTS crm_loyalty_tiers_org_idx ON public.crm_loyalty_tiers(organization_id, min_lifetime_points);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_loyalty_tiers TO authenticated;
GRANT ALL ON public.crm_loyalty_tiers TO service_role;
ALTER TABLE public.crm_loyalty_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_tiers_org_read" ON public.crm_loyalty_tiers FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "loyalty_tiers_org_write" ON public.crm_loyalty_tiers FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.crm_loyalty_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  points_balance INTEGER NOT NULL DEFAULT 0,
  points_lifetime_earned INTEGER NOT NULL DEFAULT 0,
  current_tier_id UUID REFERENCES public.crm_loyalty_tiers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','frozen','closed')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, customer_id)
);
CREATE INDEX IF NOT EXISTS crm_loyalty_accounts_org_idx ON public.crm_loyalty_accounts(organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS crm_loyalty_accounts_customer_idx ON public.crm_loyalty_accounts(customer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_loyalty_accounts TO authenticated;
GRANT ALL ON public.crm_loyalty_accounts TO service_role;
ALTER TABLE public.crm_loyalty_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_accounts_org_read" ON public.crm_loyalty_accounts FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "loyalty_accounts_org_write" ON public.crm_loyalty_accounts FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.crm_loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.crm_loyalty_accounts(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('earn','redeem','reverse','expire','adjust','bonus')),
  points INTEGER NOT NULL,
  reason TEXT,
  source_ref TEXT,
  correlation_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_loyalty_txn_account_idx ON public.crm_loyalty_transactions(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS crm_loyalty_txn_customer_idx ON public.crm_loyalty_transactions(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS crm_loyalty_txn_org_kind_idx ON public.crm_loyalty_transactions(organization_id, kind, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_loyalty_transactions TO authenticated;
GRANT ALL ON public.crm_loyalty_transactions TO service_role;
ALTER TABLE public.crm_loyalty_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_txn_org_read" ON public.crm_loyalty_transactions FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "loyalty_txn_org_write" ON public.crm_loyalty_transactions FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.crm_loyalty_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('spend_earn','birthday_bonus','category_bonus','first_purchase_bonus','double_points_window')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  priority INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, key)
);
CREATE INDEX IF NOT EXISTS crm_loyalty_rules_org_active_idx ON public.crm_loyalty_rules(organization_id, is_active, priority);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_loyalty_rules TO authenticated;
GRANT ALL ON public.crm_loyalty_rules TO service_role;
ALTER TABLE public.crm_loyalty_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_rules_org_read" ON public.crm_loyalty_rules FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "loyalty_rules_org_write" ON public.crm_loyalty_rules FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.crm_reward_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  points_cost INTEGER NOT NULL CHECK (points_cost > 0),
  stock INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);
CREATE INDEX IF NOT EXISTS crm_reward_catalog_org_idx ON public.crm_reward_catalog(organization_id, is_active);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_reward_catalog TO authenticated;
GRANT ALL ON public.crm_reward_catalog TO service_role;
ALTER TABLE public.crm_reward_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reward_catalog_org_read" ON public.crm_reward_catalog FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "reward_catalog_org_write" ON public.crm_reward_catalog FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.crm_reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES public.crm_reward_catalog(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES public.crm_loyalty_accounts(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES public.crm_loyalty_transactions(id) ON DELETE RESTRICT,
  points_spent INTEGER NOT NULL CHECK (points_spent > 0),
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','fulfilled','cancelled')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_reward_redemptions_org_idx ON public.crm_reward_redemptions(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS crm_reward_redemptions_customer_idx ON public.crm_reward_redemptions(customer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_reward_redemptions TO authenticated;
GRANT ALL ON public.crm_reward_redemptions TO service_role;
ALTER TABLE public.crm_reward_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reward_redemptions_org_read" ON public.crm_reward_redemptions FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "reward_redemptions_org_write" ON public.crm_reward_redemptions FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.crm_loyalty_expirations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.crm_loyalty_accounts(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  points INTEGER NOT NULL CHECK (points > 0),
  scheduled_for TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  transaction_id UUID REFERENCES public.crm_loyalty_transactions(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_loyalty_expirations_pending_idx
  ON public.crm_loyalty_expirations(organization_id, scheduled_for) WHERE processed_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_loyalty_expirations TO authenticated;
GRANT ALL ON public.crm_loyalty_expirations TO service_role;
ALTER TABLE public.crm_loyalty_expirations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_expirations_org_read" ON public.crm_loyalty_expirations FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "loyalty_expirations_org_write" ON public.crm_loyalty_expirations FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

DROP TRIGGER IF EXISTS trg_loyalty_tiers_updated_at ON public.crm_loyalty_tiers;
CREATE TRIGGER trg_loyalty_tiers_updated_at BEFORE UPDATE ON public.crm_loyalty_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_loyalty_accounts_updated_at ON public.crm_loyalty_accounts;
CREATE TRIGGER trg_loyalty_accounts_updated_at BEFORE UPDATE ON public.crm_loyalty_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_loyalty_rules_updated_at ON public.crm_loyalty_rules;
CREATE TRIGGER trg_loyalty_rules_updated_at BEFORE UPDATE ON public.crm_loyalty_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_reward_catalog_updated_at ON public.crm_reward_catalog;
CREATE TRIGGER trg_reward_catalog_updated_at BEFORE UPDATE ON public.crm_reward_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_reward_redemptions_updated_at ON public.crm_reward_redemptions;
CREATE TRIGGER trg_reward_redemptions_updated_at BEFORE UPDATE ON public.crm_reward_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.crm_loyalty_recompute_balance(p_account_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_balance INTEGER; v_lifetime INTEGER;
BEGIN
  SELECT COALESCE(SUM(points), 0) INTO v_balance
    FROM public.crm_loyalty_transactions WHERE account_id = p_account_id;
  SELECT COALESCE(SUM(points), 0) INTO v_lifetime
    FROM public.crm_loyalty_transactions
    WHERE account_id = p_account_id AND kind IN ('earn','bonus') AND points > 0;
  UPDATE public.crm_loyalty_accounts
    SET points_balance = v_balance, points_lifetime_earned = v_lifetime, updated_at = now()
    WHERE id = p_account_id;
  RETURN v_balance;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.crm_loyalty_recompute_balance(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_loyalty_recompute_balance(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.crm_loyalty_recompute_tier(p_account_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_tier UUID; v_org UUID; v_lifetime INTEGER;
BEGIN
  SELECT organization_id, points_lifetime_earned INTO v_org, v_lifetime
    FROM public.crm_loyalty_accounts WHERE id = p_account_id;
  IF v_org IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO v_tier FROM public.crm_loyalty_tiers
    WHERE organization_id = v_org AND is_active
      AND min_lifetime_points <= COALESCE(v_lifetime, 0)
    ORDER BY min_lifetime_points DESC LIMIT 1;
  UPDATE public.crm_loyalty_accounts SET current_tier_id = v_tier WHERE id = p_account_id;
  RETURN v_tier;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.crm_loyalty_recompute_tier(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_loyalty_recompute_tier(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.crm_loyalty_apply_txn(
  p_account_id UUID,
  p_kind TEXT,
  p_points INTEGER,
  p_reason TEXT,
  p_source_ref TEXT,
  p_correlation_id TEXT,
  p_metadata JSONB,
  p_created_by UUID
)
RETURNS TABLE (transaction_id UUID, new_balance INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_org UUID; v_customer UUID; v_current INTEGER; v_new INTEGER; v_txn UUID;
BEGIN
  IF p_points = 0 THEN
    RAISE EXCEPTION 'crm_loyalty_apply_txn: points cannot be zero';
  END IF;
  IF p_kind NOT IN ('earn','redeem','reverse','expire','adjust','bonus') THEN
    RAISE EXCEPTION 'crm_loyalty_apply_txn: invalid kind %', p_kind;
  END IF;

  SELECT organization_id, customer_id, points_balance
    INTO v_org, v_customer, v_current
    FROM public.crm_loyalty_accounts WHERE id = p_account_id FOR UPDATE;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'crm_loyalty_apply_txn: account % not found', p_account_id;
  END IF;

  v_new := v_current + p_points;
  IF p_points < 0 AND v_new < 0 THEN
    RAISE EXCEPTION 'crm_loyalty_apply_txn: insufficient balance (have %, need %)', v_current, -p_points;
  END IF;

  INSERT INTO public.crm_loyalty_transactions
    (organization_id, account_id, customer_id, kind, points, reason, source_ref, correlation_id, metadata, created_by)
  VALUES (v_org, p_account_id, v_customer, p_kind, p_points, p_reason, p_source_ref, p_correlation_id,
          COALESCE(p_metadata, '{}'::jsonb), p_created_by)
  RETURNING id INTO v_txn;

  PERFORM public.crm_loyalty_recompute_balance(p_account_id);
  PERFORM public.crm_loyalty_recompute_tier(p_account_id);

  RETURN QUERY SELECT v_txn, v_new;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.crm_loyalty_apply_txn(UUID, TEXT, INTEGER, TEXT, TEXT, TEXT, JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_loyalty_apply_txn(UUID, TEXT, INTEGER, TEXT, TEXT, TEXT, JSONB, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.crm_loyalty_seed_tiers(p_org UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.crm_loyalty_tiers (organization_id, code, name, min_lifetime_points, multiplier, color)
  VALUES
    (p_org, 'BRONZE',   'Bronze',       0,     1.00, '#cd7f32'),
    (p_org, 'SILVER',   'Silver',    1000,     1.10, '#c0c0c0'),
    (p_org, 'GOLD',     'Gold',      5000,     1.25, '#d4af37'),
    (p_org, 'PLATINUM', 'Platinum', 20000,     1.50, '#e5e4e2')
  ON CONFLICT (organization_id, code) DO NOTHING;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.crm_loyalty_seed_tiers(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_loyalty_seed_tiers(UUID) TO service_role;
