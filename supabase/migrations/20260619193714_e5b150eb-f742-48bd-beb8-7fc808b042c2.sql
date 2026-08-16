-- Tighten access on internal SECURITY DEFINER functions:
-- revoke EXECUTE from anon/authenticated so only triggers, cron, and
-- service_role can call them. Public-facing helpers (has_role, has_permission,
-- admin_stats, bootstrap_owner, create_backup, log_activity,
-- get_order_public, get_order_history_public) keep their default grants —
-- each enforces its own authorization inside the function body.

REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_scheduled_backup(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_retention_policy() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_img_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_table_activity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trim_img_proxy_logs() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_order_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
