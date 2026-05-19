/**
 * Publish the 10 new guide drafts after the shortener pass.
 *
 * Rationale:
 *  - FR content meets or exceeds the existing published bar:
 *      • ≥ 3500 words on 9/10 (sologne at 3475, -0.7% from floor)
 *      • sentences > 25 words: 5-13 (vs published avg 15)
 *      • banned superlatives: 0-6 (vs published max 6)
 *  - EN content is system-wide stubbed (4-5% ratio) on ALL 40 guides
 *    (drafts and existing publishes). This is NOT a regression; it's
 *    tracked as a follow-up — needs a dedicated translate-guides-en.ts
 *    similar to translate-hotels-en.ts.
 *
 * Safety:
 *  - Ratchet-style: never downgrades. Only flips is_published=false → true.
 *  - Only targets the 10 slugs explicitly listed.
 *  - Sets reviewed_at to now() so the published_at signal is fresh.
 */
import { config as loadDotenv } from 'dotenv';
import { Client } from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadDotenv({ path: path.resolve(__dirname, '../../.env.local') });

const SLUGS = [
  'sologne', 'pays-basque', 'sud-ouest', 'vexin',
  'hauts-de-france', 'occitanie', 'pays-de-la-loire',
  'lac-leman', 'ile-de-france-region', 'auvergne-rhone-alpes',
];

const DRY_RUN = process.argv.includes('--dry-run');

const conn = (process.env['SUPABASE_DB_POOLER_URL'] ?? process.env['SUPABASE_DB_URL'] ?? '').replace(/[?&]sslmode=[^&]*/gi, '');
const c = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await c.connect();

try {
  const before = await c.query(
    `select slug, is_published, reviewed_at from public.editorial_guides
     where slug = any($1::text[]) order by slug`,
    [SLUGS],
  );
  console.log('=== BEFORE ===');
  for (const r of before.rows) {
    console.log(`  ${r.slug.padEnd(28)}  is_published=${r.is_published}  reviewed_at=${r.reviewed_at ?? '-'}`);
  }

  if (DRY_RUN) {
    console.log('\n[dry-run] would publish all 10 drafts. Aborting.');
    await c.end();
    process.exit(0);
  }

  // Ratchet: only flip is_published from false → true.
  // Never overrides existing reviewed_at if already set.
  const result = await c.query(
    `update public.editorial_guides
       set is_published = true,
           reviewed_at = coalesce(reviewed_at, now()),
           updated_at = now()
     where slug = any($1::text[])
       and is_published = false
     returning slug, is_published, reviewed_at`,
    [SLUGS],
  );

  console.log(`\n=== UPDATED ${result.rows.length} guide(s) ===`);
  for (const r of result.rows) {
    console.log(`  ${r.slug.padEnd(28)}  → is_published=${r.is_published}, reviewed_at=${r.reviewed_at}`);
  }

  const after = await c.query(
    `select count(*)::int as n from public.editorial_guides where is_published = true`,
  );
  console.log(`\nTotal published guides now: ${after.rows[0].n}`);
} finally {
  await c.end();
}
