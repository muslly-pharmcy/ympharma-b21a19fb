-- Internal in-app notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users update their own notifications (mark read)"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read, created_at DESC);
CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

-- Loyalty accounts
CREATE TABLE public.loyalty_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  tier TEXT NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze','silver','gold','platinum')),
  total_spent_yer NUMERIC NOT NULL DEFAULT 0 CHECK (total_spent_yer >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.loyalty_accounts TO authenticated;
GRANT ALL ON public.loyalty_accounts TO service_role;

ALTER TABLE public.loyalty_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own loyalty account"
  ON public.loyalty_accounts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE public.loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  points INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earned','redeemed','bonus','expired','adjustment')),
  description TEXT,
  order_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.loyalty_transactions TO authenticated;
GRANT ALL ON public.loyalty_transactions TO service_role;

ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own loyalty transactions"
  ON public.loyalty_transactions FOR SELECT TO authenticated
  USING (phone_number IN (
    SELECT la.phone_number FROM public.loyalty_accounts la WHERE la.user_id = auth.uid()
  ));

CREATE INDEX idx_loyalty_tx_phone_created ON public.loyalty_transactions(phone_number, created_at DESC);

-- Tier recompute helper
CREATE OR REPLACE FUNCTION public.recompute_loyalty_tier(_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_spent NUMERIC;
  v_tier TEXT;
BEGIN
  SELECT total_spent_yer INTO v_spent FROM public.loyalty_accounts WHERE phone_number = _phone;
  IF v_spent IS NULL THEN
    RETURN NULL;
  END IF;
  v_tier := CASE
    WHEN v_spent >= 50000 THEN 'platinum'
    WHEN v_spent >= 25000 THEN 'gold'
    WHEN v_spent >= 10000 THEN 'silver'
    ELSE 'bronze'
  END;
  UPDATE public.loyalty_accounts SET tier = v_tier, updated_at = now() WHERE phone_number = _phone;
  RETURN v_tier;
END;
$$;

-- Earn points: 1 point per 10 YER spent
CREATE OR REPLACE FUNCTION public.add_loyalty_points(
  _phone TEXT,
  _spent_yer NUMERIC,
  _order_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points INTEGER;
BEGIN
  v_points := GREATEST(0, FLOOR(_spent_yer / 10)::INTEGER);
  INSERT INTO public.loyalty_accounts (phone_number, points, total_spent_yer)
  VALUES (_phone, v_points, _spent_yer)
  ON CONFLICT (phone_number) DO UPDATE
    SET points = public.loyalty_accounts.points + EXCLUDED.points,
        total_spent_yer = public.loyalty_accounts.total_spent_yer + EXCLUDED.total_spent_yer,
        updated_at = now();

  INSERT INTO public.loyalty_transactions (phone_number, points, type, description, order_id)
  VALUES (_phone, v_points, 'earned',
          format('نقاط من طلب بقيمة %s ر.ي', _spent_yer::TEXT), _order_id);

  PERFORM public.recompute_loyalty_tier(_phone);
  RETURN v_points;
END;
$$;

-- Redeem points: 1 point = 0.5 YER discount
CREATE OR REPLACE FUNCTION public.redeem_loyalty_points(
  _phone TEXT,
  _points INTEGER
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INTEGER;
  v_discount NUMERIC;
BEGIN
  IF _points <= 0 THEN
    RAISE EXCEPTION 'invalid_points_amount';
  END IF;
  SELECT points INTO v_balance FROM public.loyalty_accounts WHERE phone_number = _phone FOR UPDATE;
  IF v_balance IS NULL OR v_balance < _points THEN
    RAISE EXCEPTION 'insufficient_points';
  END IF;
  v_discount := _points * 0.5;
  UPDATE public.loyalty_accounts
    SET points = points - _points, updated_at = now()
    WHERE phone_number = _phone;
  INSERT INTO public.loyalty_transactions (phone_number, points, type, description)
  VALUES (_phone, -_points, 'redeemed',
          format('استرداد %s نقطة بقيمة %s ر.ي', _points::TEXT, v_discount::TEXT));
  RETURN v_discount;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.add_loyalty_points(TEXT, NUMERIC, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.redeem_loyalty_points(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_loyalty_tier(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_loyalty_points(TEXT, NUMERIC, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.redeem_loyalty_points(TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.recompute_loyalty_tier(TEXT) TO service_role;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_loyalty_accounts_updated_at
  BEFORE UPDATE ON public.loyalty_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
