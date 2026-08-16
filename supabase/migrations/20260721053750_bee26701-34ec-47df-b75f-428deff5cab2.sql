
CREATE TABLE IF NOT EXISTS public.medical_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 120),
  phone text NOT NULL CHECK (char_length(phone) BETWEEN 5 AND 40),
  request_type text NOT NULL CHECK (request_type IN ('medication','consultation','delivery','other')),
  note text CHECK (note IS NULL OR char_length(note) <= 2000),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','done','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medical_requests TO authenticated;
GRANT INSERT ON public.medical_requests TO anon;
GRANT ALL ON public.medical_requests TO service_role;
ALTER TABLE public.medical_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone_can_submit_request" ON public.medical_requests;
CREATE POLICY "anyone_can_submit_request" ON public.medical_requests FOR INSERT TO anon, authenticated WITH CHECK (status = 'new');
DROP POLICY IF EXISTS "admins_read_requests" ON public.medical_requests;
CREATE POLICY "admins_read_requests" ON public.medical_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admins_update_requests" ON public.medical_requests;
CREATE POLICY "admins_update_requests" ON public.medical_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
