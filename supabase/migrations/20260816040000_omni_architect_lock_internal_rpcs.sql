-- Omni-Architect security hardening.
--
-- These RPCs are invoked only by server functions through supabaseAdmin.  They
-- are SECURITY DEFINER and several accept organization and actor identifiers as
-- arguments, so granting EXECUTE to `authenticated` would let a signed-in
-- browser bypass the application permission boundary by calling PostgREST RPC
-- directly.  Keep the Data API surface closed; service_role retains access for
-- the existing trusted server flows.

REVOKE ALL ON FUNCTION public.emit_domain_event(text, text, jsonb, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.emit_domain_event(text, text, jsonb, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.inv_emit(text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inv_emit(text, jsonb, text) TO service_role;

REVOKE ALL ON FUNCTION public.inv_receive_stock(uuid, uuid, uuid, uuid, numeric, numeric, text, date, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inv_receive_stock(uuid, uuid, uuid, uuid, numeric, numeric, text, date, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.inv_adjust_stock(uuid, numeric, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inv_adjust_stock(uuid, numeric, text, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.inv_reserve_fefo(uuid, uuid, numeric, text, uuid, uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inv_reserve_fefo(uuid, uuid, numeric, text, uuid, uuid, text, boolean) TO service_role;

REVOKE ALL ON FUNCTION public.inv_release_reservation(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inv_release_reservation(uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.inv_consume_reservation(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inv_consume_reservation(uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.inv_transfer_stock(uuid, uuid, uuid, uuid, numeric, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inv_transfer_stock(uuid, uuid, uuid, uuid, numeric, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.inv_return_stock(uuid, uuid, uuid, numeric, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inv_return_stock(uuid, uuid, uuid, numeric, text, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.po_receive(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.po_receive(uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.crm_campaign_transition(uuid, public.crm_campaign_status) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_campaign_transition(uuid, public.crm_campaign_status) TO service_role;

REVOKE ALL ON FUNCTION public.crm_segment_recalc(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_segment_recalc(uuid, uuid[]) TO service_role;

REVOKE ALL ON FUNCTION public.ensure_user_organization(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_user_organization(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.pg_get_indexdef_by_name(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pg_get_indexdef_by_name(text) TO service_role;
