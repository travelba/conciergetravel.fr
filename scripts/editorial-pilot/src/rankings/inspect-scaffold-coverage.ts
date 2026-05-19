/**
 * inspect-scaffold-coverage.ts — verify that the 64 Yonder scaffold
 * slugs all appear in the extended matrix (A2 / May 19, 2026).
 *
 * Run: pnpm --filter @mch/editorial-pilot exec tsx \
 *        src/rankings/inspect-scaffold-coverage.ts
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadRankingsV2 } from './rankings-catalog-v2.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCAFFOLD_PATH = path.resolve(__dirname, '../../data/yonder-scaffold-classified.json');

interface ScaffoldEntry {
  readonly slug: string;
  readonly titleFr: string;
  readonly axes: {
    readonly lieu: { readonly slug: string };
    readonly types: readonly string[];
    readonly themes: readonly string[];
    readonly occasions: readonly string[];
  };
}

async function main(): Promise<void> {
  const raw = await readFile(SCAFFOLD_PATH, 'utf-8');
  const file = JSON.parse(raw) as { entries: readonly ScaffoldEntry[] };
  const scaffoldSlugs = file.entries.map((e) => e.slug);

  const { matrix } = await loadRankingsV2({ skipUnderfilled: false });
  const matrixSlugs = new Set(matrix.seeds.map((s) => s.slug));

  const present: string[] = [];
  const missing: string[] = [];
  for (const slug of scaffoldSlugs) {
    if (matrixSlugs.has(slug)) present.push(slug);
    else missing.push(slug);
  }

  console.log(`━━━ A2 scaffold coverage ━━━`);
  console.log(`  Scaffold slugs : ${scaffoldSlugs.length}`);
  console.log(`  Present in matrix : ${present.length}`);
  console.log(`  Missing from matrix : ${missing.length}`);
  console.log('');

  if (missing.length > 0) {
    console.log('━━━ Missing slugs ━━━');
    for (const m of missing) console.log(`  ✗ ${m}`);
    console.log('');
  }

  // Print eligibility distribution for the scaffold slugs that ARE in
  // the matrix — this tells us how many will be generable now vs. need
  // more hotels published first.
  const eligibility = new Map<string, number>();
  for (const s of matrix.seeds) {
    if (scaffoldSlugs.includes(s.slug)) eligibility.set(s.slug, s.eligibleCount);
  }
  const byBucket: Record<string, number> = {
    '0 (drop)': 0,
    '1-2 (under)': 0,
    '3-4 (min)': 0,
    '5-9 (good)': 0,
    '10+ (great)': 0,
  };
  for (const [, count] of eligibility) {
    if (count === 0) byBucket['0 (drop)']! += 1;
    else if (count < 3) byBucket['1-2 (under)']! += 1;
    else if (count < 5) byBucket['3-4 (min)']! += 1;
    else if (count < 10) byBucket['5-9 (good)']! += 1;
    else byBucket['10+ (great)']! += 1;
  }
  console.log('━━━ Eligibility distribution (scaffold slugs only) ━━━');
  for (const [k, v] of Object.entries(byBucket)) {
    console.log(`  ${k.padEnd(15)} ${v}`);
  }
  console.log('');

  console.log('━━━ Per-slug eligibility ━━━');
  const sorted = [...eligibility.entries()].sort((a, b) => b[1] - a[1]);
  for (const [slug, count] of sorted) {
    const flag = count === 0 ? '✗' : count < 3 ? '⚠' : '✓';
    console.log(`  ${flag} ${slug.padEnd(50)} ${count}`);
  }
}

main().catch((err) => {
  console.error('[inspect-scaffold-coverage] FAILED:', err);
  process.exit(1);
});
