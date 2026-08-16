
-- Section 1: Automation Hub ledger extensions for agent_actions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'action_execution_status') THEN
    CREATE TYPE public.action_execution_status AS ENUM ('PENDING_APPROVAL','EXECUTED','SKIPPED','FAILED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'action_target_pipeline') THEN
    CREATE TYPE public.action_target_pipeline AS ENUM ('PRESCRIPTIONS','ORDERS','MARKETING_QUEUE','INVENTORY');
  END IF;
END $$;

ALTER TABLE public.agent_actions
  ADD COLUMN IF NOT EXISTS originating_agent public.valid_agent_modes,
  ADD COLUMN IF NOT EXISTS target_pipeline public.action_target_pipeline,
  ADD COLUMN IF NOT EXISTS execution_status public.action_execution_status DEFAULT 'PENDING_APPROVAL',
  ADD COLUMN IF NOT EXISTS priority_level VARCHAR(10),
  ADD COLUMN IF NOT EXISTS compiled_arabic_output TEXT,
  ADD COLUMN IF NOT EXISTS updated_by_admin VARCHAR(255);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_actions_priority_chk') THEN
    ALTER TABLE public.agent_actions
      ADD CONSTRAINT agent_actions_priority_chk
      CHECK (priority_level IS NULL OR priority_level IN ('CRITICAL','HIGH','MEDIUM','LOW'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agent_actions_exec_status ON public.agent_actions (execution_status);
CREATE INDEX IF NOT EXISTS idx_agent_actions_target_pipeline ON public.agent_actions (target_pipeline);
CREATE INDEX IF NOT EXISTS idx_agent_actions_originating_agent ON public.agent_actions (originating_agent);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_actions TO authenticated;
GRANT ALL ON public.agent_actions TO service_role;

-- Section 2.1: Prescription intercept trigger
-- Inserts a PENDING_APPROVAL pharmacist row into agent_actions for every new prescription.
CREATE OR REPLACE FUNCTION public.intercept_new_prescription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.agent_actions (
    agent_name, action_type, payload, status,
    originating_agent, target_pipeline, execution_status, priority_level,
    compiled_arabic_output
  ) VALUES (
    'pharmacist',
    'EXTRACT_AND_QUOTE',
    jsonb_build_object('prescription_id', NEW.id, 'customer_phone', NEW.customer_phone, 'image_path', NEW.image_path),
    'pending',
    'pharmacist'::public.valid_agent_modes,
    'PRESCRIPTIONS'::public.action_target_pipeline,
    'PENDING_APPROVAL'::public.action_execution_status,
    'HIGH',
    'وصفة جديدة بانتظار الاستخراج والتسعير من الصيدلي الذكي.'
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.error_logs (source, message, context)
  VALUES ('intercept_new_prescription', SQLERRM, jsonb_build_object('prescription_id', NEW.id));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_intercept_new_prescription ON public.prescriptions;
CREATE TRIGGER trg_intercept_new_prescription
  AFTER INSERT ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.intercept_new_prescription();

-- Section 2.2: Order reservation trigger
CREATE OR REPLACE FUNCTION public.intercept_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.agent_actions (
    agent_name, action_type, payload, status,
    originating_agent, target_pipeline, execution_status, priority_level,
    compiled_arabic_output
  ) VALUES (
    'inventory',
    'RESERVE_STOCK',
    jsonb_build_object('order_id', NEW.id, 'customer_phone', NEW.customer_phone, 'total', NEW.total),
    'pending',
    'inventory'::public.valid_agent_modes,
    'ORDERS'::public.action_target_pipeline,
    'PENDING_APPROVAL'::public.action_execution_status,
    'CRITICAL',
    'طلب جديد بانتظار حجز المخزون والتأكيد التشغيلي.'
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.error_logs (source, message, context)
  VALUES ('intercept_new_order', SQLERRM, jsonb_build_object('order_id', NEW.id));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_intercept_new_order ON public.orders;
CREATE TRIGGER trg_intercept_new_order
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.intercept_new_order();

-- Section 2.3: Chronic refill enqueue helper (called by existing chronic-refills cron)
CREATE OR REPLACE FUNCTION public.enqueue_chronic_refill_action(
  _customer_phone TEXT,
  _tier TEXT,
  _discount_code TEXT,
  _message_arabic TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _id UUID;
BEGIN
  INSERT INTO public.agent_actions (
    agent_name, action_type, payload, status,
    originating_agent, target_pipeline, execution_status, priority_level,
    compiled_arabic_output
  ) VALUES (
    'refill',
    'CHRONIC_RETENTION',
    jsonb_build_object('customer_phone', _customer_phone, 'loyalty_tier', _tier, 'discount_code', _discount_code),
    'pending',
    'refill'::public.valid_agent_modes,
    'MARKETING_QUEUE'::public.action_target_pipeline,
    'PENDING_APPROVAL'::public.action_execution_status,
    'MEDIUM',
    _message_arabic
  ) RETURNING id INTO _id;
  RETURN _id;
END;
$$;
