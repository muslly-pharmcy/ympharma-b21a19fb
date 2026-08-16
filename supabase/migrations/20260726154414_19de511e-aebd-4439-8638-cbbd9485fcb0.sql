-- Replace overly-broad ALL policies on crm_* tables with permission-gated writes.
-- Reads by any org member remain allowed via existing *_org_read policies (or new ones where missing).

-- Helper: drop old ALL policies
DROP POLICY IF EXISTS loyalty_accounts_org_write ON public.crm_loyalty_accounts;
DROP POLICY IF EXISTS loyalty_txn_org_write ON public.crm_loyalty_transactions;
DROP POLICY IF EXISTS loyalty_expirations_org_write ON public.crm_loyalty_expirations;
DROP POLICY IF EXISTS loyalty_rules_org_write ON public.crm_loyalty_rules;
DROP POLICY IF EXISTS loyalty_tiers_org_write ON public.crm_loyalty_tiers;
DROP POLICY IF EXISTS promotions_org_write ON public.crm_promotions;
DROP POLICY IF EXISTS reward_catalog_org_write ON public.crm_reward_catalog;
DROP POLICY IF EXISTS reward_redemptions_org_write ON public.crm_reward_redemptions;
DROP POLICY IF EXISTS coupons_org_all ON public.crm_coupons;
DROP POLICY IF EXISTS crm_customers_org_members ON public.crm_customers;

-- crm_customers needs an explicit read policy since old ALL policy handled both.
CREATE POLICY crm_customers_org_read ON public.crm_customers
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY crm_customers_manage_write ON public.crm_customers
  FOR ALL TO authenticated
  USING (public.has_org_permission(auth.uid(), organization_id, 'crm.customers.manage'))
  WITH CHECK (public.has_org_permission(auth.uid(), organization_id, 'crm.customers.manage'));

-- crm_coupons needs explicit read policy (old policy was ALL).
CREATE POLICY coupons_org_read ON public.crm_coupons
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY coupons_manage_write ON public.crm_coupons
  FOR ALL TO authenticated
  USING (public.has_org_permission(auth.uid(), organization_id, 'crm.promotions.manage'))
  WITH CHECK (public.has_org_permission(auth.uid(), organization_id, 'crm.promotions.manage'));

-- Loyalty tables: gated by loyalty.manage
CREATE POLICY loyalty_accounts_manage_write ON public.crm_loyalty_accounts
  FOR ALL TO authenticated
  USING (public.has_org_permission(auth.uid(), organization_id, 'crm.loyalty.manage'))
  WITH CHECK (public.has_org_permission(auth.uid(), organization_id, 'crm.loyalty.manage'));

CREATE POLICY loyalty_txn_manage_write ON public.crm_loyalty_transactions
  FOR ALL TO authenticated
  USING (public.has_org_permission(auth.uid(), organization_id, 'crm.loyalty.manage'))
  WITH CHECK (public.has_org_permission(auth.uid(), organization_id, 'crm.loyalty.manage'));

CREATE POLICY loyalty_expirations_manage_write ON public.crm_loyalty_expirations
  FOR ALL TO authenticated
  USING (public.has_org_permission(auth.uid(), organization_id, 'crm.loyalty.manage'))
  WITH CHECK (public.has_org_permission(auth.uid(), organization_id, 'crm.loyalty.manage'));

CREATE POLICY loyalty_rules_manage_write ON public.crm_loyalty_rules
  FOR ALL TO authenticated
  USING (public.has_org_permission(auth.uid(), organization_id, 'crm.loyalty.manage'))
  WITH CHECK (public.has_org_permission(auth.uid(), organization_id, 'crm.loyalty.manage'));

CREATE POLICY loyalty_tiers_manage_write ON public.crm_loyalty_tiers
  FOR ALL TO authenticated
  USING (public.has_org_permission(auth.uid(), organization_id, 'crm.loyalty.manage'))
  WITH CHECK (public.has_org_permission(auth.uid(), organization_id, 'crm.loyalty.manage'));

-- Promotions / reward catalog / redemptions: gated by promotions.manage
CREATE POLICY promotions_manage_write ON public.crm_promotions
  FOR ALL TO authenticated
  USING (public.has_org_permission(auth.uid(), organization_id, 'crm.promotions.manage'))
  WITH CHECK (public.has_org_permission(auth.uid(), organization_id, 'crm.promotions.manage'));

CREATE POLICY reward_catalog_manage_write ON public.crm_reward_catalog
  FOR ALL TO authenticated
  USING (public.has_org_permission(auth.uid(), organization_id, 'crm.promotions.manage'))
  WITH CHECK (public.has_org_permission(auth.uid(), organization_id, 'crm.promotions.manage'));

CREATE POLICY reward_redemptions_manage_write ON public.crm_reward_redemptions
  FOR ALL TO authenticated
  USING (public.has_org_permission(auth.uid(), organization_id, 'crm.promotions.manage'))
  WITH CHECK (public.has_org_permission(auth.uid(), organization_id, 'crm.promotions.manage'));