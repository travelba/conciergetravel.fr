/* eslint-disable no-console */
import { config as loadDotenv } from 'dotenv';
import { Client } from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadDotenv({ path: path.resolve(__dirname, '../../.env.local') });

// Slugs pushed before the kill (from rankings-bulk log).
const PUSHED = [
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
  console.log('=== Current state of touched rankings ===\n');
  const r = await c.query(
    `select slug, is_published, updated_at
     from public.editorial_rankings
     where slug = ANY($1::text[])
     order by slug`,
    [PUSHED],
  );
  for (const row of r.rows) {
    console.log(`  ${row.slug.padEnd(55)} pub=${row.is_published} updated_at=${row.updated_at?.toISOString?.() ?? row.updated_at}`);
  }
  console.log(`\nMatched: ${r.rows.length} / ${PUSHED.length}`);

  console.log('\n=== Total published vs drafts in editorial_rankings ===');
  const totals = await c.query(
    `select is_published, count(*)::int as n
     from public.editorial_rankings
     group by is_published`,
  );
  for (const row of totals.rows) {
    console.log(`  is_published=${row.is_published}: ${row.n}`);
  }
} finally {
  await c.end();
}
