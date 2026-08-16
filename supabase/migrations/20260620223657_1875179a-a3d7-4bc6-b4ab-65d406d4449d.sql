-- Phase 6C: WhatsApp Customer Notifications — delivery tracking columns
ALTER TABLE public.whatsapp_delivery_logs
  ADD COLUMN IF NOT EXISTS correlation_id text,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;

-- Idempotency: prevent duplicate dispatches for same (kind, ref, recipient).
CREATE UNIQUE INDEX IF NOT EXISTS uq_wa_delivery_idem
  ON public.whatsapp_delivery_logs(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Fast lookups for the retry worker and the delivery webhook.
CREATE INDEX IF NOT EXISTS idx_wa_delivery_status_attempts
  ON public.whatsapp_delivery_logs(status, attempts, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_wa_delivery_wamid
  ON public.whatsapp_delivery_logs(wamid)
  WHERE wamid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wa_delivery_created_at
  ON public.whatsapp_delivery_logs(created_at DESC);
