// Pushes a generated ranking to Supabase via PostgREST (no DB URL
// needed — uses NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
//
// Steps:
//   1. UPSERT into editorial_rankings (Prefer: resolution=merge-duplicates,
//      Prefer: return=representation).
//      Ratchet: read existing `is_published` first and OR with the new value.
//   2. DELETE entries where ranking_id = <upserted_id>.
//   3. POST bulk-insert new entries.
//
// Usage:
//   node push-ranking-via-rest.mjs --slug=top-aman-hotels-monde
//
// Reads from:
//   scripts/editorial-pilot/data/rankings-cache/<slug>/generated.json
//   scripts/editorial-pilot/data/rankings-cache/<slug>/seed.json

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadDotenv({ path: path.resolve(__dirname, '../../../../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const args = process.argv.slice(2);
let slug = '';
let publishOverride = null; // null=respect seed; true/false override
for (const a of args) {
  if (a.startsWith('--slug=')) slug = a.slice('--slug='.length);
  else if (a === '--publish') publishOverride = true;
  else if (a === '--draft') publishOverride = false;
}
if (!slug) {
  console.error('Missing --slug=<slug>');
  process.exit(1);
}

function stripBom(s) {
  return s.replace(/^\uFEFF/, '');
}

const cacheDir = path.resolve(process.cwd(), 'scripts/editorial-pilot/data/rankings-cache', slug);
const generated = JSON.parse(stripBom(await readFile(path.join(cacheDir, 'generated.json'), 'utf8')));
const seed = JSON.parse(stripBom(await readFile(path.join(cacheDir, 'seed.json'), 'utf8')));

const publish = publishOverride !== null ? publishOverride : seed.publish !== false;

function buildTocAnchors(r) {
  // Anchor IDs MUST match the actual rendered section IDs in
  // apps/web/src/app/[locale]/classement/[slug]/page.tsx, otherwise
  // clicks scroll nowhere.
  const out = [];
  out.push({ anchor: 'introduction', label_fr: 'Introduction', label_en: 'Introduction', level: 2 });
  for (const s of r.editorial_sections) {
    out.push({
      anchor: s.key,
      label_fr: s.title_fr,
      label_en: s.title_en && s.title_en.length > 0 ? s.title_en : s.title_fr,
      level: 2,
    });
  }
  if (r.tables.length > 0) {
    out.push({ anchor: 'tableaux', label_fr: 'Tableau comparatif', label_en: 'Comparison table', level: 2 });
  }
  out.push({ anchor: 'ranking', label_fr: 'Le classement', label_en: 'The ranking', level: 2 });
  if (r.glossary.length > 0) {
    out.push({ anchor: 'glossaire', label_fr: 'Glossaire', label_en: 'Glossary', level: 2 });
  }
  if (r.outro_fr && r.outro_fr.length > 0) {
    out.push({ anchor: 'conclusion', label_fr: 'Conclusion', label_en: 'Conclusion', level: 2 });
  }
  out.push({ anchor: 'faq', label_fr: 'FAQ', label_en: 'FAQ', level: 2 });
  if (r.external_sources.length > 0) {
    out.push({ anchor: 'sources', label_fr: 'Sources & références', label_en: 'Sources & references', level: 2 });
  }
  return out;
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function jfetch(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}\n${body}`);
  }
  const text = await res.text();
  return text.length > 0 ? JSON.parse(text) : null;
}

// 1. Check existing ranking row to compute the is_published ratchet.
const existing = await jfetch(
  `${SUPABASE_URL}/rest/v1/editorial_rankings?slug=eq.${encodeURIComponent(slug)}&select=id,is_published`,
);
const existingRow = Array.isArray(existing) && existing.length > 0 ? existing[0] : null;
const finalPublish = (existingRow?.is_published ?? false) || publish;

console.log(
  `Existing ranking: ${existingRow ? `id=${existingRow.id} is_published=${existingRow.is_published}` : 'none'} — final publish=${finalPublish}`,
);

const tocAnchors = buildTocAnchors(generated);
const todayIso = new Date().toISOString().slice(0, 10);

const rankingRow = {
  slug: seed.slug,
  title_fr: seed.titleFr,
  title_en: seed.titleEn,
  kind: seed.kind,
  intro_fr: generated.intro_fr,
  intro_en: generated.intro_en,
  outro_fr: generated.outro_fr,
  outro_en: generated.outro_en,
  faq: generated.faq,
  hero_image: seed.heroImage ?? null,
  meta_title_fr: generated.meta_title_fr,
  meta_title_en: generated.meta_title_en,
  meta_desc_fr: generated.meta_desc_fr,
  meta_desc_en: generated.meta_desc_en,
  reviewed_at: todayIso,
  author_name: 'MyConciergeHotel Éditorial',
  author_url: '/equipe/editorial',
  is_published: finalPublish,
  tables: generated.tables,
  glossary: generated.glossary,
  external_sources: generated.external_sources,
  editorial_callouts: generated.editorial_callouts,
  toc_anchors: tocAnchors,
  editorial_sections: generated.editorial_sections,
  axes: {},
  factual_summary_fr: generated.factual_summary_fr && generated.factual_summary_fr.length > 0 ? generated.factual_summary_fr : null,
  factual_summary_en: generated.factual_summary_en && generated.factual_summary_en.length > 0 ? generated.factual_summary_en : null,
};

// 2. Upsert the ranking row.
const upserted = await jfetch(
  `${SUPABASE_URL}/rest/v1/editorial_rankings?on_conflict=slug`,
  {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(rankingRow),
  },
);

const rankingId = Array.isArray(upserted) && upserted.length > 0 ? upserted[0].id : null;
if (!rankingId) {
  throw new Error('Upsert did not return id.');
}
console.log(`✓ upserted ranking row — id=${rankingId}`);

// 3. Delete old entries.
const delRes = await fetch(
  `${SUPABASE_URL}/rest/v1/editorial_ranking_entries?ranking_id=eq.${rankingId}`,
  { method: 'DELETE', headers },
);
if (!delRes.ok) {
  const t = await delRes.text();
  throw new Error(`DELETE failed: ${delRes.status} ${t}`);
}
console.log(`✓ deleted previous entries for ranking_id=${rankingId}`);

// 4. Bulk insert new entries.
// DB check constraint: justification_fr must be 40-1200 chars.
function truncateAtSentence(text, max) {
  if (!text || text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastDot = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.\n'));
  if (lastDot > max * 0.7) return cut.slice(0, lastDot + 1);
  return cut.slice(0, max - 1) + '…';
}
const entriesPayload = generated.entries.map((e) => ({
  ranking_id: rankingId,
  hotel_id: e.hotel_id,
  rank: e.rank,
  justification_fr: truncateAtSentence(e.justification_fr, 1200),
  justification_en: e.justification_en && e.justification_en.length > 0 ? truncateAtSentence(e.justification_en, 1200) : null,
  badge_fr: e.badge_fr && e.badge_fr.length > 0 ? e.badge_fr.slice(0, 80) : null,
  badge_en: e.badge_en && e.badge_en.length > 0 ? e.badge_en.slice(0, 80) : null,
}));

const insRes = await fetch(`${SUPABASE_URL}/rest/v1/editorial_ranking_entries`, {
  method: 'POST',
  headers: { ...headers, Prefer: 'return=minimal' },
  body: JSON.stringify(entriesPayload),
});
if (!insRes.ok) {
  const t = await insRes.text();
  throw new Error(`INSERT entries failed: ${insRes.status} ${t}`);
}
console.log(`✓ inserted ${entriesPayload.length} new entries.`);
console.log(`\nRanking ${slug} pushed successfully. Published=${finalPublish}.`);
