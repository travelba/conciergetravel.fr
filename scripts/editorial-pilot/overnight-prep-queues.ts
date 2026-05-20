/**
 * Overnight launcher : prepare lists of slugs that need work.
 *
 * Outputs:
 *   - runs/queue-fr-pipeline.txt   : slugs FR needing full pipeline (sections + concierge)
 *   - runs/queue-faq-extend.txt    : slugs needing FAQ extension to 10
 *   - runs/queue-missing-briefs.txt: slugs FR without an auto brief on disk
 */

import { readdir, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO = resolve(__dirname, '../..');
const RUNS_DIR = resolve(REPO, 'runs');
const BRIEFS_DIR = resolve(REPO, 'scripts/editorial-pilot/briefs');
const BRIEFS_AUTO_DIR = resolve(REPO, 'scripts/editorial-pilot/briefs-auto');

loadDotenv({ path: resolve(REPO, '.env.local') });

const url = (
  process.env['SUPABASE_DB_POOLER_URL'] ??
  process.env['SUPABASE_DB_URL'] ??
  process.env['DATABASE_URL'] ??
  ''
).replace(/\?sslmode=require/, '');
if (!url) {
  console.error('SUPABASE_DB_POOLER_URL or SUPABASE_DB_URL missing');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

const frToPipeline = await client.query<{ slug: string }>(`
  select slug from public.hotels
  where country_code = 'FR'
    and (long_description_sections is null
      or jsonb_typeof(long_description_sections) <> 'array'
      or jsonb_array_length(long_description_sections) < 6)
  order by slug;
`);

const faqExtend = await client.query<{ slug: string; country: string; n: number | null }>(`
  select slug, country_code as country,
    case when faq_content is null or jsonb_typeof(faq_content) <> 'array' then null
         else jsonb_array_length(faq_content) end as n
  from public.hotels
  where faq_content is null
     or jsonb_typeof(faq_content) <> 'array'
     or jsonb_array_length(faq_content) < 10
  order by country_code, slug;
`);

await client.end();

const briefsHand = await readdir(BRIEFS_DIR).catch(() => []);
const briefsAuto = await readdir(BRIEFS_AUTO_DIR).catch(() => []);
const allBriefs = new Set<string>(
  [...briefsHand, ...briefsAuto]
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .map((f) => f.replace(/\.json$/, '')),
);

const frSlugs = frToPipeline.rows.map((r) => r.slug);
const frWithBrief = frSlugs.filter((s) => allBriefs.has(s));
const frNoBrief = frSlugs.filter((s) => !allBriefs.has(s));

await mkdir(RUNS_DIR, { recursive: true });
await writeFile(resolve(RUNS_DIR, 'queue-fr-pipeline.txt'), frWithBrief.join('\n') + '\n', 'utf-8');
await writeFile(resolve(RUNS_DIR, 'queue-fr-no-brief.txt'), frNoBrief.join('\n') + '\n', 'utf-8');
await writeFile(
  resolve(RUNS_DIR, 'queue-faq-extend.txt'),
  faqExtend.rows.map((r) => `${r.slug}\t${r.country}\t${r.n ?? '-'}`).join('\n') + '\n',
  'utf-8',
);

console.log(`FR pipeline queue (with auto brief): ${frWithBrief.length}`);
console.log(`FR pipeline queue (NO auto brief, needs build): ${frNoBrief.length}`);
console.log(`FAQ extend queue (all countries): ${faqExtend.rows.length}`);
console.log('');
console.log('FR slugs without brief (first 30):');
frNoBrief.slice(0, 30).forEach((s) => console.log(`  ${s}`));
console.log('');
console.log('Wrote:');
console.log('  runs/queue-fr-pipeline.txt');
console.log('  runs/queue-fr-no-brief.txt');
console.log('  runs/queue-faq-extend.txt');
