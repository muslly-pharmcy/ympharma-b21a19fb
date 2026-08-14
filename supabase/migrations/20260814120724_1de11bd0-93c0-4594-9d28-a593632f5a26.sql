-- 1) Seed Control Tower keys into the existing app_settings table
INSERT INTO public.app_settings (key, value, description) VALUES
  ('enable_medication_vault', 'true'::jsonb, 'تفعيل خزينة الأدوية والروشتات'),
  ('enable_ai_marketing', 'true'::jsonb, 'تفعيل التسويق بالذكاء الاصطناعي'),
  ('enable_delivery_orders', 'true'::jsonb, 'تفعيل خدمة التوصيل المنزلي'),
  ('enable_clinical_inspector', 'true'::jsonb, 'تفعيل لوحة الفحص السريري'),
  ('maintenance_mode', 'false'::jsonb, 'وضع الصيانة'),
  ('pharmacy_status', '"OPEN"'::jsonb, 'حالة الصيدلية: OPEN | CLOSED | BUSY'),
  ('custom_announcement', '{"active": false, "text_ar": "", "type": "info"}'::jsonb, 'الإعلان العاجل'),
  ('delivery_fees_matrix', '{"crater": 1500, "mualla": 1500, "khormaksar": 1500, "mansoura": 2000, "sheikh_othman": 2000, "dar_saad": 2500, "buraiqeh": 3000}'::jsonb, 'مصفوفة أسعار التوصيل - عدن')
ON CONFLICT (key) DO NOTHING;

-- 2) Append-only audit log for Control Tower settings changes
CREATE TABLE IF NOT EXISTS public.control_tower_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID,
  action TEXT NOT NULL,
  target_key TEXT,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.control_tower_audit_log TO authenticated;
GRANT ALL ON public.control_tower_audit_log TO service_role;

ALTER TABLE public.control_tower_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "control_tower_audit_admin_read" ON public.control_tower_audit_log;
CREATE POLICY "control_tower_audit_admin_read"
  ON public.control_tower_audit_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role));

CREATE INDEX IF NOT EXISTS control_tower_audit_created_at_idx
  ON public.control_tower_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS control_tower_audit_target_key_idx
  ON public.control_tower_audit_log (target_key);

-- 3) Trigger: record every app_settings value change
CREATE OR REPLACE FUNCTION public.log_app_setting_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.value IS DISTINCT FROM NEW.value THEN
    INSERT INTO public.control_tower_audit_log (admin_id, action, target_key, old_value, new_value)
    VALUES (COALESCE(NEW.updated_by, auth.uid()), 'UPDATE_SETTING', OLD.key, OLD.value, NEW.value);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_app_setting_change() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_log_app_setting_change ON public.app_settings;
CREATE TRIGGER trg_log_app_setting_change
AFTER UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.log_app_setting_change();

-- 4) Narrow public read: only pharmacy status + announcement
CREATE OR REPLACE FUNCTION public.public_pharmacy_status()
RETURNS TABLE (key TEXT, value JSONB)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.key, s.value
  FROM public.app_settings s
  WHERE s.key IN ('pharmacy_status', 'custom_announcement');
$$;

REVOKE ALL ON FUNCTION public.public_pharmacy_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_pharmacy_status() TO anon, authenticated, service_role;

-- 5) Realtime for settings sync
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'app_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;
  END IF;
EXCEPTION WHEN undefined_object THEN NULL;
END;
$$;