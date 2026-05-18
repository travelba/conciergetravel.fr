/**
 * Audit FR sentence length across guides and rankings to see how far we are
 * from the strict "≤ 25 words" Concierge rule (ADR-0011).
 *
 * Reports, per slug : total sentences, count > 25 words, % over.
 * Then aggregates an average % over corpus.
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
if (!connectionString) {
  console.error('Missing connection string');
  process.exit(1);
}

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();

function extractFrText(row) {
  const parts = [];
  if (typeof row.summary_fr === 'string') parts.push(row.summary_fr);
  const sections = row.sections;
  if (Array.isArray(sections)) {
    for (const s of sections) {
      if (s && typeof s.body_fr === 'string') parts.push(s.body_fr);
      if (s && Array.isArray(s.paragraphs_fr)) parts.push(s.paragraphs_fr.join(' '));
    }
  }
  return parts.join(' ');
}

function countLongSentences(text) {
  if (!text) return { total: 0, over: 0 };
  const sentences = text
    .split(/[.!?…]+\s+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 4);
  let over = 0;
  for (const s of sentences) {
    const words = s.split(/\s+/u).filter(Boolean);
    if (words.length > 25) over++;
  }
  return { total: sentences.length, over };
}

async function audit(table) {
  const cols =
    table === 'editorial_guides'
      ? 'slug, summary_fr, sections'
      : 'slug, intro_fr, outro_fr';
  const { rows } = await client.query(
    `select ${cols} from public.${table} where is_published = true order by slug`,
  );
  let totalSent = 0;
  let totalOver = 0;
  const worst = [];
  for (const r of rows) {
    const text =
      table === 'editorial_guides'
        ? extractFrText(r)
        : [r.intro_fr ?? '', r.outro_fr ?? ''].join(' ');
    const { total, over } = countLongSentences(text);
    totalSent += total;
    totalOver += over;
    const pct = total > 0 ? (over / total) * 100 : 0;
    worst.push({ slug: r.slug, sent: total, over, pct });
  }
  worst.sort((a, b) => b.pct - a.pct);
  return { rows: worst, totalSent, totalOver };
}

console.log('=== editorial_guides ===');
const g = await audit('editorial_guides');
console.log(
  `  ${g.rows.length} guides | ${g.totalSent} sentences | ${g.totalOver} > 25 mots (${((g.totalOver / g.totalSent) * 100).toFixed(1)}%)`,
);
console.log('  Top 10 worst:');
for (const r of g.rows.slice(0, 10)) {
  console.log(`    ${r.slug.padEnd(40)} ${String(r.over).padStart(4)}/${String(r.sent).padStart(4)} (${r.pct.toFixed(1)}%)`);
}

console.log('=== editorial_rankings ===');
const r = await audit('editorial_rankings');
console.log(
  `  ${r.rows.length} rankings | ${r.totalSent} sentences | ${r.totalOver} > 25 mots (${((r.totalOver / r.totalSent) * 100).toFixed(1)}%)`,
);
console.log('  Top 10 worst:');
for (const x of r.rows.slice(0, 10)) {
  console.log(`    ${x.slug.padEnd(40)} ${String(x.over).padStart(4)}/${String(x.sent).padStart(4)} (${x.pct.toFixed(1)}%)`);
}

await client.end();
