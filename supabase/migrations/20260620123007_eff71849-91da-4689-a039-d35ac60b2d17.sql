-- =====================================================================
-- Phase 6B Sprint 3: Prescription Review State Machine
-- =====================================================================

-- 1) Canonical status list (used by both tables) ----------------------
--    Stored as TEXT + CHECK to stay consistent with prescriptions.status
--    and to keep migrations cheap to evolve.
DO $$ BEGIN
  -- no-op placeholder so the block parses
  PERFORM 1;
END $$;

-- 2) prescription_reviews — current state per prescription -----------
CREATE TABLE IF NOT EXISTS public.prescription_reviews (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id text NOT NULL UNIQUE
                  REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  reviewer_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'PENDING_REVIEW'
                  CHECK (status IN (
                    'PENDING_REVIEW','ASSIGNED','IN_REVIEW',
                    'APPROVED','REJECTED','ESCALATED'
                  )),
  review_notes    text,
  assigned_at     timestamptz,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.prescription_reviews TO authenticated;
GRANT ALL ON public.prescription_reviews TO service_role;

ALTER TABLE public.prescription_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read prescription_reviews"
ON public.prescription_reviews FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'owner'::app_role)
  OR public.has_permission(auth.uid(), 'prescriptions')
);

CREATE POLICY "staff write prescription_reviews"
ON public.prescription_reviews FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'owner'::app_role)
  OR public.has_permission(auth.uid(), 'prescriptions')
);

CREATE POLICY "staff update prescription_reviews"
ON public.prescription_reviews FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'owner'::app_role)
  OR public.has_permission(auth.uid(), 'prescriptions')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'owner'::app_role)
  OR public.has_permission(auth.uid(), 'prescriptions')
);

CREATE INDEX IF NOT EXISTS prescription_reviews_status_idx
  ON public.prescription_reviews(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS prescription_reviews_reviewer_idx
  ON public.prescription_reviews(reviewer_id, updated_at DESC);

-- 3) prescription_escalations — multiple per prescription -------------
CREATE TABLE IF NOT EXISTS public.prescription_escalations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id text NOT NULL
                  REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  reason          text NOT NULL,
  assigned_to     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'OPEN'
                  CHECK (status IN ('OPEN','RESOLVED','CANCELLED')),
  resolution_note text,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz
);

GRANT SELECT, INSERT, UPDATE ON public.prescription_escalations TO authenticated;
GRANT ALL ON public.prescription_escalations TO service_role;

ALTER TABLE public.prescription_escalations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read prescription_escalations"
ON public.prescription_escalations FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'owner'::app_role)
  OR public.has_permission(auth.uid(), 'prescriptions')
);

CREATE POLICY "staff write prescription_escalations"
ON public.prescription_escalations FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'owner'::app_role)
  OR public.has_permission(auth.uid(), 'prescriptions')
);

CREATE POLICY "staff update prescription_escalations"
ON public.prescription_escalations FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'owner'::app_role)
  OR public.has_permission(auth.uid(), 'prescriptions')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'owner'::app_role)
  OR public.has_permission(auth.uid(), 'prescriptions')
);

CREATE INDEX IF NOT EXISTS prescription_escalations_rx_idx
  ON public.prescription_escalations(prescription_id, created_at DESC);
CREATE INDEX IF NOT EXISTS prescription_escalations_status_idx
  ON public.prescription_escalations(status, created_at DESC);

-- 4) State machine: validation + automatic event emission ------------
CREATE OR REPLACE FUNCTION public.validate_prescription_review_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_name text;
  v_actor      text := COALESCE(auth.uid()::text, 'system');
