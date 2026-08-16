
-- Phase 1 — ALIGN: soft-dedupe agent identities (non-destructive).
-- Keep rows for audit history, disable the non-canonical duplicates.
UPDATE public.ai_agents
SET enabled = false,
    metadata = COALESCE(metadata, '{}'::jsonb)
             || jsonb_build_object(
                  'deprecated_by', 'phase-1-align',
                  'canonical_code',
                  CASE code
                    WHEN 'pharmacist_agent' THEN 'pharmacist'
                    WHEN 'customer_agent'   THEN 'customer_galaxy'
                    ELSE code
                  END,
                  'deprecated_at', now()
                ),
    updated_at = now()
WHERE code IN ('pharmacist_agent', 'customer_agent');

-- Phase 1 — CONNECT: unified read view over both decision stores.
CREATE OR REPLACE VIEW public.ai_decisions_unified AS
SELECT
  id,
  event_id,
  event_name,
  agent_dispatched              AS agent_code,
  decision                      AS decision,
  confidence,
  reasoning,
  outcome,
  latency_ms,
  created_at,
  'sun'::text                   AS source
FROM public.sun_decisions
UNION ALL
SELECT
  id,
  event_id,
  NULL::text                    AS event_name,
  agent_name                    AS agent_code,
  action                        AS decision,
  (confidence * 100)::numeric   AS confidence,
  reasoning::text               AS reasoning,
  decision_type                 AS outcome,
  NULL::integer                 AS latency_ms,
  created_at,
  'core'::text                  AS source
FROM public.ai_decisions;

GRANT SELECT ON public.ai_decisions_unified TO authenticated;
GRANT SELECT ON public.ai_decisions_unified TO service_role;

COMMENT ON VIEW public.ai_decisions_unified IS
  'Phase 1 unified read view: sun_decisions + ai_decisions in one shape. Read-only, non-destructive.';
