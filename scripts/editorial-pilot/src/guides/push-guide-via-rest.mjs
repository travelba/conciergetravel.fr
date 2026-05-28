// Pushes a generated guide to Supabase via PostgREST (no DB URL needed
// — uses NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
//
// Steps:
//   1. Read existing row (slug) to compute the is_published ratchet.
//   2. UPSERT into editorial_guides via on_conflict=slug, merge-duplicates.
//
// Usage:
//   node scripts/editorial-pilot/src/guides/push-guide-via-rest.mjs --slug=marrakech
//
// Reads from:
//   scripts/editorial-pilot/data/guides-cache/<slug>/generated.json
//   scripts/editorial-pilot/data/guides-cache/<slug>/seed.json

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';

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
let publishOverride = null;
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

const cacheDir = path.resolve(process.cwd(), 'scripts/editorial-pilot/data/guides-cache', slug);
const generated = JSON.parse(stripBom(await readFile(path.join(cacheDir, 'generated.json'), 'utf8')));
const seed = JSON.parse(stripBom(await readFile(path.join(cacheDir, 'seed.json'), 'utf8')));

const publish = publishOverride !== null ? publishOverride : seed.publish !== false;

function buildTocAnchors(guide) {
  const out = [];
  for (const s of guide.sections) {
    const anchor = s.key && s.key.length > 0 ? s.key : s.type;
    out.push({
      anchor,
      label_fr: s.title_fr,
      label_en: s.title_en && s.title_en.length > 0 ? s.title_en : s.title_fr,
      level: 2,
    });
  }
  if (guide.tables && guide.tables.length > 0) {
    out.push({ anchor: 'tableaux', label_fr: 'Tableaux comparatifs', label_en: 'Comparison tables', level: 2 });
  }
  if (guide.glossary && guide.glossary.length > 0) {
    out.push({ anchor: 'glossaire', label_fr: 'Glossaire', label_en: 'Glossary', level: 2 });
  }
  out.push({ anchor: 'faq', label_fr: 'FAQ', label_en: 'FAQ', level: 2 });
  if (guide.external_sources && guide.external_sources.length > 0) {
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
  const res = await fetch(url, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}\n${body}`);
  }
  const text = await res.text();
  return text.length > 0 ? JSON.parse(text) : null;
}

const existing = await jfetch(
  `${SUPABASE_URL}/rest/v1/editorial_guides?slug=eq.${encodeURIComponent(slug)}&select=id,is_published`,
);
const existingRow = Array.isArray(existing) && existing.length > 0 ? existing[0] : null;
const finalPublish = (existingRow?.is_published ?? false) || publish;

console.log(
  `Existing guide: ${existingRow ? `id=${existingRow.id} is_published=${existingRow.is_published}` : 'none'} — final publish=${finalPublish}`,
);

const tocAnchors = buildTocAnchors(generated);
const todayIso = new Date().toISOString().slice(0, 10);

const guideRow = {
  slug: seed.slug,
  name_fr: seed.nameFr,
  name_en: seed.nameEn,
  scope: seed.scope,
  country_code: seed.countryCode,
  summary_fr: generated.summary_fr,
  summary_en: generated.summary_en,
  sections: generated.sections ?? [],
  faq: generated.faq ?? [],
  featured_reviews: [],
  highlights: generated.highlights ?? [],
  practical_info: generated.practical_info ?? null,
  hero_image: seed.heroImage ?? null,
  meta_title_fr: generated.meta_title_fr,
  meta_title_en: generated.meta_title_en,
  meta_desc_fr: generated.meta_desc_fr,
  meta_desc_en: generated.meta_desc_en,
  reviewed_at: todayIso,
  author_name: 'MyConciergeHotel Éditorial',
  author_url: '/equipe/editorial',
  is_published: finalPublish,
  tables: generated.tables ?? [],
  glossary: generated.glossary ?? [],
  external_sources: generated.external_sources ?? [],
  editorial_callouts: generated.editorial_callouts ?? [],
  toc_anchors: tocAnchors,
  editorial_sections: generated.editorial_sections ?? [],
};

const upserted = await jfetch(
  `${SUPABASE_URL}/rest/v1/editorial_guides?on_conflict=slug`,
  {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(guideRow),
  },
);

const guideId = Array.isArray(upserted) && upserted.length > 0 ? upserted[0].id : null;
if (!guideId) {
  throw new Error('Upsert did not return id.');
}
console.log(`✓ upserted guide row — id=${guideId} slug=${seed.slug} published=${finalPublish}`);
