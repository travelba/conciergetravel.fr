/**
 * Inspect the top 30 Yonder Tier 1 hotels to verify brief-builder
 * prerequisites: wikidata_id, lat/lng, OSM POIs done, official_url.
 */
import { config as loadDotenv } from 'dotenv';
import { Client } from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadDotenv({ path: path.resolve(__dirname, '../../.env.local') });

const TIER1 = [
  'hotel-du-rond-point-des-champs-elysees',
  'too-hotel',
  'le-cinq-codet',
  'monsieur-aristide',
  'hotel-de-sers',
  'les-bords-de-mer',
  'brach-paris',
  'baumaniere',
  'les-roches-rouges',
  'so-paris',
  'le-chambard',
  'chateau-de-theoule',
  'villa-marie',
  'pullman-paris-centre-bercy',
  'la-fondation',
  'lily-of-the-valley',
  'hotel-parc-saint-severin',
  'hotel-mansart',
  'hotel-particulier-montmartre',
  'hotel-la-bourdonnais',
  'le-barn',
  'chateau-lafaurie-peyraguey',
  'les-hortensias-du-lac',
  'hotel-vernet',
  'chateau-de-fonscolombe',
  'hotel-spa-du-castellet',
  'hotel-juana',
  'hotel-barriere-l-hermitage-la-baule',
  'hotel-barriere-le-royal-deauville',
  'u-capu-biancu',
];

const conn = (process.env['SUPABASE_DB_POOLER_URL'] ?? process.env['SUPABASE_DB_URL'] ?? '').replace(/[?&]sslmode=[^&]*/gi, '');
const c = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await c.connect();

const r = await c.query(
  `select slug, name, city, country_code, latitude, longitude, wikidata_id, official_url,
          phone_e164, postal_code, is_published, priority,
          coalesce(jsonb_array_length(faq_content), 0) as faq_n,
          coalesce(jsonb_array_length(long_description_sections), 0) as sections_n,
          coalesce(length(description_fr), 0) as desc_fr_len,
          0 as pois_n
   from public.hotels h
   where slug = any($1::text[])
   order by array_position($1::text[], slug)`,
  [TIER1],
);

console.log(`${TIER1.length} Tier 1 slugs requested, ${r.rows.length} found in DB.\n`);
console.log('Slug                                          | City               | Wikidata | LatLng | URL  | Phone | POIs | Sections | FAQ | DescFR');
console.log('-'.repeat(150));
let okForBrief = 0;
let needsManual = 0;
const missing = [];
for (const slug of TIER1) {
  const row = r.rows.find((x) => x.slug === slug);
  if (!row) {
    missing.push(slug);
    continue;
  }
  const wd = row.wikidata_id ? '✓' : '✗';
  const ll = row.latitude && row.longitude ? '✓' : '✗';
  const url = row.official_url ? '✓' : '✗';
  const ph = row.phone_e164 ? '✓' : '✗';
  const slugP = String(row.slug).padEnd(45);
  const city = String(row.city ?? '-').padEnd(18);
  const pois = String(row.pois_n).padStart(4);
  const secs = String(row.sections_n).padStart(2);
  const faq = String(row.faq_n).padStart(3);
  const desc = String(row.desc_fr_len).padStart(5);
  console.log(`${slugP} | ${city} | ${wd}        | ${ll}      | ${url}    | ${ph}     | ${pois} | ${secs}       | ${faq} | ${desc}`);
  if (row.wikidata_id && row.latitude && row.longitude) okForBrief++;
  else needsManual++;
}

if (missing.length > 0) {
  console.log(`\nMissing from DB (${missing.length}):`);
  for (const m of missing) console.log(`  - ${m}`);
}

console.log(`\n=== Brief-builder readiness ===`);
console.log(`  Has wikidata_id + lat/lng (auto-brief OK)  : ${okForBrief}`);
console.log(`  Missing wikidata or coords (manual needed) : ${needsManual}`);
console.log(`  Not found in DB                            : ${missing.length}`);

await c.end();
