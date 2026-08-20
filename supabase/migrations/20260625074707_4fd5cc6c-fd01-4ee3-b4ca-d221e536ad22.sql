
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 255),
  message text NOT NULL CHECK (char_length(message) BETWEEN 10 AND 1000),
  user_agent text,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.contact_messages TO anon, authenticated;
GRANT SELECT ON public.contact_messages TO authenticated;
GRANT ALL ON public.contact_messages TO service_role;

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can submit a contact message" ON public.contact_messages;
CREATE POLICY "anyone can submit a contact message"
  ON public.contact_messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "admins can read contact messages" ON public.contact_messages;
CREATE POLICY "admins can read contact messages"
  ON public.contact_messages FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE INDEX IF NOT EXISTS contact_messages_created_at_idx
  ON public.contact_messages (created_at DESC);
