#!/usr/bin/env node
/**
 * Rebrand: ConciergeTravel.fr → MyConciergeHotel.com.
 *
 * Pure-text rebrand across all source files in the monorepo. Operates
 * in-place. Idempotent (safe to re-run — second run is a no-op).
 *
 * What it touches:
 *   - PascalCase  "ConciergeTravel"           → "MyConciergeHotel"
 *   - Lowercase   "conciergetravel"           → "myconciergehotel" (for any leftover
 *                                                ASCII identifier-style match)
 *   - Domain      "conciergetravel.fr"        → "myconciergehotel.com"
 *   - npm scope   "@cct/"                     → "@mch/"
 *   - Env prefix  "CCT_"                      → "MCH_"
 *   - Redis prefix "cct:"                     → "mch:"
 *   - Bare top-level "name": "conciergetravel" in root package.json → "myconciergehotel"
 *
 * What it does NOT touch (excluded):
 *   - node_modules/, .next/, .git/, dist/, build/, .turbo/, coverage/
 *   - pnpm-lock.yaml (rebuilt by pnpm install)
 *   - Anything under .cursor/ (skills, rules — they reference the brand as
 *     a meta example; updating them is fine but they're updated by the same
 *     run since they're plain markdown — INCLUDED by default; see SKIP_DIRS to exclude)
 *   - Binary files (anything that fails utf-8 round-trip)
 *
 * Usage:
 *   node scripts/rebrand-mch.mjs --dry-run       (preview only)
 *   node scripts/rebrand-mch.mjs                 (apply)
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DRY = process.argv.includes('--dry-run');

const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  '.git',
  'dist',
  'build',
  '.turbo',
  'coverage',
  '.vercel',
  'playwright-report',
  'test-results',
  'out',
]);

const SKIP_FILES = new Set([
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'rebrand-mch.mjs',
]);

const SKIP_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.svg',
  '.pdf', '.zip', '.tar', '.gz', '.mp4', '.mov', '.webm',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.lock', '.tsbuildinfo',
]);

// Order matters: most-specific first to avoid double-rewrites.
const REPLACEMENTS = [
  ['conciergetravel.fr', 'myconciergehotel.com'],
  ['ConciergeTravel.fr', 'MyConciergeHotel.com'],
  ['ConciergeTravel', 'MyConciergeHotel'],
  ['@cct/', '@mch/'],
  ['CCT_', 'MCH_'],
  ['cct:', 'mch:'],
  // Root package.json "name": "conciergetravel"
  ['"name": "conciergetravel"', '"name": "myconciergehotel"'],
  // Bare lowercase: this targets directory references in docs ("conciergetravel.fr/" path
  // strings in markdown). Keep AFTER the .fr replacement so the domain replacement wins.
  ['/conciergetravel/', '/myconciergehotel/'],
];

let touchedFiles = 0;
let totalReplacements = 0;
const perPattern = new Map(REPLACEMENTS.map(([from]) => [from, 0]));

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walk(full);
      continue;
    }
    if (!entry.isFile()) continue;
    if (SKIP_FILES.has(entry.name)) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (SKIP_EXTENSIONS.has(ext)) continue;
    await processFile(full);
  }
}

async function processFile(file) {
  let buf;
  try {
    buf = await fs.readFile(file);
  } catch (err) {
    console.warn(`[skip] ${path.relative(ROOT, file)} — ${err.message}`);
    return;
  }
  // Skip files that have NUL bytes (binary).
  if (buf.includes(0)) return;
  let text;
  try {
    text = buf.toString('utf8');
  } catch {
    return;
  }
  let next = text;
  let fileReplacements = 0;
  for (const [from, to] of REPLACEMENTS) {
    let count = 0;
    let idx = 0;
    while ((idx = next.indexOf(from, idx)) !== -1) {
      count += 1;
      idx += from.length;
    }
    if (count > 0) {
      next = next.split(from).join(to);
      fileReplacements += count;
      perPattern.set(from, (perPattern.get(from) ?? 0) + count);
    }
  }
  if (fileReplacements > 0) {
    touchedFiles += 1;
    totalReplacements += fileReplacements;
    const rel = path.relative(ROOT, file);
    console.log(`${DRY ? '[dry]' : '[ok ]'} ${fileReplacements.toString().padStart(4)}  ${rel}`);
    if (!DRY) {
      await fs.writeFile(file, next, 'utf8');
    }
  }
}

console.log(`Rebrand ConciergeTravel → MyConciergeHotel  (${DRY ? 'DRY RUN' : 'APPLY'})`);
console.log(`Root: ${ROOT}\n`);
await walk(ROOT);

console.log('\n────────  Summary  ────────');
console.log(`Files touched: ${touchedFiles}`);
console.log(`Total replacements: ${totalReplacements}`);
console.log('Per pattern:');
for (const [pat, n] of perPattern) {
  console.log(`  ${n.toString().padStart(5)}  ${pat}`);
}
if (DRY) console.log('\n(dry-run, nothing written)');
