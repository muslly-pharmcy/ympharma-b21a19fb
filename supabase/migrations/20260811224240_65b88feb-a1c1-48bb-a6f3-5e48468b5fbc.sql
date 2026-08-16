CREATE TABLE public.seedance_generations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  job_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress',
  prompt TEXT NOT NULL,
  aspect_ratio TEXT NOT NULL DEFAULT '9:16',
  seconds INTEGER NOT NULL DEFAULT 8,
  storage_path TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX seedance_generations_job_id_key ON public.seedance_generations (job_id);
CREATE INDEX seedance_generations_user_idx ON public.seedance_generations (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seedance_generations TO authenticated;
GRANT ALL ON public.seedance_generations TO service_role;

ALTER TABLE public.seedance_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seedance_own_select" ON public.seedance_generations
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "seedance_own_insert" ON public.seedance_generations
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "seedance_own_update" ON public.seedance_generations
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "seedance_own_delete" ON public.seedance_generations
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER update_seedance_generations_updated_at
  BEFORE UPDATE ON public.seedance_generations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "seedance_videos_own_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'seedance-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "seedance_videos_own_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'seedance-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "seedance_videos_own_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'seedance-videos' AND (storage.foldername(name))[1] = auth.uid()::text);