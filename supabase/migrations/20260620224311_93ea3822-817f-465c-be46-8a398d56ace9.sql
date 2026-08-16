-- Phase 6D — Approval requests ledger for WhatsApp AI agent
CREATE TABLE IF NOT EXISTS public.agent_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id text NOT NULL DEFAULT 'whatsapp-ai',
  conversation_id uuid,
  correlation_id text,
  user_phone text,
  action_type text NOT NULL CHECK (action_type IN (
    'create_order','approve_prescription','inventory_change','transfer','price_change','refund'
  )),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  customer_message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired')),
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.agent_approval_requests TO authenticated;
GRANT ALL ON public.agent_approval_requests TO service_role;

ALTER TABLE public.agent_approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read approval requests"
  ON public.agent_approval_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));

CREATE POLICY "Admins update approval requests"
  ON public.agent_approval_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));

CREATE INDEX IF NOT EXISTS idx_agent_approval_status_created
  ON public.agent_approval_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_approval_correlation
  ON public.agent_approval_requests(correlation_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_agent_approval_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_touch_agent_approval ON public.agent_approval_requests;
CREATE TRIGGER trg_touch_agent_approval BEFORE UPDATE ON public.agent_approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_agent_approval_updated_at();

-- Add correlation_id to existing ai_tool_events for cross-tool tracing
ALTER TABLE public.ai_tool_events
  ADD COLUMN IF NOT EXISTS correlation_id text;
CREATE INDEX IF NOT EXISTS idx_ai_tool_events_correlation
  ON public.ai_tool_events(correlation_id);

-- ===== Read-only RPC: prescription status (phone-locked, minimal disclosure) =====
CREATE OR REPLACE FUNCTION public.ai_get_prescription_status(_prescription_id text, _phone text)
RETURNS TABLE(id text, status text, created_at timestamptz, has_review boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.status, p.created_at,
         EXISTS(SELECT 1 FROM public.prescription_reviews r WHERE r.prescription_id = p.id) AS has_review
  FROM public.prescriptions p
  WHERE p.id = _prescription_id
    AND regexp_replace(coalesce(p.customer_phone,''), '\D', '', 'g')
      = regexp_replace(coalesce(_phone,''), '\D', '', 'g')
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.ai_get_prescription_status(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_get_prescription_status(text, text) TO service_role;

-- ===== Read-only RPC: branch availability for a product (no internal cost) =====
CREATE OR REPLACE FUNCTION public.ai_get_branch_availability(_product_query text)
RETURNS TABLE(product_id uuid, product_name text, branch_name text, in_stock boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.name, b.name,
         (coalesce(bi.qty,0) - coalesce(bi.reserved_qty,0)) > 0
  FROM public.products p
  JOIN public.branch_inventory bi ON bi.product_id = p.id
  JOIN public.branches b ON b.id = bi.branch_id
  WHERE p.is_published = true
    AND (p.name ILIKE '%' || _product_query || '%' OR p.brand ILIKE '%' || _product_query || '%')
  ORDER BY p.name, b.name
  LIMIT 30;
$$;

REVOKE ALL ON FUNCTION public.ai_get_branch_availability(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_get_branch_availability(text) TO service_role;
