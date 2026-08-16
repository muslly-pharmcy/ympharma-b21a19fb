
CREATE TABLE IF NOT EXISTS public.prescription_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_file_id UUID NOT NULL REFERENCES public.prescription_files(id) ON DELETE CASCADE,
  prescription_id TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'prescription' CHECK (source_type IN ('prescription','insurance')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','review','failed')),
  model_tier TEXT NOT NULL DEFAULT 'flash' CHECK (model_tier IN ('flash','pro')),
  model_used TEXT,
  attempts INT NOT NULL DEFAULT 0,
  confidence NUMERIC(5,2),
  medications JSONB NOT NULL DEFAULT '[]'::jsonb,
  doctor_name TEXT,
  prescription_date DATE,
  diagnosis TEXT,
  allergies JSONB NOT NULL DEFAULT '[]'::jsonb,
  interactions JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_response JSONB,
  error TEXT,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rx_extr_status_idx ON public.prescription_extractions (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS rx_extr_file_idx ON public.prescription_extractions (prescription_file_id);
CREATE INDEX IF NOT EXISTS rx_extr_rx_idx ON public.prescription_extractions (prescription_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS rx_extr_one_per_file ON public.prescription_extractions (prescription_file_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescription_extractions TO authenticated;
GRANT ALL ON public.prescription_extractions TO service_role;

ALTER TABLE public.prescription_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rx_extr admin read" ON public.prescription_extractions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));

CREATE POLICY "rx_extr admin write" ON public.prescription_extractions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));

CREATE OR REPLACE FUNCTION public.tg_rx_extr_touch() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS rx_extr_touch ON public.prescription_extractions;
CREATE TRIGGER rx_extr_touch BEFORE UPDATE ON public.prescription_extractions
  FOR EACH ROW EXECUTE FUNCTION public.tg_rx_extr_touch();

CREATE OR REPLACE FUNCTION public.tg_rx_file_enqueue_extraction() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_source TEXT;
BEGIN
  v_source := CASE
    WHEN NEW.bucket ILIKE '%insurance%' OR NEW.object_path ILIKE 'insurance/%' THEN 'insurance'
    ELSE 'prescription' END;
  INSERT INTO public.prescription_extractions (prescription_file_id, prescription_id, source_type)
  VALUES (NEW.id, NEW.prescription_id, v_source)
  ON CONFLICT (prescription_file_id) DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS rx_file_enqueue_extraction ON public.prescription_files;
CREATE TRIGGER rx_file_enqueue_extraction
  AFTER INSERT ON public.prescription_files
  FOR EACH ROW WHEN (NEW.deleted_at IS NULL)
  EXECUTE FUNCTION public.tg_rx_file_enqueue_extraction();
