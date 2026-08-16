
-- Trigger: revert protected columns on self-updates to hc_doctors
CREATE OR REPLACE FUNCTION public.hc_doctors_protect_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_staff boolean := false;
BEGIN
  -- Bypass for staff with manage permission or admins
  IF NEW.organization_id IS NOT NULL
     AND public.has_org_permission(auth.uid(), NEW.organization_id, 'healthcare.doctors.manage') THEN
    is_staff := true;
  ELSIF public.has_role(auth.uid(), 'admin'::app_role) THEN
    is_staff := true;
  END IF;

  IF NOT is_staff AND OLD.user_id = auth.uid() THEN
    NEW.verification_status := OLD.verification_status;
    NEW.is_public           := OLD.is_public;
    NEW.trust_score         := OLD.trust_score;
    NEW.confidence_score    := OLD.confidence_score;
    NEW.organization_id     := OLD.organization_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hc_doctors_protect_self_update ON public.hc_doctors;
CREATE TRIGGER trg_hc_doctors_protect_self_update
BEFORE UPDATE ON public.hc_doctors
FOR EACH ROW
EXECUTE FUNCTION public.hc_doctors_protect_self_update();

-- Trigger: revert protected columns on self-updates to profiles
CREATE OR REPLACE FUNCTION public.profiles_protect_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'owner'::app_role) THEN
    RETURN NEW;
  END IF;

  IF OLD.id = auth.uid() THEN
    NEW.status   := OLD.status;
    NEW.metadata := OLD.metadata;
    NEW.email    := OLD.email;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_protect_self_update ON public.profiles;
CREATE TRIGGER trg_profiles_protect_self_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.profiles_protect_self_update();
