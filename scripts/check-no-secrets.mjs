#!/usr/bin/env node
/**
 * Fail-closed secret scan for built artifacts.
 *
 * Usage:
 *   node scripts/check-no-secrets.mjs [target] [--strict]
 *
 * `target` defaults to `dist`. Both the Cloudflare build (`dist/client`,
 * `dist/server`) and the Nitro build (`.output/public`, `.output/server`) are
 * supported: files under a `client/` or `public/` segment are treated as
 * browser-shipped and get the client-boundary rules.
 *
 * Severity:
 *   error — a secret value, a .env file, or a service-role-signed JWT in the
 *           build output. Always fails.
 *   warn  — a service-role *identifier* in browser-shipped code. Not a secret
 *           value; it signals that a server-only module leaked into the client
 *           graph. Reported, but only fails with `--strict`.
 *
 * Exit codes: 0 = no errors (or no errors and warnings without --strict),
 *             1 = error/violation or unusable target.
 * No dependencies, no network, no writes.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join, relative, sep } from "node:path";

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const target = args.find((arg) => !arg.startsWith("-")) ?? "dist";
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_HITS_PER_RULE = 5;
const TEXT_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".css",
  ".html",
  ".txt",
  ".map",
  ".webmanifest",
  ".svg",
  ".xml",
]);

if (!existsSync(target)) {
  console.error(`check-no-secrets: target not found: ${target}`);
  console.error("Build first (bun run build:cloudflare or bun run build) or pass an existing directory.");
  process.exit(1);
}

const files = [];
const errors = [];
const warnings = [];
let skippedBinary = 0;
let skippedLarge = 0;
let skippedExtension = 0;

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      walk(full);
      continue;
    }
    if (!stat.isFile()) continue;
    files.push({ path: full, size: stat.size });
  }
}

function relPath(full) {
  return relative(target, full).split(sep).join("/");
}

function isClientBundle(rel) {
  // `dist/client/**` (Cloudflare) and `.output/public/**` (Nitro) are shipped
  // to browsers. Server bundles legitimately reference secret env var names.
  return /(^|\/)(client|public)(\/|$)/.test(rel);
}

function lineNumber(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function redact(value) {
  const trimmed = value.replace(/\s+/g, " ").slice(0, 120);
  if (trimmed.length <= 8) return "***";
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-2)} (${trimmed.length} chars)`;
}

function report(rel, rule, line, match, severity) {
  const entry = { path: rel, rule, line, preview: redact(match) };
  if (severity === "warn") warnings.push(entry);
  else errors.push(entry);
}

function decodeJwtRole(token) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = Buffer.from(normalized, "base64").toString("utf8");
    const claims = JSON.parse(decoded);
    return typeof claims.role === "string" ? claims.role : null;
  } catch {
    return null;
  }
}

const RULES = [
  {
    id: "env-file-in-output",
    severity: "error",
    matches(rel) {
      const name = basename(rel);
      return /^\.env(\..+)?$/.test(name) && !name.endsWith(".example");
    },
  },
  {
    id: "private-key",
    severity: "error",
    re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g,
  },
  {
    id: "openai-or-stripe-key",
    severity: "error",
    re: /\b(?:sk|rk)[-_](?:(?:live|test|proj)[-_])?[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    id: "supabase-secret-key",
    severity: "error",
    re: /\bsb_secret_[A-Za-z0-9_-]{10,}\b/g,
  },
  {
    id: "supabase-personal-token",
    severity: "error",
    re: /\bsbp_[A-Za-z0-9]{20,}\b/g,
  },
  {
    id: "google-api-key",
    severity: "error",
    re: /\bAIza[0-9A-Za-z_-]{35}\b/g,
  },
  {
    id: "github-token",
    severity: "error",
    re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g,
  },
  {
    id: "slack-token",
    severity: "error",
    re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g,
  },
  {
    id: "aws-access-key",
    severity: "error",
    re: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    id: "database-url-with-password",
    severity: "error",
    re: /\bpostgres(?:ql)?:\/\/[^:\s/"']+:[^@\s/"']+@/g,
  },
  {
    id: "jwt-signed-for-service-role",
    severity: "error",
    scan(text, rel, add) {
      const re = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
      let match;
      while ((match = re.exec(text)) !== null) {
        if (decodeJwtRole(match[0]) === "service_role") {
          add("jwt-signed-for-service-role", lineNumber(text, match.index), match[0]);
        }
      }
    },
  },
  {
    id: "service-role-identifier-in-client",
    severity: "warn",
    clientOnly: true,
    re: /\bSUPABASE_SERVICE_ROLE_KEY\b|\bservice_role\b/g,
  },
];

console.log(`check-no-secrets: scanning ${target}`);
walk(target);

let scanned = 0;
for (const { path: full, size } of files) {
  const rel = relPath(full);

  for (const rule of RULES) {
    if (rule.matches && rule.matches(rel)) {
      report(rel, rule.id, 0, rel, rule.severity);
    }
  }

  if (size > MAX_FILE_BYTES) {
    skippedLarge += 1;
    continue;
  }
  if (!TEXT_EXTENSIONS.has(extname(full).toLowerCase())) {
    skippedExtension += 1;
    continue;
  }

  let buffer;
  try {
    buffer = readFileSync(full);
  } catch {
    continue;
  }
  if (buffer.subarray(0, 4096).includes(0)) {
    skippedBinary += 1;
    continue;
  }

  scanned += 1;
  const text = buffer.toString("utf8");
  const perRule = new Map();

  for (const rule of RULES) {
    const remaining = () =>
      MAX_HITS_PER_RULE - (perRule.get(rule.id) ?? 0);
    const add = (ruleId, line, match) => {
      if (remaining() <= 0) return;
      perRule.set(ruleId, (perRule.get(ruleId) ?? 0) + 1);
      report(rel, ruleId, line, match, rule.severity);
    };

    if (rule.scan) {
      rule.scan(text, rel, add);
      continue;
    }
    if (!rule.re || (rule.clientOnly && !isClientBundle(rel))) continue;

    const re = new RegExp(rule.re.source, rule.re.flags.includes("g") ? rule.re.flags : `${rule.re.flags}g`);
    let match;
    while ((match = re.exec(text)) !== null) {
      add(rule.id, lineNumber(text, match.index), match[0]);
      if (match[0].length === 0) re.lastIndex += 1;
    }
  }
}

console.log(
  `check-no-secrets: ${scanned} text file(s) scanned, ` +
    `${skippedBinary} binary skipped, ${skippedLarge} oversized skipped, ` +
    `${skippedExtension} non-text skipped`,
);

if (warnings.length > 0) {
  const heading = strict ? "warnings promoted to errors (--strict)" : "warnings";
  console.warn(`check-no-secrets: ${warnings.length} ${heading}`);
  for (const w of warnings) {
    console.warn(`  ${w.path}:${w.line} [${w.rule}] ${w.preview}`);
  }
}

if (errors.length > 0 || (strict && warnings.length > 0)) {
  if (errors.length > 0) {
    console.error(`check-no-secrets: ${errors.length} error(s) found`);
    for (const e of errors) {
      console.error(`  ${e.path}:${e.line} [${e.rule}] ${e.preview}`);
    }
  }
  process.exit(1);
}

console.log("check-no-secrets: no secrets detected");
