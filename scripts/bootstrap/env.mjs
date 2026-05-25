#!/usr/bin/env node
/**
 * Bootstrap environment variables for local development.
 *
 * Source of truth: Vercel project "myconciergehotel-com" (team: travelba).
 * Local copy: `.env.local` (root, for scripts) + `apps/web/.env.local`
 * (for `next dev`, because Next.js auto-loads from its own cwd only).
 *
 * Flow:
 *   1. Verify Vercel CLI installed + project linked
 *   2. Pull development env vars to root `.env.local`
 *   3. Mirror to `apps/web/.env.local`
 *   4. Cross-check against `.env.example` → report missing keys
 *
 * Both `.env.local` files are gitignored via `*.local` in `.gitignore`.
 *
 * Usage:
 *   pnpm bootstrap:env                        # default: development env
 *   pnpm bootstrap:env --env=preview          # pull preview env
 *   pnpm bootstrap:env --env=production       # pull production env (handle with care)
 *   pnpm bootstrap:env --no-mirror            # do NOT copy to apps/web/.env.local
 *   pnpm bootstrap:env --no-check             # skip the .env.example cross-check
 *
 * ADR: docs/adr/0012-env-vars-single-source-of-truth.md
 * Skill: windows-dev-environment (Rule 9 quater).
 */

import { execSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(__filename, '..', '..', '..');
const ROOT_ENV_LOCAL = join(REPO_ROOT, '.env.local');
const ROOT_ENV_EXAMPLE = join(REPO_ROOT, '.env.example');
const APPS_WEB_ENV_LOCAL = join(REPO_ROOT, 'apps', 'web', '.env.local');
const VERCEL_REPO_JSON = join(REPO_ROOT, '.vercel', 'repo.json');

/** Parse CLI args of the form --key or --key=value. */
function parseArgs(argv) {
  const out = { env: 'development', mirror: true, check: true };
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    const key = eq === -1 ? a.slice(2) : a.slice(2, eq);
    const val = eq === -1 ? true : a.slice(eq + 1);
    if (key === 'env' && typeof val === 'string') out.env = val;
    if (key === 'no-mirror') out.mirror = false;
    if (key === 'no-check') out.check = false;
  }
  return out;
}

function logStep(emoji, msg) {
  process.stdout.write(`${emoji}  ${msg}\n`);
}

function logSubstep(msg) {
  process.stdout.write(`   ${msg}\n`);
}

function fail(msg, code = 1) {
  process.stderr.write(`\n❌  ${msg}\n`);
  process.exit(code);
}

