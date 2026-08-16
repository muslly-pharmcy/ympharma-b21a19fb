
-- =========================================================
-- 1) Trigger metrics for stock_qty change logger
-- =========================================================
CREATE TABLE IF NOT EXISTS public.trigger_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('ok','failed')),
  duration_ms numeric,
  error_message text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trigger_metrics_name_time
  ON public.trigger_metrics(trigger_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trigger_metrics_status
  ON public.trigger_metrics(status, created_at DESC);

GRANT SELECT ON public.trigger_metrics TO authenticated;
GRANT ALL ON public.trigger_metrics TO service_role;

ALTER TABLE public.trigger_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin read trigger metrics" ON public.trigger_metrics
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- =========================================================
-- 2) Wrap the stock_qty trigger with metrics + error trapping
-- =========================================================
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
        'log_product_stock_change',
        'ok',
        EXTRACT(MILLISECOND FROM (clock_timestamp() - v_start)),
        jsonb_build_object('product_id', NEW.id, 'delta', COALESCE(NEW.stock_qty,0) - COALESCE(OLD.stock_qty,0))
      );
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLERRM;
      -- never block the parent UPDATE on metrics failure
      BEGIN
        INSERT INTO public.trigger_metrics(trigger_name, status, duration_ms, error_message, payload)
        VALUES (
          'log_product_stock_change',
          'failed',
          EXTRACT(MILLISECOND FROM (clock_timestamp() - v_start)),
          v_err,
          jsonb_build_object('product_id', NEW.id)
        );
        -- Auto-alert when error rate spikes (>=5 failures in last 5 min).
        IF (SELECT count(*) FROM public.trigger_metrics
              WHERE trigger_name = 'log_product_stock_change'
                AND status = 'failed'
                AND created_at > now() - interval '5 minutes') >= 5
        THEN
          INSERT INTO public.staff_alerts(severity, kind, title, body, payload)
          VALUES (
            'high',
            'trigger_failure',
            'تكرار فشل Trigger تسجيل تغييرات المخزون',
            'log_product_stock_change فشل 5 مرات أو أكثر خلال 5 دقائق — تحقق من جدول trigger_metrics.',
            jsonb_build_object('trigger', 'log_product_stock_change', 'last_error', v_err)
          )
          ON CONFLICT DO NOTHING;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        NULL; -- swallow metric-of-metric failures
      END;
    END;
  END IF;
  RETURN NEW;
END;
$$;

-- =========================================================
-- 3) Supplier link audit (with rollback support)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.supplier_link_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  before_supplier_name text,
  after_supplier_name text,
  before_supplier_cost numeric,
  after_supplier_cost numeric,
  reason text,
  performed_by uuid,
  rolled_back_at timestamptz,
  rolled_back_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_link_audit_batch
  ON public.supplier_link_audit(batch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_link_audit_product
  ON public.supplier_link_audit(product_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.supplier_link_audit TO authenticated;
GRANT ALL ON public.supplier_link_audit TO service_role;

ALTER TABLE public.supplier_link_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin read supplier audit" ON public.supplier_link_audit
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin write supplier audit" ON public.supplier_link_audit
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin update supplier audit" ON public.supplier_link_audit
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
