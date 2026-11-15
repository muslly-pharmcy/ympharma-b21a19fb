#!/usr/bin/env bash
# Synthetic CI database only. Attempts two competing decrements of the
# sole remaining unreserved unit; precisely one must succeed.
set -euo pipefail

run_adjustment() {
  local output_file="$1"
  psql -X -q -v ON_ERROR_STOP=1 -Atc "
    SET ROLE authenticated;
    SELECT pg_catalog.set_config('request.jwt.claim.sub',
      '11111111-1111-4111-8111-111111111111', false);
    SELECT public.inv_adjust_stock(
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',-1,'concurrent decrement');
  " >"$output_file" 2>&1
}

run_adjustment /tmp/ympharma-stock-attempt-1.log &
pid1=$!
run_adjustment /tmp/ympharma-stock-attempt-2.log &
pid2=$!

set +e
wait "$pid1"; rc1=$?
wait "$pid2"; rc2=$?
set -e

if [[ "$(( (rc1 == 0) + (rc2 == 0) ))" -ne 1 ]]; then
  echo "Expected exactly one successful competing adjustment. rc1=$rc1 rc2=$rc2"
  cat /tmp/ympharma-stock-attempt-1.log /tmp/ympharma-stock-attempt-2.log
  exit 1
fi

psql -X -v ON_ERROR_STOP=1 <<'SQL'
DO $test$
DECLARE onhand numeric;
DECLARE reserved numeric;
DECLARE movements integer;
BEGIN
  SELECT qty_on_hand,qty_reserved INTO onhand,reserved
  FROM public.inv_stock_batches
  WHERE id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  SELECT count(*) INTO movements
  FROM public.inv_stock_movements
  WHERE batch_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  IF onhand<>8 OR reserved<>8 OR movements<>2 THEN
    RAISE EXCEPTION 'race affected stock or audit: onhand %, reserved %, moves %',
      onhand,reserved,movements;
  END IF;
END;
$test$;
SQL

echo "PASS: one of two competing stock decrements succeeded; stock == reserved; exactly two total movements."
