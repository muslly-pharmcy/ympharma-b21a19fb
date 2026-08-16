
REVOKE ALL ON FUNCTION public.hc_doctors_protect_self_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.profiles_protect_self_update()   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_privileged_grant_changes() FROM PUBLIC, anon, authenticated;
