
-- ============================================================
-- Phase 4C — AI Security Policy enforcement (DB layer)
-- ============================================================

-- 1) Audit table for every AI tool call
CREATE TABLE IF NOT EXISTS public.ai_tool_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id     text NOT NULL DEFAULT 'whatsapp-ai',
  conversation_id uuid NULL,
  tool_name    text NOT NULL,
  input        jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_phone   text NULL,
  status       text NOT NULL DEFAULT 'ok',   -- ok | error | denied
  duration_ms  integer NULL,
  error_message text NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_tool_events_created_at  ON public.ai_tool_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_tool_events_tool        ON public.ai_tool_events (tool_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_tool_events_conv        ON public.ai_tool_events (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_tool_events_status      ON public.ai_tool_events (status) WHERE status <> 'ok';

GRANT SELECT ON public.ai_tool_events TO authenticated;
GRANT ALL    ON public.ai_tool_events TO service_role;

ALTER TABLE public.ai_tool_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_tool_events admins read" ON public.ai_tool_events;
CREATE POLICY "ai_tool_events admins read"
  ON public.ai_tool_events
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'owner'::app_role)
  );

DROP POLICY IF EXISTS "ai_tool_events service writes" ON public.ai_tool_events;
CREATE POLICY "ai_tool_events service writes"
  ON public.ai_tool_events
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 2) Explicit ai_agent_role — non-login DB role used as a hard security boundary.
--    Even if a future tool tries to widen access, this role can never write.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ai_agent_role') THEN
    CREATE ROLE ai_agent_role NOLOGIN;
  END IF;
END$$;

-- Baseline: revoke everything on public schema from this role.
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM ai_agent_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ai_agent_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM ai_agent_role;
REVOKE ALL ON SCHEMA public                  FROM ai_agent_role;
GRANT  USAGE ON SCHEMA public                TO   ai_agent_role;

-- Read-only allow-list for the AI agent.
GRANT SELECT (id, name, brand, price, old_price, category, image_url, badge,
              description, is_published, legacy_id)
  ON public.products TO ai_agent_role;
GRANT SELECT ON public.branches            TO ai_agent_role;
GRANT SELECT ON public.order_status_history TO ai_agent_role;

-- Hard denials (idempotent — re-running is safe).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.products             FROM ai_agent_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.orders               FROM ai_agent_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.order_status_history FROM ai_agent_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.branch_inventory     FROM ai_agent_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.inventory_transfers  FROM ai_agent_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.transfer_items       FROM ai_agent_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.inventory_reservation_state FROM ai_agent_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.discount_codes       FROM ai_agent_role;

-- Block default future privileges in public for this role.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES    FROM ai_agent_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM ai_agent_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM ai_agent_role;

COMMENT ON ROLE ai_agent_role IS
  'Phase 4C AI security boundary. NOLOGIN. Read-only on products/branches/order_status_history. Never grant write privileges.';

COMMENT ON TABLE public.ai_tool_events IS
  'Audit log for every AI tool call (Phase 4C). Append-only via service_role; admins read.';
