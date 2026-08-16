
CREATE POLICY "anyone upload prescription images" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'prescriptions');
CREATE POLICY "admins read prescription images" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'prescriptions' AND public.has_role(auth.uid(),'admin'));
