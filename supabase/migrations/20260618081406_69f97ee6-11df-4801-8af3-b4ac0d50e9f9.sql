
-- ============ img_rate_limit ============
CREATE TABLE public.img_rate_limit (
  ip text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  count int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.img_rate_limit TO service_role;
ALTER TABLE public.img_rate_limit ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated — proxy uses service role.

CREATE INDEX img_rate_limit_updated_idx ON public.img_rate_limit (updated_at);

-- Returns true if the IP is allowed to proceed, false if it has exceeded the limit.
-- Caller passes _max (e.g. 60) and _window_seconds (e.g. 60).
CREATE OR REPLACE FUNCTION public.check_img_rate_limit(
  _ip text, _max int, _window_seconds int
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  INSERT INTO public.img_rate_limit AS r (ip, window_start, count, updated_at)
  VALUES (_ip, now(), 1, now())
  ON CONFLICT (ip) DO UPDATE SET
    window_start = CASE
      WHEN r.window_start < now() - make_interval(secs => _window_seconds) THEN now()
      ELSE r.window_start
    END,
    count = CASE
      WHEN r.window_start < now() - make_interval(secs => _window_seconds) THEN 1
      ELSE r.count + 1
    END,
    updated_at = now()
  RETURNING count INTO v_count;
  RETURN v_count <= _max;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_img_rate_limit(text, int, int) FROM PUBLIC, anon, authenticated;

-- ============ product_image_overrides ============
CREATE TABLE public.product_image_overrides (
  dedupe_key text PRIMARY KEY,
  image_url text,
  source text NOT NULL DEFAULT 'manual',
  found boolean NOT NULL DEFAULT false,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT ON public.product_image_overrides TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_image_overrides TO authenticated;
GRANT ALL ON public.product_image_overrides TO service_role;

ALTER TABLE public.product_image_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public can read found overrides"
  ON public.product_image_overrides FOR SELECT TO anon, authenticated
  USING (found = true AND image_url IS NOT NULL);

CREATE POLICY "admins manage overrides"
  ON public.product_image_overrides FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE INDEX product_image_overrides_fetched_idx ON public.product_image_overrides (fetched_at DESC);
