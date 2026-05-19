/* eslint-disable no-console */
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
try {
  const totals = await c.query(
    `select is_published, count(*)::int as n
     from public.editorial_rankings group by is_published`,
  );
  console.log('editorial_rankings totals:');
  for (const r of totals.rows) console.log(`  is_published=${r.is_published}: ${r.n}`);

  const since = '2026-05-19T09:49:00Z';
  const recent = await c.query(
    `select count(*)::int as n from public.editorial_rankings where updated_at >= $1`,
    [since],
  );
  console.log(`\nTouched by re-launch (>= ${since}): ${recent.rows[0].n}`);

  const low = await c.query(
    `select slug, is_published, jsonb_array_length(editorial_sections) as sections
     from public.editorial_rankings
     where updated_at >= $1
     order by jsonb_array_length(editorial_sections) asc
     limit 10`,
    [since],
  );
  console.log('\nLowest section counts among recently pushed:');
  for (const r of low.rows) console.log(`  pub=${r.is_published}  sections=${r.sections}  ${r.slug}`);

  const newPub = await c.query(
    `select slug from public.editorial_rankings
     where updated_at >= $1 and is_published = true
     order by slug`,
    [since],
  );
  console.log(`\nPublished after re-launch (${newPub.rows.length}):`);
  for (const r of newPub.rows) console.log(`  ${r.slug}`);
} finally {
  await c.end();
}
