
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
  invoice_number TEXT UNIQUE NOT NULL,
  html_content TEXT NOT NULL,
  total NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','cancelled')),
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON public.invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);

GRANT SELECT ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage invoices" ON public.invoices
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
  transaction_ref TEXT UNIQUE,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'YER',
  method TEXT NOT NULL CHECK (method IN ('cod','bank_transfer','card','wallet')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','cancelled')),
  payment_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  receipt_url TEXT,
  confirmed_by UUID REFERENCES auth.users(id),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_paytx_order_id ON public.payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_paytx_status ON public.payment_transactions(status);

GRANT SELECT ON public.payment_transactions TO authenticated;
GRANT ALL ON public.payment_transactions TO service_role;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage payments" ON public.payment_transactions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON public.invoices;
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_paytx_updated_at ON public.payment_transactions;
CREATE TRIGGER trg_paytx_updated_at BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_year TEXT; v_seq INTEGER;
BEGIN
  v_year := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '-([0-9]+)$') AS INTEGER)), 0) + 1
    INTO v_seq FROM public.invoices WHERE invoice_number LIKE 'INV-' || v_year || '-%';
  RETURN 'INV-' || v_year || '-' || LPAD(v_seq::TEXT, 5, '0');
END; $$;
GRANT EXECUTE ON FUNCTION public.generate_invoice_number() TO authenticated, service_role;
