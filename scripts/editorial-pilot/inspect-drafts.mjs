/**
 * List all draft hotels with their enrichment status, sorted by
 * brief-readiness (wikidata_id + lat/lng + official_url first).
 */
import { config as loadDotenv } from 'dotenv';
import { Client } from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadDotenv({ path: path.resolve(__dirname, '../../.env.local') });

const conn = (process.env['SUPABASE_DB_POOLER_URL'] ?? process.env['SUPABASE_DB_URL'] ?? '').replace(/[?&]sslmode=[^&]*/gi, '');
const c = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await c.connect();

const r = await c.query(`
  select slug, name, city, country_code, latitude, longitude, wikidata_id,
         official_url, phone_e164, is_palace, stars,
         coalesce(length(description_fr), 0) as desc_fr_len,
         coalesce(jsonb_array_length(faq_content), 0) as faq_n
  from public.hotels
  where is_published = false
  order by
    case when wikidata_id is not null then 0 else 1 end,
    case when latitude is not null then 0 else 1 end,
    case when official_url is not null then 0 else 1 end,
    is_palace desc nulls last,
    stars desc nulls last,
    slug
`);

console.log(`Total drafts in DB: ${r.rows.length}\n`);

let okBriefCount = 0;
console.log('Idx | Slug                                          | City                  | Palace | Stars | Wikidata | LatLng | URL  | Phone | DescFR');
console.log('-'.repeat(150));
for (let i = 0; i < r.rows.length; i++) {
  const row = r.rows[i];
  const wd = row.wikidata_id ? '✓' : '✗';
  const ll = row.latitude && row.longitude ? '✓' : '✗';
  const url = row.official_url ? '✓' : '✗';
  const ph = row.phone_e164 ? '✓' : '✗';
  const palace = row.is_palace ? '★' : '-';
  const stars = row.stars ? String(row.stars) : '-';
  if (row.wikidata_id && row.latitude && row.longitude) okBriefCount++;
  console.log(
    `${String(i + 1).padStart(3)} | ${String(row.slug).padEnd(45)} | ${String(row.city ?? '-').padEnd(21)} | ${palace}      | ${stars.padEnd(5)} | ${wd}        | ${ll}      | ${url}    | ${ph}     | ${String(row.desc_fr_len).padStart(5)}`,
  );
  if (i >= 50) {
    console.log(`  ... ${r.rows.length - i - 1} more drafts truncated`);
    break;
  }
}

console.log(`\n=== Brief-builder readiness ===`);
console.log(`  Total drafts                      : ${r.rows.length}`);
console.log(`  With wikidata + lat/lng (top tier): ${r.rows.filter((x) => x.wikidata_id && x.latitude && x.longitude).length}`);
console.log(`  Palace                            : ${r.rows.filter((x) => x.is_palace).length}`);
  console.log(`  5★                                : ${r.rows.filter((x) => x.stars === 5).length}`);

await c.end();
