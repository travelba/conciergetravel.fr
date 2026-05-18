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

// Pick a hotel with sigs just enriched
const { rows } = await cli.query(`
  select slug, name,
         jsonb_array_length(signature_experiences) as sig_n,
         signature_experiences->0->>'title_fr' as sig0_fr,
         signature_experiences->0->>'title_en' as sig0_en,
         signature_experiences->0->>'description_fr' as sig0_desc_fr,
         left(signature_experiences->0->>'description_en', 80) as sig0_desc_en,
         jsonb_array_length(faq_content) as faq_n,
         coalesce(jsonb_array_length(awards),0) as award_n,
         length(description_en) as desc_en_len
  from hotels where slug = 'hotel-castelbrac'`);
console.log('\n=== Sample hotel (hotel-castelbrac, post-enrich) ===');
console.log(JSON.stringify(rows[0], null, 2));

console.log('\n=== Coverage signature_experiences with EN ===');
const { rows: sigStats } = await cli.query(`
  select
    count(*) filter (where signature_experiences->0->>'title_en' is not null
                       and length(signature_experiences->0->>'title_en') >= 3) as sig_title_en,
    count(*) filter (where signature_experiences->0->>'description_en' is not null
                       and length(signature_experiences->0->>'description_en') >= 30) as sig_desc_en,
    count(*) as total
  from hotels where is_published = true
    and coalesce(jsonb_array_length(signature_experiences),0) > 0`);
console.log(`  title_en (≥3 chars): ${sigStats[0].sig_title_en}/${sigStats[0].total}`);
console.log(`  desc_en  (≥30 chars): ${sigStats[0].sig_desc_en}/${sigStats[0].total}`);

await cli.end();