BEGIN
  -- Always bump updated_at
  NEW.updated_at := now();

  -- No status change → nothing to validate
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- Allowed transitions only
  IF NOT (
    (OLD.status = 'PENDING_REVIEW' AND NEW.status = 'ASSIGNED') OR
    (OLD.status = 'ASSIGNED'       AND NEW.status = 'IN_REVIEW') OR
    (OLD.status = 'IN_REVIEW'      AND NEW.status IN ('APPROVED','REJECTED','ESCALATED')) OR
    (OLD.status = 'ESCALATED'      AND NEW.status IN ('IN_REVIEW','APPROVED','REJECTED'))
  ) THEN
    RAISE EXCEPTION
      'invalid_prescription_review_transition: % -> % (rx=%)',
      OLD.status, NEW.status, NEW.prescription_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- Stamp lifecycle timestamps
  IF NEW.status = 'ASSIGNED'  AND NEW.assigned_at  IS NULL THEN NEW.assigned_at  := now(); END IF;
  IF NEW.status = 'IN_REVIEW' AND NEW.started_at   IS NULL THEN NEW.started_at   := now(); END IF;
  IF NEW.status IN ('APPROVED','REJECTED') AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  END IF;

  -- Map status → canonical event
  v_event_name := CASE NEW.status
    WHEN 'ASSIGNED'  THEN 'PRESCRIPTION_ASSIGNED'
    WHEN 'IN_REVIEW' THEN 'PRESCRIPTION_IN_REVIEW'
    WHEN 'APPROVED'  THEN 'PRESCRIPTION_APPROVED'
    WHEN 'REJECTED'  THEN 'PRESCRIPTION_REJECTED'
    WHEN 'ESCALATED' THEN 'PRESCRIPTION_ESCALATED'
    ELSE NULL
  END;

  IF v_event_name IS NOT NULL THEN
    PERFORM public.emit_prescription_event(
      v_event_name,
      NEW.prescription_id,
      v_actor,
      CASE WHEN auth.uid() IS NULL THEN 'system' ELSE 'staff' END,
      NULL,
      jsonb_build_object(
        'from_status', OLD.status,
        'to_status',   NEW.status,
        'reviewer_id', NEW.reviewer_id,
        'review_notes', NEW.review_notes
      ),
      'review_state_machine'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_prescription_review_transition
  ON public.prescription_reviews;
CREATE TRIGGER trg_validate_prescription_review_transition
BEFORE UPDATE OF status, reviewer_id, review_notes
ON public.prescription_reviews
FOR EACH ROW EXECUTE FUNCTION public.validate_prescription_review_transition();

-- 5) Auto-seed a review row on every new prescription -----------------
CREATE OR REPLACE FUNCTION public.seed_prescription_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.prescription_reviews(prescription_id, status)
  VALUES (NEW.id, 'PENDING_REVIEW')
  ON CONFLICT (prescription_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_prescription_review ON public.prescriptions;
CREATE TRIGGER trg_seed_prescription_review
AFTER INSERT ON public.prescriptions
FOR EACH ROW EXECUTE FUNCTION public.seed_prescription_review();

-- 6) Escalation row auto-creates on ESCALATED transition --------------
CREATE OR REPLACE FUNCTION public.open_escalation_on_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'ESCALATED' AND OLD.status <> 'ESCALATED' THEN
    INSERT INTO public.prescription_escalations(
      prescription_id, reason, assigned_to, created_by, status
    )
    VALUES (
      NEW.prescription_id,
      COALESCE(NEW.review_notes, 'escalated_by_reviewer'),
      NULL,
      auth.uid(),
      'OPEN'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_open_escalation_on_review
  ON public.prescription_reviews;
CREATE TRIGGER trg_open_escalation_on_review
AFTER UPDATE OF status ON public.prescription_reviews
FOR EACH ROW EXECUTE FUNCTION public.open_escalation_on_review();

-- 7) Backfill review rows for any existing prescriptions --------------
INSERT INTO public.prescription_reviews(prescription_id, status)
SELECT id, 'PENDING_REVIEW' FROM public.prescriptions
ON CONFLICT (prescription_id) DO NOTHING;

-- 8) Docs --------------------------------------------------------------
COMMENT ON TABLE public.prescription_reviews IS
$DOC$Current review state for each prescription. State machine enforced by
trg_validate_prescription_review_transition. Allowed transitions:
  PENDING_REVIEW -> ASSIGNED
  ASSIGNED       -> IN_REVIEW
  IN_REVIEW      -> APPROVED | REJECTED | ESCALATED
  ESCALATED      -> IN_REVIEW | APPROVED | REJECTED
All other transitions raise an error. Every valid transition emits the
matching PRESCRIPTION_* event via emit_prescription_event.$DOC$;

COMMENT ON TABLE public.prescription_escalations IS
$DOC$Audit log of escalations. One row opened automatically whenever a review
transitions into ESCALATED. Resolution sets status=RESOLVED and resolved_at.$DOC$;
