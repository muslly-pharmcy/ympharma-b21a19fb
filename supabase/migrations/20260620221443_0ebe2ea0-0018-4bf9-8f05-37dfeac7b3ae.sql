
-- Prescription uploads: accept any image/* and PDF up to 25 MB
DROP POLICY IF EXISTS "anyone upload prescription images" ON storage.objects;
CREATE POLICY "anyone upload prescription images" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'prescriptions'
    AND (storage.foldername(name))[1] = 'uploads'
    AND (
      lower(COALESCE(metadata->>'mimetype','')) LIKE 'image/%'
      OR lower(COALESCE(metadata->>'mimetype','')) = 'application/pdf'
    )
    AND COALESCE((metadata->>'size')::bigint, 0) <= 26214400
  );

-- Insurance uploads: same widening
DROP POLICY IF EXISTS "anyone_uploads_insurance_constrained" ON storage.objects;
CREATE POLICY "anyone_uploads_insurance_constrained" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'insurance'
    AND (
      lower(COALESCE(metadata->>'mimetype','')) LIKE 'image/%'
      OR lower(COALESCE(metadata->>'mimetype','')) = 'application/pdf'
    )
    AND COALESCE((metadata->>'size')::bigint, 0) <= 26214400
  );
