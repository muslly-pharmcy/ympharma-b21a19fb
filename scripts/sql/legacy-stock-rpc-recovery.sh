#!/usr/bin/env bash
# Only the synthetic CI database is accepted. Never restore over source data.
set -euo pipefail
[[ "${PGDATABASE:-}" == 'ympharma_legacy_stock_test' ]] || { echo 'Synthetic database required'; exit 1; }
# This script belongs to the disposable hosted CI service, never a remote server.
[[ "${GITHUB_ACTIONS:-}" == true && "${RUNNER_ENVIRONMENT:-}" == github-hosted ]] || { echo 'Disposable GitHub-hosted CI required'; exit 1; }
[[ "${PGHOST:-}" == 127.0.0.1 && "${PGPORT:-}" == 5432 && "${PGUSER:-}" == postgres ]] || { echo 'Explicit loopback CI connection required'; exit 1; }
[[ -z "${PGHOSTADDR:-}${PGSERVICE:-}${PGSERVICEFILE:-}${PGOPTIONS:-}" ]] || { echo 'Connection overrides are forbidden'; exit 1; }
evidence=$(mktemp -d)
snapshot() {
  psql -X -v ON_ERROR_STOP=1 -At -d "$1" <<'SQL'
SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.inv_stock_batches t;
SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.inv_stock_movements t;
SELECT jsonb_agg(to_jsonb(t) ORDER BY movement_id) FROM public.synthetic_events t;
SELECT has_function_privilege('anon','public.inv_adjust_stock(uuid,numeric,text)','EXECUTE'),has_function_privilege('authenticated','public.inv_adjust_stock(uuid,numeric,text)','EXECUTE');
SQL
}
snapshot "$PGDATABASE" > "$evidence/before.txt"
pg_dump -Fc -f "$evidence/fixture.dump" "$PGDATABASE"
createdb ympharma_legacy_stock_restored
pg_restore --exit-on-error -d ympharma_legacy_stock_restored "$evidence/fixture.dump"
snapshot ympharma_legacy_stock_restored > "$evidence/after.txt"
diff -u "$evidence/before.txt" "$evidence/after.txt"
psql -X -v ON_ERROR_STOP=1 -d ympharma_legacy_stock_restored <<'SQL'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
DO $$ BEGIN
  BEGIN
    PERFORM public.inv_adjust_stock('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',-1,'restored reservation guard');
    RAISE EXCEPTION 'restored database permitted reserved stock consumption';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;
SQL
snapshot ympharma_legacy_stock_restored > "$evidence/after-rejection.txt"
diff -u "$evidence/before.txt" "$evidence/after-rejection.txt"
echo 'PASS: synthetic stock, movements, events and ACL restored; reservation guard retained.'
