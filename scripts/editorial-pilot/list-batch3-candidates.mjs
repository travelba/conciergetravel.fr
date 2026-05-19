/**
 * Phase C batch 3 — relaxed candidate detection.
 *
 * Batch 1 + 2 used strict criteria (wikidata_id + lat/lng + official_url).
 * Batch 3 drops the `official_url` requirement since many top-tier 4★+ and
 * Palace hotels in our Yonder catalog lack that field — they can still be
 * enriched via Wikidata + Wikipedia + Tavily without an official site.
 *
 * Filters still applied:
 * - is_published = false (we never touch published)
 * - wikidata_id is not null (anchor for fact-check)
 * - lat/lng is not null (POI / events / hreflang)
 * - stars ≥ 4 or is_palace = true (worth the LLM spend)
 *
 * Dedup, on the other hand, is STRICT:
 * - Skip slugs already pushed (long_description_sections populated)
 * - Skip slugs whose Wikidata Q-id matches a published hotel
 * - Skip slugs whose Q-id matches another batch-1/2/3 draft already counted
 * - Skip name-sig collisions vs published hotels
 * - Skip slugs that already have 08-concierge-voice.md on disk
 */
import pg from 'pg';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(resolve(__dirname, '../../.env.local'), 'utf8');
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
const conn = (env.SUPABASE_DB_POOLER_URL ?? '').replace(/[?&]sslmode=[^&]*/giu, '');
const cli = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await cli.connect();

const pushed = await cli.query(`
  select slug, wikidata_id from public.hotels
   where is_published = false
     and long_description_sections is not null
     and jsonb_array_length(long_description_sections) >= 5
`);
const alreadyPushed = new Set(pushed.rows.map((r) => r.slug));
const alreadyPushedWd = new Map();
for (const r of pushed.rows) {
  if (r.wikidata_id) alreadyPushedWd.set(r.wikidata_id, r.slug);
}

const outputDir = resolve(__dirname, 'output');
const onDisk = new Set();
if (existsSync(outputDir)) {
  for (const d of readdirSync(outputDir)) {
    if (existsSync(join(outputDir, d, '08-concierge-voice.md'))) onDisk.add(d);
  }
}

const published = await cli.query(`
  select slug, wikidata_id, name
    from public.hotels
   where is_published = true
`);
const publishedWdById = new Map();
const publishedByName = new Map();
for (const r of published.rows) {
  if (r.wikidata_id) publishedWdById.set(r.wikidata_id, r.slug);
  publishedByName.set(r.name.toLowerCase().replace(/[^a-z0-9]+/gu, ''), r.slug);
}

// Relaxed: drop `official_url is not null`. Restrict to top-tier 4★+ or palace.
const r = await cli.query(`
  select slug, name, city, region, country_code, wikidata_id,
         latitude, longitude, official_url, is_palace, stars,
         address, postal_code
    from public.hotels
   where is_published = false
     and wikidata_id is not null
     and latitude is not null and longitude is not null
     and (is_palace = true or stars >= 4)
   order by is_palace desc, stars desc, name asc
`);

const skipped = {
  alreadyPushed: [],
  onDisk: [],
  wikidataDupe: [],
  nameDupe: [],
  intraBatch: [],
  batch1or2Dupe: [],
};
const candidates = [];
const seenWd = new Set();
const seenNameSig = new Set();
for (const row of r.rows) {
  if (alreadyPushed.has(row.slug)) {
    skipped.alreadyPushed.push(row.slug);
    continue;
  }
  if (onDisk.has(row.slug)) {
    skipped.onDisk.push(row.slug);
    continue;
  }
  if (row.wikidata_id && alreadyPushedWd.has(row.wikidata_id)) {
    skipped.batch1or2Dupe.push(`${row.slug} ~ ${alreadyPushedWd.get(row.wikidata_id)} (batch 1/2)`);
    continue;
  }
  if (row.wikidata_id && publishedWdById.has(row.wikidata_id)) {
    skipped.wikidataDupe.push(`${row.slug} ~ ${publishedWdById.get(row.wikidata_id)}`);
    continue;
  }
  const nameSig = row.name.toLowerCase().replace(/[^a-z0-9]+/gu, '');
  if (publishedByName.has(nameSig)) {
    skipped.nameDupe.push(`${row.slug} ~ ${publishedByName.get(nameSig)}`);
    continue;
  }
  if (row.wikidata_id && seenWd.has(row.wikidata_id)) {
    skipped.intraBatch.push(`${row.slug} (wd ${row.wikidata_id} already)`);
    continue;
  }
  if (seenNameSig.has(nameSig)) {
    skipped.intraBatch.push(`${row.slug} (name "${row.name}" already)`);
    continue;
  }
  if (row.wikidata_id) seenWd.add(row.wikidata_id);
  seenNameSig.add(nameSig);
  candidates.push(row);
}

// Sort candidates by region for visibility (sud-ouest / IdF hors Paris focus)
candidates.sort((a, b) => (a.region ?? '').localeCompare(b.region ?? ''));

// eslint-disable-next-line no-console
console.log('=== Phase C batch 3 candidates (relaxed: no official_url required) ===\n');
let lastRegion = null;
for (const c of candidates) {
  if (c.region !== lastRegion) {
    // eslint-disable-next-line no-console
    console.log(`\n[${c.region ?? '?'}]`);
    lastRegion = c.region;
  }
  const flag = c.is_palace ? '★P' : `${c.stars}★`;
  const url = c.official_url ? '+url' : '   ';
  // eslint-disable-next-line no-console
  console.log(
    `  ${c.slug.padEnd(40)} ${flag.padEnd(3)} ${url} ${(c.city ?? '-').padEnd(20)} ${c.wikidata_id}`,
  );
}
// eslint-disable-next-line no-console
console.log(`\n--- Total candidates: ${candidates.length}`);
// eslint-disable-next-line no-console
console.log(
  `--- Skipped: ${skipped.alreadyPushed.length} already-pushed | ${skipped.onDisk.length} on-disk | ${skipped.batch1or2Dupe.length} batch1/2-wd-dupe | ${skipped.wikidataDupe.length} wd-dupe (vs published) | ${skipped.nameDupe.length} name-dupe | ${skipped.intraBatch.length} intra-batch`,
);
if (skipped.batch1or2Dupe.length > 0) {
  // eslint-disable-next-line no-console
  console.log('  Batch1/2 dupes:', skipped.batch1or2Dupe);
}
if (skipped.wikidataDupe.length > 0) {
  // eslint-disable-next-line no-console
  console.log('  WD dupes (vs published):', skipped.wikidataDupe.slice(0, 15));
}

// eslint-disable-next-line no-console
console.log('\n--- Slugs (comma-separated) ---');
// eslint-disable-next-line no-console
console.log(candidates.map((c) => c.slug).join(','));

await cli.end();
