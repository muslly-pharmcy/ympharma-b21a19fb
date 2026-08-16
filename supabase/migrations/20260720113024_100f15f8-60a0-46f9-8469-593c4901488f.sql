
-- =========================================================
-- D3: Campaigns & Segmentation
-- =========================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE public.crm_campaign_status AS ENUM ('draft','scheduled','running','paused','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crm_campaign_channel AS ENUM ('whatsapp','sms','email','push','in_app');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crm_campaign_event_kind AS ENUM ('queued','sent','delivered','opened','clicked','bounced','failed','unsubscribed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crm_recipient_status AS ENUM ('pending','sent','delivered','failed','skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- updated_at trigger fn (idempotent)
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- ============ CAMPAIGNS ============
CREATE TABLE IF NOT EXISTS public.crm_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  channel public.crm_campaign_channel NOT NULL,
  segment_id uuid,
  message_template text NOT NULL DEFAULT '',
  subject text,
  status public.crm_campaign_status NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  audience_size int NOT NULL DEFAULT 0,
  sent_count int NOT NULL DEFAULT 0,
  delivered_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_campaigns TO authenticated;
GRANT ALL ON public.crm_campaigns TO service_role;
ALTER TABLE public.crm_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_campaigns_org_read" ON public.crm_campaigns FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "crm_campaigns_org_write" ON public.crm_campaigns FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE INDEX IF NOT EXISTS idx_crm_campaigns_org_status ON public.crm_campaigns (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_campaigns_scheduled ON public.crm_campaigns (scheduled_at) WHERE status = 'scheduled';

CREATE TRIGGER trg_crm_campaigns_touch BEFORE UPDATE ON public.crm_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ CAMPAIGN SCHEDULES (optional recurring) ============
CREATE TABLE IF NOT EXISTS public.crm_campaign_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  run_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  executed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_campaign_schedules TO authenticated;
GRANT ALL ON public.crm_campaign_schedules TO service_role;
ALTER TABLE public.crm_campaign_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_camp_sch_all" ON public.crm_campaign_schedules FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE INDEX IF NOT EXISTS idx_crm_camp_sch_run ON public.crm_campaign_schedules (run_at) WHERE status = 'pending';
CREATE TRIGGER trg_crm_camp_sch_touch BEFORE UPDATE ON public.crm_campaign_schedules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ CAMPAIGN RUNS (audit trail) ============
CREATE TABLE IF NOT EXISTS public.crm_campaign_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  audience_size int NOT NULL DEFAULT 0,
  sent_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT, INSERT, UPDATE ON public.crm_campaign_runs TO authenticated;
GRANT ALL ON public.crm_campaign_runs TO service_role;
ALTER TABLE public.crm_campaign_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_camp_runs_all" ON public.crm_campaign_runs FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE INDEX IF NOT EXISTS idx_crm_camp_runs_campaign ON public.crm_campaign_runs (campaign_id, started_at DESC);

-- ============ CAMPAIGN RECIPIENTS (audience snapshot) ============
CREATE TABLE IF NOT EXISTS public.crm_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  channel public.crm_campaign_channel NOT NULL,
  address text,
  status public.crm_recipient_status NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, customer_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_campaign_recipients TO authenticated;
GRANT ALL ON public.crm_campaign_recipients TO service_role;
ALTER TABLE public.crm_campaign_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_camp_rec_all" ON public.crm_campaign_recipients FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE INDEX IF NOT EXISTS idx_crm_camp_rec_campaign ON public.crm_campaign_recipients (campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_camp_rec_customer ON public.crm_campaign_recipients (customer_id);

-- ============ CAMPAIGN EVENTS (deliveries/opens/clicks) ============
CREATE TABLE IF NOT EXISTS public.crm_campaign_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES public.crm_campaign_recipients(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.crm_customers(id) ON DELETE SET NULL,
  kind public.crm_campaign_event_kind NOT NULL,
  channel public.crm_campaign_channel,
  provider_ref text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.crm_campaign_events TO authenticated;
GRANT ALL ON public.crm_campaign_events TO service_role;
ALTER TABLE public.crm_campaign_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_camp_ev_read" ON public.crm_campaign_events FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "crm_camp_ev_write" ON public.crm_campaign_events FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE INDEX IF NOT EXISTS idx_crm_camp_ev_campaign ON public.crm_campaign_events (campaign_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_camp_ev_kind ON public.crm_campaign_events (campaign_id, kind);

-- ============ SEGMENTS ============
CREATE TABLE IF NOT EXISTS public.crm_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  combinator text NOT NULL DEFAULT 'and' CHECK (combinator IN ('and','or')),
  is_dynamic boolean NOT NULL DEFAULT true,
  member_count int NOT NULL DEFAULT 0,
  last_recalculated_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_segments TO authenticated;
GRANT ALL ON public.crm_segments TO service_role;
ALTER TABLE public.crm_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_segments_all" ON public.crm_segments FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE INDEX IF NOT EXISTS idx_crm_segments_org ON public.crm_segments (organization_id);
CREATE TRIGGER trg_crm_segments_touch BEFORE UPDATE ON public.crm_segments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- FK on campaigns -> segments (after segments exists)
ALTER TABLE public.crm_campaigns DROP CONSTRAINT IF EXISTS crm_campaigns_segment_fk;
ALTER TABLE public.crm_campaigns
  ADD CONSTRAINT crm_campaigns_segment_fk
  FOREIGN KEY (segment_id) REFERENCES public.crm_segments(id) ON DELETE SET NULL;

-- ============ SEGMENT MEMBERSHIPS ============
CREATE TABLE IF NOT EXISTS public.crm_segment_memberships (
  segment_id uuid NOT NULL REFERENCES public.crm_segments(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (segment_id, customer_id)
);
GRANT SELECT, INSERT, DELETE ON public.crm_segment_memberships TO authenticated;
GRANT ALL ON public.crm_segment_memberships TO service_role;
ALTER TABLE public.crm_segment_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_seg_mem_all" ON public.crm_segment_memberships FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE INDEX IF NOT EXISTS idx_crm_seg_mem_customer ON public.crm_segment_memberships (customer_id);

-- ============ UNSUBSCRIBES ============
CREATE TABLE IF NOT EXISTS public.crm_unsubscribes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  channel public.crm_campaign_channel NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, customer_id, channel)
);
GRANT SELECT, INSERT, DELETE ON public.crm_unsubscribes TO authenticated;
GRANT ALL ON public.crm_unsubscribes TO service_role;
ALTER TABLE public.crm_unsubscribes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_unsub_all" ON public.crm_unsubscribes FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

-- ============ CONTACT PREFERENCES ============
CREATE TABLE IF NOT EXISTS public.crm_contact_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  channel public.crm_campaign_channel NOT NULL,
  opted_in boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, customer_id, channel)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_contact_preferences TO authenticated;
GRANT ALL ON public.crm_contact_preferences TO service_role;
ALTER TABLE public.crm_contact_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_pref_all" ON public.crm_contact_preferences FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE TRIGGER trg_crm_pref_touch BEFORE UPDATE ON public.crm_contact_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ Auto-generate campaign code ============
CREATE OR REPLACE FUNCTION public.crm_campaigns_gen_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'CMP-' || to_char(now(),'YYMMDD') || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,6);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_crm_campaigns_gen_code ON public.crm_campaigns;
CREATE TRIGGER trg_crm_campaigns_gen_code BEFORE INSERT ON public.crm_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.crm_campaigns_gen_code();

