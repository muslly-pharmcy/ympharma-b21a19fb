
-- ============ visitor_sessions ============
CREATE TABLE public.visitor_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_token text UNIQUE NOT NULL,
  ip_hash text,
  country text,
  language text,
  device text,
  browser text,
  pages_viewed jsonb NOT NULL DEFAULT '[]'::jsonb,
  interests jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_visit boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_visitor_sessions_token ON public.visitor_sessions(visitor_token);
CREATE INDEX idx_visitor_sessions_country ON public.visitor_sessions(country);
CREATE INDEX idx_visitor_sessions_last_seen ON public.visitor_sessions(last_seen_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.visitor_sessions TO authenticated;
GRANT ALL ON public.visitor_sessions TO service_role;

ALTER TABLE public.visitor_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read visitor sessions"
  ON public.visitor_sessions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "service manages visitor sessions"
  ON public.visitor_sessions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============ medical_posts ============
CREATE TABLE public.medical_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text UNIQUE NOT NULL,
  category text NOT NULL,
  content text NOT NULL,
  summary text,
  language text NOT NULL DEFAULT 'ar',
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  cover_image_url text,
  ai_generated boolean NOT NULL DEFAULT true,
  approved boolean NOT NULL DEFAULT false,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  published_at timestamptz,
  publish_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_medical_posts_approved_pub ON public.medical_posts(approved, published_at DESC);
CREATE INDEX idx_medical_posts_slug ON public.medical_posts(slug);
CREATE INDEX idx_medical_posts_category ON public.medical_posts(category);

GRANT SELECT ON public.medical_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medical_posts TO authenticated;
GRANT ALL ON public.medical_posts TO service_role;

ALTER TABLE public.medical_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public reads approved posts"
  ON public.medical_posts FOR SELECT TO anon, authenticated
  USING (approved = true);

CREATE POLICY "admins read all posts"
  ON public.medical_posts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins manage posts"
  ON public.medical_posts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "service manages posts"
  ON public.medical_posts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_medical_posts_updated_at
  BEFORE UPDATE ON public.medical_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
