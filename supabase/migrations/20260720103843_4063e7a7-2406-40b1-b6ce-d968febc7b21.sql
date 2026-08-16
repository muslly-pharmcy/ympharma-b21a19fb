
-- AI Runtime (Phase 5) — Prompt Registry, Agents, Runs
CREATE TABLE IF NOT EXISTS public.air_prompts (
  key TEXT PRIMARY KEY,
  version INT NOT NULL DEFAULT 1,
  system_prompt TEXT NOT NULL,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.air_prompts TO authenticated;
GRANT ALL ON public.air_prompts TO service_role;
ALTER TABLE public.air_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY air_prompts_read ON public.air_prompts FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.air_agents (
  key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT,
  prompt_key TEXT NOT NULL REFERENCES public.air_prompts(key),
  model TEXT NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  allowed_tools TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  temperature NUMERIC NOT NULL DEFAULT 0.3,
  max_tokens INT NOT NULL DEFAULT 1500,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.air_agents TO authenticated;
GRANT ALL ON public.air_agents TO service_role;
ALTER TABLE public.air_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY air_agents_read ON public.air_agents FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.air_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  actor_user_id UUID NOT NULL,
  agent_key TEXT NOT NULL REFERENCES public.air_agents(key),
  model TEXT NOT NULL,
  input TEXT NOT NULL,
  output TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|success|error
  error_message TEXT,
  tools_used TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  prompt_tokens INT,
  completion_tokens INT,
  total_tokens INT,
  latency_ms INT,
  correlation_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS air_runs_org_created_idx ON public.air_runs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS air_runs_agent_idx ON public.air_runs(agent_key, created_at DESC);
GRANT SELECT ON public.air_runs TO authenticated;
GRANT ALL ON public.air_runs TO service_role;
ALTER TABLE public.air_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY air_runs_read_org ON public.air_runs FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

-- Seed 3 prompts
INSERT INTO public.air_prompts (key, system_prompt, description) VALUES
('pharmacy_assistant.v1',
 'أنت مساعد صيدلي محترف داخل نظام MUSLLY AI OS. مهمتك تقديم إجابات دقيقة، موجزة، وبالعربية عندما يُسأل بالعربية. اعتمد فقط على السياق المُقدَّم (context) ولا تختلق بيانات. عند غياب معلومة قل ذلك صراحة. لا تُقدم استشارة طبية نهائية — كل تحذير سريري استشاري فقط.',
 'Pharmacy floor assistant — Q&A over catalog/inventory context'),
('inventory_analyst.v1',
 'أنت محلل مخزون. حلّل بيانات المخزون المُقدمة (منتجات، مستويات، تواريخ صلاحية) وقدم توصيات موجزة: منتجات قاربت على النفاد، منتجات معرضة للانتهاء، بنود يُنصح بإعادة طلبها. اكتب بالعربية بصيغة نقاط قصيرة. لا تخترع أرقاماً.',
 'Inventory analyst — reorder + expiry suggestions'),
('executive_assistant.v1',
 'أنت مساعد تنفيذي للمدير العام. لخّص السياق التشغيلي المُقدَّم (أوامر شراء مفتوحة، وصفات، مطالبات تأمين) في تقرير موجز من 5-7 نقاط بالعربية. أبرز المخاطر والفرص. لا تفترض معلومات غير موجودة في السياق.',
 'Executive assistant — daily operational digest')
ON CONFLICT (key) DO UPDATE SET
  system_prompt = EXCLUDED.system_prompt,
  description = EXCLUDED.description,
  updated_at = now();

-- Seed 3 agents
INSERT INTO public.air_agents (key, display_name, description, prompt_key, allowed_tools) VALUES
('pharmacy_assistant', 'مساعد الصيدلية', 'مساعد للصيدلي على الأرض للإجابة عن الأدوية والمخزون', 'pharmacy_assistant.v1', ARRAY['search_products','get_product_stock']),
('inventory_analyst', 'محلل المخزون', 'تحليل المخزون واقتراحات إعادة الطلب والصلاحية', 'inventory_analyst.v1', ARRAY['list_low_stock','list_expiring_soon']),
('executive_assistant', 'المساعد التنفيذي', 'تقرير تشغيلي مختصر للمدير العام', 'executive_assistant.v1', ARRAY['ops_snapshot'])
ON CONFLICT (key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  prompt_key = EXCLUDED.prompt_key,
  allowed_tools = EXCLUDED.allowed_tools,
  updated_at = now();
