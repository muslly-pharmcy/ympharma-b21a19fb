import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const isMain = (url) => Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(url);
export const within = (parent, child) => {
  const path = relative(parent, child);
  return path !== '..' && !path.startsWith('..' + sep) && !isAbsolute(path);
};

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', ...options, shell: false });
  if (result.error) console.error('Unable to start tool (' + (result.error.code ?? 'unknown error') + ').');
  if (result.signal) console.error('Tool terminated by ' + result.signal + '.');
  return result.error || result.signal ? 1 : (result.status ?? 1);
}

// Resolve only an already installed package; never download a tool through npx.
export function localCli(packageName, binName) {
  const packageRoot = resolve(root, 'node_modules', packageName);
  const pkg = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
  const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.[binName];
  if (!bin || !within(packageRoot, resolve(packageRoot, bin))) throw new Error('No local ' + binName + ' executable.');
  return resolve(packageRoot, bin);
}

export function runLocalCli(packageName, binName, args) {
  try {
    return run(process.execPath, [localCli(packageName, binName), ...args]);
  } catch {
    console.error('Install a reviewed version of ' + packageName + ' locally before using ' + binName + '. No installation was attempted.');
    return 2;
  }
}

// Check existing ancestors before creating output, including junctions on Windows.
export function artifactDirectory(value = 'artifacts', base = root) {
  const canonicalBase = realpathSync(base);
  const allowed = resolve(canonicalBase, 'artifacts');
  const output = resolve(canonicalBase, value);
  if (!within(allowed, output)) throw new Error('Output must stay inside artifacts/.');
  for (let cursor = output; cursor !== canonicalBase; cursor = dirname(cursor)) {
    if (existsSync(cursor) && !within(allowed, realpathSync(cursor))) throw new Error('Output link leaves artifacts/.');
  }
  mkdirSync(output, { recursive: true });
  return output;
}
