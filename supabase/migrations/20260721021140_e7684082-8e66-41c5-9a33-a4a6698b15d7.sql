
-- Wave R1.3.2 — CRM cluster: enable Data API access under existing RLS.
-- Read-only for schema/data; only GRANTs and one missing policy pair added.

-- 1. Grants: every table below already has RLS + org-scoped policies keyed on
--    is_org_member(organization_id, auth.uid()). Missing grants are why the
--    server functions still route through supabaseAdmin. Adding these lets
--    R1.3.3 flip those handlers to context.supabase without behaviour change.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_customers            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_customer_contacts    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_customer_addresses   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_customer_tags        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_campaigns            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_campaign_events      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_segments             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_loyalty_accounts     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_loyalty_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_loyalty_rules        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_loyalty_tiers        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_reward_catalog       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_reward_redemptions   TO authenticated;

GRANT ALL ON public.crm_customers            TO service_role;
GRANT ALL ON public.crm_customer_contacts    TO service_role;
GRANT ALL ON public.crm_customer_addresses   TO service_role;
GRANT ALL ON public.crm_customer_tags        TO service_role;
GRANT ALL ON public.crm_campaigns            TO service_role;
GRANT ALL ON public.crm_campaign_events      TO service_role;
GRANT ALL ON public.crm_segments             TO service_role;
GRANT ALL ON public.crm_loyalty_accounts     TO service_role;
GRANT ALL ON public.crm_loyalty_transactions TO service_role;
GRANT ALL ON public.crm_loyalty_rules        TO service_role;
GRANT ALL ON public.crm_loyalty_tiers        TO service_role;
GRANT ALL ON public.crm_reward_catalog       TO service_role;
GRANT ALL ON public.crm_reward_redemptions   TO service_role;

-- No `anon` grants: every policy scopes on auth.uid() via is_org_member.

-- 2. Policy gap: crm_campaign_events had only SELECT + INSERT. Add UPDATE and
--    DELETE using the same org-membership predicate so authenticated users can
--    manage their own org's events under RLS.

DROP POLICY IF EXISTS crm_camp_ev_update ON public.crm_campaign_events;
CREATE POLICY crm_camp_ev_update ON public.crm_campaign_events
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS crm_camp_ev_delete ON public.crm_campaign_events;
CREATE POLICY crm_camp_ev_delete ON public.crm_campaign_events
  FOR DELETE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
