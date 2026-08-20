-- Restrict order_status_history SELECT to staff only.
-- Public tracking continues to work via the existing SECURITY DEFINER RPC
-- get_order_history_public(_id text), so customers can still look up their
-- own order by ID without being able to enumerate all order IDs.
DROP POLICY IF EXISTS "public can read history of an order" ON public.order_status_history;
REVOKE SELECT ON public.order_status_history FROM anon;

CREATE POLICY "staff can read order history"
ON public.order_status_history
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'owner')
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_permission(auth.uid(), 'orders')
);
