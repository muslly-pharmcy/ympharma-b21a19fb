
CREATE OR REPLACE FUNCTION public.log_product_stock_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason text;
  v_source text;
  v_start  timestamptz := clock_timestamp();
  v_err    text;
  v_fail_count int;
  v_admin_email text;
  v_alert_payload jsonb;
BEGIN
  IF NEW.stock_qty IS DISTINCT FROM OLD.stock_qty THEN
    BEGIN
      v_reason := current_setting('app.adjust_reason', true);
      v_source := COALESCE(NULLIF(current_setting('app.adjust_source', true), ''), 'manual');

      INSERT INTO public.inventory_manual_adjustments
        (product_id, delta, before_qty, after_qty, reason, source, performed_by)
      VALUES (
        NEW.id,
        COALESCE(NEW.stock_qty, 0) - COALESCE(OLD.stock_qty, 0),
        COALESCE(OLD.stock_qty, 0),
        COALESCE(NEW.stock_qty, 0),
        NULLIF(v_reason, ''),
        v_source,
        auth.uid()
      );

      INSERT INTO public.trigger_metrics(trigger_name, status, duration_ms, payload)
      VALUES (
        'log_product_stock_change', 'ok',
        EXTRACT(MILLISECOND FROM (clock_timestamp() - v_start)),
        jsonb_build_object(
          'product_id', NEW.id,
          'delta', COALESCE(NEW.stock_qty,0) - COALESCE(OLD.stock_qty,0),
          'reason', NULLIF(v_reason, ''),
          'source', v_source
        )
      );
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLERRM;
      BEGIN
        INSERT INTO public.trigger_metrics(trigger_name, status, duration_ms, error_message, payload)
        VALUES (
          'log_product_stock_change', 'failed',
          EXTRACT(MILLISECOND FROM (clock_timestamp() - v_start)),
          v_err,
          jsonb_build_object('product_id', NEW.id, 'reason', NULLIF(v_reason,''), 'source', v_source)
        );

        SELECT count(*) INTO v_fail_count
          FROM public.trigger_metrics
         WHERE trigger_name = 'log_product_stock_change'
           AND status = 'failed'
           AND created_at > now() - interval '5 minutes';

        IF v_fail_count >= 5 THEN
          v_alert_payload := jsonb_build_object(
            'trigger', 'log_product_stock_change',
            'failures_5min', v_fail_count,
            'last_error', v_err,
            'reason', NULLIF(v_reason,''),
            'source', v_source,
            'product_id', NEW.id
          );

          INSERT INTO public.staff_alerts(severity, kind, title, body, channels, payload)
          VALUES (
            'high', 'trigger_failure',
            'تكرار فشل Trigger تسجيل تغييرات المخزون',
            format('فشل log_product_stock_change %s مرة خلال آخر 5 دقائق. آخر خطأ: %s',
                   v_fail_count, left(coalesce(v_err,''), 200)),
            ARRAY['whatsapp','email']::text[],
            v_alert_payload
          )
          ON CONFLICT DO NOTHING;

          -- Enqueue an admin email through the existing email queue.
          FOR v_admin_email IN
            SELECT u.email
              FROM auth.users u
              JOIN public.user_roles r ON r.user_id = u.id
             WHERE r.role IN ('owner','admin')
               AND u.email IS NOT NULL
             LIMIT 10
          LOOP
            PERFORM public.enqueue_email(
              'transactional_emails',
              jsonb_build_object(
                'template_name', 'incident-alert',
                'recipient_email', v_admin_email,
                'message_id', 'trigger-fail-' || to_char(now(), 'YYYYMMDDHH24MI'),
                'subject', '[تنبيه] فشل Trigger تسجيل تغييرات المخزون',
                'props', v_alert_payload
              )
            );
          END LOOP;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END;
  END IF;
  RETURN NEW;
END;
$$;
