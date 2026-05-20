/**
 * Unified audit across the three editorial corpora :
 *   - hotels                (936 — FR + INTL)
 *   - editorial_rankings    (~88)
 *   - editorial_guides      (~86)
 *
 * For each row, scores it on three axes :
 *   - CONTENT_QUALITY       : sections, words, long sentences, banned terms
 *                              and concierge advice envelope (hotels only)
 *   - PUBLICATION_GATES     : FAQ ≥ 10, gallery ≥ 30, hero set
 *   - ENRICHMENT_DEPTH      : wikidata_id, lat/lng, postal_code, awards
 *
 * Outputs (in the cwd):
 *   - audit-corpus-fr.json      — full structured report
 *   - audit-corpus-fr-summary.txt — human-readable verdicts table
 *
 * Usage:
 *   pnpm --filter @mch/editorial-pilot exec node audit-corpus-fr.mjs
 *   (or just `node audit-corpus-fr.mjs` from the editorial-pilot folder)
 */
import pg from 'pg';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '../..');
const envText = readFileSync(resolve(REPO, '.env.local'), 'utf8');
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
const conn = (env.SUPABASE_DB_POOLER_URL ?? '').replace(/[?&]sslmode=[^&]*/giu, '');
const cli = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await cli.connect();

const BANNED_TERMS = [
  'incroyable',
  'magnifique',
  'sublime',
  'magique',
  'fascinant',
  'extraordinaire',
  'remarquable',
  'splendide',
  'somptueu',
  'merveilleu',
  'inoubliable',
  'mythique',
];

function countWords(s) {
  if (!s || typeof s !== 'string') return 0;
  return s
    .trim()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 0).length;
}

function countLongSentences(s) {
  if (!s) return 0;
  const bulletChunks = s.split(/\n\s*[-*]\s+/u);
  let count = 0;
  for (const chunk of bulletChunks) {
    const sentences = chunk
      .replace(/\s+/gu, ' ')
      .split(/(?<=[.!?])\s+(?=[A-ZÀ-ÿ])/u)
      .map((x) => x.trim())
      .filter((x) => x.length > 5);
    count += sentences.filter((sent) => countWords(sent) > 25).length;
  }
  return count;
}

function countBannedTerms(s) {
  if (!s) return { count: 0, hits: [] };
  const lower = s.toLowerCase();
  const hits = [];
  for (const term of BANNED_TERMS) {
    const matches = lower.match(new RegExp(term, 'gu')) ?? [];
    if (matches.length > 0) hits.push(`${term}×${matches.length}`);
  }
  return { count: hits.length, hits };
}

// ───────────────────────── 1. HOTELS ─────────────────────────
const hotelsRes = await cli.query(`
  select slug, name, city, country_code, country_label_fr,
         long_description_sections, concierge_advice,
         address, postal_code, hero_image,
         case when jsonb_typeof(gallery_images) = 'array' then jsonb_array_length(gallery_images) else 0 end as gallery_count,
         case when jsonb_typeof(faq_content) = 'array' then jsonb_array_length(faq_content)
              when jsonb_typeof(faq_content->'items') = 'array' then jsonb_array_length(faq_content->'items')
              else 0 end as faq_count,
         wikidata_id, latitude, longitude,
         restaurant_info, spa_info, awards, signature_experiences,
         is_published,
         to_char(updated_at, 'YYYY-MM-DD HH24:MI') as updated_at
    from public.hotels
   order by country_code, slug;
`);

const hotels = [];
const hotelBuckets = {
  ready_to_publish: [],
  needs_publish_gates: [],
  needs_concierge_voice: [],
  needs_pipeline: [],
  needs_brief: [],
};

