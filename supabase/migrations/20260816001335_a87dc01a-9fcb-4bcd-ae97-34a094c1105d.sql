DROP POLICY IF EXISTS "insurance_cards_owner_select" ON storage.objects;
DROP POLICY IF EXISTS "insurance_cards_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "insurance_cards_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "insurance_cards_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "insurance_cards_staff_select" ON storage.objects;

CREATE POLICY "insurance_cards_owner_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'insurance-cards' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "insurance_cards_owner_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'insurance-cards' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "insurance_cards_owner_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'insurance-cards' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'insurance-cards' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "insurance_cards_owner_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'insurance-cards' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "insurance_cards_staff_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'insurance-cards' AND public.has_role(auth.uid(), 'admin'::public.app_role));