
-- product-images: staff-only writes; reads always go through server-issued signed URLs.
DROP POLICY IF EXISTS "product_images_staff_write" ON storage.objects;
CREATE POLICY "product_images_staff_write" ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'product-images' AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role)))
  WITH CHECK (bucket_id = 'product-images' AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role)));

-- payment-receipts: user uploads to own folder, staff can read all.
DROP POLICY IF EXISTS "payment_receipts_user_write" ON storage.objects;
CREATE POLICY "payment_receipts_user_write" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'payment-receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "payment_receipts_user_read" ON storage.objects;
CREATE POLICY "payment_receipts_user_read" ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-receipts'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'owner'::app_role)
    )
  );