for (const row of hotelsRes.rows) {
  const sections = row.long_description_sections ?? [];
  const sectionsArray = Array.isArray(sections) ? sections : [];
  let totalFrWords = 0;
  let totalLongSentences = 0;
  let totalBanned = 0;
  const bannedHits = [];

  for (const s of sectionsArray) {
    const body = s.body_fr ?? '';
    totalFrWords += countWords(body);
    totalLongSentences += countLongSentences(body);
    const b = countBannedTerms(body);
    totalBanned += b.count;
    bannedHits.push(...b.hits);
  }

  const advice = row.concierge_advice ?? {};
  const adviceFr = advice.fr ?? {};
  const adviceFrBody = adviceFr.body ?? '';
  const adviceFrWords = countWords(adviceFrBody);
  const hasConciergeFr =
    adviceFrWords >= 50 && adviceFrWords <= 110 && adviceFrBody.startsWith('Mon conseil');

  const galleryOk = row.gallery_count >= 30;
  const faqOk = row.faq_count >= 10;
  const heroOk = !!row.hero_image;
  const hasSections = sectionsArray.length >= 6;
  const sectionsOk = sectionsArray.length >= 8 && totalFrWords >= 400 && totalFrWords <= 1000;

  let bucket;
  if (!hasSections) bucket = 'needs_pipeline';
  else if (!hasConciergeFr) bucket = 'needs_concierge_voice';
  else if (!faqOk || !galleryOk || !heroOk) bucket = 'needs_publish_gates';
  else if (!sectionsOk || totalLongSentences > 5 || totalBanned > 2)
    bucket = 'needs_concierge_voice';
  else bucket = 'ready_to_publish';

  const record = {
    slug: row.slug,
    name: row.name,
    city: row.city,
    country_code: row.country_code,
    bucket,
    sections: sectionsArray.length,
    words_fr: totalFrWords,
    long_sentences: totalLongSentences,
    banned_count: totalBanned,
    banned_hits: bannedHits,
    advice_fr_words: adviceFrWords,
    has_concierge_fr: hasConciergeFr,
    address_set: !!row.address,
    postal_set: !!row.postal_code,
    coords_set: row.latitude !== null && row.longitude !== null,
    wikidata_set: !!row.wikidata_id,
    gallery_count: row.gallery_count,
    faq_count: row.faq_count,
    hero_set: heroOk,
    is_published: row.is_published,
    updated_at: row.updated_at,
  };
  hotels.push(record);
  hotelBuckets[bucket].push(row.slug);
}

// ───────────────────────── 2. RANKINGS ─────────────────────────
const rankingsRes = await cli.query(`
  select slug, title_fr, title_en, kind,
         intro_fr, intro_en, outro_fr, outro_en,
         factual_summary_fr, factual_summary_en,
         meta_title_fr, meta_desc_fr,
         case when jsonb_typeof(editorial_sections) = 'array' then jsonb_array_length(editorial_sections) else 0 end as section_count,
         case when jsonb_typeof(axes) = 'array' then jsonb_array_length(axes) else 0 end as axes_count,
         case when jsonb_typeof(faq) = 'array' then jsonb_array_length(faq) else 0 end as faq_count,
         is_published
    from public.editorial_rankings
   order by slug;
`);

const rankings = [];
const rankingBuckets = {
  ready_to_publish: [],
  needs_factual_summary: [],
  needs_intro_long: [],
  needs_faq: [],
  needs_full_content: [],
};

for (const row of rankingsRes.rows) {
  const introWords = countWords(row.intro_fr);
  const outroWords = countWords(row.outro_fr);
  const totalLongSent = countLongSentences(row.intro_fr) + countLongSentences(row.outro_fr);
  const factualOk = (row.factual_summary_fr ?? '').length > 80;
  const introOk = introWords >= 200;
  const faqOk = row.faq_count >= 5;
  const hasSections = row.section_count >= 3;

  let bucket;
  if (!introOk && !hasSections) bucket = 'needs_full_content';
  else if (!factualOk) bucket = 'needs_factual_summary';
  else if (!introOk) bucket = 'needs_intro_long';
  else if (!faqOk) bucket = 'needs_faq';
  else bucket = 'ready_to_publish';

  rankings.push({
    slug: row.slug,
    bucket,
    title_fr: row.title_fr,
    intro_words: introWords,
    outro_words: outroWords,
    section_count: row.section_count,
    axes_count: row.axes_count,
    long_sentences: totalLongSent,
    factual_set: factualOk,
    faq_count: row.faq_count,
    meta_set: !!row.meta_title_fr && !!row.meta_desc_fr,
    is_published: row.is_published,
    kind: row.kind,
  });
  rankingBuckets[bucket].push(row.slug);
}

// ───────────────────────── 3. GUIDES ─────────────────────────
// Migration 0039 added `summary_long_fr` (text, ≥ 1500 chars) and
// `editorial_sections` (jsonb, ≥ 6 sections). The legacy `summary_fr`
// and `sections` columns are kept for backwards compatibility but the
// long-form pipeline writes to the new ones.
const guidesRes = await cli.query(`
  select slug, name_fr, name_en, scope, country_code,
         summary_fr, summary_en, summary_long_fr,
         meta_title_fr, meta_desc_fr,
         case when jsonb_typeof(sections) = 'array' then jsonb_array_length(sections) else 0 end as legacy_section_count,
         case when jsonb_typeof(editorial_sections) = 'array' then jsonb_array_length(editorial_sections) else 0 end as section_count,
         case when jsonb_typeof(faq) = 'array' then jsonb_array_length(faq) else 0 end as faq_count,
         is_published
    from public.editorial_guides
   order by slug;
`);

