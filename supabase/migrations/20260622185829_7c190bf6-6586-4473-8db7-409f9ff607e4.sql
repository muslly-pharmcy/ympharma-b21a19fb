
CREATE POLICY "Submitters read own approval requests"
ON public.agent_approval_requests
FOR SELECT
TO authenticated
USING (
  (payload ->> 'submittedBy') = auth.uid()::text
);
