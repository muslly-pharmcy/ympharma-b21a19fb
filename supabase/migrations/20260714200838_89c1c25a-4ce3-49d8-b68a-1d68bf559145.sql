
-- ==========================================================
-- Phoenix Phase A — Commerce & Revenue Engine
-- ==========================================================

DO $$ BEGIN CREATE TYPE public.billing_audience AS ENUM ('pharmacy','doctor','supplier','organization'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.billing_tier AS ENUM ('free','basic','premium','enterprise','professional','analytics'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.billing_sub_status AS ENUM ('trialing','active','past_due','cancelled','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.billing_invoice_status AS ENUM ('draft','issued','paid','void','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.billing_ledger_entry AS ENUM ('charge','refund','credit','adjustment'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Plans
CREATE TABLE IF NOT EXISTS public.billing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  audience public.billing_audience NOT NULL,
  tier public.billing_tier NOT NULL,
  name_ar text NOT NULL,
  name_en text,
  description_ar text,
  price_month_yer numeric(12,2) NOT NULL DEFAULT 0,
  price_year_yer numeric(12,2) NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.billing_plans TO anon, authenticated;
GRANT ALL ON public.billing_plans TO service_role;
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing_plans_read_active" ON public.billing_plans FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "billing_plans_admin_all" ON public.billing_plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Subscriptions
CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type public.billing_audience NOT NULL,
  subject_id uuid NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  plan_id uuid NOT NULL REFERENCES public.billing_plans(id),
  status public.billing_sub_status NOT NULL DEFAULT 'trialing',
  started_at timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  trial_ends_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS billing_subs_active_uidx
  ON public.billing_subscriptions (subject_type, subject_id) WHERE status IN ('trialing','active','past_due');
GRANT SELECT, INSERT, UPDATE ON public.billing_subscriptions TO authenticated;
GRANT ALL ON public.billing_subscriptions TO service_role;
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing_subs_org_read" ON public.billing_subscriptions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin')
    OR (organization_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = billing_subscriptions.organization_id AND m.user_id = auth.uid())));
CREATE POLICY "billing_subs_admin_write" ON public.billing_subscriptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Invoices
CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.billing_subscriptions(id) ON DELETE CASCADE,
  amount_yer numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'YER',
  period_start date,
  period_end date,
  issued_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  status public.billing_invoice_status NOT NULL DEFAULT 'draft',
  external_ref text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.billing_invoices TO authenticated;
GRANT ALL ON public.billing_invoices TO service_role;
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing_inv_org_read" ON public.billing_invoices FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin')
    OR EXISTS (
      SELECT 1 FROM public.billing_subscriptions s
      JOIN public.organization_members m ON m.organization_id = s.organization_id
      WHERE s.id = billing_invoices.subscription_id AND m.user_id = auth.uid()));
CREATE POLICY "billing_inv_admin_write" ON public.billing_invoices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Ledger (append-only)
CREATE TABLE IF NOT EXISTS public.billing_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type public.billing_ledger_entry NOT NULL,
  amount_yer numeric(12,2) NOT NULL,
  invoice_id uuid REFERENCES public.billing_invoices(id) ON DELETE SET NULL,
  subject_type public.billing_audience,
  subject_id uuid,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.billing_ledger TO authenticated;
GRANT ALL ON public.billing_ledger TO service_role;
ALTER TABLE public.billing_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing_ledger_admin_read" ON public.billing_ledger FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "billing_ledger_admin_insert" ON public.billing_ledger FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Audit
CREATE TABLE IF NOT EXISTS public.billing_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  target_table text,
  target_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.billing_audit_events TO authenticated;
GRANT ALL ON public.billing_audit_events TO service_role;
ALTER TABLE public.billing_audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing_audit_admin_read" ON public.billing_audit_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "billing_audit_service_insert" ON public.billing_audit_events FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- Insurance
CREATE TABLE IF NOT EXISTS public.ins_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text,
  logo_url text,
  phone text,
  website text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ins_companies TO anon, authenticated;
GRANT ALL ON public.ins_companies TO service_role;
ALTER TABLE public.ins_companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ins_companies_public_read" ON public.ins_companies FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "ins_companies_admin_all" ON public.ins_companies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.ins_patient_coverage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES public.hc_patients(id) ON DELETE CASCADE,
  patient_user_id uuid,
  company_id uuid NOT NULL REFERENCES public.ins_companies(id) ON DELETE RESTRICT,
  policy_no text,
  valid_from date,
  valid_to date,
  copay_percent numeric(5,2) DEFAULT 0,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ins_patient_coverage TO authenticated;
GRANT ALL ON public.ins_patient_coverage TO service_role;
ALTER TABLE public.ins_patient_coverage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ins_cov_owner_read" ON public.ins_patient_coverage FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR patient_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.hc_patients p WHERE p.id = ins_patient_coverage.patient_id AND p.user_id = auth.uid()));
CREATE POLICY "ins_cov_owner_write" ON public.ins_patient_coverage FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR patient_user_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(),'admin') OR patient_user_id = auth.uid());

