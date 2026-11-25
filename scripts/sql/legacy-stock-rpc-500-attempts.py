#!/usr/bin/env python3
"""500 synthetic contenders, at most 32 concurrent PostgreSQL sessions."""
import concurrent.futures
import os
import subprocess
import sys
import threading
import time

EXPECTED = {
    "GITHUB_ACTIONS": "true", "RUNNER_ENVIRONMENT": "github-hosted",
    "PGHOST": "127.0.0.1", "PGPORT": "5432", "PGUSER": "postgres",
    "PGDATABASE": "ympharma_legacy_stock_test",
}
if any(os.environ.get(k) != v for k, v in EXPECTED.items()):
    sys.exit("Disposable GitHub-hosted loopback database required")
if any(os.environ.get(k) for k in ("PGHOSTADDR", "PGSERVICE", "PGSERVICEFILE", "PGOPTIONS")):
    sys.exit("Connection overrides forbidden")

BATCH = "bbbbbbbb-bbbb-4bbb-8bbb-111111111111"
WORKERS, ATTEMPTS = 32, 500
def sql(statement):
    return subprocess.run(
        ["psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1",
         "-v", "VERBOSITY=verbose", "-c", statement],
        text=True, capture_output=True, timeout=45, check=False,
    )
def required(statement):
    result = sql(statement)
    if result.returncode:
        sys.exit(result.stderr)
    return result.stdout.strip()

required(f"""
INSERT INTO public.inv_stock_batches
(id, organization_id, warehouse_id, product_id, qty_on_hand, qty_reserved)
VALUES ('{BATCH}', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 1, 0);
""")
barrier = threading.Barrier(WORKERS, timeout=30)

def attempt(index):
    if index < WORKERS:
        barrier.wait()
    result = sql(f"""
SET ROLE authenticated;
SELECT pg_catalog.set_config('request.jwt.claim.sub',
 '11111111-1111-4111-8111-111111111111', false);
SELECT public.inv_adjust_stock('{BATCH}', -1, 'synthetic 500-contender test');
""")
    if result.returncode == 0:
        return "success"
    if "23514" in result.stderr and "adjustment would exceed unreserved stock" in result.stderr:
        return "rejected"
    return "unexpected: " + result.stderr[:400]

started = time.monotonic()
with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as pool:
    results = list(pool.map(attempt, range(ATTEMPTS)))
success = results.count("success")
rejected = results.count("rejected")
print(f"attempts={ATTEMPTS} max_parallel_sessions={WORKERS} success={success} rejected={rejected} elapsed_seconds={time.monotonic()-started:.2f}")
if success != 1 or rejected != 499:
    print([r for r in results if r.startswith("unexpected")][:5])
    sys.exit("Wrong outcome or unexpected errors")

actual = required(f"""
SELECT b.qty_on_hand::text || '|' || b.qty_reserved::text || '|' ||
 (SELECT count(*) FROM public.inv_stock_movements m WHERE m.batch_id=b.id) || '|' ||
 (SELECT COALESCE(sum(qty_delta),0) FROM public.inv_stock_movements m WHERE m.batch_id=b.id) || '|' ||
 (SELECT count(*) FROM public.synthetic_events e JOIN public.inv_stock_movements m
   ON m.id=e.movement_id WHERE m.batch_id=b.id)
FROM public.inv_stock_batches b WHERE b.id='{BATCH}';
""")
if actual != "0|0|1|-1|1":
    sys.exit(f"Unexpected stock/movement/event invariant: {actual}")
print("PASS: exactly one decrement, 499 explicit stock rejections, one movement and one event")
