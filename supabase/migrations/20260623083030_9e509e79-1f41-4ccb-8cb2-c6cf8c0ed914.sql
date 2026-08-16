CREATE TABLE public.agent_weights (
  id BIGSERIAL PRIMARY KEY,
  criterion TEXT UNIQUE NOT NULL,
  weight NUMERIC(5,4) NOT NULL CHECK (weight >= 0 AND weight <= 1),
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT ON public.agent_weights TO authenticated;
GRANT ALL ON public.agent_weights TO service_role;

ALTER TABLE public.agent_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage agent_weights" ON public.agent_weights
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role));

CREATE OR REPLACE FUNCTION public.touch_agent_weights_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_agent_weights_updated_at
  BEFORE UPDATE ON public.agent_weights
  FOR EACH ROW EXECUTE FUNCTION public.touch_agent_weights_updated_at();

INSERT INTO public.agent_weights (criterion, weight, description) VALUES
  ('stock_velocity', 0.30, 'سرعة بيع المنتج خلال آخر 14 يوم'),
  ('profit_margin', 0.25, 'هامش الربح (price - supplier_cost) / price'),
  ('days_since_last_promotion', 0.20, 'عدد الأيام منذ آخر منشور لهذا المنتج'),
  ('seasonal_factor', 0.15, 'عامل موسمي يحدده الأدمن'),
  ('interaction_score', 0.10, 'متوسط تفاعل آخر 3 منشورات')
ON CONFLICT (criterion) DO NOTHING;
