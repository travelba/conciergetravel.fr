// Reads a generated ranking JSON + a seed metadata, emits a single SQL
// transaction string that:
//   - upserts the row in editorial_rankings (ratchet `is_published`)
//   - deletes existing entries for that ranking_id
//   - inserts the new entries
//
// Used by the agent to run the push via Supabase MCP `execute_sql`
// without needing a local DB connection string.
//
// Usage:
//   node build-push-sql.mjs --slug=<slug>
// Reads from:
//   scripts/editorial-pilot/data/rankings-cache/<slug>/generated.json
//   scripts/editorial-pilot/data/rankings-cache/<slug>/seed.json  (must exist)
// Writes to stdout (redirect to file or pipe to MCP).

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
let slug = '';
let outFile = '';
for (const a of args) {
  if (a.startsWith('--slug=')) slug = a.slice('--slug='.length);
  else if (a.startsWith('--out=')) outFile = a.slice('--out='.length);
}
if (!slug) {
  console.error('Missing --slug=<slug>');
  process.exit(1);
}

const ROOT = process.cwd();
const cacheDir = path.resolve(ROOT, 'scripts/editorial-pilot/data/rankings-cache', slug);
function stripBom(s) {
  return s.replace(/^\uFEFF/, '');
}
const generated = JSON.parse(stripBom(await readFile(path.join(cacheDir, 'generated.json'), 'utf8')));
const seed = JSON.parse(stripBom(await readFile(path.join(cacheDir, 'seed.json'), 'utf8')));

// Escapes a string for use in a Postgres E'...' literal.
function escapeSqlString(s) {
  if (s === null || s === undefined) return 'NULL';
  // Use dollar-quoted string with a unique tag to avoid escaping issues.
  return `$mch$${s}$mch$`;
}

function escapeJsonForSql(obj) {
  // Postgres jsonb accepts a string cast via ::jsonb.
  // Dollar-quoting handles all interior quotes/backslashes/newlines.
  return `${escapeSqlString(JSON.stringify(obj))}::jsonb`;
}

function escapeBool(b) {
  return b ? 'TRUE' : 'FALSE';
}

function buildTocAnchors(r) {
  const out = [];
  out.push({ anchor: 'introduction', label_fr: 'Introduction', label_en: 'Introduction', level: 2 });
  if (r.tables.length > 0) {
    out.push({ anchor: 'tableau-comparatif', label_fr: 'Tableau comparatif', label_en: 'Comparison table', level: 2 });
  }
  out.push({ anchor: 'classement', label_fr: 'Le classement', label_en: 'The ranking', level: 2 });
  for (const s of r.editorial_sections) {
    out.push({ anchor: s.key, label_fr: s.title_fr, label_en: s.title_en && s.title_en.length > 0 ? s.title_en : s.title_fr, level: 2 });
  }
  if (r.glossary.length > 0) {
    out.push({ anchor: 'glossaire', label_fr: 'Glossaire', label_en: 'Glossary', level: 2 });
  }
  out.push({ anchor: 'faq', label_fr: 'FAQ', label_en: 'FAQ', level: 2 });
  if (r.external_sources.length > 0) {
    out.push({ anchor: 'sources', label_fr: 'Sources & références', label_en: 'Sources & references', level: 2 });
  }
  return out;
}

const tocAnchors = buildTocAnchors(generated);
const todayIso = new Date().toISOString().slice(0, 10);
const publish = seed.publish !== false; // default true
const factualSummaryFr = generated.factual_summary_fr && generated.factual_summary_fr.length > 0 ? generated.factual_summary_fr : null;
const factualSummaryEn = generated.factual_summary_en && generated.factual_summary_en.length > 0 ? generated.factual_summary_en : null;

// Build the SQL — one big transaction.
const stmts = [];
stmts.push('BEGIN;');

