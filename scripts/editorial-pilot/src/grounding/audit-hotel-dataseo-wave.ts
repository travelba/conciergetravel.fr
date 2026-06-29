/**
 * Read-only DataForSEO audit for hotel fiches.
 *
 * Selects a prioritised wave of published hotels, grounds each fiche with the
 * existing DataForSEO helper, classifies PAA demand, and writes JSON + Markdown
 * reports under scripts/editorial-pilot/runs/. No database write is performed.
 *
 * Usage:
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/grounding/audit-hotel-dataseo-wave.ts --limit=100 --concurrency=2
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

import { isEditoriallyRelevantPaa } from '../hotels/faq-perplexity-gates.js';
import type { HotelLlmInput } from '../hotels/supabase-hotels.js';
import { loadDfsConfig } from './env-dfs.js';
import { groundHotel, type HotelGroundingResult } from './hotel-grounding.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../../../..');

loadDotenv({ path: resolve(REPO_ROOT, '.env.local') });
loadDotenv({ path: resolve(REPO_ROOT, '.env') });

const DEFAULT_LIMIT = 100;
const DEFAULT_CANDIDATES = 420;
const DEFAULT_CONCURRENCY = 2;

const EXPLICIT_WAVE_1A_SLUGS = [
  'les-airelles-gordes',
  'le-meurice',
  'hotel-ritz-paris',
  'four-seasons-hotel-george-v',
  'the-berkeley',
  'claridge-s-londres',
  'aman-new-york',
  'the-plaza-hotel',
  '25hours-hotel-dubai-one-central',
  'burj-al-arab',
  'hotel-de-russie-rocco-forte-collection',
  'bulgari-roma',
] as const;

const PRIORITY_CITY_POINTS = new Map<string, number>([
  ['Paris', 18],
  ['Londres', 18],
  ['New York', 18],
  ['Dubaï', 18],
  ['Dubai', 18],
  ['Rome', 16],
  ['Venise', 14],
  ['Tokyo', 14],
  ['Los Angeles', 12],
  ['Marrakech', 12],
  ['Monaco', 12],
  ['Saint-Tropez', 12],
  ['Courchevel', 12],
  ['Cannes', 12],
  ['Nice', 10],
]);

const SupabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(40),
});

const HotelAuditRowSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  name_en: z.string().nullable(),
  city: z.string().nullable(),
  district: z.string().nullable(),
  region: z.string().nullable(),
  country_code: z.string().nullable(),
  country_label_fr: z.string().nullable(),
  country_label_en: z.string().nullable(),
  stars: z.number().nullable(),
  is_palace: z.boolean().nullable(),
  luxury_tier: z.string().nullable(),
  meta_title_fr: z.string().nullable(),
  meta_title_en: z.string().nullable(),
  meta_desc_fr: z.string().nullable(),
  meta_desc_en: z.string().nullable(),
  factual_summary_fr: z.string().nullable(),
  factual_summary_en: z.string().nullable(),
  description_fr: z.string().nullable(),
  description_en: z.string().nullable(),
  faq_content: z.unknown().nullable(),
  faq_content_kit: z.unknown().nullable(),
  concierge_questions: z.unknown().nullable(),
  geo_qa: z.unknown().nullable(),
  long_description_sections: z.unknown().nullable(),
  gallery_images: z.unknown().nullable(),
  external_sources: z.unknown().nullable(),
  google_rating: z.union([z.string(), z.number()]).nullable(),
  google_reviews_count: z.number().nullable(),
  points_of_interest: z.unknown().nullable(),
  restaurant_info: z.unknown().nullable(),
  spa_info: z.unknown().nullable(),
  amenities: z.unknown().nullable(),
  signature_experiences: z.unknown().nullable(),
  awards: z.unknown().nullable(),
  updated_at: z.string().nullable(),
});

type HotelAuditRow = z.infer<typeof HotelAuditRowSchema>;

interface Args {
  readonly limit: number;
  readonly candidateLimit: number;
  readonly concurrency: number;
  readonly refresh: boolean;
  readonly slugs: readonly string[];
}

interface QualitySnapshot {
  readonly faqCount: number;
  readonly faqKitCount: number;
  readonly conciergeQuestionCount: number;
  readonly geoQaCount: number;
  readonly sectionCount: number;
  readonly photoCount: number;
  readonly photoCategoryCount: number;
  readonly externalSourcesCount: number;
  readonly factualFrLen: number;
  readonly factualEnLen: number;
  readonly metaTitleFrLen: number;
  readonly metaTitleEnLen: number;
  readonly metaDescFrLen: number;
  readonly metaDescEnLen: number;
}

interface SelectionScore {
  readonly score: number;
  readonly reasons: readonly string[];
  readonly quality: QualitySnapshot;
}

interface ClassifiedPaa {
  readonly question: string;
  readonly action:
    | 'keep_faq'
    | 'keep_geo'
    | 'keep_section'
    | 'keep_linking'
    | 'reject_noise'
    | 'reject_phase6';
}

interface AuditItem {
  readonly slug: string;
  readonly name: string;
  readonly city: string | null;
  readonly countryCode: string | null;
  readonly score: number;
  readonly reasons: readonly string[];
  readonly quality: QualitySnapshot;
  readonly grounding: {
    readonly grounded: boolean;
    readonly locale: string;
    readonly seeds: readonly string[];
    readonly paaTotal: number;
    readonly paaUseful: number;
    readonly topKeywords: readonly {
      readonly keyword: string;
      readonly searchVolume: number | null;
    }[];
    readonly relatedSearches: readonly string[];
  };
  readonly paa: readonly ClassifiedPaa[];
  readonly changes: ChangePlan;
}

interface ChangePlan {
  readonly modify: readonly string[];
  readonly create: readonly string[];
  readonly remove: readonly string[];
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const readNumber = (name: string, fallback: number): number => {
    const raw = argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
    if (raw === undefined) return fallback;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return parsed;
  };
  const slugsRaw = argv.find((a) => a.startsWith('--slugs='))?.slice('--slugs='.length);
  return {
    limit: readNumber('limit', DEFAULT_LIMIT),
    candidateLimit: readNumber('candidates', DEFAULT_CANDIDATES),
    concurrency: readNumber('concurrency', DEFAULT_CONCURRENCY),
    refresh: argv.includes('--refresh'),
    slugs:
      slugsRaw === undefined
        ? []
        : slugsRaw
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0),
  };
}

function asArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringField(value: unknown, key: string): string | null {
  if (typeof value !== 'object' || value === null) return null;
  if (!Object.prototype.hasOwnProperty.call(value, key)) return null;
  const raw = Object.getOwnPropertyDescriptor(value, key)?.value;
  return typeof raw === 'string' ? raw : null;
}

function qualitySnapshot(row: HotelAuditRow): QualitySnapshot {
  const photos = asArray(row.gallery_images);
  const categories = new Set<string>();
  for (const photo of photos) {
    const category = stringField(photo, 'category');
    if (category !== null && category.trim().length > 0) categories.add(category.trim());
  }
  return {
    faqCount: asArray(row.faq_content).length,
    faqKitCount: asArray(row.faq_content_kit).length,
    conciergeQuestionCount: asArray(row.concierge_questions).length,
    geoQaCount: asArray(row.geo_qa).length,
    sectionCount: asArray(row.long_description_sections).length,
    photoCount: photos.length,
    photoCategoryCount: categories.size,
    externalSourcesCount: asArray(row.external_sources).length,
    factualFrLen: row.factual_summary_fr?.length ?? 0,
    factualEnLen: row.factual_summary_en?.length ?? 0,
    metaTitleFrLen: row.meta_title_fr?.length ?? 0,
    metaTitleEnLen: row.meta_title_en?.length ?? 0,
    metaDescFrLen: row.meta_desc_fr?.length ?? 0,
    metaDescEnLen: row.meta_desc_en?.length ?? 0,
  };
}

function hasLanguageLeak(row: HotelAuditRow): boolean {
  const faq = asArray(row.faq_content);
  return faq.some((item) => {
    const questionFr = stringField(item, 'question_fr') ?? '';
    return /\b(dove|come|quanto|where|what|how)\b/iu.test(questionFr);
  });
}

function selectionScore(row: HotelAuditRow): SelectionScore {
  const q = qualitySnapshot(row);
  const reasons: string[] = [];
  let score = 0;

  if (EXPLICIT_WAVE_1A_SLUGS.some((slug) => slug === row.slug)) {
    score += 40;
    reasons.push('wave_1a_explicit');
  }

  const cityPoints = row.city === null ? 0 : (PRIORITY_CITY_POINTS.get(row.city) ?? 0);
  if (cityPoints > 0) {
    score += cityPoints;
    reasons.push(`priority_city:${row.city}`);
  }

  const reviews = row.google_reviews_count ?? 0;
  if (reviews > 0) {
    const reviewScore = Math.min(18, Math.round(Math.log10(reviews + 1) * 5));
    score += reviewScore;
    reasons.push(`reviews:${reviews}`);
  }

  if (q.externalSourcesCount < 2) {
    score += 12;
    reasons.push('eeat_sources_lt_2');
  }
  if (q.photoCount < 10) {
    score += 12;
    reasons.push('photos_lt_10');
  } else if (q.photoCount < 30) {
    score += 5;
    reasons.push('photos_lt_30');
  }
  if (q.photoCategoryCount < 5) {
    score += 10;
    reasons.push('photo_categories_lt_5');
  } else if (q.photoCategoryCount < 10) {
    score += 4;
    reasons.push('photo_categories_lt_10');
  }
  if (q.geoQaCount < 3) {
    score += 10;
    reasons.push('geo_qa_lt_3');
  }
  if (q.faqCount < 10) {
    score += 10;
    reasons.push('faq_lt_10');
  }
  if (q.faqKitCount < 40) {
    score += 7;
    reasons.push('faq_kit_lt_40');
  }
  if (
    q.factualFrLen < 130 ||
    q.factualFrLen > 150 ||
    q.factualEnLen < 130 ||
    q.factualEnLen > 150
  ) {
    score += 6;
    reasons.push('factual_outside_cdc_ideal');
  }
  if (
    q.metaDescFrLen < 140 ||
    q.metaDescFrLen > 170 ||
    q.metaDescEnLen < 140 ||
    q.metaDescEnLen > 170
  ) {
    score += 8;
    reasons.push('meta_desc_outside_band');
  }
  if (
    (row.meta_title_fr ?? '').trim().endsWith('|') ||
    (row.meta_title_en ?? '').trim().endsWith('|')
  ) {
    score += 12;
    reasons.push('meta_title_broken_pipe');
  }
  if (hasLanguageLeak(row)) {
    score += 12;
    reasons.push('faq_language_leak');
  }
  if (
    row.is_palace !== true &&
    /\bpalace\b/iu.test(`${row.meta_title_fr ?? ''} ${row.meta_desc_fr ?? ''}`)
  ) {
    score += 6;
    reasons.push('palace_claim_to_verify');
  }

  return { score, reasons, quality: q };
}

function truncateText(value: string | null, max: number): string | null {
  if (value === null) return null;
  if (value.length <= max) return value;
  return `${value.slice(0, max).trimEnd()}...`;
}

function toLlmInput(row: HotelAuditRow): HotelLlmInput {
  return {
    slug: row.slug,
    name: row.name,
    name_en: row.name_en,
    city: row.city,
    district: row.district,
    country_code: row.country_code,
    country_label_fr: row.country_label_fr,
    country_label_en: row.country_label_en,
    stars: row.stars,
    is_palace: row.is_palace,
    description_fr_excerpt: truncateText(row.description_fr, 800),
    description_en_excerpt: truncateText(row.description_en, 800),
    points_of_interest: asArray(row.points_of_interest).slice(0, 5),
    restaurant_info: row.restaurant_info,
    spa_info: row.spa_info,
    amenities: asArray(row.amenities).slice(0, 12),
    signature_experiences: asArray(row.signature_experiences).slice(0, 5),
    awards: asArray(row.awards).slice(0, 5),
  };
}

function classifyPaa(question: string): ClassifiedPaa {
  const q = question.toLowerCase();
  if (!isEditoriallyRelevantPaa(question)) {
    return { question, action: 'reject_noise' };
  }
  if (
    /\b(net worth|worth|fortune|richest|billionaires?|celebrity|celebrities|famous people|kate middleton|meghan markle|johnny cash|bill gates|boyfriend|girlfriend|salary|salaire|star)\b/iu.test(
      q,
    )
  ) {
    return { question, action: 'reject_noise' };
  }
  if (
    /\b(discount|promo|coupon|availability|available|book|booking|reserve|payment|pay|refund|cancel)\b/iu.test(
      q,
    )
  ) {
    return { question, action: 'reject_phase6' };
  }
  if (
    /\b(où|where|near|airport|aeroport|gare|station|distance|quartier|around|adresse|address|location)\b/iu.test(
      q,
    )
  ) {
    return { question, action: 'keep_geo' };
  }
  if (
    /\b(restaurant|chef|menu|bar|tea|spa|pool|piscine|room|suite|photos?|history|histoire|michelin|forbes)\b/iu.test(
      q,
    )
  ) {
    return { question, action: 'keep_section' };
  }
  if (/\b(best|luxury hotels|meilleurs|hotel luxe|palace)\b/iu.test(q)) {
    return { question, action: 'keep_linking' };
  }
  return { question, action: 'keep_faq' };
}

function buildChangePlan(
  row: HotelAuditRow,
  score: SelectionScore,
  grounding: HotelGroundingResult,
): ChangePlan {
  const modify: string[] = [];
  const create: string[] = [];
  const remove: string[] = [];
  const q = score.quality;
  if (score.reasons.includes('meta_title_broken_pipe'))
    modify.push('Corriger le meta title casse.');
  if (score.reasons.includes('faq_language_leak'))
    modify.push('Corriger la langue des questions FAQ FR/EN.');
  if (score.reasons.includes('palace_claim_to_verify'))
    modify.push('Verifier/remplacer le claim "Palace" si aucune source officielle ne le confirme.');
  if (q.externalSourcesCount < 2)
    create.push('Ajouter au moins 2 sources EEAT avant toute reecriture factuelle.');
  if (q.photoCount < 30 || q.photoCategoryCount < 10)
    create.push('Créer un chantier photo : categories manquantes, alt et demandes photos DataSEO.');
  if (q.geoQaCount < 3 && grounding.grounding.peopleAlsoAsk.length > 0)
    create.push('Créer/regenerer geo_qa en dry-run avec PAA utiles.');
  if (q.faqKitCount < 40 && grounding.grounding.peopleAlsoAsk.length > 0)
    create.push('Créer ou re-grounder faq_content_kit et tracer dfs_paa_coverage.');
  if (
    q.factualFrLen < 130 ||
    q.factualFrLen > 150 ||
    q.factualEnLen < 130 ||
    q.factualEnLen > 150
  ) {
    modify.push(
      'Reviser factual_summary seulement si les mots-cles DataSEO apportent un angle factuel.',
    );
  }
  const topKeyword = grounding.grounding.topKeywords[0];
  if (topKeyword !== undefined)
    modify.push(`Verifier title/meta contre le top keyword "${topKeyword.keyword}".`);

  const rejectedQuestions = grounding.grounding.peopleAlsoAsk
    .map(classifyPaa)
    .filter((p) => p.action.startsWith('reject'));
  if (rejectedQuestions.length > 0) {
    remove.push(
      'Exclure des FAQ/geo_qa les PAA bruitées : people, fortune, salaires, booking Phase 6.',
    );
  }
  if (
    row.is_palace !== true &&
    /\bpalace\b/iu.test(`${row.meta_title_fr ?? ''} ${row.meta_desc_fr ?? ''}`)
  ) {
    remove.push('Retirer ou qualifier le terme "Palace" des surfaces publiques si non officiel.');
  }
  if (modify.length === 0 && create.length === 0 && remove.length === 0) {
    modify.push('Fiche stable : garder en observation, pas de rewrite prioritaire.');
  }
  return { modify, create, remove };
}

async function fetchHotels(url: string, key: string, limit: number): Promise<HotelAuditRow[]> {
  const columns = [
    'id',
    'slug',
    'name',
    'name_en',
    'city',
    'district',
    'region',
    'country_code',
    'country_label_fr',
    'country_label_en',
    'stars',
    'is_palace',
    'luxury_tier',
    'meta_title_fr',
    'meta_title_en',
    'meta_desc_fr',
    'meta_desc_en',
    'factual_summary_fr',
    'factual_summary_en',
    'description_fr',
    'description_en',
    'faq_content',
    'faq_content_kit',
    'concierge_questions',
    'geo_qa',
    'long_description_sections',
    'gallery_images',
    'external_sources',
    'google_rating',
    'google_reviews_count',
    'points_of_interest',
    'restaurant_info',
    'spa_info',
    'amenities',
    'signature_experiences',
    'awards',
    'updated_at',
  ].join(',');
  const endpoint = new URL('/rest/v1/hotels', url);
  endpoint.searchParams.set('select', columns);
  endpoint.searchParams.set('is_published', 'eq.true');
  endpoint.searchParams.set('order', 'google_reviews_count.desc.nullslast,slug.asc');
  endpoint.searchParams.set('limit', String(limit));
  const res = await fetch(endpoint, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[audit-dataseo] Supabase fetch failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return z.array(HotelAuditRowSchema).parse(await res.json());
}

async function fetchExplicitHotels(
  url: string,
  key: string,
  slugs: readonly string[],
): Promise<HotelAuditRow[]> {
  if (slugs.length === 0) return [];
  const encoded = slugs.map((slug) => `"${slug.replace(/"/gu, '')}"`).join(',');
  const endpoint = new URL('/rest/v1/hotels', url);
  endpoint.searchParams.set('select', '*');
  endpoint.searchParams.set('slug', `in.(${encoded})`);
  const res = await fetch(endpoint, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `[audit-dataseo] Supabase explicit fetch failed (${res.status}): ${body.slice(0, 300)}`,
    );
  }
  return z.array(HotelAuditRowSchema).parse(await res.json());
}

function selectWave(
  rows: readonly HotelAuditRow[],
  limit: number,
): readonly { readonly row: HotelAuditRow; readonly score: SelectionScore }[] {
  const bySlug = new Map<string, HotelAuditRow>();
  for (const row of rows) bySlug.set(row.slug, row);
  return [...bySlug.values()]
    .map((row) => ({ row, score: selectionScore(row) }))
    .sort((a, b) => {
      if (b.score.score !== a.score.score) return b.score.score - a.score.score;
      return (b.row.google_reviews_count ?? 0) - (a.row.google_reviews_count ?? 0);
    })
    .slice(0, limit);
}

async function mapConcurrent<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  let next = 0;
  async function run(): Promise<void> {
    for (;;) {
      const index = next;
      next += 1;
      const item = items[index];
      if (item === undefined) return;
      out[index] = await worker(item, index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()));
  return out;
}

async function auditOne(
  item: { readonly row: HotelAuditRow; readonly score: SelectionScore },
  index: number,
  total: number,
  refresh: boolean,
): Promise<AuditItem> {
  const dfsCfg = loadDfsConfig();
  if (dfsCfg === null) throw new Error('DataForSEO is disabled or unconfigured.');
  const label = `${index + 1}/${total} ${item.row.slug}`;
  console.log(`[audit-dataseo] ${label}`);
  const grounding = await groundHotel(dfsCfg, toLlmInput(item.row), {
    refresh,
    maxSerpSeeds: 2,
    maxRelatedSeeds: 2,
    relatedLimit: 40,
    intentTopN: 20,
    keepTopKeywords: 20,
  });
  const classified = grounding.grounding.peopleAlsoAsk.map(classifyPaa);
  const useful = classified.filter(
    (p) => p.action !== 'reject_noise' && p.action !== 'reject_phase6',
  );
  return {
    slug: item.row.slug,
    name: item.row.name,
    city: item.row.city,
    countryCode: item.row.country_code,
    score: item.score.score,
    reasons: item.score.reasons,
    quality: item.score.quality,
    grounding: {
      grounded: grounding.grounding.grounded,
      locale: `${grounding.locale.locationName}/${grounding.locale.languageCode}`,
      seeds: grounding.grounding.seeds,
      paaTotal: grounding.grounding.peopleAlsoAsk.length,
      paaUseful: useful.length,
      topKeywords: grounding.grounding.topKeywords.slice(0, 8),
      relatedSearches: grounding.grounding.relatedSearches.slice(0, 8),
    },
    paa: classified.slice(0, 16),
    changes: buildChangePlan(item.row, item.score, grounding),
  };
}

function renderMarkdown(items: readonly AuditItem[], args: Args, generatedAt: string): string {
  const lines: string[] = [];
  lines.push('# Audit DataSEO — vague 100 fiches hotels');
  lines.push('');
  lines.push(`**Date** : ${generatedAt}`);
  lines.push('**Mode** : lecture seule, DataForSEO live avec cache disque, aucune ecriture DB.');
  lines.push(
    `**Parametres** : limit=${args.limit}, candidates=${args.candidateLimit}, concurrency=${args.concurrency}, refresh=${args.refresh ? 'on' : 'off'}.`,
  );
  lines.push('');
  lines.push('## Synthese');
  lines.push('');
  lines.push(`- Fiches auditees : ${items.length}`);
  lines.push(`- Grounding ON : ${items.filter((i) => i.grounding.grounded).length}`);
  lines.push(`- PAA utiles : ${items.reduce((sum, i) => sum + i.grounding.paaUseful, 0)}`);
  lines.push(
    `- Fiches EEAT < 2 sources : ${items.filter((i) => i.quality.externalSourcesCount < 2).length}`,
  );
  lines.push(`- Fiches photos < 30 : ${items.filter((i) => i.quality.photoCount < 30).length}`);
  lines.push(
    `- Fiches categories photo < 10 : ${items.filter((i) => i.quality.photoCategoryCount < 10).length}`,
  );
  lines.push('');
  lines.push('## Tableau prioritaire');
  lines.push('');
  lines.push(
    '| # | Slug | Ville | Score | PAA utiles | Top keyword | Modifier | Créer | Retirer |',
  );
  lines.push('| ---: | --- | --- | ---: | ---: | --- | --- | --- | --- |');
  items.forEach((item, index) => {
    const top = item.grounding.topKeywords[0];
    lines.push(
      `| ${index + 1} | \`${item.slug}\` | ${item.city ?? '-'} | ${item.score} | ${item.grounding.paaUseful} | ${top?.keyword ?? '-'} | ${item.changes.modify.length} | ${item.changes.create.length} | ${item.changes.remove.length} |`,
    );
  });
  lines.push('');
  lines.push('## Detail fiche par fiche');
  for (const item of items) {
    lines.push('');
    lines.push(`### ${item.slug}`);
    lines.push('');
    lines.push(`- **Hotel** : ${item.name} (${item.city ?? '-'}, ${item.countryCode ?? '-'})`);
    lines.push(`- **Score / raisons** : ${item.score} — ${item.reasons.join(', ') || 'stable'}`);
    lines.push(
      `- **Qualite actuelle** : FAQ ${item.quality.faqCount}, geo_qa ${item.quality.geoQaCount}, photos ${item.quality.photoCount}/${item.quality.photoCategoryCount} categories, EEAT ${item.quality.externalSourcesCount}, factual FR/EN ${item.quality.factualFrLen}/${item.quality.factualEnLen}`,
    );
    lines.push(
      `- **DataSEO** : ${item.grounding.locale}, seeds ${item.grounding.seeds.map((s) => `\`${s}\``).join(', ')}, PAA ${item.grounding.paaUseful}/${item.grounding.paaTotal} utiles`,
    );
    if (item.grounding.topKeywords.length > 0) {
      lines.push(
        `- **Top keywords** : ${item.grounding.topKeywords
          .slice(0, 5)
          .map((k) => `${k.keyword}${k.searchVolume === null ? '' : ` (${k.searchVolume}/mo)`}`)
          .join(', ')}`,
      );
    }
    const kept = item.paa.filter((p) => p.action.startsWith('keep')).slice(0, 5);
    const rejected = item.paa.filter((p) => p.action.startsWith('reject')).slice(0, 4);
    if (kept.length > 0) {
      lines.push(
        `- **PAA utiles** : ${kept.map((p) => `${p.question} [${p.action}]`).join(' ; ')}`,
      );
    }
    if (rejected.length > 0) {
      lines.push(
        `- **PAA rejetees** : ${rejected.map((p) => `${p.question} [${p.action}]`).join(' ; ')}`,
      );
    }
    lines.push(`- **À modifier** : ${item.changes.modify.join(' ; ') || 'Rien en priorite.'}`);
    lines.push(`- **À créer** : ${item.changes.create.join(' ; ') || 'Rien en priorite.'}`);
    lines.push(`- **À retirer** : ${item.changes.remove.join(' ; ') || 'Rien en priorite.'}`);
  }
  lines.push('');
  lines.push('## Regles de suite');
  lines.push('');
  lines.push('- Ne pas ecrire en base depuis ce rapport : il sert a prioriser les corrections.');
  lines.push(
    '- Toute regeneration FAQ/geo_qa doit relancer les gates `hasLeak()` et `dfs_paa_coverage`.',
  );
  lines.push('- Toute modification visible doit etre marchee sur FR et EN avant commit.');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const env = SupabaseEnvSchema.parse(process.env);
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/u, '');
  const explicit = args.slugs.length > 0 ? args.slugs : EXPLICIT_WAVE_1A_SLUGS;
  const [candidateRows, explicitRows] = await Promise.all([
    fetchHotels(supabaseUrl, env.SUPABASE_SERVICE_ROLE_KEY, args.candidateLimit),
    fetchExplicitHotels(supabaseUrl, env.SUPABASE_SERVICE_ROLE_KEY, explicit),
  ]);
  const selected = selectWave([...explicitRows, ...candidateRows], args.limit);
  console.log(`[audit-dataseo] selected=${selected.length} candidates=${candidateRows.length}`);
  const items = await mapConcurrent(selected, args.concurrency, (item, index) =>
    auditOne(item, index, selected.length, args.refresh),
  );
  const generatedAt = new Date().toISOString();
  const stamp = generatedAt.replace(/[:.]/gu, '-');
  const outDir = resolve(REPO_ROOT, 'scripts/editorial-pilot/runs');
  await mkdir(outDir, { recursive: true });
  const jsonPath = resolve(outDir, `dataseo-hotel-wave-${args.limit}-${stamp}.json`);
  const mdPath = resolve(outDir, `dataseo-hotel-wave-${args.limit}-${stamp}.md`);
  await writeFile(jsonPath, JSON.stringify({ generatedAt, args, items }, null, 2), 'utf8');
  await writeFile(mdPath, renderMarkdown(items, args, generatedAt), 'utf8');
  console.log(`[audit-dataseo] wrote ${jsonPath}`);
  console.log(`[audit-dataseo] wrote ${mdPath}`);
}

main().catch((err: unknown) => {
  console.error('[audit-dataseo] FATAL', err);
  process.exit(1);
});
