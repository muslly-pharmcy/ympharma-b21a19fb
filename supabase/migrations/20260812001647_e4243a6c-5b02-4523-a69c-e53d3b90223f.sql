ALTER VIEW public.pending_admin_notifications SET (security_invoker = on);
ALTER VIEW public.v_privileged_definer_grants SET (security_invoker = on);
ALTER VIEW public.whatsapp_notification_health SET (security_invoker = on);