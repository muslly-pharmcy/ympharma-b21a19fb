
-- 1) ai_agent_permissions
CREATE TABLE public.ai_agent_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  permission TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agent_name, permission)
);
GRANT SELECT ON public.ai_agent_permissions TO authenticated;
GRANT ALL ON public.ai_agent_permissions TO service_role;
ALTER TABLE public.ai_agent_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_read_ai_agent_permissions" ON public.ai_agent_permissions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- 2) ai_actions (tool execution ledger)
CREATE TABLE public.ai_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB,
  status TEXT NOT NULL DEFAULT 'completed',
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  approval_request_id UUID,
  error_message TEXT,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_actions_agent ON public.ai_actions(agent_name, created_at DESC);
CREATE INDEX idx_ai_actions_status ON public.ai_actions(status, created_at DESC);
GRANT SELECT ON public.ai_actions TO authenticated;
GRANT ALL ON public.ai_actions TO service_role;
ALTER TABLE public.ai_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_read_ai_actions" ON public.ai_actions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- 3) ai_world_health
CREATE TABLE public.ai_world_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_name TEXT NOT NULL,
  status TEXT NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_world_health_system ON public.ai_world_health(system_name, checked_at DESC);
GRANT SELECT ON public.ai_world_health TO authenticated;
GRANT ALL ON public.ai_world_health TO service_role;
ALTER TABLE public.ai_world_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_read_ai_world_health" ON public.ai_world_health
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Seed permissions
INSERT INTO public.ai_agent_permissions (agent_name, permission) VALUES
  ('pharmacist_agent','prescription.read'),
  ('pharmacist_agent','drug.info.read'),
  ('pharmacist_agent','interaction.check'),
  ('prescription_agent','prescription.read'),
  ('prescription_agent','prescription.review.queue'),
  ('interaction_agent','drug.info.read'),
  ('interaction_agent','interaction.check'),
  ('inventory_agent','inventory.read'),
  ('inventory_agent','inventory.predict'),
  ('expiry_agent','inventory.read'),
  ('expiry_agent','expiry.alert.read'),
  ('procurement_agent','inventory.read'),
  ('procurement_agent','procurement.recommend'),
  ('customer_agent','customer.message'),
  ('customer_agent','whatsapp.read'),
  ('support_agent','customer.message'),
  ('support_agent','support.escalate'),
  ('sales_agent','sales.read'),
  ('sales_agent','order.read'),
  ('marketing_agent','marketing.read'),
  ('marketing_agent','campaign.read'),
  ('guardian_agent','security.read'),
  ('guardian_agent','audit.read')
ON CONFLICT (agent_name, permission) DO NOTHING;
