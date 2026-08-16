ALTER TABLE public.social_post_attempts
  ADD COLUMN IF NOT EXISTS request_payload JSONB,
  ADD COLUMN IF NOT EXISTS response_status INTEGER,
  ADD COLUMN IF NOT EXISTS response_body TEXT,
  ADD COLUMN IF NOT EXISTS hmac_valid BOOLEAN,
  ADD COLUMN IF NOT EXISTS idempotent_skip BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.social_post_attempts DROP CONSTRAINT IF EXISTS social_post_attempts_status_check;
ALTER TABLE public.social_post_attempts
  ADD CONSTRAINT social_post_attempts_status_check
  CHECK (status IN ('success','failed','skipped'));
