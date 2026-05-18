/**
 * Audit `hotels.upcoming_events` Concierge-voice coverage and quality
 * across the published catalog. Reports:
 *   - # hotels with ≥ 1 upcoming event, # with full Concierge coverage
 *   - upcoming-event count (excludes stale dates)
 *   - per-category breakdown (concert / exhibition / festival / sport / show / heritage)
 *   - sentence-length offenders (> 25 mots) — total + first 60
 *   - banned-phrase offenders (light heuristic — see linter for full
 *     set) — total + first 60
 *
 * Usage:
 *   node scripts/editorial-pilot/audit-concierge-events.mjs
 */
import pg from 'pg';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

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
  select slug, upcoming_events
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

const todayIso = new Date().toISOString().slice(0, 10);

const stats = {
  hotelsTotal: r.rows.length,
  hotelsWithEvents: 0,
  hotelsWithFullDesc: 0,
  eventsTotal: 0,
  eventsWithDescFr: 0,
  byCategory: {},
  descByCategory: {},
  longSentences: 0,
  bannedHits: 0,
};
const offenders = [];

for (const row of r.rows) {
  const events = Array.isArray(row.upcoming_events) ? row.upcoming_events : [];
  const upcoming = events.filter((e) => {
    const last = e?.end_date ?? e?.start_date;
    return typeof last === 'string' && last >= todayIso;
  });
  if (upcoming.length === 0) continue;
  stats.hotelsWithEvents++;
  let allHaveDesc = true;
  for (const e of upcoming) {
    stats.eventsTotal++;
    const cat = typeof e.category === 'string' ? e.category : 'other';
    stats.byCategory[cat] = (stats.byCategory[cat] ?? 0) + 1;
    const desc = typeof e.description_fr === 'string' ? e.description_fr.trim() : '';
    if (desc.length > 0) {
      stats.eventsWithDescFr++;
      stats.descByCategory[cat] = (stats.descByCategory[cat] ?? 0) + 1;
      const longs = splitSentences(desc).filter((s) => countWords(s) > 25);
      if (longs.length > 0) {
        stats.longSentences += longs.length;
        if (offenders.length < 80) {
          offenders.push(
            `${row.slug} :: ${e.name} (${cat}) :: sentence > 25 words: "${longs[0].slice(0, 100)}…"`,
          );
        }
      }
      for (const re of BANNED) {
        const matches = desc.match(new RegExp(re.source, re.flags));
        if (matches && matches.length > 0) {
          stats.bannedHits += matches.length;
          if (offenders.length < 80) {
            offenders.push(
              `${row.slug} :: ${e.name} (${cat}) :: banned "${matches[0]}" in "${desc.slice(0, 100)}…"`,
            );
          }
        }
      }
    } else {
      allHaveDesc = false;
    }
  }
  if (allHaveDesc) stats.hotelsWithFullDesc++;
}

console.log(`=== Concierge events audit (${stats.hotelsTotal} published hotels) ===`);
console.log(`  Hotels with ≥ 1 upcoming event : ${stats.hotelsWithEvents}`);
console.log(
  `  Hotels with full FR coverage   : ${stats.hotelsWithFullDesc} / ${stats.hotelsWithEvents}`,
);
console.log(`  Events total (non-stale)       : ${stats.eventsTotal}`);
console.log(
  `  Events with description_fr     : ${stats.eventsWithDescFr} / ${stats.eventsTotal} (${
    stats.eventsTotal === 0
      ? '0'
      : ((stats.eventsWithDescFr * 100) / stats.eventsTotal).toFixed(1)
  }%)`,
);
console.log(`\n  Per-category coverage (desc / total):`);
for (const cat of Object.keys(stats.byCategory).sort()) {
  console.log(
    `    ${cat.padEnd(12)} : ${stats.descByCategory[cat] ?? 0} / ${stats.byCategory[cat]}`,
  );
}
console.log(`\n  Quality flags:`);
console.log(`    sentences > 25 words       : ${stats.longSentences}`);
console.log(`    banned-phrase occurrences  : ${stats.bannedHits}`);

if (offenders.length > 0) {
  console.log(`\n  ${offenders.length} offender(s) (showing first 60):`);
  for (const o of offenders.slice(0, 60)) console.log(`    - ${o}`);
}

await cli.end();
