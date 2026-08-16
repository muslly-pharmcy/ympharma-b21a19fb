
-- ============ push_subscriptions ============
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  visitor_token text,
  endpoint text UNIQUE NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  active boolean NOT NULL DEFAULT true,
  last_success_at timestamptz,
  fail_count int NOT NULL DEFAULT 0,
  subscribed_at timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at timestamptz
);
CREATE INDEX idx_push_subs_active ON public.push_subscriptions(active) WHERE active = true;
CREATE INDEX idx_push_subs_visitor ON public.push_subscriptions(visitor_token);
CREATE INDEX idx_push_subs_user ON public.push_subscriptions(user_id);

GRANT SELECT, INSERT, UPDATE ON public.push_subscriptions TO anon, authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can subscribe"
  ON public.push_subscriptions FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "users manage own subs"
  ON public.push_subscriptions FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "admins read subs"
  ON public.push_subscriptions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

CREATE POLICY "service manages subs"
  ON public.push_subscriptions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============ ai_campaigns ============
CREATE TABLE public.ai_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  frequency text NOT NULL DEFAULT '72_hours',
  content_type text NOT NULL DEFAULT 'medical_tip',
  target_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  post_id uuid REFERENCES public.medical_posts(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_campaigns TO authenticated;
GRANT ALL ON public.ai_campaigns TO service_role;

ALTER TABLE public.ai_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage campaigns"
  ON public.ai_campaigns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "service manages campaigns"
  ON public.ai_campaigns FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_ai_campaigns_updated_at
  BEFORE UPDATE ON public.ai_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ campaign_deliveries ============
CREATE TABLE public.campaign_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.ai_campaigns(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.push_subscriptions(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.medical_posts(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'sent',
  sent_at timestamptz NOT NULL DEFAULT now(),
  opened_at timestamptz,
  clicked_at timestamptz,
  error_message text
);
CREATE INDEX idx_cd_sub_sent ON public.campaign_deliveries(subscription_id, sent_at DESC);
CREATE INDEX idx_cd_campaign ON public.campaign_deliveries(campaign_id, sent_at DESC);

GRANT SELECT ON public.campaign_deliveries TO authenticated;
GRANT ALL ON public.campaign_deliveries TO service_role;

ALTER TABLE public.campaign_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read deliveries"
  ON public.campaign_deliveries FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "service manages deliveries"
  ON public.campaign_deliveries FOR ALL TO service_role
  USING (true) WITH CHECK (true);
