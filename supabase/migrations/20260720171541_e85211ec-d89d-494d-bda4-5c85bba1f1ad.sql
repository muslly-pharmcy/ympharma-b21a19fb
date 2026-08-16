
-- =============================================================
-- AI Runtime Layer 0 — Governance Foundation
-- =============================================================

-- Extend air_prompts with governance columns
ALTER TABLE public.air_prompts
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved'
    CHECK (status IN ('draft','approved','deprecated')),
  ADD COLUMN IF NOT EXISTS guardrails JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS output_schema JSONB,
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rollback_version INT,
  ADD COLUMN IF NOT EXISTS evaluation_score NUMERIC(4,3);

-- =============================================================
-- air_policies — Policy Engine rules
-- =============================================================
CREATE TABLE IF NOT EXISTS public.air_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  key TEXT NOT NULL,
  subject TEXT NOT NULL,            -- e.g. 'clinical.decision', 'tool.execute', 'agent.invoke'
  rule JSONB NOT NULL,              -- {when:{...}, require:[...], deny:false}
  priority INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.air_policies TO authenticated;
GRANT ALL ON public.air_policies TO service_role;
ALTER TABLE public.air_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY air_policies_read ON public.air_policies FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
CREATE POLICY air_policies_write ON public.air_policies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =============================================================
-- air_budgets — Budget Engine
-- =============================================================
CREATE TABLE IF NOT EXISTS public.air_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  scope TEXT NOT NULL,              -- 'global' | 'agent:<key>' | 'user:<uuid>'
  period TEXT NOT NULL CHECK (period IN ('daily','monthly','emergency')),
  token_limit INT,
  cost_limit_cents INT,
  latency_ms_limit INT,
  consumed_tokens INT NOT NULL DEFAULT 0,
  consumed_cost_cents INT NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, scope, period)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.air_budgets TO authenticated;
GRANT ALL ON public.air_budgets TO service_role;
ALTER TABLE public.air_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY air_budgets_read ON public.air_budgets FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
CREATE POLICY air_budgets_write ON public.air_budgets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =============================================================
-- air_capabilities — Capability Registry
-- =============================================================
CREATE TABLE IF NOT EXISTS public.air_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  agent_key TEXT NOT NULL,
  can_read BOOLEAN NOT NULL DEFAULT true,
  can_write BOOLEAN NOT NULL DEFAULT false,
  can_execute BOOLEAN NOT NULL DEFAULT false,
  can_call_tools BOOLEAN NOT NULL DEFAULT true,
  can_approve BOOLEAN NOT NULL DEFAULT false,
  can_learn BOOLEAN NOT NULL DEFAULT true,
  allowed_domains TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, agent_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.air_capabilities TO authenticated;
GRANT ALL ON public.air_capabilities TO service_role;
ALTER TABLE public.air_capabilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY air_caps_read ON public.air_capabilities FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
CREATE POLICY air_caps_write ON public.air_capabilities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =============================================================
-- air_evaluations — Evaluation Engine
-- =============================================================
CREATE TABLE IF NOT EXISTS public.air_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  run_id UUID NOT NULL,
  quality NUMERIC(4,3),          -- 0..1
  latency_ms INT,
  cost_cents INT,
  success BOOLEAN NOT NULL DEFAULT true,
  retries INT NOT NULL DEFAULT 0,
  feedback JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS air_evaluations_run_idx ON public.air_evaluations(run_id);
CREATE INDEX IF NOT EXISTS air_evaluations_org_created_idx ON public.air_evaluations(organization_id, created_at DESC);
GRANT SELECT, INSERT ON public.air_evaluations TO authenticated;
GRANT ALL ON public.air_evaluations TO service_role;
ALTER TABLE public.air_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY air_evals_read ON public.air_evaluations FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
CREATE POLICY air_evals_insert ON public.air_evaluations FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

-- =============================================================
-- air_kernel_calls — Brain Kernel audit
-- =============================================================
CREATE TABLE IF NOT EXISTS public.air_kernel_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  correlation_id TEXT,
  from_agent TEXT,               -- null when initiated by user
  to_agent TEXT NOT NULL,
  purpose TEXT NOT NULL,
  allowed BOOLEAN NOT NULL,
  decision JSONB NOT NULL DEFAULT '{}'::jsonb,
  policy_key TEXT,
  denied_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS air_kernel_calls_org_idx ON public.air_kernel_calls(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS air_kernel_calls_corr_idx ON public.air_kernel_calls(correlation_id);
GRANT SELECT, INSERT ON public.air_kernel_calls TO authenticated;
GRANT ALL ON public.air_kernel_calls TO service_role;
ALTER TABLE public.air_kernel_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY air_kernel_read ON public.air_kernel_calls FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
CREATE POLICY air_kernel_insert ON public.air_kernel_calls FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

-- =============================================================
-- air_memory_layers — Memory Manager (short/working/long/archive)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.air_memory_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  agent_key TEXT NOT NULL,
  layer TEXT NOT NULL CHECK (layer IN ('short','working','long','archive')),
  key TEXT,
  content TEXT NOT NULL,
  importance NUMERIC(4,3) NOT NULL DEFAULT 0.5,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS air_mem_lookup_idx ON public.air_memory_layers(organization_id, agent_key, layer, created_at DESC);
CREATE INDEX IF NOT EXISTS air_mem_expiry_idx ON public.air_memory_layers(expires_at) WHERE expires_at IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.air_memory_layers TO authenticated;
GRANT ALL ON public.air_memory_layers TO service_role;
ALTER TABLE public.air_memory_layers ENABLE ROW LEVEL SECURITY;
CREATE POLICY air_mem_read ON public.air_memory_layers FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
CREATE POLICY air_mem_write ON public.air_memory_layers FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