// Upsert ranking row.
stmts.push(`
INSERT INTO public.editorial_rankings (
  slug, title_fr, title_en, kind, intro_fr, intro_en, outro_fr, outro_en,
  faq, hero_image, meta_title_fr, meta_title_en, meta_desc_fr, meta_desc_en,
  reviewed_at, author_name, author_url, is_published,
  tables, glossary, external_sources, editorial_callouts, toc_anchors,
  editorial_sections, axes, factual_summary_fr, factual_summary_en
) VALUES (
  ${escapeSqlString(seed.slug)},
  ${escapeSqlString(seed.titleFr)},
  ${escapeSqlString(seed.titleEn)},
  ${escapeSqlString(seed.kind)},
  ${escapeSqlString(generated.intro_fr)},
  ${escapeSqlString(generated.intro_en)},
  ${escapeSqlString(generated.outro_fr)},
  ${escapeSqlString(generated.outro_en)},
  ${escapeJsonForSql(generated.faq)},
  ${seed.heroImage ? escapeSqlString(seed.heroImage) : 'NULL'},
  ${escapeSqlString(generated.meta_title_fr)},
  ${escapeSqlString(generated.meta_title_en)},
  ${escapeSqlString(generated.meta_desc_fr)},
  ${escapeSqlString(generated.meta_desc_en)},
  ${escapeSqlString(todayIso)}::date,
  ${escapeSqlString('MyConciergeHotel Éditorial')},
  ${escapeSqlString('/equipe/editorial')},
  ${escapeBool(publish)},
  ${escapeJsonForSql(generated.tables)},
  ${escapeJsonForSql(generated.glossary)},
  ${escapeJsonForSql(generated.external_sources)},
  ${escapeJsonForSql(generated.editorial_callouts)},
  ${escapeJsonForSql(tocAnchors)},
  ${escapeJsonForSql(generated.editorial_sections)},
  '{}'::jsonb,
  ${factualSummaryFr ? escapeSqlString(factualSummaryFr) : 'NULL'},
  ${factualSummaryEn ? escapeSqlString(factualSummaryEn) : 'NULL'}
) ON CONFLICT (slug) DO UPDATE SET
  title_fr = excluded.title_fr,
  title_en = excluded.title_en,
  kind = excluded.kind,
  intro_fr = excluded.intro_fr,
  intro_en = excluded.intro_en,
  outro_fr = excluded.outro_fr,
  outro_en = excluded.outro_en,
  faq = excluded.faq,
  hero_image = excluded.hero_image,
  meta_title_fr = excluded.meta_title_fr,
  meta_title_en = excluded.meta_title_en,
  meta_desc_fr = excluded.meta_desc_fr,
  meta_desc_en = excluded.meta_desc_en,
  reviewed_at = excluded.reviewed_at,
  is_published = (editorial_rankings.is_published OR excluded.is_published),
  tables = excluded.tables,
  glossary = excluded.glossary,
  external_sources = excluded.external_sources,
  editorial_callouts = excluded.editorial_callouts,
  toc_anchors = excluded.toc_anchors,
  editorial_sections = excluded.editorial_sections,
  axes = excluded.axes,
  factual_summary_fr = excluded.factual_summary_fr,
  factual_summary_en = excluded.factual_summary_en;
`);

// Delete & re-insert entries — wrapped in a CTE so we can use the ID
// returned by the upsert.
stmts.push(`
WITH ranking AS (
  SELECT id FROM public.editorial_rankings WHERE slug = ${escapeSqlString(seed.slug)}
)
DELETE FROM public.editorial_ranking_entries
WHERE ranking_id = (SELECT id FROM ranking);
`);

// Build a single bulk INSERT.
const valuesRows = generated.entries
  .map((e) => {
    const justifEn = e.justification_en && e.justification_en.length > 0 ? escapeSqlString(e.justification_en) : 'NULL';
    const badgeFr = e.badge_fr && e.badge_fr.length > 0 ? escapeSqlString(e.badge_fr) : 'NULL';
    const badgeEn = e.badge_en && e.badge_en.length > 0 ? escapeSqlString(e.badge_en) : 'NULL';
    return `((SELECT id FROM public.editorial_rankings WHERE slug = ${escapeSqlString(seed.slug)}), ${escapeSqlString(e.hotel_id)}::uuid, ${e.rank}, ${escapeSqlString(e.justification_fr)}, ${justifEn}, ${badgeFr}, ${badgeEn})`;
  })
  .join(',\n  ');

stmts.push(`
INSERT INTO public.editorial_ranking_entries (
  ranking_id, hotel_id, rank, justification_fr, justification_en, badge_fr, badge_en
) VALUES
  ${valuesRows};
`);

stmts.push('COMMIT;');

const sql = stmts.join('\n');

if (outFile) {
  await writeFile(outFile, sql, 'utf8');
  console.error(`Wrote SQL (${sql.length} chars) to ${outFile}`);
} else {
  process.stdout.write(sql);
}