const guides = [];
const guideBuckets = {
  ready_to_publish: [],
  needs_summary_long: [],
  needs_faq: [],
  needs_full_content: [],
};

for (const row of guidesRes.rows) {
  // Pipeline post-0039 writes long-form content to `summary_long_fr` /
  // `editorial_sections`. We check the new fields first and fall back to
  // legacy `summary_fr` / `sections` for guides that haven't been
  // re-rendered yet.
  const summaryLong = row.summary_long_fr ?? '';
  const summaryLongChars = summaryLong.length;
  const summaryShort = row.summary_fr ?? '';
  const summaryWords = countWords(summaryLong || summaryShort);
  const totalLongSent = countLongSentences(summaryLong || summaryShort);
  const summaryOk = summaryLongChars >= 1500 || summaryWords >= 200;
  const faqOk = row.faq_count >= 5;
  const hasSections = row.section_count >= 6 || row.legacy_section_count >= 3;

  let bucket;
  if (!summaryOk && !hasSections) bucket = 'needs_full_content';
  else if (!summaryOk) bucket = 'needs_summary_long';
  else if (!faqOk) bucket = 'needs_faq';
  else bucket = 'ready_to_publish';

  guides.push({
    slug: row.slug,
    bucket,
    name_fr: row.name_fr,
    summary_words: summaryWords,
    section_count: row.section_count,
    long_sentences: totalLongSent,
    faq_count: row.faq_count,
    meta_set: !!row.meta_title_fr && !!row.meta_desc_fr,
    is_published: row.is_published,
    scope: row.scope,
    country_code: row.country_code,
  });
  guideBuckets[bucket].push(row.slug);
}

await cli.end();

// ───────────────────────── REPORT ─────────────────────────
const out = {
  generated_at: new Date().toISOString(),
  hotels: {
    total: hotels.length,
    by_country: hotels.reduce((acc, h) => {
      acc[h.country_code] = (acc[h.country_code] ?? 0) + 1;
      return acc;
    }, {}),
    bucket_counts: Object.fromEntries(
      Object.entries(hotelBuckets).map(([k, v]) => [k, v.length]),
    ),
    bucket_slugs: hotelBuckets,
    records: hotels,
  },
  rankings: {
    total: rankings.length,
    bucket_counts: Object.fromEntries(
      Object.entries(rankingBuckets).map(([k, v]) => [k, v.length]),
    ),
    bucket_slugs: rankingBuckets,
    records: rankings,
  },
  guides: {
    total: guides.length,
    bucket_counts: Object.fromEntries(
      Object.entries(guideBuckets).map(([k, v]) => [k, v.length]),
    ),
    bucket_slugs: guideBuckets,
    records: guides,
  },
};

const outPath = resolve(__dirname, 'audit-corpus-fr.json');
writeFileSync(outPath, JSON.stringify(out, null, 2));

const summary = [
  '=== Audit corpus FR — ' + out.generated_at + ' ===',
  '',
  '── HOTELS ──────────────────────────────────────────',
  `  Total            : ${out.hotels.total}`,
  ...Object.entries(out.hotels.bucket_counts).map(
    ([k, v]) => `  ${k.padEnd(26)} : ${v}`,
  ),
  '',
  '── RANKINGS ────────────────────────────────────────',
  `  Total            : ${out.rankings.total}`,
  ...Object.entries(out.rankings.bucket_counts).map(
    ([k, v]) => `  ${k.padEnd(26)} : ${v}`,
  ),
  '',
  '── GUIDES ──────────────────────────────────────────',
  `  Total            : ${out.guides.total}`,
  ...Object.entries(out.guides.bucket_counts).map(
    ([k, v]) => `  ${k.padEnd(26)} : ${v}`,
  ),
  '',
  '── PRIORITIES ─────────────────────────────────────',
  `  Hotels needing pipeline    : ${out.hotels.bucket_counts.needs_pipeline}`,
  `  Hotels needing FAQ/photos  : ${out.hotels.bucket_counts.needs_publish_gates}`,
  `  Hotels needing concierge   : ${out.hotels.bucket_counts.needs_concierge_voice}`,
  `  Rankings needing factual   : ${out.rankings.bucket_counts.needs_factual_summary}`,
  `  Rankings needing intro     : ${out.rankings.bucket_counts.needs_intro_long}`,
  `  Guides needing summary     : ${out.guides.bucket_counts.needs_summary_long}`,
  `  Guides needing content     : ${out.guides.bucket_counts.needs_full_content}`,
  '',
  `Detailed JSON → ${outPath}`,
].join('\n');

writeFileSync(resolve(__dirname, 'audit-corpus-fr-summary.txt'), summary);
console.log(summary);
