
CREATE TABLE IF NOT EXISTS public.prescription_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id TEXT NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  storage_provider TEXT NOT NULL DEFAULT 'supabase',
  bucket TEXT NOT NULL DEFAULT 'prescriptions',
  object_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  sha256 TEXT,
  legacy_blob_id UUID REFERENCES public.prescription_image_blobs(id) ON DELETE SET NULL,
  uploaded_via TEXT NOT NULL DEFAULT 'direct_upload'
    CHECK (uploaded_via IN ('direct_upload','whatsapp','migration','admin')),
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT prescription_files_object_path_unique UNIQUE (bucket, object_path)
);

CREATE INDEX IF NOT EXISTS prescription_files_prescription_idx
  ON public.prescription_files(prescription_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS prescription_files_legacy_blob_idx
  ON public.prescription_files(legacy_blob_id);
CREATE INDEX IF NOT EXISTS prescription_files_created_idx
  ON public.prescription_files(created_at DESC);

GRANT SELECT ON public.prescription_files TO authenticated;
GRANT ALL ON public.prescription_files TO service_role;

ALTER TABLE public.prescription_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read prescription files"
  ON public.prescription_files
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'owner'::public.app_role)
  );

CREATE POLICY "service role manages prescription files"
  ON public.prescription_files
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.touch_prescription_files_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_prescription_files_touch ON public.prescription_files;
CREATE TRIGGER trg_prescription_files_touch
  BEFORE UPDATE ON public.prescription_files
  FOR EACH ROW EXECUTE FUNCTION public.touch_prescription_files_updated_at();

CREATE OR REPLACE FUNCTION public.audit_prescription_file_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs (action, entity_type, entity_id, details, created_at)
    VALUES (
      'prescription_file.uploaded',
      'prescription_file',
      NEW.id::text,
      jsonb_build_object(
        'prescription_id', NEW.prescription_id,
        'bucket', NEW.bucket,
        'object_path', NEW.object_path,
        'mime_type', NEW.mime_type,
        'size_bytes', NEW.size_bytes,
        'uploaded_via', NEW.uploaded_via,
        'has_legacy_blob', NEW.legacy_blob_id IS NOT NULL
      ),
      now()
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    INSERT INTO public.activity_logs (action, entity_type, entity_id, details, created_at)
    VALUES (
      'prescription_file.deleted',
      'prescription_file',
      NEW.id::text,
      jsonb_build_object('prescription_id', NEW.prescription_id, 'object_path', NEW.object_path),
      now()
    );
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prescription_files_audit ON public.prescription_files;
CREATE TRIGGER trg_prescription_files_audit
  AFTER INSERT OR UPDATE ON public.prescription_files
  FOR EACH ROW EXECUTE FUNCTION public.audit_prescription_file_change();

CREATE OR REPLACE FUNCTION public.prescription_file_count(_prescription_id TEXT)
RETURNS INTEGER LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::int FROM public.prescription_files
   WHERE prescription_id = _prescription_id AND deleted_at IS NULL
$$;

INSERT INTO public.app_settings (key, value, description, updated_at)
VALUES (
  'prescription_storage_mode',
  to_jsonb('dual_write'::text),
  'Phase 6A — dual_write | storage_only | legacy_only',
  now()
)
ON CONFLICT (key) DO NOTHING;
