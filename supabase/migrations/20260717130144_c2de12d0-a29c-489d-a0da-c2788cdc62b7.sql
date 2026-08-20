
CREATE OR REPLACE FUNCTION public.has_consent(
  _patient_id uuid,
  _grantee_type text,
  _grantee_id uuid,
  _scope text
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.patient_consents
    WHERE patient_id = _patient_id
      AND granted_to_type = _grantee_type
      AND granted_to_id = _grantee_id
      AND active = true
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
      AND (scope ? _scope OR scope ? '*')
  );
$$;

REVOKE ALL ON FUNCTION public.has_consent(uuid, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_consent(uuid, text, uuid, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.has_consent(uuid, text, uuid, text) IS
  'Wave A — checks whether a patient has an active (non-revoked, non-expired) consent granting the given scope to the given grantee. Scope value ''*'' means all scopes.';
