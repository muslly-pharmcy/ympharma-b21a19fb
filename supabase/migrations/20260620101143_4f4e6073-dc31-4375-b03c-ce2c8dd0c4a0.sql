
CREATE OR REPLACE FUNCTION public.cancel_transfer(
  _transfer_id uuid,
  _reason      text DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t public.inventory_transfers%ROWTYPE;
BEGIN
  -- Serialize all reserve/release/commit/cancel ops for this transfer.
  PERFORM pg_advisory_xact_lock(hashtextextended(_transfer_id::text, 0));

  SELECT * INTO t
    FROM public.inventory_transfers
   WHERE id = _transfer_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'transfer % not found', _transfer_id USING ERRCODE = 'P0002';
  END IF;

  -- Idempotent re-entry: safe to retry, never releases twice.
  IF t.status = 'CANCELLED' THEN
    RETURN 'SKIPPED_DUPLICATE';
  END IF;

  IF t.status IN ('COMPLETED','REJECTED') THEN
    RAISE EXCEPTION 'cannot cancel transfer in terminal state %', t.status
      USING ERRCODE = 'check_violation';
  END IF;

  -- Release reservation only if one is actually held. The release fn is
  -- itself idempotent and returns SKIPPED_NO_RESERVATION otherwise.
  IF t.status IN ('RESERVED','PICKING','PACKED') THEN
    PERFORM public.release_transfer_reservation(_transfer_id, COALESCE(_reason, 'cancelled'));
  END IF;

  UPDATE public.inventory_transfers
     SET status = 'CANCELLED',
         reason = COALESCE(_reason, reason)
   WHERE id = _transfer_id;
  -- trg_transfer_status_guard_upd writes the audit row + agent_events.

  RETURN 'OK_CANCELLED';
END
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_transfer(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.cancel_transfer(uuid, text) TO authenticated, service_role;
