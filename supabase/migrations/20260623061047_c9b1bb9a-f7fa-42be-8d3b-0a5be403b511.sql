-- 1) attempts log
CREATE TABLE public.social_post_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  attempt_no INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success','failed')),
  error_message TEXT,
  external_id TEXT,
  source TEXT NOT NULL DEFAULT 'server' CHECK (source IN ('server','callback','manual','cron')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_social_post_attempts_post ON public.social_post_attempts(post_id, created_at DESC);

GRANT SELECT ON public.social_post_attempts TO authenticated;
GRANT ALL ON public.social_post_attempts TO service_role;

ALTER TABLE public.social_post_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_owner_read_attempts" ON public.social_post_attempts
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));

-- 2) attempt counters on social_posts
ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;

-- 3) unique index for stats upsert by post_id
CREATE UNIQUE INDEX IF NOT EXISTS uq_social_post_stats_post
  ON public.social_post_stats(post_id);
