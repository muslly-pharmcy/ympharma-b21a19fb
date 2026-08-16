CREATE TABLE public.ai_business_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_type text NOT NULL,
  summary text NOT NULL,
  recommendation jsonb NOT NULL DEFAULT '{}'::jsonb,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric NOT NULL DEFAULT 0,
  agent_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ai_business_insights TO authenticated;
GRANT ALL ON public.ai_business_insights TO service_role;
ALTER TABLE public.ai_business_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read business insights" ON public.ai_business_insights FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "service writes business insights" ON public.ai_business_insights FOR INSERT
  TO service_role WITH CHECK (true);
CREATE INDEX ai_business_insights_type_idx ON public.ai_business_insights(insight_type, created_at DESC);
