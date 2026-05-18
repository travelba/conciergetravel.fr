/**
 * Inspect guides and rankings to count which already have a `concierge_tip`
 * callout in `editorial_callouts` and which are missing one.
 */
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envText = readFileSync(resolve(process.cwd(), '../../.env.local'), 'utf8');
const env = {};
for (const raw of envText.split('\n')) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const eq = line.indexOf('=');
  if (eq <= 0) continue;
  env[line.slice(0, eq).trim()] = line
    .slice(eq + 1)
    .trim()
    .replace(/^"|"$/g, '');
}

const connectionString =
  env.SUPABASE_DB_POOLER_URL ?? env.SUPABASE_DB_URL ?? env.DATABASE_URL;
if (typeof connectionString !== 'string' || connectionString.length === 0) {
  console.error('Missing SUPABASE_DB_URL in .env.local');
  process.exit(1);
}

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();

function classify(rows) {
  const out = { total: 0, withTip: 0, withoutTip: [] };
  for (const r of rows) {
    out.total++;
    const cs = Array.isArray(r.editorial_callouts) ? r.editorial_callouts : [];
    const has = cs.some((c) => c && c.kind === 'concierge_tip');
    if (has) out.withTip++;
    else out.withoutTip.push(r.slug);
  }
  return out;
}

const guides = (
  await client.query(
    `select slug, editorial_callouts from public.editorial_guides where is_published = true order by slug`,
  )
).rows;
const rankings = (
  await client.query(
    `select slug, editorial_callouts from public.editorial_rankings where is_published = true order by slug`,
  )
).rows;

const g = classify(guides);
const r = classify(rankings);

console.log('=== GUIDES ===');
console.log(`  total: ${g.total}  with concierge_tip: ${g.withTip}  without: ${g.withoutTip.length}`);
if (g.withoutTip.length > 0) {
  console.log('  missing tip:');
  for (const s of g.withoutTip) console.log(`    - ${s}`);
}

console.log('=== RANKINGS ===');
console.log(`  total: ${r.total}  with concierge_tip: ${r.withTip}  without: ${r.withoutTip.length}`);
if (r.withoutTip.length > 0) {
  console.log('  missing tip:');
  for (const s of r.withoutTip) console.log(`    - ${s}`);
}

await client.end();
