
-- 1) trust_pages: singleton-ish editable content for /trust
CREATE TABLE IF NOT EXISTS public.trust_pages (
  slug text PRIMARY KEY,
  title text NOT NULL DEFAULT '',
  intro text NOT NULL DEFAULT '',
  data_collection text NOT NULL DEFAULT '',
  retention text NOT NULL DEFAULT '',
  encryption text NOT NULL DEFAULT '',
  cookies text NOT NULL DEFAULT '',
  incident_reporting text NOT NULL DEFAULT '',
  contact text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.trust_pages TO anon, authenticated;
GRANT INSERT, UPDATE ON public.trust_pages TO authenticated;
GRANT ALL ON public.trust_pages TO service_role;

ALTER TABLE public.trust_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read trust pages" ON public.trust_pages;
CREATE POLICY "Anyone can read trust pages"
ON public.trust_pages FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Owners/admins can insert trust pages" ON public.trust_pages;
CREATE POLICY "Owners/admins can insert trust pages"
ON public.trust_pages FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Owners/admins can update trust pages" ON public.trust_pages;
CREATE POLICY "Owners/admins can update trust pages"
ON public.trust_pages FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));

DROP TRIGGER IF EXISTS trust_pages_touch_updated_at ON public.trust_pages;
CREATE TRIGGER trust_pages_touch_updated_at
BEFORE UPDATE ON public.trust_pages
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed default 'trust' row (Arabic) so the public page always has content.
INSERT INTO public.trust_pages (slug, title, intro, data_collection, retention, encryption, cookies, incident_reporting, contact)
VALUES (
  'trust',
  'كيف نحمي بياناتك',
  'هذه الصفحة يحررها فريق صيدلية المصلي للإجابة عن الأسئلة الشائعة حول الأمان والخصوصية. المعلومات هنا تصف ممارساتنا الحالية وليست شهادة اعتماد مستقلة.',
  'نجمع فقط البيانات اللازمة لتنفيذ الطلب: الاسم، رقم الهاتف، العنوان، الأصناف المطلوبة، وصور الروشتات. لا نطلب بيانات حساسة إضافية ولا نبيع بياناتك لأي طرف ثالث.',
  'نحتفظ ببيانات الطلبات والروشتات للفترة اللازمة لتنفيذ الخدمة وأغراض السجل الإداري. يمكنك طلب حذف بياناتك في أي وقت عبر التواصل معنا.',
  'كل الاتصالات بين المتصفح وخوادمنا مشفّرة عبر HTTPS. قاعدة البيانات محمية بسياسات صلاحيات صفية (Row Level Security)، وصور الروشتات تُخزّن في حاوية خاصة غير عامة.',
  'نستخدم تخزينًا محليًا في المتصفح (localStorage) لحفظ السلة وتفضيلات اللغة وجلسة الموظفين. لا نستخدم كوكيز إعلانية ولا نتتبّع المستخدمين عبر مواقع أخرى.',
  'إذا اكتشفت ثغرة أمنية أو تسريبًا محتملًا، نرجو التواصل معنا مباشرة قبل أي إفصاح علني وسنرد بأسرع وقت ممكن.',
  'واتساب: 774068936 — أرضي: 02358921 — العنوان: عدن — المنصورة — ريمي، أمام مشفى صابر.'
)
ON CONFLICT (slug) DO NOTHING;

-- 2) Tighten SECURITY DEFINER EXECUTE grants

-- Trigger functions (never called via API)
REVOKE EXECUTE ON FUNCTION public.log_table_activity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_order_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- Admin-only RPCs
REVOKE EXECUTE ON FUNCTION public.bootstrap_owner() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_backup(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_scheduled_backup(text) FROM PUBLIC, anon, authenticated;

-- Activity log helper (authenticated only)
REVOKE EXECUTE ON FUNCTION public.log_activity(text, text, text, jsonb) FROM PUBLIC, anon;

-- Keep public: has_role, has_permission (used by anon-evaluated RLS),
-- get_order_public and get_order_history_public (public order tracking page).
