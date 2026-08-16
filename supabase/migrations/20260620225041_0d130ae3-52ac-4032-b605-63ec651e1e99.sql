
INSERT INTO public.whatsapp_notification_templates (id, event_name, body_template, variables, enabled, description)
VALUES
(
  'AGENT_APPROVAL_APPROVED',
  'AGENT_APPROVAL_APPROVED',
  E'🏥 *{{pharmacy_name}}*\n\n✅ تمت الموافقة على طلبك\n\n🆔 المرجع: *{{request_ref}}*\n📝 النوع: {{action_label}}\n{{#note}}💬 ملاحظة: {{note}}\n{{/note}}\nسنبدأ التنفيذ ونوافيك بالمستجدات.\n\n🔕 لإلغاء الاشتراك: {{opt_out_url}}',
  ARRAY['pharmacy_name','request_ref','action_label','note','opt_out_url'],
  true,
  'إشعار العميل بموافقة الموظف على طلب وكيل AI'
),
(
  'AGENT_APPROVAL_REJECTED',
  'AGENT_APPROVAL_REJECTED',
  E'🏥 *{{pharmacy_name}}*\n\n⚠️ تعذّر تنفيذ طلبك\n\n🆔 المرجع: *{{request_ref}}*\n📝 النوع: {{action_label}}\n❌ السبب: {{reason}}\n\nيمكنك الرد على هذه الرسالة للتواصل مع موظف.\n\n🔕 لإلغاء الاشتراك: {{opt_out_url}}',
  ARRAY['pharmacy_name','request_ref','action_label','reason','opt_out_url'],
  true,
  'إشعار العميل برفض الموظف لطلب وكيل AI'
)
ON CONFLICT (id) DO UPDATE
  SET body_template = EXCLUDED.body_template,
      variables = EXCLUDED.variables,
      description = EXCLUDED.description,
      updated_at = now();
