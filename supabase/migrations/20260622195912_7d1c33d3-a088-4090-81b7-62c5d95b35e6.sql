DROP POLICY IF EXISTS "Staff can subscribe to orders/prescriptions topics" ON realtime.messages;
DROP POLICY IF EXISTS "Staff can subscribe to staff topics" ON realtime.messages;

CREATE POLICY "Staff can subscribe to staff topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  CASE
    WHEN realtime.topic() IN ('orders', 'public:orders') THEN
      public.has_role(auth.uid(), 'owner')
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_permission(auth.uid(), 'orders')
    WHEN realtime.topic() IN ('prescriptions', 'public:prescriptions') THEN
      public.has_role(auth.uid(), 'owner')
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_permission(auth.uid(), 'prescriptions')
    WHEN realtime.topic() IN ('agent_approval_requests', 'public:agent_approval_requests') THEN
      public.has_role(auth.uid(), 'owner')
      OR public.has_role(auth.uid(), 'admin')
    ELSE false
  END
);
