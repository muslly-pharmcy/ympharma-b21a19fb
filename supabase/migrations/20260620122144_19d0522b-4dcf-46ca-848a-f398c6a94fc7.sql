-- Phase 6B Sprint 1: WhatsApp Prescription Notifications

-- Recipient configuration (admin-managed via app_settings)
INSERT INTO public.app_settings(key, value, updated_at)
VALUES
  ('prescription_notify_enabled', to_jsonb(false), now()),
  ('prescription_notify_recipients', '[]'::jsonb, now()),
  ('prescription_signed_url_ttl_seconds', to_jsonb(900), now())
ON CONFLICT (key) DO NOTHING;

-- Helper: enqueue PRESCRIPTION_REVIEW_REQUESTED on insert (Sprint 2 partial)
CREATE OR REPLACE FUNCTION public.emit_prescription_review_requested()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.emit_agent_event(
      'PRESCRIPTION_REVIEW_REQUESTED',
      'prescription',
      NEW.id,
      jsonb_build_object(
        'customer_phone', NEW.customer_phone,
        'image_count', COALESCE(array_length(NEW.image_urls, 1), 0)
      ),
      'trigger'
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.error_logs(source, message, metadata)
    VALUES ('emit_prescription_review_requested', SQLERRM, jsonb_build_object('rx_id', NEW.id))
    ON CONFLICT DO NOTHING;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_emit_review_requested ON public.prescriptions;
CREATE TRIGGER trg_emit_review_requested
AFTER INSERT ON public.prescriptions
FOR EACH ROW EXECUTE FUNCTION public.emit_prescription_review_requested();

-- Schedule WhatsApp dispatcher every minute (idempotent re-create)
DO $$
DECLARE
  v_proj text := 'project--4d4aad01-9bf4-4d8b-acab-e51a06a17c63';
  v_url text;
BEGIN
  v_url := 'https://' || v_proj || '.lovable.app/api/public/hooks/rx-notify';
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rx-notify-dispatch') THEN
    PERFORM cron.unschedule('rx-notify-dispatch');
  END IF;
  PERFORM cron.schedule(
    'rx-notify-dispatch',
    '* * * * *',
    format($cmd$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', current_setting('app.cron_secret', true)),
        body := '{"limit":20}'::jsonb
      );
    $cmd$, v_url)
  );
END$$;
