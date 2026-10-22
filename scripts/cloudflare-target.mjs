import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [command, ...args] = process.argv.slice(2);
// Validate before loading dependencies or building; no argument may override dry-run.
if (command === "validate" && args.length > 0) {
  console.error("The validate command does not accept additional arguments.");
  process.exit(2);
}
const require = createRequire(import.meta.url);
const viteBin = resolve(dirname(require.resolve("vite/package.json")), "bin/vite.js");
const wranglerBin = resolve(
  dirname(require.resolve("wrangler/package.json")),
  "bin/wrangler.js",
);
const targetEnv = { ...process.env, CLOUDFLARE_BUILD: "1" };

function run(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env: targetEnv,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(result.error);
    process.exitCode = 1;
    return false;
  }

  if (result.signal) {
    console.error(`Command terminated by signal ${result.signal}`);
    process.exitCode = 1;
    return false;
  }

  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    return false;
  }

  return true;
}

if (["dev", "build", "preview"].includes(command)) {
  run([viteBin, command, ...args]);
} else if (command === "validate") {
  if (run([viteBin, "build"])) {
    // Keep validation arguments fixed so callers cannot change targets or disable dry-run.
    run([wranglerBin, "deploy", "--dry-run"]);
  }
} else {
  console.error(
    "Usage: node scripts/cloudflare-target.mjs <dev|build|preview|validate>",
  );
  process.exitCode = 2;
}
