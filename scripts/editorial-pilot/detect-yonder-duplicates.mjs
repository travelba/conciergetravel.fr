/**
 * Detect Yonder drafts that are duplicates of already-published hotels.
 * Heuristic: same name (normalised, no diacritics, lowercase) OR same
 * wikidata_id.
 */
import { config as loadDotenv } from 'dotenv';
import { Client } from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadDotenv({ path: path.resolve(__dirname, '../../.env.local') });

const TIER1_BUILT = [
  'bvlgari-hotel-paris', 'domaine-les-crayeres', 'four-seasons-georges-v',
  'hotel-barriere-le-majestic', 'hotel-barriere-le-normandy', 'hotel-de-crillon',
  'hotel-de-sers', 'hotel-du-palais', 'hotel-hermitage-monte-carlo',
  'hotel-martinez', 'hotel-royal', 'saint-james-paris',
  'abbaye-des-vaux-de-cernay', 'burgundy', 'bus-palladium',
  'castel-marie-louise', 'fouquet-s-paris', 'grand-hotel-du-palais-royal',
  'grand-hotel-la-cloche-dijon', 'hotel-barriere-le-fouquet-s-paris',
  'hotel-cap-estel', 'hotel-crillon-le-brave', 'hotel-fouquet-s-paris',
  'hotel-metropole-monte-carlo', 'hotel-molitor-paris-mgallery',
  'hotel-montalembert', 'hotel-raphael', 'hotel-saint-james-paris',
  'hotel-sax-paris',
];

function normaliseName(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[''`’]/gu, "'")
    .replace(/\s+/gu, ' ')
    .trim();
}

const conn = (process.env['SUPABASE_DB_POOLER_URL'] ?? process.env['SUPABASE_DB_URL'] ?? '').replace(/[?&]sslmode=[^&]*/gi, '');
const c = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await c.connect();

const drafts = await c.query(
  `select slug, name, city, wikidata_id, latitude, longitude
   from public.hotels
   where slug = any($1::text[])`,
  [TIER1_BUILT],
);

const published = await c.query(
  `select slug, name, city, wikidata_id, latitude, longitude
   from public.hotels
   where is_published = true`,
);

console.log(`Drafts checked: ${drafts.rows.length}`);
console.log(`Published candidates: ${published.rows.length}\n`);

const results = [];
for (const draft of drafts.rows) {
  const dNorm = normaliseName(draft.name);
  const matches = [];
  for (const pub of published.rows) {
    const pNorm = normaliseName(pub.name);
    // Exact name match
    if (dNorm === pNorm) {
      matches.push({ slug: pub.slug, reason: 'exact-name', name: pub.name });
      continue;
    }
    // Wikidata QID match
    if (draft.wikidata_id && pub.wikidata_id && draft.wikidata_id === pub.wikidata_id) {
      matches.push({ slug: pub.slug, reason: 'same-wikidata', name: pub.name });
      continue;
    }
    // GPS proximity (within 50m) when both have coords
    if (draft.latitude && pub.latitude && Math.abs(draft.latitude - pub.latitude) < 0.0005 && Math.abs(draft.longitude - pub.longitude) < 0.0005) {
      matches.push({ slug: pub.slug, reason: 'same-gps', name: pub.name });
      continue;
    }
    // Substring on long names
    if (dNorm.length > 8 && pNorm.length > 8 && (dNorm.includes(pNorm) || pNorm.includes(dNorm))) {
      matches.push({ slug: pub.slug, reason: 'substring', name: pub.name });
    }
  }
  results.push({ draft: draft.slug, draftName: draft.name, matches });
}

const dupes = results.filter((r) => r.matches.length > 0);
const uniques = results.filter((r) => r.matches.length === 0);

console.log(`=== ${dupes.length} drafts with possible duplicates ===`);
for (const r of dupes) {
  console.log(`\n  ${r.draft}  ("${r.draftName}")`);
  for (const m of r.matches.slice(0, 3)) {
    console.log(`    ⇄ ${m.slug.padEnd(40)} via ${m.reason}  ("${m.name}")`);
  }
}

console.log(`\n=== ${uniques.length} unique drafts (no dupe vs published) ===`);
for (const r of uniques) {
  console.log(`  ${r.draft}  ("${r.draftName}")`);
}

// Intra-draft duplicate detection (drafts that duplicate other drafts).
console.log('\n=== Intra-draft duplicates (Tier 1 only) ===');
const draftRows = drafts.rows;
const seenIntra = new Set();
for (let i = 0; i < draftRows.length; i++) {
  for (let j = i + 1; j < draftRows.length; j++) {
    const a = draftRows[i];
    const b = draftRows[j];
    const aN = normaliseName(a.name);
    const bN = normaliseName(b.name);
    const wikiMatch = a.wikidata_id && b.wikidata_id && a.wikidata_id === b.wikidata_id;
    const gpsMatch = a.latitude && b.latitude && Math.abs(a.latitude - b.latitude) < 0.0005 && Math.abs(a.longitude - b.longitude) < 0.0005;
    const substr = aN.length > 8 && bN.length > 8 && (aN.includes(bN) || bN.includes(aN));
    if (wikiMatch || gpsMatch || substr) {
      const reasons = [wikiMatch ? 'wikidata' : null, gpsMatch ? 'gps' : null, substr ? 'substring' : null].filter(Boolean).join('+');
      console.log(`  ${a.slug.padEnd(40)} ⇄ ${b.slug.padEnd(40)}  via ${reasons}`);
      seenIntra.add(a.slug);
      seenIntra.add(b.slug);
    }
  }
}

// Final clean list — drafts that are NEITHER published-dupes NOR intra-dupes.
const cleanSlugs = uniques
  .map((u) => u.draft)
  .filter((s) => !seenIntra.has(s));

console.log(`\n=== ${cleanSlugs.length} CLEAN drafts (safe to run 8-pass) ===`);
for (const s of cleanSlugs) console.log(`  ${s}`);

await c.end();