CREATE OR REPLACE FUNCTION public.crm_segments_gen_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'SEG-' || to_char(now(),'YYMMDD') || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,6);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_crm_segments_gen_code ON public.crm_segments;
CREATE TRIGGER trg_crm_segments_gen_code BEFORE INSERT ON public.crm_segments
  FOR EACH ROW EXECUTE FUNCTION public.crm_segments_gen_code();

-- ============ State machine ============
CREATE OR REPLACE FUNCTION public.crm_campaign_transition(p_id uuid, p_next public.crm_campaign_status)
RETURNS public.crm_campaign_status
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cur public.crm_campaign_status;
  v_allowed boolean := false;
BEGIN
  SELECT status INTO v_cur FROM public.crm_campaigns WHERE id = p_id FOR UPDATE;
  IF v_cur IS NULL THEN RAISE EXCEPTION 'Campaign % not found', p_id; END IF;

  v_allowed := CASE
    WHEN v_cur = 'draft'     AND p_next IN ('scheduled','running','cancelled') THEN true
    WHEN v_cur = 'scheduled' AND p_next IN ('running','cancelled','draft')     THEN true
    WHEN v_cur = 'running'   AND p_next IN ('paused','completed','cancelled')  THEN true
    WHEN v_cur = 'paused'    AND p_next IN ('running','cancelled','completed') THEN true
    ELSE false
  END;
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Illegal transition % -> %', v_cur, p_next USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.crm_campaigns
    SET status = p_next,
        started_at   = CASE WHEN p_next = 'running'   AND started_at   IS NULL THEN now() ELSE started_at   END,
        completed_at = CASE WHEN p_next = 'completed'                          THEN now() ELSE completed_at END,
        cancelled_at = CASE WHEN p_next = 'cancelled'                          THEN now() ELSE cancelled_at END
    WHERE id = p_id;
  RETURN p_next;
END $$;
REVOKE ALL ON FUNCTION public.crm_campaign_transition(uuid, public.crm_campaign_status) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_campaign_transition(uuid, public.crm_campaign_status) TO authenticated, service_role;

-- ============ Segment recalculation (atomic swap) ============
CREATE OR REPLACE FUNCTION public.crm_segment_recalc(p_segment_id uuid, p_customer_ids uuid[])
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid;
  v_count int;
BEGIN
  SELECT organization_id INTO v_org FROM public.crm_segments WHERE id = p_segment_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Segment % not found', p_segment_id; END IF;

  DELETE FROM public.crm_segment_memberships WHERE segment_id = p_segment_id;
  IF array_length(p_customer_ids,1) IS NOT NULL THEN
    INSERT INTO public.crm_segment_memberships (segment_id, customer_id, organization_id)
    SELECT p_segment_id, cid, v_org
    FROM unnest(p_customer_ids) cid
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT count(*) INTO v_count FROM public.crm_segment_memberships WHERE segment_id = p_segment_id;
  UPDATE public.crm_segments
    SET member_count = v_count, last_recalculated_at = now()
    WHERE id = p_segment_id;
  RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.crm_segment_recalc(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_segment_recalc(uuid, uuid[]) TO authenticated, service_role;
