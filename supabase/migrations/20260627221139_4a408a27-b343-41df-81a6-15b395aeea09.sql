
DROP POLICY IF EXISTS "anyone can submit a contact message" ON public.contact_messages;

CREATE POLICY "anyone can submit a contact message"
  ON public.contact_messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(btrim(name)) BETWEEN 1 AND 200
    AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND length(email) <= 320
    AND length(btrim(message)) BETWEEN 5 AND 5000
  );
