import pg from 'pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envText = readFileSync(resolve(process.cwd(), '../../.env.local'), 'utf8');
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
const conn = (env.SUPABASE_DB_POOLER_URL ?? '').replace(/\?sslmode=require/, '');
const cli = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await cli.connect();

const q = (sql) => cli.query(sql).then((r) => r.rows);

const hotelStats = await q(`
  select
    count(*) filter (where is_published)                                          as published,
    count(*) filter (where is_published and description_en is not null
                       and length(description_en) > 60)                            as has_desc_en,
    count(*) filter (where is_published and meta_title_en is not null)             as has_meta_title_en,
    count(*) filter (where is_published and jsonb_array_length(coalesce(faq_content,'[]'::jsonb)) >= 10) as faq_ge_10,
    count(*) filter (where is_published and jsonb_array_length(coalesce(signature_experiences,'[]'::jsonb)) >= 5) as sig_ge_5,
    count(*) filter (where is_published and signature_experiences is not null
                       and (signature_experiences -> 0 ->> 'description_en') is not null
                       and length(signature_experiences -> 0 ->> 'description_en') > 30) as sig_en,
    count(*) filter (where is_published and jsonb_array_length(coalesce(long_description_sections,'[]'::jsonb)) >= 4) as sections_ge_4,
    count(*) filter (where is_published and long_description_sections is not null
                       and (long_description_sections -> 0 ->> 'title_en') is not null) as sections_en,
    count(*) filter (where is_published and region <> 'France')                    as has_real_region,
    count(*) filter (where is_published and latitude is not null
                       and longitude is not null)                                  as has_geo,
    count(*) filter (where is_published and gallery_images is not null
                       and jsonb_array_length(gallery_images) >= 5)                as has_gallery
  from hotels
`);

const guideStats = await q(`
  select
    count(*) filter (where is_published)                                                       as published,
    count(*) filter (where is_published and summary_en is not null)                            as has_summary_en,
    count(*) filter (where is_published and jsonb_array_length(coalesce(sections,'[]'::jsonb)) >= 3) as has_sections_ge_3
  from editorial_guides
`);

const rankingStats = await q(`
  select
    count(*) filter (where is_published)                                                       as published,
    count(*) filter (where is_published and title_en is not null)                              as has_title_en,
    count(*) filter (where is_published and jsonb_array_length(coalesce(editorial_sections,'[]'::jsonb)) >= 3) as has_sections_ge_3
  from editorial_rankings
`);

const regionDist = await q(`
  select region, count(*) as n
  from hotels where is_published
  group by region
  order by n desc
  limit 12
`);

const h = hotelStats[0];
const g = guideStats[0];
const r = rankingStats[0];

console.log('\n==== HOTELS (CDC §2) ====');
console.log(`Published:                 ${h.published}`);
console.log(`description_en:           ${h.has_desc_en} / ${h.published}`);
console.log(`meta_title_en:            ${h.has_meta_title_en} / ${h.published}`);
console.log(`FAQ ≥ 10:                  ${h.faq_ge_10} / ${h.published}`);
console.log(`signature_experiences ≥5: ${h.sig_ge_5} / ${h.published}  (with EN: ${h.sig_en})`);
console.log(`long_description_sections≥4: ${h.sections_ge_4} / ${h.published}  (with EN: ${h.sections_en})`);
console.log(`region ≠ "France":         ${h.has_real_region} / ${h.published}`);
console.log(`geo (lat/lng):            ${h.has_geo} / ${h.published}`);
console.log(`gallery_images ≥ 5:        ${h.has_gallery} / ${h.published}`);

console.log('\n==== GUIDES ====');
console.log(`Published:                 ${g.published}`);
console.log(`summary_en:               ${g.has_summary_en} / ${g.published}`);
console.log(`sections ≥ 3:              ${g.has_sections_ge_3} / ${g.published}`);

console.log('\n==== RANKINGS ====');
console.log(`Published:                 ${r.published}`);
console.log(`title_en:                 ${r.has_title_en} / ${r.published}`);
console.log(`editorial_sections ≥ 3:   ${r.has_sections_ge_3} / ${r.published}`);

console.log('\n==== REGION DIST (top 12) ====');
for (const row of regionDist) {
  console.log(`  ${row.n.toString().padStart(3)}  ${row.region}`);
}
console.log('');
await cli.end();
