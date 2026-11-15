"""Real multi-connection test; ONLY the synthetic admin-stock CI database."""
import concurrent.futures
import os
import subprocess
import uuid

if os.environ.get('PGDATABASE') != 'ympharma_admin_stock_test':
    raise SystemExit('Refusing a non-disposable database')

def sql(statement):
    return subprocess.run(['psql', '-X', '-At', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-c', statement], capture_output=True, text=True)

reset = sql("""
UPDATE public.organization_members SET branch_scope='{}';
UPDATE public.inv_stock_batches SET qty_reserved=0,qty_on_hand=CASE WHEN batch_no='LOT-1' THEN 10 ELSE 5 END;
TRUNCATE public.inv_stock_set_requests,public.inv_stock_movements,public.test_events;
""")
if reset.returncode:
    raise SystemExit(reset.stderr)

def attempt(_):
    key = str(uuid.uuid4())
    return sql(f"SELECT public.inv_set_product_stock('11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-cccccccccccc',15,14,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{key}','concurrent recount');")

with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
    results = list(executor.map(attempt, range(20)))
passed = sum(r.returncode == 0 for r in results)
rejected = sum(r.returncode != 0 and '40001' in r.stderr and 'STOCK_BALANCE_CHANGED' in r.stderr for r in results)
assert (passed, rejected) == (1, 19), [(r.returncode, r.stderr) for r in results]
final = sql("SELECT sum(qty_on_hand) FROM public.inv_stock_batches;")
assert final.returncode == 0 and final.stdout.strip() == '14.000', final.stdout
print('PASS: 20 independent stock-set attempts, 1 accepted, 19 stale-balance rejections, final stock 14')
