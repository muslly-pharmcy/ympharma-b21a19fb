
-- Realtime owns realtime.messages on hosted Supabase. Its built-in RLS remains
-- authoritative; application authorization is enforced on the public tables.

-- 2) Activity logs INSERT policy (writes still happen via SECURITY DEFINER fns/triggers,
--    but make the rule explicit so direct inserts cannot be forged for another user)
DROP POLICY IF EXISTS "Users can insert own activity entries" ON public.activity_logs;
CREATE POLICY "Users can insert own activity entries"
ON public.activity_logs
FOR INSERT
TO authenticated
WITH CHECK (actor_id = auth.uid());

-- 3) Storage policies for prescriptions bucket (UPDATE + DELETE)
DROP POLICY IF EXISTS "Staff can update prescription files" ON storage.objects;
CREATE POLICY "Staff can update prescription files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'prescriptions'
  AND (
    public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_permission(auth.uid(), 'prescriptions')
  )
)
WITH CHECK (
  bucket_id = 'prescriptions'
  AND (
    public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_permission(auth.uid(), 'prescriptions')
  )
);

DROP POLICY IF EXISTS "Staff can delete prescription files" ON storage.objects;
CREATE POLICY "Staff can delete prescription files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'prescriptions'
  AND (
    public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_permission(auth.uid(), 'prescriptions')
  )
);
