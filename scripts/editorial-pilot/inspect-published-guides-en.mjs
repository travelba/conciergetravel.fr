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
  select slug, sections, is_published
  from public.editorial_guides
  where is_published = true
  order by slug
`);

function countWords(s) {
  if (typeof s !== 'string') return 0;
  return s.trim().split(/[^\p{L}\p{N}]+/u).filter((x) => x.length > 0).length;
}

console.log('Slug                       | FR words | EN words | EN ratio | Sections | EN any full?');
console.log('-'.repeat(105));
for (const row of r.rows) {
  const sections = Array.isArray(row.sections) ? row.sections : [];
  let frTotal = 0, enTotal = 0, fullEn = 0;
  for (const s of sections) {
    const fw = countWords(s?.body_fr);
    const ew = countWords(s?.body_en);
    frTotal += fw;
    enTotal += ew;
    if (ew >= fw * 0.7 && ew > 100) fullEn++;
  }
  const ratio = frTotal > 0 ? Math.round((enTotal / frTotal) * 100) : 0;
  console.log(`${row.slug.padEnd(28)} | ${String(frTotal).padEnd(8)} | ${String(enTotal).padEnd(8)} | ${String(ratio).padStart(4)}%   | ${String(sections.length).padStart(2)}       | ${fullEn}/${sections.length}`);
}

const sample = r.rows.find((row) => Array.isArray(row.sections) && row.sections.some((s) => countWords(s?.body_en) > 200));
if (sample) {
  console.log(`\n--- Sample of populated EN body (from ${sample.slug}): ---`);
  for (const s of sample.sections) {
    if (countWords(s?.body_en) > 200) {
      console.log(`section ${s.key}: "${(s.body_en || '').slice(0, 300)}..."`);
      break;
    }
  }
}
await c.end();
