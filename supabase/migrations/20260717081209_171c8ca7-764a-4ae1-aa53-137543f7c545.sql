CREATE TABLE public.wa_allowlist (
  phone text PRIMARY KEY,
  label text,
  district text NOT NULL DEFAULT 'عدن',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_allowlist TO authenticated;
GRANT ALL ON public.wa_allowlist TO service_role;
ALTER TABLE public.wa_allowlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage wa allowlist"
  ON public.wa_allowlist FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
