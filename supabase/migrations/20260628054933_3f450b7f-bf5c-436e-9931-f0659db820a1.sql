-- SEC-P1-003 Batch 2 — REVOKE EXECUTE from authenticated for 57 SECURITY DEFINER functions
BEGIN;

-- RESTRICT_ADMIN_ONLY (5)
REVOKE EXECUTE ON FUNCTION public.current_inventory_write_mode() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.exec_dashboard() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_order_cancel_release() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.inventory_report() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.release_order_stock(_order_id text, _actor text, _reason text) FROM authenticated;

-- SERVICE_ROLE_ONLY (52)
REVOKE EXECUTE ON FUNCTION public.ack_staff_alert(_id uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.alert_on_failed_agent_action() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_populate_bundle_items() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.branch_reorder_suggestions(_branch_id uuid, _lookback_days integer, _coverage_days integer, _limit integer, _offset integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.check_tracking_rate_limit(_ip text, _max integer, _window_seconds integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_agent_events(_limit integer, _worker text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_customer_rx_notifications(_limit integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_rate_limit(_key text, _max integer, _window_seconds integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.detect_stale_transfers(_stale_minutes integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.emit_event_on_order_insert() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.emit_event_on_prescription_insert() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.emit_order_event(_order_id text, _event_name text, _correlation_id uuid, _meta jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.emit_order_status_event() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.emit_prescription_review_requested() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_chronic_refill_action(_customer_phone text, _tier text, _discount_code text, _message_arabic text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_customer_order_notification() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_customer_rx_notification() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fail_agent_event(_event_id uuid, _processed_by text, _error text, _max_retries integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_agent_actions() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_invoice_number() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_marketing_campaigns() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.intercept_new_order() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.intercept_new_prescription() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_inventory_shadow(_order_id text, _legacy_id integer, _requested_qty integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_product_stock_change() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_table_activity() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_event_processed(_event_id uuid, _processed_by text, _error text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_inventory_audit_issues() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.on_order_inserted_alert() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.on_rx_inserted_alert() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.open_escalation_on_review() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.publish_transfer_event() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.rebuild_customer_intel() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_loyalty_tier(_phone text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.record_order_status_change() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.release_transfer_reservation(_transfer_id uuid, _reason text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.reserve_order_stock(_order_id text, _actor text, _reason text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.run_bi_worker() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.run_ceo_worker() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.run_cto_worker() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.run_cx_worker() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.run_inventory_worker() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.run_marketing_worker() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.run_operations_worker() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.run_sales_worker() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_prescription_review() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_publish_wa_escalation_event() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_publish_wa_message_event() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.transfer_status_guard() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.trim_img_proxy_logs() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_prescription_review_transition() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_prescription_image_coverage() FROM authenticated;

COMMIT;
