
-- ============ img_proxy_settings (single row, owner-editable) ============
CREATE TABLE public.img_proxy_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  image_domain text NOT NULL DEFAULT 'muslly.com',
  allowed_hosts text[] NOT NULL DEFAULT ARRAY[
    'images.unsplash.com',
    'plus.unsplash.com',
    'source.unsplash.com',
    'img.youtube.com',
    'i.imgur.com'
  ]::text[],
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE ON public.img_proxy_settings TO authenticated;
GRANT ALL ON public.img_proxy_settings TO service_role;

ALTER TABLE public.img_proxy_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read img proxy settings"
  ON public.img_proxy_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE POLICY "owners write img proxy settings"
  ON public.img_proxy_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

INSERT INTO public.img_proxy_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ============ img_proxy_logs (recent attempts, last ~200 kept) ============
CREATE TABLE public.img_proxy_logs (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  host text,
  url text NOT NULL,
  status int NOT NULL,
  ok boolean NOT NULL,
  error text,
  duration_ms int
);

GRANT SELECT ON public.img_proxy_logs TO authenticated;
GRANT ALL ON public.img_proxy_logs TO service_role;

ALTER TABLE public.img_proxy_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read img proxy logs"
  ON public.img_proxy_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE INDEX img_proxy_logs_created_at_idx ON public.img_proxy_logs (created_at DESC);
CREATE INDEX img_proxy_logs_ok_idx ON public.img_proxy_logs (ok, created_at DESC);

-- Trim old rows so the table stays small (keep most recent 200).
CREATE OR REPLACE FUNCTION public.trim_img_proxy_logs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.img_proxy_logs
  WHERE id IN (
    SELECT id FROM public.img_proxy_logs
    ORDER BY id DESC
    OFFSET 200
  );
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trim_img_proxy_logs() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trim_img_proxy_logs_trg
  AFTER INSERT ON public.img_proxy_logs
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trim_img_proxy_logs();