/** Step 1 — verify the Vercel CLI is on PATH. */
function ensureVercelCli() {
  try {
    const v = execSync('vercel --version', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    logSubstep(`Vercel CLI ${v}`);
  } catch {
    fail(
      'Vercel CLI is not installed.\n' +
        '   Install: `pnpm add -g vercel` (or `npm i -g vercel`).\n' +
        '   Then re-run `pnpm bootstrap:env`.',
    );
  }
}

/** Step 2 — verify the repo is linked to a Vercel project. */
function ensureVercelLink() {
  if (!existsSync(VERCEL_REPO_JSON)) {
    fail(
      '.vercel/repo.json is missing. The repo is not linked to a Vercel project.\n' +
        '   Run: `vercel link --yes --project=myconciergehotel-com --scope=travelba`\n' +
        '   Then re-run `pnpm bootstrap:env`.',
    );
  }
  /** @type {{ projects: Array<{ name: string; directory?: string }> }} */
  const data = JSON.parse(readFileSync(VERCEL_REPO_JSON, 'utf8'));
  const projects = data.projects ?? [];
  if (projects.length === 0) {
    fail('.vercel/repo.json is malformed (no projects).');
  }
  logSubstep(`Linked to Vercel project: ${projects.map((p) => p.name).join(', ')}`);
}

/**
 * Step 3 — pull env from Vercel and **merge** into `.env.local`.
 *
 * Critical: must NEVER lose keys that are local-only (e.g. OPENAI_API_KEY,
 * ANTHROPIC_API_KEY, TAVILY_API_KEY). Strategy:
 *   1. Snapshot the existing `.env.local` content (if any).
 *   2. Ask Vercel CLI to write to a temp file (not `.env.local` directly).
 *   3. Merge: keys from Vercel take priority, local-only keys are preserved.
 *   4. Write the merged result back to `.env.local`.
 */
function pullVercelEnv(envName) {
  const tmpPath = join(REPO_ROOT, '.env.local.vercel-pull');
  const localBefore = parseEnvFile(ROOT_ENV_LOCAL);
  const localKeysBefore = Object.keys(localBefore);

  logSubstep(`Pulling ${envName} env vars to temp file…`);
  const res = spawnSync(
    'vercel',
    ['env', 'pull', '.env.local.vercel-pull', `--environment=${envName}`, '--yes'],
    {
      cwd: REPO_ROOT,
      shell: true,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  if (res.status !== 0) {
    process.stderr.write(res.stderr ?? '');
    fail(`vercel env pull failed (exit ${res.status}).`);
  }
  if (!existsSync(tmpPath)) {
    fail('vercel env pull succeeded but did not write the temp file.');
  }

  const vercel = parseEnvFile(tmpPath);
  const vercelKeysCount = Object.keys(vercel).length;

  // Merge — Vercel wins on conflict (Vercel = source of truth for managed
  // secrets), but local-only keys (OPENAI_API_KEY, TAVILY_API_KEY, …) are
  // preserved verbatim.
  const merged = { ...localBefore };
  for (const [k, v] of Object.entries(vercel)) {
    merged[k] = v;
  }
  const preserved = localKeysBefore.filter((k) => !(k in vercel));

  // Render with a clear header and preserved-keys section at the bottom.
  const lines = [
    '# Created by `pnpm bootstrap:env`',
    `# Source: Vercel project "myconciergehotel-com" (env=${envName}) merged with local-only keys.`,
    '# DO NOT EDIT this header — re-run `pnpm bootstrap:env` after changing Vercel.',
    '# To add a local-only key (e.g. LLM API key): append it BELOW the "# --- local-only" marker.',
    '',
    '# --- managed by Vercel (refreshed by bootstrap:env) -------------------------',
  ];
  for (const k of Object.keys(vercel).sort()) {
    lines.push(`${k}="${escapeEnvValue(vercel[k])}"`);
  }
  lines.push('');
  lines.push('# --- local-only (preserved across bootstrap:env runs) -----------------------');
  for (const k of preserved.sort()) {
    lines.push(`${k}="${escapeEnvValue(merged[k])}"`);
  }
  lines.push('');
  writeFileSync(ROOT_ENV_LOCAL, lines.join('\n'), 'utf8');

  // Remove the temp file (no need to keep it around).
  try {
    renameSync(tmpPath, tmpPath + '.bak');
    // .bak is gitignored via *.local — keep one for forensics, the next
    // bootstrap will overwrite it.
  } catch {
    // Best-effort cleanup; ignore.
  }

  logSubstep(`Wrote ${ROOT_ENV_LOCAL} (Vercel: ${vercelKeysCount} keys, preserved local: ${preserved.length} keys)`);
}

/** Escape a value for safe `.env` writing — preserve newlines as `\n` literals. */
function escapeEnvValue(v) {
  return String(v ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

/** Step 4 — mirror root .env.local → apps/web/.env.local. */
function mirrorToWebApp() {
  if (!existsSync(ROOT_ENV_LOCAL)) {
    fail('.env.local was not created by `vercel env pull`. Cannot mirror.');
  }
  copyFileSync(ROOT_ENV_LOCAL, APPS_WEB_ENV_LOCAL);
  logSubstep(`Mirrored to ${join('apps', 'web', '.env.local')}`);
}

/** Parse a .env-style file into { KEY: value } (value may be empty). */
function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  /** @type {Record<string, string>} */
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const rawValue = trimmed.slice(eq + 1).trim();
    const value = rawValue.startsWith('"') && rawValue.endsWith('"') ? rawValue.slice(1, -1) : rawValue;
    out[key] = value;
  }
  return out;
}

/**
 * Step 5 — cross-check .env.local against .env.example.
 * Reports keys present in example but missing or empty in local, broken
 * down by category (Supabase, Amadeus, …) when the example uses ASCII headers.
 */
function crossCheck() {
  if (!existsSync(ROOT_ENV_EXAMPLE)) {
    logSubstep('.env.example missing — skipping cross-check');
    return { missing: [], empty: [] };
  }
  const example = parseEnvFile(ROOT_ENV_EXAMPLE);
  const local = parseEnvFile(ROOT_ENV_LOCAL);
  const missing = [];
  const empty = [];
  for (const key of Object.keys(example)) {
    if (!(key in local)) {
      missing.push(key);
    } else if (local[key] === '') {
      empty.push(key);
    }
  }
  return { missing, empty };
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  logStep('🔧', `Bootstrap env (target = ${args.env})`);

  logStep('1/4', 'Checking Vercel CLI…');
  ensureVercelCli();

  logStep('2/4', 'Checking Vercel link…');
  ensureVercelLink();

  logStep('3/4', `Pulling ${args.env} env vars from Vercel…`);
  pullVercelEnv(args.env);

  if (args.mirror) {
    logStep('4/4', 'Mirroring to apps/web/.env.local…');
    mirrorToWebApp();
  } else {
    logStep('4/4', 'Mirroring SKIPPED (--no-mirror)');
  }

  if (args.check) {
    process.stdout.write('\n');
    logStep('🔍', 'Cross-checking .env.local against .env.example…');
    const { missing, empty } = crossCheck();
    if (missing.length === 0 && empty.length === 0) {
      logSubstep('✅  All keys from .env.example are present and non-empty.');
    } else {
      if (missing.length > 0) {
        logSubstep(`⚠️   ${missing.length} key(s) MISSING from .env.local:`);
        for (const k of missing) logSubstep(`     - ${k}`);
      }
      if (empty.length > 0) {
        logSubstep(`⚠️   ${empty.length} key(s) PRESENT but EMPTY in .env.local:`);
        for (const k of empty) logSubstep(`     - ${k}`);
      }
      logSubstep('');
      logSubstep('Fix by adding the missing keys in Vercel and re-running `pnpm bootstrap:env`:');
      logSubstep('  https://vercel.com/travelba/myconciergehotel-com/settings/environment-variables');
      logSubstep('');
      logSubstep('Or, for keys not yet in Vercel (e.g. local-only LLM keys):');
      logSubstep('  echo \'OPENAI_API_KEY="sk-…"\' >> .env.local && pnpm bootstrap:env --no-check');
    }
  }

  process.stdout.write('\n✅  Done.\n');
}

main();
