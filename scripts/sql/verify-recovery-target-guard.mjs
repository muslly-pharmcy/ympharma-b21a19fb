import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const script = fileURLToPath(new URL('./legacy-stock-rpc-recovery.sh', import.meta.url));
const bash = process.env.TEST_BASH || 'bash';
const base = { ...process.env, PGDATABASE: 'ympharma_legacy_stock_test', PGHOST: '127.0.0.1',
  PGPORT: '5432', PGUSER: 'postgres', GITHUB_ACTIONS: 'true', RUNNER_ENVIRONMENT: 'github-hosted',
  PGHOSTADDR: '', PGSERVICE: '', PGSERVICEFILE: '', PGOPTIONS: '' };
const cases = [
  [{PGDATABASE:'production'}, 'Synthetic database required'],
  [{GITHUB_ACTIONS:''}, 'Disposable GitHub-hosted CI required'],
  [{RUNNER_ENVIRONMENT:'self-hosted'}, 'Disposable GitHub-hosted CI required'],
  [{PGHOST:'db.example.invalid'}, 'Explicit loopback CI connection required'],
  [{PGHOST:''}, 'Explicit loopback CI connection required'],
  [{PGPORT:'6543'}, 'Explicit loopback CI connection required'],
  [{PGUSER:'other'}, 'Explicit loopback CI connection required'],
  ...['PGHOSTADDR','PGSERVICE','PGSERVICEFILE','PGOPTIONS'].map(key => [{[key]:'override'}, 'Connection overrides are forbidden'])
];
for (const [overrides, expected] of cases) {
  const run = spawnSync(bash, [script], {env:{...base,...overrides},encoding:'utf8'});
  assert.ifError(run.error);
  assert.equal(run.status, 1, run.stderr);
  assert.equal(run.stdout.trim(), expected);
}
console.log(`PASS: ${cases.length} unsafe target configurations rejected before database commands.`);
