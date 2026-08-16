
-- 1) hc_doctors: prevent self-verify/self-publish
CREATE OR REPLACE FUNCTION public.hc_doctors_prevent_self_verify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.verification_status := 'pending'::hc_verification_status;
    NEW.is_public := false;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
      NEW.verification_status := OLD.verification_status;
    END IF;
    IF NEW.is_public IS DISTINCT FROM OLD.is_public THEN
      NEW.is_public := OLD.is_public;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hc_doctors_prevent_self_verify ON public.hc_doctors;
CREATE TRIGGER trg_hc_doctors_prevent_self_verify
  BEFORE INSERT OR UPDATE ON public.hc_doctors
  FOR EACH ROW EXECUTE FUNCTION public.hc_doctors_prevent_self_verify();

-- 2) pn_pharmacies: prevent org self-verify/self-publish
CREATE OR REPLACE FUNCTION public.pn_pharmacies_prevent_self_verify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.verification_status := 'pending'::pn_verification_status;
    NEW.is_public := false;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
      NEW.verification_status := OLD.verification_status;
    END IF;
    IF NEW.is_public IS DISTINCT FROM OLD.is_public THEN
      NEW.is_public := OLD.is_public;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pn_pharmacies_prevent_self_verify ON public.pn_pharmacies;
CREATE TRIGGER trg_pn_pharmacies_prevent_self_verify
  BEFORE INSERT OR UPDATE ON public.pn_pharmacies
  FOR EACH ROW EXECUTE FUNCTION public.pn_pharmacies_prevent_self_verify();

-- 3) reviews: prevent self-approve
CREATE OR REPLACE FUNCTION public.reviews_prevent_self_approve()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.is_approved := false;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_approved IS DISTINCT FROM OLD.is_approved THEN
      NEW.is_approved := OLD.is_approved;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reviews_prevent_self_approve ON public.reviews;
CREATE TRIGGER trg_reviews_prevent_self_approve
  BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.reviews_prevent_self_approve();
