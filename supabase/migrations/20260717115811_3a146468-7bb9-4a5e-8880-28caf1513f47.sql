
-- Ensure vector ext (already enabled from Phase 1.3)
CREATE EXTENSION IF NOT EXISTS vector;

-- 1) Knowledge graph nodes
CREATE TABLE public.medical_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('DISEASE','SYMPTOM','MEDICINE','PROCEDURE','LAB_TEST','SPECIALTY')),
  slug text NOT NULL,
  name_ar text NOT NULL,
  name_en text,
  synonyms text[] DEFAULT '{}',
  description_ar text,
  description_en text,
  icd_code text,
  atc_code text,
  severity text,
  metadata jsonb NOT NULL DEFAULT '{}',
  embedding vector(768),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, slug)
);
GRANT SELECT ON public.medical_entities TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medical_entities TO authenticated;
GRANT ALL ON public.medical_entities TO service_role;
ALTER TABLE public.medical_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read entities" ON public.medical_entities FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage entities" ON public.medical_entities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX medical_entities_type_idx ON public.medical_entities (entity_type);
CREATE INDEX medical_entities_name_ar_trgm ON public.medical_entities USING gin (name_ar gin_trgm_ops);
CREATE INDEX medical_entities_embedding_idx ON public.medical_entities USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- 2) Typed edges
CREATE TABLE public.medical_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.medical_entities(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES public.medical_entities(id) ON DELETE CASCADE,
  relationship_type text NOT NULL CHECK (relationship_type IN
    ('causes','treats','symptom_of','specialist_for','contraindicates','interacts_with','indicates','part_of','related_to')),
  confidence numeric NOT NULL DEFAULT 0.5 CHECK (confidence BETWEEN 0 AND 1),
  evidence_source text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, target_id, relationship_type)
);
GRANT SELECT ON public.medical_relationships TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medical_relationships TO authenticated;
GRANT ALL ON public.medical_relationships TO service_role;
ALTER TABLE public.medical_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read relationships" ON public.medical_relationships FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage relationships" ON public.medical_relationships FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX medical_relationships_source_idx ON public.medical_relationships (source_id, relationship_type);
CREATE INDEX medical_relationships_target_idx ON public.medical_relationships (target_id, relationship_type);

-- 3) Drug interactions
CREATE TABLE public.drug_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_a_id uuid NOT NULL REFERENCES public.medical_entities(id) ON DELETE CASCADE,
  drug_b_id uuid NOT NULL REFERENCES public.medical_entities(id) ON DELETE CASCADE,
  severity text NOT NULL CHECK (severity IN ('minor','moderate','major','contraindicated')),
  mechanism text,
  clinical_effect_ar text,
  recommendation_ar text,
  evidence_source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (drug_a_id < drug_b_id),
  UNIQUE (drug_a_id, drug_b_id)
);
GRANT SELECT ON public.drug_interactions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drug_interactions TO authenticated;
GRANT ALL ON public.drug_interactions TO service_role;
ALTER TABLE public.drug_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read interactions" ON public.drug_interactions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage interactions" ON public.drug_interactions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX drug_interactions_a_idx ON public.drug_interactions (drug_a_id);
CREATE INDEX drug_interactions_b_idx ON public.drug_interactions (drug_b_id);

-- 4) Telemedicine session shells
CREATE TABLE public.telemedicine_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES public.hc_doctors(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.hc_patients(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.hc_appointments(id) ON DELETE SET NULL,
  session_type text NOT NULL DEFAULT 'video' CHECK (session_type IN ('video','audio','chat')),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','waiting','active','completed','cancelled','no_show')),
  join_token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  scheduled_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.telemedicine_sessions TO authenticated;
GRANT ALL ON public.telemedicine_sessions TO service_role;
ALTER TABLE public.telemedicine_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read sessions" ON public.telemedicine_sessions FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.hc_doctors d WHERE d.id = telemedicine_sessions.doctor_id AND d.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.hc_patients p WHERE p.id = telemedicine_sessions.patient_id AND p.user_id = auth.uid())
);
CREATE POLICY "Doctors/admins insert sessions" ON public.telemedicine_sessions FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.hc_doctors d WHERE d.id = telemedicine_sessions.doctor_id AND d.user_id = auth.uid())
);
CREATE POLICY "Participants update sessions" ON public.telemedicine_sessions FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.hc_doctors d WHERE d.id = telemedicine_sessions.doctor_id AND d.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.hc_patients p WHERE p.id = telemedicine_sessions.patient_id AND p.user_id = auth.uid())
);
CREATE INDEX telemedicine_doctor_idx ON public.telemedicine_sessions (doctor_id);
CREATE INDEX telemedicine_patient_idx ON public.telemedicine_sessions (patient_id);

-- 5) Provider ranking scores (polymorphic: doctor / pharmacy)
CREATE TABLE public.provider_ranking_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_kind text NOT NULL CHECK (provider_kind IN ('doctor','pharmacy','hospital','clinic','lab')),
  provider_id uuid NOT NULL,
  score numeric NOT NULL DEFAULT 0,
  level text NOT NULL DEFAULT 'STANDARD_PROVIDER' CHECK (level IN ('TOP_PROVIDER','STANDARD_PROVIDER','NEW_PROVIDER')),
  rating numeric,
  reviews_count integer DEFAULT 0,
  years_experience integer,
  response_rate numeric,
  verified boolean DEFAULT false,
  factors jsonb NOT NULL DEFAULT '{}',
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_kind, provider_id)
);
GRANT SELECT ON public.provider_ranking_scores TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_ranking_scores TO authenticated;
GRANT ALL ON public.provider_ranking_scores TO service_role;
ALTER TABLE public.provider_ranking_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read ranking" ON public.provider_ranking_scores FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage ranking" ON public.provider_ranking_scores FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX ranking_kind_score_idx ON public.provider_ranking_scores (provider_kind, score DESC);

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.set_medical_entities_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_medical_entities_updated_at BEFORE UPDATE ON public.medical_entities
  FOR EACH ROW EXECUTE FUNCTION public.set_medical_entities_updated_at();
CREATE TRIGGER trg_telemedicine_updated_at BEFORE UPDATE ON public.telemedicine_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_medical_entities_updated_at();
