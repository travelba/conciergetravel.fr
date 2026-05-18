/**
 * Audit `hotels.points_of_interest` Concierge-voice coverage and quality
 * across the published catalog. Reports:
 *   - # hotels with ≥ 1 POI, # hotels with full Concierge coverage
 *   - per-bucket coverage (visit / do / shop)
 *   - per-bucket tip coverage (`bucket_tip_fr` populated)
 *   - sentence-length offenders (> 25 mots) — total + first 30
 *   - banned-phrase offenders (light heuristic — see linter for full
 *     set) — total + first 30
 *
 * Usage:
 *   pnpm --filter @mch/editorial-pilot exec node ./audit-concierge-pois.mjs
 */
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// We allow being invoked from any directory: try repo-root .env.local first,
// then ../../.env.local (when executed from scripts/editorial-pilot/).
import { existsSync } from 'node:fs';
const envPath = [
  resolve(process.cwd(), '.env.local'),
  resolve(process.cwd(), '../../.env.local'),
  resolve(import.meta.dirname, '../../.env.local'),
].find((p) => existsSync(p));
if (!envPath) {
  console.error('audit: no .env.local found (looked in cwd, ../../, script dir)');
  process.exit(1);
}
const envText = readFileSync(envPath, 'utf8');
const env = {};
for (const raw of envText.split('\n')) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (!m) continue;
  let v = (m[2] ?? '').trim();
  const q = v.match(/^"([^"]*)"/) ?? v.match(/^'([^']*)'/);
  v = q ? (q[1] ?? '') : v.split(/\s+#/)[0]?.trim() ?? '';
  env[m[1] ?? ''] = v;
}
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const conn = (env.SUPABASE_DB_POOLER_URL ?? env.DATABASE_URL ?? '').replace(
  /\?sslmode=require/,
  '',
);
const cli = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await cli.connect();

const r = await cli.query(`
  select slug, points_of_interest
  from public.hotels
  where is_published = true
  order by slug
`);

function countWords(s) {
  if (typeof s !== 'string') return 0;
  const t = s.trim();
  if (!t.length) return 0;
  return t.split(/[^\p{L}\p{N}]+/u).filter((x) => x.length > 0).length;
}

function splitSentences(s) {
  if (typeof s !== 'string') return [];
  return s
    .replace(/\.\.\./g, '.')
    .split(/(?<=[.!?…])\s+/u)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

// Quick banned-phrase heuristic — full list lives in
// `scripts/editorial-pilot/src/linter.ts`. Kept short here so the audit
// stays dependency-free (no TS toolchain at runtime).
const BANNED = [
  /\bmagnifiques?\b/giu,
  /\bincontournables?\b/giu,
  /\bjoyaux?\b/giu,
  /\bécrins?\b/giu,
  /\bniché[se]?\b/giu,
  /\bbienvenue\b/iu,
  /\bdécouvrez\b/iu,
  /\bvues?\s+imprenables?\b/giu,
  /\bvues?\s+spectaculaires?\b/giu,
  /\bexpériences?\s+uniques?\b/giu,
];

const stats = {
  hotelsTotal: r.rows.length,
  hotelsWithPois: 0,
  hotelsWithFullDesc: 0,
  poisTotal: 0,
  poisWithDescFr: 0,
  poisByBucket: { visit: 0, do: 0, shop: 0 },
  descByBucket: { visit: 0, do: 0, shop: 0 },
  tipsByBucket: { visit: 0, do: 0, shop: 0 },
  longSentences: 0,
  bannedHits: 0,
};
const offenders = [];

for (const row of r.rows) {
  const pois = Array.isArray(row.points_of_interest) ? row.points_of_interest : [];
  if (pois.length === 0) continue;
  stats.hotelsWithPois++;
  let allHaveDesc = true;
  const seenBucketTip = { visit: false, do: false, shop: false };
  for (const p of pois) {
    stats.poisTotal++;
    const bucket = p.bucket && p.bucket in stats.poisByBucket ? p.bucket : null;
    if (bucket) stats.poisByBucket[bucket]++;
    const desc = typeof p.description_fr === 'string' ? p.description_fr.trim() : '';
    if (desc.length > 0) {
      stats.poisWithDescFr++;
      if (bucket) stats.descByBucket[bucket]++;
      const longs = splitSentences(desc).filter((s) => countWords(s) > 25);
      if (longs.length > 0) {
        stats.longSentences += longs.length;
        if (offenders.length < 60) {
          offenders.push(
            `${row.slug} :: ${p.name} (${bucket ?? '?'}) :: sentence > 25 words: "${longs[0].slice(0, 100)}…"`,
          );
        }
      }
      for (const re of BANNED) {
        const matches = desc.match(new RegExp(re.source, re.flags));
        if (matches && matches.length > 0) {
          stats.bannedHits += matches.length;
          if (offenders.length < 60) {
            offenders.push(
              `${row.slug} :: ${p.name} (${bucket ?? '?'}) :: banned "${matches[0]}" in "${desc.slice(0, 100)}…"`,
            );
          }
        }
      }
    } else {
      allHaveDesc = false;
    }
    const tip = typeof p.bucket_tip_fr === 'string' ? p.bucket_tip_fr.trim() : '';
    if (tip.length > 0 && bucket && !seenBucketTip[bucket]) {
      stats.tipsByBucket[bucket]++;
      seenBucketTip[bucket] = true;
    }
  }
  if (allHaveDesc) stats.hotelsWithFullDesc++;
}

console.log(`=== Concierge POIs audit (${stats.hotelsTotal} published hotels) ===`);
console.log(`  Hotels with ≥ 1 POI         : ${stats.hotelsWithPois}`);
console.log(
  `  Hotels with full FR coverage: ${stats.hotelsWithFullDesc} / ${stats.hotelsWithPois}`,
);
console.log(`  POIs total                  : ${stats.poisTotal}`);
console.log(
  `  POIs with description_fr    : ${stats.poisWithDescFr} / ${stats.poisTotal} (${
    stats.poisTotal === 0
      ? '0'
      : ((stats.poisWithDescFr * 100) / stats.poisTotal).toFixed(1)
  }%)`,
);
console.log(`\n  Per-bucket coverage (desc / total):`);
for (const b of ['visit', 'do', 'shop']) {
  console.log(`    ${b.padEnd(6)} : ${stats.descByBucket[b]} / ${stats.poisByBucket[b]}`);
}
console.log(`\n  Per-bucket tip coverage (hotels with bucket_tip_fr):`);
for (const b of ['visit', 'do', 'shop']) {
  console.log(
    `    ${b.padEnd(6)} : ${stats.tipsByBucket[b]} / ${stats.hotelsWithPois}`,
  );
}
console.log(`\n  Quality flags:`);
console.log(`    sentences > 25 words       : ${stats.longSentences}`);
console.log(`    banned-phrase occurrences  : ${stats.bannedHits}`);

if (offenders.length > 0) {
  console.log(`\n  ${offenders.length} offender(s) (showing first 30):`);
  for (const o of offenders.slice(0, 30)) console.log(`    - ${o}`);
}

await cli.end();
