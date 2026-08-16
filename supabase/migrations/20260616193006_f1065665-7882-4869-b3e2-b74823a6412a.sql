-- Tighten INSERT policy on prescriptions bucket: enforce uploads/ folder + image mime + size limit
DROP POLICY IF EXISTS "anyone upload prescription images" ON storage.objects;

CREATE POLICY "anyone upload prescription images"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'prescriptions'
  AND (storage.foldername(name))[1] = 'uploads'
  AND lower(coalesce(metadata->>'mimetype','')) IN ('image/jpeg','image/jpg','image/png','image/webp','image/heic','image/heif','application/pdf')
  AND coalesce((metadata->>'size')::bigint, 0) <= 10485760
);

-- Align SELECT policy with table-level access (admin OR owner OR has prescriptions permission)
DROP POLICY IF EXISTS "admins read prescription images" ON storage.objects;

CREATE POLICY "staff read prescription images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'prescriptions'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'owner')
    OR public.has_permission(auth.uid(), 'prescriptions')
  )
);
