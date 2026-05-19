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
  const cols = await c.query(
    `select column_name from information_schema.columns
     where table_schema='public' and table_name='editorial_guides'
     order by ordinal_position`,
  );
  console.log('editorial_guides columns:', cols.rows.map(r => r.column_name).join(', '));

  const drafts = await c.query(
    `select * from public.editorial_guides
     where is_published = false
     order by created_at desc nulls last
     limit 50`,
  );
  console.log(`\nDrafts (is_published=false): ${drafts.rows.length}`);
  for (const r of drafts.rows) {
    const slug = r.slug ?? '-';
    const scope = r.scope ?? '-';
    const cc = r.country_code ?? '-';
    console.log(`  ${slug.padEnd(50)} scope=${scope.padEnd(12)} country=${cc}`);
  }

  const published = await c.query(
    `select count(*)::int as n from public.editorial_guides where is_published = true`,
  );
  console.log(`\nPublished guides: ${published.rows[0].n}`);
} finally {
  await c.end();
}
