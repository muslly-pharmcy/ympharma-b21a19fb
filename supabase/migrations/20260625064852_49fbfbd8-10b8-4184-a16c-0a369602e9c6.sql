CREATE TABLE IF NOT EXISTS public.operations_alerts_v14 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  message TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operations_alerts_v14 TO authenticated;
GRANT ALL ON public.operations_alerts_v14 TO service_role;

ALTER TABLE public.operations_alerts_v14 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_alerts" ON public.operations_alerts_v14
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_dedupe_v14 ON public.operations_alerts_v14(user_id, dedupe_key);
CREATE INDEX IF NOT EXISTS idx_operations_alerts_v14_user_id ON public.operations_alerts_v14(user_id);
CREATE INDEX IF NOT EXISTS idx_operations_alerts_v14_created_at ON public.operations_alerts_v14(created_at);
CREATE INDEX IF NOT EXISTS idx_operations_alerts_v14_read_at ON public.operations_alerts_v14(read_at);
