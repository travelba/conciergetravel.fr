/* eslint-disable no-console */
import { config as loadDotenv } from 'dotenv';
import { Client } from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadDotenv({ path: path.resolve(__dirname, '../../.env.local') });

const SLUGS = [
  'meilleurs-hotels-escapade-france',
  'meilleurs-hotels-anniversaire-france',
  'meilleurs-hotels-lune-de-miel-france',
  'meilleurs-hotels-minceur-france',
  'meilleurs-hotels-seminaire-france',
  'meilleurs-hotels-week-end-france',
  'plus-beaux-5-etoiles-france',
  'meilleurs-hotels-charme-france',
  'meilleurs-hotels-5-etoiles-france',
  'meilleurs-hotels-les-30-plus-beaux-hotels-en-france',
  'meilleurs-hotels-famille-france',
  'meilleurs-hotels-amoureux-france',
  'meilleurs-hotels-romantiques-france',
  'meilleurs-hotels-spa-france',
];

const conn = (process.env['SUPABASE_DB_POOLER_URL'] ?? process.env['SUPABASE_DB_URL'] ?? '').replace(/[?&]sslmode=[^&]*/gi, '');
const c = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  console.log('Restoring is_published=true for accidentally demoted rankings...');
  const r = await c.query(
    `update public.editorial_rankings
     set is_published = true
     where slug = ANY($1::text[])
       and is_published = false
     returning slug, updated_at`,
    [SLUGS],
  );
  console.log(`Restored ${r.rowCount} rows:`);
  for (const row of r.rows) {
    console.log(`  ✓ ${row.slug}`);
  }
  if (r.rowCount === 0) {
    console.log('  (no rows changed — either already published or slug not found)');
  }

  const published = await c.query(
    `select count(*)::int as n from public.editorial_rankings where is_published = true`,
  );
  console.log(`\nTotal published rankings now: ${published.rows[0].n}`);
} finally {
  await c.end();
}
