/**
 * DB rebrand: ConciergeTravel → MyConciergeHotel (+ conciergetravel.fr → myconciergehotel.com).
 *
 * String-replace across every text + JSONB column that may have stored the
 * old brand from LLM-generated content (hotels, editorial_guides,
 * editorial_rankings). Wrapped in a single transaction so it's atomic.
 *
 * Idempotent: re-running it is a no-op.
 *
 * Usage:
 *   node scripts/editorial-pilot/rebrand-db.mjs --dry-run
 *   node scripts/editorial-pilot/rebrand-db.mjs
 */
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DRY = process.argv.includes('--dry-run');

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

const REPLACEMENTS = [
  ['ConciergeTravel.fr', 'MyConciergeHotel.com'],
  ['conciergetravel.fr', 'myconciergehotel.com'],
  ['ConciergeTravel', 'MyConciergeHotel'],
  ['conciergetravel', 'myconciergehotel'],
];

// Build a Postgres expression that chains replace() calls — order matters
// (most-specific first). Works on text values.
function textChain(colExpr) {
  let cur = colExpr;
  for (const [from, to] of REPLACEMENTS) {
    cur = `replace(${cur}, ${pg.escapeLiteral(from)}, ${pg.escapeLiteral(to)})`;
  }
  return cur;
}
// pg doesn't expose escapeLiteral on the client by default; use the static
// version on the module (pg-pool uses node-postgres' Client.escapeLiteral
// internally). Fall back to manual escape for older versions.
if (typeof pg.escapeLiteral !== 'function') {
  pg.escapeLiteral = (s) => `'${String(s).replace(/'/g, "''")}'`;
}

// JSONB requires casting to text, chaining replaces, then casting back.
function jsonbChain(colExpr) {
  return `${textChain(`${colExpr}::text`)}::jsonb`;
}

const TARGETS = [
  {
    table: 'hotels',
    text: [
      'description_fr',
      'description_en',
      'meta_title_fr',
      'meta_title_en',
      'meta_desc_fr',
      'meta_desc_en',
    ],
    jsonb: ['faq_content', 'long_description_sections', 'signature_experiences', 'awards', 'policies', 'mice_info'],
  },
  {
    table: 'editorial_guides',
    text: ['summary_fr', 'summary_en', 'meta_title_fr', 'meta_title_en', 'meta_desc_fr', 'meta_desc_en'],
    jsonb: ['sections', 'faq', 'highlights', 'practical_info', 'tables', 'glossary', 'external_sources', 'editorial_callouts'],
  },
  {
    table: 'editorial_rankings',
    text: ['intro_fr', 'intro_en', 'outro_fr', 'outro_en', 'meta_title_fr', 'meta_title_en', 'meta_desc_fr', 'meta_desc_en', 'factual_summary_fr', 'factual_summary_en'],
    jsonb: ['faq', 'tables', 'glossary', 'external_sources', 'editorial_callouts', 'editorial_sections', 'axes'],
  },
];

await cli.query('begin');
let totalAffected = 0;
try {
  for (const { table, text, jsonb } of TARGETS) {
    const sets = [];
    for (const col of text) {
      sets.push(`${col} = ${textChain(col)}`);
    }
    for (const col of jsonb) {
      sets.push(`${col} = case when ${col} is null then null else ${jsonbChain(col)} end`);
    }
    const whereClauses = [...text, ...jsonb]
      .map((c) => `${c}::text ilike '%conciergetravel%'`)
      .join(' or ');
    const sql = `update ${table} set ${sets.join(', ')}, updated_at = timezone('utc', now()) where ${whereClauses}`;
    if (DRY) {
      const countSql = `select count(*) from ${table} where ${whereClauses}`;
      const r = await cli.query(countSql);
      console.log(`[dry] ${table}: would update ${r.rows[0].count} row(s)`);
    } else {
      const r = await cli.query(sql);
      totalAffected += r.rowCount;
      console.log(`[ok ] ${table}: ${r.rowCount} row(s) updated`);
    }
  }
  if (DRY) {
    await cli.query('rollback');
    console.log('\n(dry-run, nothing committed)');
  } else {
    await cli.query('commit');
    console.log(`\nTotal rows updated: ${totalAffected}`);
  }
} catch (err) {
  await cli.query('rollback');
  console.error('Aborted:', err.message);
  process.exit(1);
} finally {
  await cli.end();
}
