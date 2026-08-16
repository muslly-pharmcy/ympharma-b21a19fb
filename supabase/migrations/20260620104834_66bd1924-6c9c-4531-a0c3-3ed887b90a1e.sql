REVOKE EXECUTE ON FUNCTION public.branch_reorder_suggestions(uuid, int, int, int) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.branch_reorder_suggestions(uuid, int, int, int) TO authenticated, service_role;