-- updated_at triggers
DO $$ BEGIN CREATE TRIGGER billing_plans_touch BEFORE UPDATE ON public.billing_plans FOR EACH ROW EXECUTE FUNCTION public.pn_touch_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER billing_subs_touch BEFORE UPDATE ON public.billing_subscriptions FOR EACH ROW EXECUTE FUNCTION public.pn_touch_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER billing_inv_touch BEFORE UPDATE ON public.billing_invoices FOR EACH ROW EXECUTE FUNCTION public.pn_touch_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER ins_companies_touch BEFORE UPDATE ON public.ins_companies FOR EACH ROW EXECUTE FUNCTION public.pn_touch_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER ins_cov_touch BEFORE UPDATE ON public.ins_patient_coverage FOR EACH ROW EXECUTE FUNCTION public.pn_touch_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RPCs
CREATE OR REPLACE FUNCTION public.billing_activate_plan(
  _subject_type public.billing_audience,
  _subject_id uuid,
  _plan_code text,
  _organization_id uuid DEFAULT NULL,
  _trial_days int DEFAULT 0
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _plan_id uuid; _sub_id uuid;
BEGIN
  SELECT id INTO _plan_id FROM public.billing_plans WHERE code = _plan_code AND is_active = true;
  IF _plan_id IS NULL THEN RAISE EXCEPTION 'plan_not_found' USING ERRCODE = '22023'; END IF;

  IF _organization_id IS NOT NULL AND NOT public.has_role(auth.uid(),'admin')
     AND NOT EXISTS (
       SELECT 1 FROM public.organization_members m
       WHERE m.organization_id = _organization_id AND m.user_id = auth.uid()
         AND m.role IN ('owner','admin','manager')
     ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Cancel any existing active subscription for the subject.
  UPDATE public.billing_subscriptions
     SET status = 'cancelled', cancelled_at = now(), updated_at = now()
   WHERE subject_type = _subject_type AND subject_id = _subject_id
     AND status IN ('trialing','active','past_due');

  INSERT INTO public.billing_subscriptions
    (subject_type, subject_id, organization_id, plan_id, status,
     current_period_end, trial_ends_at, created_by)
  VALUES
    (_subject_type, _subject_id, _organization_id, _plan_id,
     CASE WHEN _trial_days > 0 THEN 'trialing'::public.billing_sub_status ELSE 'active'::public.billing_sub_status END,
     now() + interval '30 days',
     CASE WHEN _trial_days > 0 THEN now() + (_trial_days || ' days')::interval ELSE NULL END,
     auth.uid())
  RETURNING id INTO _sub_id;

  INSERT INTO public.billing_audit_events (actor_id, action, target_table, target_id, payload)
  VALUES (auth.uid(), 'activate_plan', 'billing_subscriptions', _sub_id,
          jsonb_build_object('plan_code',_plan_code,'subject_type',_subject_type,'subject_id',_subject_id,'trial_days',_trial_days));

  RETURN _sub_id;
END; $$;
REVOKE ALL ON FUNCTION public.billing_activate_plan(public.billing_audience, uuid, text, uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.billing_activate_plan(public.billing_audience, uuid, text, uuid, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.billing_cancel_subscription(
  _subscription_id uuid, _at_period_end boolean DEFAULT true
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org_id uuid;
BEGIN
  SELECT organization_id INTO _org_id FROM public.billing_subscriptions WHERE id = _subscription_id;
  IF NOT public.has_role(auth.uid(),'admin')
     AND NOT EXISTS (
       SELECT 1 FROM public.organization_members m
       WHERE m.organization_id = _org_id AND m.user_id = auth.uid()
         AND m.role IN ('owner','admin','manager')
     ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF _at_period_end THEN
    UPDATE public.billing_subscriptions SET cancel_at_period_end = true, updated_at = now() WHERE id = _subscription_id;
  ELSE
    UPDATE public.billing_subscriptions SET status = 'cancelled', cancelled_at = now(), updated_at = now() WHERE id = _subscription_id;
  END IF;

  INSERT INTO public.billing_audit_events (actor_id, action, target_table, target_id, payload)
  VALUES (auth.uid(), 'cancel_subscription', 'billing_subscriptions', _subscription_id, jsonb_build_object('at_period_end',_at_period_end));
END; $$;
REVOKE ALL ON FUNCTION public.billing_cancel_subscription(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.billing_cancel_subscription(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.billing_issue_invoice(
  _subscription_id uuid, _period_start date, _period_end date
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _inv_id uuid; _sub RECORD; _price numeric(12,2);
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT s.*, p.price_month_yer AS plan_price
    INTO _sub
    FROM public.billing_subscriptions s
    JOIN public.billing_plans p ON p.id = s.plan_id
   WHERE s.id = _subscription_id;
  IF _sub IS NULL THEN RAISE EXCEPTION 'subscription_not_found' USING ERRCODE = '22023'; END IF;
  _price := _sub.plan_price;

  INSERT INTO public.billing_invoices
    (subscription_id, amount_yer, period_start, period_end, issued_at, due_at, status)
  VALUES (_subscription_id, _price, _period_start, _period_end, now(), now() + interval '14 days', 'issued')
  RETURNING id INTO _inv_id;

  INSERT INTO public.billing_ledger (entry_type, amount_yer, invoice_id, subject_type, subject_id, notes, created_by)
  VALUES ('charge', _price, _inv_id, _sub.subject_type, _sub.subject_id, 'invoice issued', auth.uid());

  INSERT INTO public.billing_audit_events (actor_id, action, target_table, target_id, payload)
  VALUES (auth.uid(), 'issue_invoice', 'billing_invoices', _inv_id, jsonb_build_object('amount',_price));

  RETURN _inv_id;
END; $$;
REVOKE ALL ON FUNCTION public.billing_issue_invoice(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.billing_issue_invoice(uuid, date, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.billing_record_payment(
  _invoice_id uuid, _amount_yer numeric, _notes text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _inv RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT i.*, s.subject_type, s.subject_id
    INTO _inv
    FROM public.billing_invoices i
    JOIN public.billing_subscriptions s ON s.id = i.subscription_id
   WHERE i.id = _invoice_id;
  IF _inv IS NULL THEN RAISE EXCEPTION 'invoice_not_found' USING ERRCODE = '22023'; END IF;

  UPDATE public.billing_invoices SET status='paid', paid_at=now(), updated_at=now() WHERE id = _invoice_id;
  INSERT INTO public.billing_ledger (entry_type, amount_yer, invoice_id, subject_type, subject_id, notes, created_by)
  VALUES ('charge', _amount_yer, _invoice_id, _inv.subject_type, _inv.subject_id, COALESCE(_notes,'payment recorded'), auth.uid());

  INSERT INTO public.billing_audit_events (actor_id, action, target_table, target_id, payload)
  VALUES (auth.uid(), 'record_payment', 'billing_invoices', _invoice_id, jsonb_build_object('amount',_amount_yer));
END; $$;
REVOKE ALL ON FUNCTION public.billing_record_payment(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.billing_record_payment(uuid, numeric, text) TO authenticated;

-- Seed plans
INSERT INTO public.billing_plans (code, audience, tier, name_ar, name_en, description_ar, price_month_yer, price_year_yer, features, sort_order) VALUES
  ('ph_free','pharmacy','free','مجاني','Free','ملف صيدلية أساسي', 0, 0, '["ملف عام","بحث محدود"]'::jsonb, 10),
  ('ph_basic','pharmacy','basic','أساسي','Basic','ملف موثّق + إدارة المخزون', 25000, 250000, '["ملف موثّق","إدارة المخزون","تنبيهات انتهاء الصلاحية"]'::jsonb, 20),
  ('ph_premium','pharmacy','premium','متقدّم','Premium','تحليلات + شبكة التحويل', 60000, 600000, '["كل مزايا الأساسي","تحليلات","تحويلات بين الصيدليات"]'::jsonb, 30),
  ('ph_enterprise','pharmacy','enterprise','مؤسسي','Enterprise','فروع متعددة + API', 150000, 1500000, '["فروع غير محدودة","API خاص","دعم مخصص"]'::jsonb, 40),
  ('dr_free','doctor','free','ملف مجاني','Free Profile','ملف طبيب أساسي', 0, 0, '["ملف عام","نموذج تواصل"]'::jsonb, 10),
  ('dr_pro','doctor','professional','احترافي','Professional','ظهور مميّز + إحصاءات', 15000, 150000, '["ظهور أعلى في البحث","إحصاءات","حجز مواعيد"]'::jsonb, 20),
  ('su_basic','supplier','basic','أساسي','Basic','قائمة منتجات', 20000, 200000, '["إدارة قائمة المنتجات"]'::jsonb, 10),
  ('su_analytics','supplier','analytics','تحليلي','Analytics','تحليلات المبيعات والاتجاهات', 55000, 550000, '["تحليلات مبيعات","اتجاهات الطلب"]'::jsonb, 20)
ON CONFLICT (code) DO NOTHING;

-- Seed insurance
INSERT INTO public.ins_companies (code, name_ar, name_en, phone, is_active) VALUES
  ('mareb','مأرب للتأمين','Mareb Insurance','+967-1-000001', true),
  ('unified','التأمين الموحد','Unified Insurance','+967-1-000002', true),
  ('yic','اليمنية للتأمين','Yemen Insurance Co.','+967-1-000003', true)
ON CONFLICT (code) DO NOTHING;
