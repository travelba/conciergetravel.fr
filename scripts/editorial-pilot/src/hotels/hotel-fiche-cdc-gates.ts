/**
 * CDC §2 exhaustive audit — 16 blocs + SEO + GEO + agentique + FAQ + maillage + JSON-LD + photos.
 * Complements `hotel-fiche-gates.ts` (T0/T1/T3 editorial) with every CDC v3.0 §2 criterion
 * auditable from Supabase row + room stats + guide catalogue context.
 *
 * Phase 6 (Amadeus booking / Offer JSON-LD) checks are recorded but excluded from score_global.
 */

import {
  buildKitWaveRoomAuditContext,
  countCannibalizingSections,
  countCompleteVenues,
  detectFabricatedStarClaim,
  evaluatePoiBuckets,
  evaluatePoiImages,
  evaluatePoiDedicatedImages,
  evaluateSpaDossier,
  isKitWaveSlug,
  resolvePopulatedBlocks,
} from '@mch/domain/editorial';
import {
  evaluateGalleryAltCategoryCorrespondence,
  evaluatePoiStructuralCorrespondence,
} from '@mch/domain/photos';

import {
  gateFactualSummaryFormat,
  FACTUAL_SUMMARY_MAX_CHARS,
  FACTUAL_SUMMARY_MIN_CHARS,
} from './factual-summary-generator.js';
import {
  countFeaturedFaq,
  countFeaturedFaqTips,
  isFaqCanonicalSet,
} from './canonical-faq-questions.js';
import { CONCIERGE_QUESTIONS_MIN, FAQ_KIT_MIN_ITEMS } from './faq-perplexity-taxonomy.js';
import {
  evaluateFaqKitRowEnrichment,
  hasFaqKitEnrichmentSurface,
} from './faq-kit-row-enrichment.js';
import { ADVICE_BODY_MAX_WORDS, ADVICE_BODY_MIN_WORDS } from './concierge-advice-generator.js';
import {
  evaluateKitAcceptanceGates,
  isHotelKitSlug,
  type KitRoomAuditRow,
} from './kit-fiche-acceptance-gates.js';
import { META_DESC_MAX_CHARS, META_DESC_MIN_CHARS } from './meta-desc-generator.js';
import {
  countWords,
  deriveStatus,
  evaluateHotelFiche,
  type AuditGap,
  type GapSeverity,
  type HotelAuditResult,
  type HotelAuditRow,
  FAQ_ANSWER_MAX_WORDS,
  FAQ_ANSWER_MIN_WORDS,
  FAQ_MIN_ITEMS,
  FEATURED_FAQ_COUNT,
  FEATURED_FAQ_TIPS_MIN,
  LONG_FORM_MIN_WORDS,
  LONG_SECTIONS_MIN_COUNT,
  META_TITLE_MAX_CHARS,
  META_TITLE_MIN_CHARS,
  POIS_MIN_COUNT,
  TRANSPORTS_MIN_COUNT,
  HIGHLIGHTS_MIN_COUNT,
  DESCRIPTION_MIN_CHARS,
} from './hotel-fiche-gates.js';

/* ── CDC thresholds (hotel-detail-page.mdc + photo-quality.mdc) ── */

export const CDC_GALLERY_MIN = 30;
export const PHASE1_GALLERY_MIN = 10;
export const CDC_AMENITIES_MIN = 80;
export const PHASE1_AMENITIES_MIN = 12;
export const CDC_FAQ_MAX_ITEMS = 15;
export const CDC_FAQ_MIN_ITEMS = 10;
export const CDC_FACTUAL_IDEAL_MIN = 130;
export const CDC_FACTUAL_IDEAL_MAX = 150;
export const CDC_LONG_FORM_IDEAL_MAX = 1000;
export const CDC_ROOM_DESC_MIN_WORDS = 200;
export const CDC_ROOM_IMAGES_MIN = 5;
export const ALT_TEXT_MIN_CHARS = 10;
export const ALT_TEXT_MAX_CHARS = 100;
export const CDC_COMPLETE_THRESHOLD = 95;
export const CDC_PARTIAL_THRESHOLD = 70;

/* ── Golden-template thresholds (Airelles reference) ── */
export const GOLDEN_POI_HANDOFF_MIN = 3;
export const GOLDEN_INSTAGRAM_POSTS_MIN = 3;
export const GOOGLE_RATING_MAX = 5;

export const REQUIRED_PHOTO_CATEGORIES = [
  'exterior',
  'lobby',
  'room',
  'dining',
  'spa',
  'pool',
  'view',
  'detail',
  'concierge',
  'events',
] as const;

export type CdcPhase = 'phase1' | 'cdc_target' | 'phase6_deferred';

export type CdcDimension =
  | 'cdc'
  | 'seo'
  | 'geo'
  | 'agent'
  | 'faq'
  | 'maille'
  | 'photo'
  | 'jsonld'
  | 'golden'
  | 'structure';

export interface CdcCheck {
  readonly id: string;
  readonly block: string;
  readonly dimension: CdcDimension;
  readonly phase: CdcPhase;
  readonly passed: boolean;
  readonly severity: GapSeverity;
}

export interface RoomAuditStats {
  readonly total: number;
  readonly withSlug: number;
  readonly indexable: number;
}

export interface CdcHotelAuditRow extends HotelAuditRow {
  readonly slug_en: string | null;
  readonly name_en: string | null;
  readonly stars: number | null;
  readonly is_palace: boolean | null;
  readonly city: string | null;
  readonly district: string | null;
  readonly address: string | null;
  readonly postal_code: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly phone_e164: string | null;
  readonly email_reservations: string | null;
  readonly google_rating: number | null;
  readonly google_reviews_count: number | null;
  readonly google_reviews: unknown;
  readonly last_reviews_sync: string | null;
  readonly featured_reviews: unknown;
  readonly mice_info: unknown;
  readonly hero_video: unknown;
  readonly virtual_tour_url: string | null;
  readonly booking_mode: string | null;
  readonly number_of_suites: number | null;
  readonly wikipedia_url_fr: string | null;
  readonly wikipedia_url_en: string | null;
  readonly external_sameas: unknown;
  readonly upcoming_events: unknown;
  readonly instagram: unknown;
  readonly concierge_pick: unknown;
  readonly concierge_hook: unknown;
  readonly external_sources: unknown;
}

export interface CdcAuditContext {
  readonly roomStats: RoomAuditStats;
  readonly guideSlug: string | null;
  /** Per-room slug + image count — required for kit acceptance gates (D15). */
  readonly kitRoomRows: readonly KitRoomAuditRow[];
}

export interface DimensionScore {
  readonly passed: number;
  readonly total: number;
  readonly score: number;
}

export interface BlockScore {
  readonly block: string;
  readonly label: string;
  readonly passed: number;
  readonly total: number;
  readonly score: number;
}

export interface CdcHotelAuditResult extends HotelAuditResult {
  readonly score_cdc: number;
  readonly score_cdc_phase1: number;
  readonly score_seo: number;
  readonly score_geo: number;
  readonly score_agent: number;
  readonly score_faq: number;
  readonly score_maille: number;
  readonly score_photo: number;
  readonly score_jsonld: number;
  readonly score_golden: number;
  readonly score_structure: number;
  readonly score_global: number;
  readonly status_cdc: ReturnType<typeof deriveStatus>;
  readonly blocks: readonly BlockScore[];
  readonly dimensions: Readonly<Record<CdcDimension, DimensionScore>>;
  readonly cdc_checks: readonly CdcCheck[];
  readonly cdc_gaps: readonly AuditGap[];
  readonly guide_slug: string | null;
  readonly room_stats: RoomAuditStats;
}

const BLOCK_LABELS: Readonly<Record<string, string>> = {
  '01': 'En-tête identité',
  '02': 'Galerie média',
  '03': 'Résumé factuel',
  '04': 'Description longue',
  '05': 'Chambres / sous-pages',
  '06': 'Équipements & services',
  '07': 'Localisation & accès',
  '08': 'Tarifs & réservation',
  '09': 'Politiques',
  '10': 'Avis clients',
  '11': 'FAQ structurée',
  '12': 'Guide local (teaser)',
  '13': 'Réassurance & autorité',
  '14': 'MICE / groupes',
  '15': 'Footer fiche (NAP)',
  '16': 'Conseil du Concierge',
  seo: 'SEO technique',
  geo: 'GEO / AEO',
  agent: 'Surfaces agentiques',
  maille: 'Maillage interne / EEAT',
  photo: 'Photos Phase 1 + CDC',
  jsonld: 'Prérequis JSON-LD',
  gold: 'Golden template (handoff)',
  struct: 'Restructuration',
};

function jsonLen(v: unknown): number {
  return Array.isArray(v) ? v.length : 0;
}

function strLen(v: string | null | undefined): number {
  return v?.length ?? 0;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function wordBand(text: string | null | undefined, min: number, max: number): boolean {
  if (text === null || text === undefined || text.trim().length === 0) return false;
  const n = countWords(text);
  return n >= min && n <= max;
}

function longFormWords(row: CdcHotelAuditRow): number {
  const sections = row.long_description_sections ?? [];
  let total = 0;
  for (const s of sections) {
    if (typeof s.body_fr === 'string') total += countWords(s.body_fr);
  }
  if (total === 0 && typeof row.description_fr === 'string') {
    total = countWords(row.description_fr);
  }
  return total;
}

function validLongSections(row: CdcHotelAuditRow): number {
  return (row.long_description_sections ?? []).filter((s) => {
    const hasTitle =
      (typeof s.title_fr === 'string' && s.title_fr.trim().length > 0) ||
      (typeof s.title_en === 'string' && s.title_en.trim().length > 0);
    const hasBody =
      (typeof s.body_fr === 'string' && s.body_fr.trim().length > 0) ||
      (typeof s.body_en === 'string' && s.body_en.trim().length > 0);
    return hasTitle && hasBody;
  }).length;
}

function countAmenities(row: CdcHotelAuditRow): number {
  if (!Array.isArray(row.amenities)) return 0;
  return row.amenities.length;
}

function countPoisWithDistance(row: CdcHotelAuditRow): number {
  if (!Array.isArray(row.points_of_interest)) return 0;
  return row.points_of_interest.filter((item) => {
    if (!isRecord(item)) return false;
    return (
      typeof item['distance_meters'] === 'number' ||
      typeof item['distance_km'] === 'number' ||
      (typeof item['distance_fr'] === 'string' && item['distance_fr'].length > 0)
    );
  }).length;
}

function countHighlights(row: CdcHotelAuditRow): number {
  if (!Array.isArray(row.highlights)) return 0;
  return row.highlights.filter((item) => {
    if (typeof item === 'string') return item.trim().length > 0;
    if (isRecord(item)) {
      const fr = item['label_fr'] ?? item['name_fr'];
      const en = item['label_en'] ?? item['name_en'];
      return (
        (typeof fr === 'string' && fr.trim().length > 0) ||
        (typeof en === 'string' && en.trim().length > 0)
      );
    }
    return false;
  }).length;
}

function policiesSynthetic(row: CdcHotelAuditRow): boolean {
  return row.policies !== null && row.policies['_synthetic'] === true;
}

function policiesCoreBlocks(row: CdcHotelAuditRow): boolean {
  if (row.policies === null) return false;
  return ['check_in', 'check_out', 'cancellation', 'pets', 'wifi'].every((k) => {
    const block = row.policies?.[k];
    return block !== null && block !== undefined && typeof block === 'object';
  });
}

function countVerifiedAwards(row: CdcHotelAuditRow): number {
  if (!Array.isArray(row.awards)) return 0;
  return row.awards.filter((a) => isRecord(a) && a['verified'] === true).length;
}

function countUnverifiedAwards(row: CdcHotelAuditRow): number {
  if (!Array.isArray(row.awards)) return 0;
  return row.awards.filter((a) => isRecord(a) && a['verified'] === false).length;
}

function countVerifiedAffiliations(row: CdcHotelAuditRow): number {
  if (!Array.isArray(row.affiliations)) return 0;
  return row.affiliations.filter((a) => isRecord(a) && a['verified'] === true).length;
}

function hasGmbReviewRows(row: CdcHotelAuditRow): boolean {
  if (!Array.isArray(row.google_reviews)) return false;
  return row.google_reviews.some((entry) => {
    if (!isRecord(entry)) return false;
    const author = entry['author'];
    const text = entry['text'];
    return (
      typeof author === 'string' &&
      author.trim().length > 0 &&
      typeof text === 'string' &&
      text.trim().length > 0
    );
  });
}

function hasReviewsSignal(row: CdcHotelAuditRow): boolean {
  if (hasGmbReviewRows(row)) return true;
  const gr = row.google_rating;
  const gc = row.google_reviews_count;
  if (typeof gr === 'number' && gr > 0) return true;
  if (typeof gc === 'number' && gc > 0) return true;
  const kitLen = jsonLen(row.faq_content_kit);
  if (hasFaqKitEnrichmentSurface(kitLen)) return false;
  return jsonLen(row.featured_reviews) > 0;
}

function faqAllHaveEn(row: CdcHotelAuditRow): boolean {
  const items = row.faq_content ?? [];
  if (items.length < FAQ_MIN_ITEMS) return false;
  return items.every((it) => typeof it.answer_en === 'string' && it.answer_en.trim().length > 0);
}

function faqAnswersInBand(row: CdcHotelAuditRow): boolean {
  const items = row.faq_content ?? [];
  if (items.length < FAQ_MIN_ITEMS) return false;
  return items.every((it) => wordBand(it.answer_fr, FAQ_ANSWER_MIN_WORDS, FAQ_ANSWER_MAX_WORDS));
}

function conciergePrefixOk(body: string | undefined, lang: 'fr' | 'en'): boolean {
  if (body === undefined || body.trim().length === 0) return false;
  const trimmed = body.trimStart();
  if (lang === 'fr')
    return trimmed.startsWith('Mon conseil :') || trimmed.startsWith('Mon conseil:');
  return trimmed.startsWith('My tip:') || trimmed.startsWith('My tip :');
}

interface GalleryAnalysis {
  readonly count: number;
  readonly categories: ReadonlySet<string>;
  readonly missingCategories: readonly string[];
  readonly missingAltFr: number;
  readonly missingAltEn: number;
  readonly genericAlt: number;
  readonly pinterestHotlinks: number;
  readonly officialHotlinks: number;
  readonly missingCaption: number;
  readonly invalidCloudinaryIds: number;
}

function analyzeGallery(row: CdcHotelAuditRow): GalleryAnalysis {
  const categories = new Set<string>();
  let missingAltFr = 0;
  let missingAltEn = 0;
  let genericAlt = 0;
  let pinterestHotlinks = 0;
  let officialHotlinks = 0;
  let missingCaption = 0;
  let invalidCloudinaryIds = 0;
  const items = Array.isArray(row.gallery_images) ? row.gallery_images : [];
  const hotelName = row.name.toLowerCase();

  for (const item of items) {
    if (!isRecord(item)) continue;
    const cat = item['category'];
    if (typeof cat === 'string' && cat.length > 0) categories.add(cat);

    const altFr = item['alt_fr'];
    const altEn = item['alt_en'];
    const caption = item['caption'];
    const url = item['url'];
    const publicId = item['public_id'];

    if (typeof url === 'string') {
      if (url.includes('i.pinimg.com')) pinterestHotlinks += 1;
      if (/^https?:\/\/www\.[^/]+\.(com|fr|net)/iu.test(url) && !url.includes('wikimedia'))
        officialHotlinks += 1;
      if (typeof caption !== 'string' || caption.trim().length === 0) missingCaption += 1;
    }

    if (typeof publicId === 'string') {
      if (!publicId.startsWith('cct/hotels/')) invalidCloudinaryIds += 1;
    }

    const alt = typeof altFr === 'string' ? altFr : typeof caption === 'string' ? caption : '';
    if (alt.length < ALT_TEXT_MIN_CHARS) missingAltFr += 1;
    else if (alt.length > ALT_TEXT_MAX_CHARS) missingAltFr += 1;
    else if (
      /^(photo|image|piscine|chambre|lobby)$/iu.test(alt.trim()) ||
      (alt.length < 20 && !alt.toLowerCase().includes(hotelName.slice(0, 6)))
    ) {
      genericAlt += 1;
    }

    if (typeof altEn !== 'string' || altEn.length < ALT_TEXT_MIN_CHARS) missingAltEn += 1;
  }

  const missingCategories = REQUIRED_PHOTO_CATEGORIES.filter((c) => !categories.has(c));

  return {
    count: items.length,
    categories,
    missingCategories,
    missingAltFr,
    missingAltEn,
    genericAlt,
    pinterestHotlinks,
    officialHotlinks,
    missingCaption,
    invalidCloudinaryIds,
  };
}

function sameAsCount(row: CdcHotelAuditRow): number {
  if (Array.isArray(row.external_sameas)) return row.external_sameas.length;
  if (isRecord(row.external_sameas)) return Object.keys(row.external_sameas).length;
  return 0;
}

/* ── Golden-template helpers ── */

function nonEmptyStr(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** Narrative strings used by the fabricated-distinction sentinel. */
function narrativeTexts(row: CdcHotelAuditRow): string[] {
  const out: string[] = [];
  if (nonEmptyStr(row.description_fr)) out.push(row.description_fr);
  if (nonEmptyStr(row.description_en)) out.push(row.description_en);
  for (const s of row.long_description_sections ?? []) {
    if (nonEmptyStr(s.title_fr)) out.push(s.title_fr);
    if (nonEmptyStr(s.title_en)) out.push(s.title_en);
    if (nonEmptyStr(s.body_fr)) out.push(s.body_fr);
    if (nonEmptyStr(s.body_en)) out.push(s.body_en);
  }
  if (Array.isArray(row.signature_experiences)) {
    out.push(JSON.stringify(row.signature_experiences));
  }
  return out;
}

interface EventsAnalysis {
  readonly count: number;
  readonly withImage: number;
}

function analyzeEvents(row: CdcHotelAuditRow): EventsAnalysis {
  const items = Array.isArray(row.upcoming_events) ? row.upcoming_events : [];
  let withImage = 0;
  for (const e of items) {
    if (isRecord(e) && (nonEmptyStr(e['image_url']) || nonEmptyStr(e['imageUrl']))) withImage += 1;
  }
  return { count: items.length, withImage };
}

/** Gallery items carrying provenance metadata (credit → ImageObject creditText). */
function galleryWithCredit(row: CdcHotelAuditRow): number {
  const items = Array.isArray(row.gallery_images) ? row.gallery_images : [];
  return items.filter((it) => isRecord(it) && nonEmptyStr(it['credit'])).length;
}

function instagramPostCount(row: CdcHotelAuditRow): number {
  const ig = isRecord(row.instagram) ? row.instagram : null;
  if (ig === null) return 0;
  return Array.isArray(ig['posts']) ? (ig['posts'] as unknown[]).length : 0;
}

/** Kit fiches: warn/info golden/photo gates become blockers (D19). */
function severityForKitSlug(slug: string, base: GapSeverity): GapSeverity {
  if (!isHotelKitSlug(slug)) return base;
  if (base === 'blocker') return 'blocker';
  return 'blocker';
}

function hasConciergeField(value: unknown): boolean {
  if (nonEmptyStr(value)) return true;
  if (isRecord(value)) {
    return Object.values(value).some((v) => nonEmptyStr(v));
  }
  return false;
}

function googleRatingScaleOk(row: CdcHotelAuditRow): boolean {
  const r = row.google_rating;
  if (typeof r !== 'number' || r <= 0) return true; // absent → not a scale error
  return r <= GOOGLE_RATING_MAX;
}

/** Minimum EEAT external sources for a citable provenance footer (CDC §2 bloc 13bis). */
export const EEAT_SOURCES_MIN = 2;

/** A jsonb value is "present" — non-empty string, or any non-null object/number. */
function presentValue(v: unknown): boolean {
  if (typeof v === 'string') return v.trim().length > 0;
  if (typeof v === 'number') return Number.isFinite(v);
  return v !== null && v !== undefined && typeof v === 'object';
}

/** BreadcrumbList JSON-LD trail prereqs (Home › Country › City › Hotel). */
function hasBreadcrumbTrail(row: CdcHotelAuditRow): boolean {
  return (
    typeof row.city === 'string' &&
    row.city.trim().length > 0 &&
    typeof row.country_code === 'string' &&
    row.country_code.trim().length > 0
  );
}

/**
 * Hotel / LodgingBusiness core node completeness: starRating + amenityFeature
 * + checkinTime/checkoutTime (from policies). Drives a non-thin Hotel JSON-LD.
 */
function hasHotelCoreNode(row: CdcHotelAuditRow): boolean {
  if (typeof row.stars !== 'number') return false;
  if (countAmenities(row) === 0) return false;
  if (row.policies === null) return false;
  return ['check_in', 'check_out'].every((k) => {
    const block = row.policies?.[k];
    return block !== null && block !== undefined && typeof block === 'object';
  });
}

/**
 * Event JSON-LD validity — only meaningful when `upcoming_events` is present.
 * Each event needs a name, a start date and a location (absence of events is a
 * separate `gold.events` info check, not a JSON-LD error).
 */
function eventsJsonLdOk(row: CdcHotelAuditRow): boolean {
  const items = Array.isArray(row.upcoming_events) ? row.upcoming_events : [];
  if (items.length === 0) return true;
  return items.every((e) => {
    if (!isRecord(e)) return false;
    const name =
      e['name_fr'] ?? e['name_en'] ?? e['title_fr'] ?? e['title_en'] ?? e['name'] ?? e['title'];
    const start =
      e['start_date'] ?? e['startDate'] ?? e['date'] ?? e['date_start'] ?? e['date_iso'];
    const loc = e['location'] ?? e['venue'] ?? e['place'] ?? e['address'] ?? e['venue_name'];
    return presentValue(name) && presentValue(start) && presentValue(loc);
  });
}

/**
 * Review JSON-LD validity — only meaningful when `featured_reviews` is present.
 * Each review needs an author, a review body (FR or EN quote) and a source.
 */
function reviewsJsonLdOk(row: CdcHotelAuditRow): boolean {
  const items = Array.isArray(row.featured_reviews) ? row.featured_reviews : [];
  if (items.length === 0) return true;
  return items.every((r) => {
    if (!isRecord(r)) return false;
    const author = r['author'];
    const quote = r['quote_fr'] ?? r['quote_en'] ?? r['body_fr'] ?? r['body_en'];
    const source = r['source'] ?? r['source_name'];
    return presentValue(author) && presentValue(quote) && presentValue(source);
  });
}

/** Count EEAT external-source entries carrying a field + a source label. */
function countEeatSources(row: CdcHotelAuditRow): number {
  if (!Array.isArray(row.external_sources)) return 0;
  return row.external_sources.filter(
    (s) => isRecord(s) && presentValue(s['field']) && presentValue(s['source']),
  ).length;
}

/** EN hreflang alternate is complete (name + slug + meta title + meta desc). */
function hreflangPairComplete(row: CdcHotelAuditRow): boolean {
  return [row.name_en, row.slug_en, row.meta_title_en, row.meta_desc_en].every(
    (v) => typeof v === 'string' && v.trim().length > 0,
  );
}

interface CheckBuilder {
  readonly checks: CdcCheck[];
  readonly gaps: AuditGap[];
}

function addCdcCheck(
  b: CheckBuilder,
  opts: {
    id: string;
    block: string;
    dimension: CdcDimension;
    phase: CdcPhase;
    passed: boolean;
    severity: GapSeverity;
    field: string;
    message: string;
    pipeline: string;
  },
): void {
  b.checks.push({
    id: opts.id,
    block: opts.block,
    dimension: opts.dimension,
    phase: opts.phase,
    passed: opts.passed,
    severity: opts.severity,
  });
  if (!opts.passed && opts.phase !== 'phase6_deferred') {
    b.gaps.push({
      field: opts.field,
      severity: opts.severity,
      message: opts.message,
      pipeline: opts.pipeline,
    });
  }
}

function scoreChecks(
  checks: readonly CdcCheck[],
  filter: (c: CdcCheck) => boolean,
): DimensionScore {
  const subset = checks.filter(filter);
  if (subset.length === 0) return { passed: 0, total: 0, score: 100 };
  const passed = subset.filter((c) => c.passed).length;
  return {
    passed,
    total: subset.length,
    score: Math.round((passed / subset.length) * 100),
  };
}

function buildBlockScores(checks: readonly CdcCheck[]): BlockScore[] {
  const byBlock = new Map<string, { passed: number; total: number }>();
  for (const c of checks) {
    if (c.phase === 'phase6_deferred') continue;
    const acc = byBlock.get(c.block) ?? { passed: 0, total: 0 };
    acc.total += 1;
    if (c.passed) acc.passed += 1;
    byBlock.set(c.block, acc);
  }
  return [...byBlock.entries()]
    .map(([block, stats]) => ({
      block,
      label: BLOCK_LABELS[block] ?? block,
      passed: stats.passed,
      total: stats.total,
      score: stats.total === 0 ? 100 : Math.round((stats.passed / stats.total) * 100),
    }))
    .sort((a, b) => a.block.localeCompare(b.block));
}

export function evaluateCdcHotelFiche(
  row: CdcHotelAuditRow,
  ctx: CdcAuditContext,
): CdcHotelAuditResult {
  const base = evaluateHotelFiche(row);
  const b: CheckBuilder = { checks: [], gaps: [] };
  const gallery = analyzeGallery(row);
  const longWords = longFormWords(row);
  const sectionCount = validLongSections(row);
  const amenityCount = countAmenities(row);
  const poiCount = countPoisWithDistance(row);
  const hlCount = countHighlights(row);
  const faqLen = jsonLen(row.faq_content);

  /* ── Bloc 1 — En-tête identité ── */
  addCdcCheck(b, {
    id: 'cdc.01.stars',
    block: '01',
    dimension: 'cdc',
    phase: 'cdc_target',
    passed: (row.stars !== null && row.stars >= 1) || row.is_palace === true,
    severity: 'blocker',
    field: 'stars',
    message: 'stars missing (required for HotelHeader + JSON-LD)',
    pipeline: 'back-office / seed',
  });
  addCdcCheck(b, {
    id: 'cdc.01.name_en',
    block: '01',
    dimension: 'seo',
    phase: 'cdc_target',
    passed: typeof row.name_en === 'string' && row.name_en.length > 0,
    severity: 'warn',
    field: 'name_en',
    message: 'name_en missing (hreflang / EN H1)',
    pipeline: 'seed-tier1-content.ts',
  });
  addCdcCheck(b, {
    id: 'cdc.01.slug_en',
    block: '01',
    dimension: 'seo',
    phase: 'cdc_target',
    passed: typeof row.slug_en === 'string' && row.slug_en.length > 0,
    severity: 'info',
    field: 'slug_en',
    message: 'slug_en missing',
    pipeline: 'ADR-0008 flat slug — optional if identical',
  });
  addCdcCheck(b, {
    id: 'cdc.01.address',
    block: '01',
    dimension: 'cdc',
    phase: 'cdc_target',
    passed: typeof row.address === 'string' && row.address.length > 5,
    severity: 'blocker',
    field: 'address',
    message: 'address missing (NAP + Place JSON-LD)',
    pipeline: 'geocode:hotels / Wikidata',
  });
  addCdcCheck(b, {
    id: 'cdc.01.postal_code',
    block: '15',
    dimension: 'cdc',
    phase: 'cdc_target',
    passed: typeof row.postal_code === 'string' && row.postal_code.length > 0,
    severity: 'warn',
    field: 'postal_code',
    message: 'postal_code missing (NAP / GBP parity)',
    pipeline: 'geocode:hotels',
  });
  addCdcCheck(b, {
    id: 'cdc.01.phone',
    block: '15',
    dimension: 'cdc',
    phase: 'cdc_target',
    passed: typeof row.phone_e164 === 'string' && row.phone_e164.length > 8,
    severity: 'warn',
    field: 'phone_e164',
    message: 'phone_e164 missing (NAP footer)',
    pipeline: 'Google Places / Tavily',
  });
  addCdcCheck(b, {
    id: 'cdc.01.city',
    block: '01',
    dimension: 'maille',
    phase: 'cdc_target',
    passed: typeof row.city === 'string' && row.city.length > 0,
    severity: 'blocker',
    field: 'city',
    message: 'city missing (breadcrumb + destination hub)',
    pipeline: 'seed / back-office',
  });

  /* ── Bloc 2 — Galerie média ── */
  addCdcCheck(b, {
    id: 'cdc.02.hero',
    block: '02',
    dimension: 'photo',
    phase: 'phase1',
    passed: typeof row.hero_image === 'string' && row.hero_image.length > 0,
    severity: 'blocker',
    field: 'hero_image',
    message: 'hero_image missing',
    pipeline: 'photos:sync / photos-sync-intl',
  });
  addCdcCheck(b, {
    id: 'cdc.02.gallery_phase1',
    block: '02',
    dimension: 'photo',
    phase: 'phase1',
    passed: gallery.count >= PHASE1_GALLERY_MIN,
    severity: 'blocker',
    field: 'gallery_images',
    message: `${gallery.count} photos (Phase 1 min ${PHASE1_GALLERY_MIN})`,
    pipeline: 'photos:sync',
  });
  addCdcCheck(b, {
    id: 'cdc.02.gallery_cdc',
    block: '02',
    dimension: 'photo',
    phase: 'cdc_target',
    passed: gallery.count >= CDC_GALLERY_MIN,
    severity: 'blocker',
    field: 'gallery_images',
    message: `${gallery.count} photos (CDC min ${CDC_GALLERY_MIN})`,
    pipeline: 'photos:sync Phase 2',
  });
  addCdcCheck(b, {
    id: 'cdc.02.categories_10',
    block: '02',
    dimension: 'photo',
    phase: 'phase1',
    passed: gallery.missingCategories.length === 0,
    severity: 'blocker',
    field: 'gallery_images.category',
    message: `missing photo categories: ${gallery.missingCategories.join(', ')}`,
    pipeline: 'categorize-with-vision.ts',
  });
  addCdcCheck(b, {
    id: 'cdc.02.alt_fr',
    block: '02',
    dimension: 'photo',
    phase: 'phase1',
    passed: gallery.count === 0 || gallery.missingAltFr === 0,
    severity: 'blocker',
    field: 'gallery_images.alt_fr',
    message: `${gallery.missingAltFr} gallery items missing valid alt_fr (${ALT_TEXT_MIN_CHARS}-${ALT_TEXT_MAX_CHARS} chars)`,
    pipeline: 'alt enrichment pipeline',
  });
  addCdcCheck(b, {
    id: 'cdc.02.alt_en',
    block: '02',
    dimension: 'photo',
    phase: 'cdc_target',
    passed: gallery.count === 0 || gallery.missingAltEn === 0,
    severity: 'warn',
    field: 'gallery_images.alt_en',
    message: `${gallery.missingAltEn} gallery items missing alt_en`,
    pipeline: 'alt enrichment pipeline',
  });
  addCdcCheck(b, {
    id: 'cdc.02.alt_enriched',
    block: '02',
    dimension: 'geo',
    phase: 'cdc_target',
    passed: gallery.genericAlt === 0,
    severity: 'warn',
    field: 'gallery_images.alt',
    message: `${gallery.genericAlt} generic alts (Hard Rule 16 — keyword + hotel context)`,
    pipeline: 'alt enrichment pipeline',
  });
  addCdcCheck(b, {
    id: 'cdc.02.no_pinterest',
    block: '02',
    dimension: 'photo',
    phase: 'phase1',
    passed: gallery.pinterestHotlinks === 0,
    severity: 'blocker',
    field: 'gallery_images.url',
    message: `${gallery.pinterestHotlinks} Pinterest hotlinks (illegal)`,
    pipeline: 'photos:sync — Cloudinary migration',
  });
  addCdcCheck(b, {
    id: 'cdc.02.hero_video',
    block: '02',
    dimension: 'cdc',
    phase: 'cdc_target',
    passed: row.hero_video !== null && row.hero_video !== undefined,
    severity: 'warn',
    field: 'hero_video',
    message: 'hero_video missing (CDC ≥ 30 s VideoObject)',
    pipeline: 'photo / video pipeline Phase 2',
  });
  addCdcCheck(b, {
    id: 'cdc.02.virtual_tour',
    block: '02',
    dimension: 'cdc',
    phase: 'cdc_target',
    passed: typeof row.virtual_tour_url === 'string' && row.virtual_tour_url.length > 0,
    severity: 'info',
    field: 'virtual_tour_url',
    message: 'virtual_tour_url missing (360° tour)',
    pipeline: 'Matterport / official site extract',
  });
  addCdcCheck(b, {
    id: 'cdc.02.imageobject_caption',
    block: '02',
    dimension: 'jsonld',
    phase: 'cdc_target',
    passed: gallery.missingCaption === 0,
    severity: 'warn',
    field: 'gallery_images.caption',
    message: `${gallery.missingCaption} external gallery entries without caption (ImageObject)`,
    pipeline: 'photos-sync-intl',
  });

  /* ── Bloc 3 — Résumé factuel ── */
  const fsFr = row.factual_summary_fr ?? '';
  const fsEn = row.factual_summary_en ?? '';
  addCdcCheck(b, {
    id: 'cdc.03.factual_fr_band',
    block: '03',
    dimension: 'geo',
    phase: 'phase1',
    passed: fsFr.length >= FACTUAL_SUMMARY_MIN_CHARS && fsFr.length <= FACTUAL_SUMMARY_MAX_CHARS,
    severity: 'blocker',
    field: 'factual_summary_fr',
    message: `factual_summary_fr ${fsFr.length} chars (prod ${FACTUAL_SUMMARY_MIN_CHARS}-${FACTUAL_SUMMARY_MAX_CHARS})`,
    pipeline: 'run-hotel-factual-summary.ts',
  });
  addCdcCheck(b, {
    id: 'cdc.03.factual_en_band',
    block: '03',
    dimension: 'geo',
    phase: 'phase1',
    passed: fsEn.length >= FACTUAL_SUMMARY_MIN_CHARS && fsEn.length <= FACTUAL_SUMMARY_MAX_CHARS,
    severity: 'blocker',
    field: 'factual_summary_en',
    message: `factual_summary_en ${fsEn.length} chars`,
    pipeline: 'run-hotel-factual-summary.ts',
  });
  addCdcCheck(b, {
    id: 'cdc.03.factual_ideal',
    block: '03',
    dimension: 'geo',
    phase: 'cdc_target',
    passed: fsFr.length >= CDC_FACTUAL_IDEAL_MIN && fsFr.length <= CDC_FACTUAL_IDEAL_MAX,
    severity: 'warn',
    field: 'factual_summary_fr',
    message: `factual_summary_fr ${fsFr.length} chars (CDC ideal ${CDC_FACTUAL_IDEAL_MIN}-${CDC_FACTUAL_IDEAL_MAX})`,
    pipeline: 'run-hotel-factual-summary.ts',
  });
  addCdcCheck(b, {
    id: 'cdc.03.factual_format',
    block: '03',
    dimension: 'geo',
    phase: 'cdc_target',
    passed:
      fsFr.length >= FACTUAL_SUMMARY_MIN_CHARS &&
      gateFactualSummaryFormat({ fr: fsFr, en: fsEn }) === null,
    severity: 'blocker',
    field: 'factual_summary',
    message:
      gateFactualSummaryFormat({ fr: fsFr, en: fsEn }) ??
      'factual format invalid (CDC §2.3 template)',
    pipeline: 'run-hotel-factual-summary.ts',
  });

  /* ── Bloc 4 — Description longue ── */
  addCdcCheck(b, {
    id: 'cdc.04.sections',
    block: '04',
    dimension: 'cdc',
    phase: 'phase1',
    passed: sectionCount >= LONG_SECTIONS_MIN_COUNT,
    severity: 'blocker',
    field: 'long_description_sections',
    message: `${sectionCount} sections (need ≥ ${LONG_SECTIONS_MIN_COUNT})`,
    pipeline: 'editorial 8-pass',
  });
  addCdcCheck(b, {
    id: 'cdc.04.words_min',
    block: '04',
    dimension: 'cdc',
    phase: 'phase1',
    passed: longWords >= LONG_FORM_MIN_WORDS,
    severity: 'blocker',
    field: 'long_description_sections',
    message: `${longWords} words FR (min ${LONG_FORM_MIN_WORDS})`,
    pipeline: 'editorial 8-pass',
  });
  addCdcCheck(b, {
    id: 'cdc.04.words_ideal',
    block: '04',
    dimension: 'cdc',
    phase: 'cdc_target',
    passed: longWords >= LONG_FORM_MIN_WORDS && longWords <= CDC_LONG_FORM_IDEAL_MAX,
    severity: 'warn',
    field: 'long_description_sections',
    message: `${longWords} words (CDC ideal ${LONG_FORM_MIN_WORDS}-${CDC_LONG_FORM_IDEAL_MAX})`,
    pipeline: 'editorial 8-pass',
  });
  addCdcCheck(b, {
    id: 'cdc.04.description_fr',
    block: '04',
    dimension: 'cdc',
    phase: 'phase1',
    passed: strLen(row.description_fr) >= DESCRIPTION_MIN_CHARS,
    severity: 'blocker',
    field: 'description_fr',
    message: `description_fr ${strLen(row.description_fr)} chars`,
    pipeline: 'run-hotel-description-extend.ts',
  });
  addCdcCheck(b, {
    id: 'cdc.04.description_en',
    block: '04',
    dimension: 'cdc',
    phase: 'phase1',
    passed: strLen(row.description_en) >= DESCRIPTION_MIN_CHARS,
    severity: 'blocker',
    field: 'description_en',
    message: `description_en ${strLen(row.description_en)} chars`,
    pipeline: 'run-hotel-description-extend.ts',
  });
  addCdcCheck(b, {
    id: 'cdc.04.highlights',
    block: '04',
    dimension: 'geo',
    phase: 'cdc_target',
    passed: hlCount >= HIGHLIGHTS_MIN_COUNT,
    severity: 'warn',
    field: 'highlights',
    message: `${hlCount} highlights (need ≥ ${HIGHLIGHTS_MIN_COUNT})`,
    pipeline: 'enrichment pipeline',
  });

  /* ── Bloc 5 — Chambres ── */
  addCdcCheck(b, {
    id: 'cdc.05.rooms_rows',
    block: '05',
    dimension: 'cdc',
    phase: 'cdc_target',
    passed: ctx.roomStats.total >= 1,
    severity: 'blocker',
    field: 'hotel_rooms',
    message: `0 rows in hotel_rooms (RoomCardList placeholder)`,
    pipeline: 'room catalog seed / Payload',
  });
  addCdcCheck(b, {
    id: 'cdc.05.rooms_indexable',
    block: '05',
    dimension: 'cdc',
    phase: 'cdc_target',
    passed: ctx.roomStats.indexable >= 1,
    severity: 'blocker',
    field: 'hotel_rooms.indexable',
    message: `${ctx.roomStats.indexable} indexable room sub-pages (need ≥1 with slug + 200 words + 5 photos)`,
    pipeline: 'ADR-0009 room sub-page enrichment',
  });
  addCdcCheck(b, {
    id: 'cdc.05.number_of_rooms',
    block: '05',
    dimension: 'cdc',
    phase: 'cdc_target',
    passed: row.number_of_rooms !== null && row.number_of_rooms > 0,
    severity: 'warn',
    field: 'number_of_rooms',
    message: 'number_of_rooms metadata missing',
    pipeline: 'Wikidata / Tavily',
  });

  /* ── Bloc 6 — Équipements ── */
  addCdcCheck(b, {
    id: 'cdc.06.amenities_present',
    block: '06',
    dimension: 'cdc',
    phase: 'phase1',
    passed: amenityCount >= 1,
    severity: 'blocker',
    field: 'amenities',
    message: 'amenities empty (placeholder on live page)',
    pipeline: 'amenities enrichment',
  });
  addCdcCheck(b, {
    id: 'cdc.06.amenities_phase1',
    block: '06',
    dimension: 'cdc',
    phase: 'phase1',
    passed: amenityCount >= PHASE1_AMENITIES_MIN,
    severity: 'warn',
    field: 'amenities',
    message: `${amenityCount} amenities (Phase 1 min ${PHASE1_AMENITIES_MIN})`,
    pipeline: 'amenities enrichment',
  });
  addCdcCheck(b, {
    id: 'cdc.06.amenities_cdc',
    block: '06',
    dimension: 'cdc',
    phase: 'cdc_target',
    passed: amenityCount >= CDC_AMENITIES_MIN,
    severity: 'blocker',
    field: 'amenities',
    message: `${amenityCount} amenities (CDC min ${CDC_AMENITIES_MIN})`,
    pipeline: 'amenities enrichment + taxonomy',
  });

  /* ── Bloc 7 — Localisation ── */
  addCdcCheck(b, {
    id: 'cdc.07.gps',
    block: '07',
    dimension: 'cdc',
    phase: 'cdc_target',
    passed: typeof row.latitude === 'number' && typeof row.longitude === 'number',
    severity: 'blocker',
    field: 'latitude|longitude',
    message: 'GPS coordinates missing (HotelMap + GeoCoordinates JSON-LD)',
    pipeline: 'geocode:hotels',
  });
  addCdcCheck(b, {
    id: 'cdc.07.pois',
    block: '07',
    dimension: 'geo',
    phase: 'cdc_target',
    passed: poiCount >= POIS_MIN_COUNT,
    severity: 'warn',
    field: 'points_of_interest',
    message: `${poiCount} POIs with distance (need ≥ ${POIS_MIN_COUNT})`,
    pipeline: 'pois:sync',
  });
  addCdcCheck(b, {
    id: 'cdc.07.transports',
    block: '07',
    dimension: 'geo',
    phase: 'cdc_target',
    passed: jsonLen(row.transports) >= TRANSPORTS_MIN_COUNT,
    severity: 'warn',
    field: 'transports',
    message: 'transports missing (multimodal access)',
    pipeline: 'enrichment pipeline',
  });

  /* ── Bloc 8 — Booking (Phase 6 deferred) ── */
  addCdcCheck(b, {
    id: 'cdc.08.booking_mode',
    block: '08',
    dimension: 'cdc',
    phase: 'phase6_deferred',
    passed: typeof row.booking_mode === 'string' && row.booking_mode.length > 0,
    severity: 'info',
    field: 'booking_mode',
    message: 'booking_mode unset',
    pipeline: 'Phase 6 — Amadeus GDS',
  });
  addCdcCheck(b, {
    id: 'cdc.08.live_offers',
    block: '08',
    dimension: 'jsonld',
    phase: 'phase6_deferred',
    passed: false,
    severity: 'info',
    field: 'Offer.priceValidUntil',
    message: 'Offer JSON-LD + priceValidUntil deferred Phase 6 (AGENTS.md §4ter)',
    pipeline: 'Phase 6 — frozen',
  });

  /* ── Bloc 9 — Politiques ── */
  addCdcCheck(b, {
    id: 'cdc.09.policies_present',
    block: '09',
    dimension: 'cdc',
    phase: 'phase1',
    passed: row.policies !== null,
    severity: 'blocker',
    field: 'policies',
    message: 'policies missing',
    pipeline: 'migration 0055 / Tavily',
  });
  addCdcCheck(b, {
    id: 'cdc.09.policies_real',
    block: '09',
    dimension: 'cdc',
    phase: 'cdc_target',
    passed: row.policies !== null && !policiesSynthetic(row),
    severity: 'warn',
    field: 'policies',
    message: 'policies are synthetic defaults (_synthetic: true)',
    pipeline: 'Google Places / Tavily',
  });
  addCdcCheck(b, {
    id: 'cdc.09.policies_core',
    block: '09',
    dimension: 'cdc',
    phase: 'cdc_target',
    passed: policiesCoreBlocks(row),
    severity: 'warn',
    field: 'policies',
    message: 'policies missing core blocks (check_in/out/cancel/pets/wifi)',
    pipeline: 'Google Places / Tavily',
  });

  /* ── Bloc 10 — Avis ── */
  addCdcCheck(b, {
    id: 'cdc.10.reviews_signal',
    block: '10',
    dimension: 'cdc',
    phase: 'cdc_target',
    passed: hasReviewsSignal(row),
    severity: 'warn',
    field: 'google_rating|google_reviews|featured_reviews',
    message: 'no review signal (ReviewsBlock + AggregateRating JSON-LD)',
    pipeline: 'Google Places / Amadeus sentiments Phase 6',
  });
  const kitReviewsSurface =
    isHotelKitSlug(row.slug) || hasFaqKitEnrichmentSurface(jsonLen(row.faq_content_kit));
  addCdcCheck(b, {
    id: 'cdc.10.google_reviews_gmb',
    block: '10',
    dimension: 'golden',
    phase: 'cdc_target',
    passed: !kitReviewsSurface || hasGmbReviewRows(row),
    severity: isHotelKitSlug(row.slug) ? 'blocker' : 'warn',
    field: 'google_reviews',
    message: 'kit fiche #acces requires synced Google My Business reviews (author + text)',
    pipeline: 'reviews:sync — sync-google-reviews.ts',
  });

  /* ── Bloc 11 — FAQ ── */
  addCdcCheck(b, {
    id: 'cdc.11.faq_count',
    block: '11',
    dimension: 'faq',
    phase: 'phase1',
    passed: faqLen >= CDC_FAQ_MIN_ITEMS && faqLen <= CDC_FAQ_MAX_ITEMS,
    severity: 'blocker',
    field: 'faq_content',
    message: `${faqLen} FAQ items (CDC ${CDC_FAQ_MIN_ITEMS}-${CDC_FAQ_MAX_ITEMS})`,
    pipeline: 'extend-faq-postgrest.ts',
  });
  addCdcCheck(b, {
    id: 'cdc.11.faq_canonical',
    block: '11',
    dimension: 'faq',
    phase: 'phase1',
    passed: isFaqCanonicalSet(row.faq_content, row.name),
    severity: 'blocker',
    field: 'faq_content.canonical',
    message: '10 CDC canonical FAQ questions missing or substituted',
    pipeline: 'run-faq-canonical.ts',
  });
  addCdcCheck(b, {
    id: 'cdc.11.faq_featured',
    block: '11',
    dimension: 'faq',
    phase: 'cdc_target',
    passed: countFeaturedFaq(row.faq_content) === FEATURED_FAQ_COUNT,
    severity: 'blocker',
    field: 'faq_content.featured',
    message: `${countFeaturedFaq(row.faq_content)} featured FAQ (need ${FEATURED_FAQ_COUNT})`,
    pipeline: 'run-humanizer-faq.ts',
  });
  addCdcCheck(b, {
    id: 'cdc.11.faq_tips',
    block: '11',
    dimension: 'faq',
    phase: 'cdc_target',
    passed: countFeaturedFaqTips(row.faq_content) >= FEATURED_FAQ_TIPS_MIN,
    severity: 'warn',
    field: 'faq_content.concierge_tip_fr',
    message: `${countFeaturedFaqTips(row.faq_content)} featured concierge tips (need ${FEATURED_FAQ_TIPS_MIN})`,
    pipeline: 'run-humanizer-faq.ts',
  });
  addCdcCheck(b, {
    id: 'cdc.11.faq_answer_band',
    block: '11',
    dimension: 'geo',
    phase: 'cdc_target',
    passed: faqAnswersInBand(row),
    severity: 'warn',
    field: 'faq_content.answer_fr',
    message: `FAQ answers outside ${FAQ_ANSWER_MIN_WORDS}-${FAQ_ANSWER_MAX_WORDS} words (GEO citation density)`,
    pipeline: 'run-faq-canonical.ts',
  });
  addCdcCheck(b, {
    id: 'cdc.11.faq_en_parity',
    block: '11',
    dimension: 'seo',
    phase: 'cdc_target',
    passed: faqAllHaveEn(row),
    severity: 'warn',
    field: 'faq_content.answer_en',
    message: 'FAQ missing EN answers (hreflang parity)',
    pipeline: 'run-faq-canonical.ts',
  });

  const kitLen = jsonLen(row.faq_content_kit);
  const conciergeLen = jsonLen(row.concierge_questions);
  addCdcCheck(b, {
    id: 'cdc.11.faq_kit_count',
    block: '11',
    dimension: 'faq',
    phase: 'phase1',
    passed: kitLen >= FAQ_KIT_MIN_ITEMS,
    severity: 'blocker',
    field: 'faq_content_kit',
    message: `${kitLen} kit FAQ items (Perplexity target ≥ ${FAQ_KIT_MIN_ITEMS})`,
    pipeline: 'faq:perplexity:push',
  });
  addCdcCheck(b, {
    id: 'cdc.11.concierge_questions_count',
    block: '11',
    dimension: 'faq',
    phase: 'phase1',
    passed: conciergeLen >= CONCIERGE_QUESTIONS_MIN,
    severity: 'blocker',
    field: 'concierge_questions',
    message: `${conciergeLen} concierge questions (target ≥ ${CONCIERGE_QUESTIONS_MIN})`,
    pipeline: 'faq:perplexity:push',
  });

  const faqKitEnrichment =
    kitLen >= FAQ_KIT_MIN_ITEMS
      ? evaluateFaqKitRowEnrichment({
          hotelName: row.name,
          faq_content_kit: row.faq_content_kit,
          faq_content: row.faq_content,
          concierge_questions: row.concierge_questions,
        })
      : null;
  const kitTaxonomyOk =
    faqKitEnrichment === null
      ? true
      : faqKitEnrichment.issues.filter((i) => i.code.startsWith('kit.category')).length === 0;
  addCdcCheck(b, {
    id: 'cdc.11.faq_kit_taxonomy',
    block: '11',
    dimension: 'faq',
    phase: 'phase1',
    passed: !hasFaqKitEnrichmentSurface(kitLen) || kitTaxonomyOk,
    severity: 'blocker',
    field: 'faq_content_kit.group_fr',
    message: 'kit FAQ missing Perplexity category coverage (≥2 per factual bucket)',
    pipeline: 'faq:perplexity:validate',
  });
  const kitEnOk =
    faqKitEnrichment === null
      ? true
      : faqKitEnrichment.issues.every((i) => i.code !== 'kit.en_parity');
  addCdcCheck(b, {
    id: 'cdc.11.faq_kit_en_parity',
    block: '11',
    dimension: 'faq',
    phase: 'cdc_target',
    passed: !hasFaqKitEnrichmentSurface(kitLen) || kitEnOk,
    severity: 'blocker',
    field: 'faq_content_kit.answer_en',
    message: 'kit FAQ missing EN question/answer (hreflang parity)',
    pipeline: 'faq:perplexity:push + EN pass',
  });
  const conciergeEnOk =
    faqKitEnrichment === null
      ? true
      : faqKitEnrichment.issues.every((i) => i.code !== 'concierge.en_parity');
  addCdcCheck(b, {
    id: 'cdc.11.concierge_en_parity',
    block: '11',
    dimension: 'faq',
    phase: 'cdc_target',
    passed: conciergeLen < CONCIERGE_QUESTIONS_MIN || conciergeEnOk,
    severity: 'blocker',
    field: 'concierge_questions.reply_en',
    message: 'concierge_questions missing EN question/reply',
    pipeline: 'faq:perplexity:push + EN pass',
  });
  const conciergeTaxonomyOk =
    faqKitEnrichment === null
      ? true
      : faqKitEnrichment.issues.every((i) => i.code !== 'concierge.taxonomy');
  addCdcCheck(b, {
    id: 'cdc.11.concierge_taxonomy',
    block: '11',
    dimension: 'faq',
    phase: 'phase1',
    passed: conciergeLen < CONCIERGE_QUESTIONS_MIN || conciergeTaxonomyOk,
    severity: 'blocker',
    field: 'concierge_questions.category_fr',
    message: 'concierge_questions use non-allowlist category_fr labels',
    pipeline: 'faq:perplexity:validate',
  });
  const conciergeToneOk =
    faqKitEnrichment === null
      ? true
      : faqKitEnrichment.issues.every((i) => i.code !== 'concierge.informative_tone');
  addCdcCheck(b, {
    id: 'cdc.11.concierge_informative_tone',
    block: '11',
    dimension: 'golden',
    phase: 'cdc_target',
    passed: conciergeLen < CONCIERGE_QUESTIONS_MIN || conciergeToneOk,
    severity: isHotelKitSlug(row.slug) ? 'blocker' : 'warn',
    field: 'concierge_questions.reply_fr',
    message: 'concierge replies use first-person commitment (CDC D10 — informative tone)',
    pipeline: 'faq:perplexity:push + prince-de-galles-concierge-questions.ts',
  });

  /* ── Bloc 12 — Guide local ── */
  addCdcCheck(b, {
    id: 'cdc.12.guide_teaser',
    block: '12',
    dimension: 'maille',
    phase: 'cdc_target',
    passed: ctx.guideSlug !== null,
    severity: 'warn',
    field: 'editorial_guides',
    message: `no published guide for city "${row.city ?? ''}" (LocalGuideTeaser absent)`,
    pipeline: 'editorial_guides pipeline',
  });

  /* ── Bloc 13 — Trust ── */
  addCdcCheck(b, {
    id: 'cdc.13.awards_verified',
    block: '13',
    dimension: 'jsonld',
    phase: 'cdc_target',
    passed: countUnverifiedAwards(row) === 0,
    severity: 'blocker',
    field: 'awards.verified',
    message: `${countUnverifiedAwards(row)} awards with verified:false (Hard Rule — no JSON-LD emit)`,
    pipeline: 'Payload awards / affiliations ADR-0023',
  });
  addCdcCheck(b, {
    id: 'cdc.13.trust_signal',
    block: '13',
    dimension: 'cdc',
    phase: 'cdc_target',
    passed: countVerifiedAwards(row) >= 1 || countVerifiedAffiliations(row) >= 1,
    severity: 'warn',
    field: 'awards|affiliations',
    message: 'no verified award or affiliation (TrustSignals block thin)',
    pipeline: 'affiliations backfill',
  });

  /* ── Bloc 14 — MICE ── */
  const hasMice = row.mice_info !== null && row.mice_info !== undefined;
  addCdcCheck(b, {
    id: 'cdc.14.mice_info',
    block: '14',
    dimension: 'cdc',
    phase: 'cdc_target',
    passed: hasMice,
    severity: 'info',
    field: 'mice_info',
    message: 'mice_info missing (MiceBlock — optional unless MICE property)',
    pipeline: 'Payload mice_events',
  });

  /* ── Bloc 15 — Footer NAP ── */
  addCdcCheck(b, {
    id: 'cdc.15.email',
    block: '15',
    dimension: 'cdc',
    phase: 'cdc_target',
    passed: typeof row.email_reservations === 'string' && row.email_reservations.includes('@'),
    severity: 'info',
    field: 'email_reservations',
    message: 'email_reservations missing',
    pipeline: 'Google Places / official site',
  });

  /* ── Bloc 16 — Concierge advice ── */
  const caFr = row.concierge_advice?.fr;
  const caEn = row.concierge_advice?.en;
  addCdcCheck(b, {
    id: 'cdc.16.advice_fr_words',
    block: '16',
    dimension: 'geo',
    phase: 'phase1',
    passed: wordBand(caFr?.body, ADVICE_BODY_MIN_WORDS, ADVICE_BODY_MAX_WORDS),
    severity: 'blocker',
    field: 'concierge_advice.fr.body',
    message: `concierge_advice.fr ${countWords(caFr?.body ?? '')} words (${ADVICE_BODY_MIN_WORDS}-${ADVICE_BODY_MAX_WORDS})`,
    pipeline: 'run-hotel-concierge-advice.ts',
  });
  addCdcCheck(b, {
    id: 'cdc.16.advice_en_words',
    block: '16',
    dimension: 'geo',
    phase: 'phase1',
    passed: wordBand(caEn?.body, ADVICE_BODY_MIN_WORDS, ADVICE_BODY_MAX_WORDS),
    severity: 'blocker',
    field: 'concierge_advice.en.body',
    message: `concierge_advice.en ${countWords(caEn?.body ?? '')} words`,
    pipeline: 'run-hotel-concierge-advice.ts',
  });
  addCdcCheck(b, {
    id: 'cdc.16.advice_prefix_fr',
    block: '16',
    dimension: 'geo',
    phase: 'cdc_target',
    passed: conciergePrefixOk(caFr?.body, 'fr'),
    severity: 'blocker',
    field: 'concierge_advice.fr.body',
    message: 'concierge_advice.fr must open with « Mon conseil : » (ADR-0011)',
    pipeline: 'run-hotel-concierge-advice.ts',
  });
  addCdcCheck(b, {
    id: 'cdc.16.advice_prefix_en',
    block: '16',
    dimension: 'geo',
    phase: 'cdc_target',
    passed: conciergePrefixOk(caEn?.body, 'en'),
    severity: 'blocker',
    field: 'concierge_advice.en.body',
    message: 'concierge_advice.en must open with « My tip: » (ADR-0011)',
    pipeline: 'run-hotel-concierge-advice.ts',
  });

  /* ── SEO technique ── */
  addCdcCheck(b, {
    id: 'seo.meta_title_fr',
    block: 'seo',
    dimension: 'seo',
    phase: 'cdc_target',
    passed:
      strLen(row.meta_title_fr) >= META_TITLE_MIN_CHARS &&
      strLen(row.meta_title_fr) <= META_TITLE_MAX_CHARS,
    severity: 'blocker',
    field: 'meta_title_fr',
    message: `meta_title_fr ${strLen(row.meta_title_fr)} chars`,
    pipeline: 'manual SEO / seed-tier1',
  });
  addCdcCheck(b, {
    id: 'seo.meta_title_en',
    block: 'seo',
    dimension: 'seo',
    phase: 'cdc_target',
    passed:
      strLen(row.meta_title_en) >= META_TITLE_MIN_CHARS &&
      strLen(row.meta_title_en) <= META_TITLE_MAX_CHARS,
    severity: 'blocker',
    field: 'meta_title_en',
    message: `meta_title_en ${strLen(row.meta_title_en)} chars`,
    pipeline: 'manual SEO',
  });
  addCdcCheck(b, {
    id: 'seo.meta_desc_fr',
    block: 'seo',
    dimension: 'seo',
    phase: 'cdc_target',
    passed:
      strLen(row.meta_desc_fr) >= META_DESC_MIN_CHARS &&
      strLen(row.meta_desc_fr) <= META_DESC_MAX_CHARS,
    severity: 'blocker',
    field: 'meta_desc_fr',
    message: `meta_desc_fr ${strLen(row.meta_desc_fr)} chars (${META_DESC_MIN_CHARS}-${META_DESC_MAX_CHARS})`,
    pipeline: 'run-hotel-meta-desc.ts',
  });
  addCdcCheck(b, {
    id: 'seo.meta_desc_en',
    block: 'seo',
    dimension: 'seo',
    phase: 'cdc_target',
    passed:
      strLen(row.meta_desc_en) >= META_DESC_MIN_CHARS &&
      strLen(row.meta_desc_en) <= META_DESC_MAX_CHARS,
    severity: 'blocker',
    field: 'meta_desc_en',
    message: `meta_desc_en ${strLen(row.meta_desc_en)} chars`,
    pipeline: 'run-hotel-meta-desc.ts',
  });
  addCdcCheck(b, {
    id: 'seo.indexable',
    block: 'seo',
    dimension: 'seo',
    phase: 'phase1',
    passed: base.indexable,
    severity: 'blocker',
    field: 'indexability',
    message: 'not indexable (sitemap / robots mismatch risk)',
    pipeline: 'indexability.ts',
  });
  addCdcCheck(b, {
    id: 'seo.publish_gate',
    block: 'seo',
    dimension: 'seo',
    phase: 'phase1',
    passed: base.publish_gate_pass,
    severity: 'blocker',
    field: 'publish_gate',
    message: 'publish gate failed',
    pipeline: 'publish-eligible-drafts.ts',
  });
  addCdcCheck(b, {
    id: 'seo.freshness',
    block: 'seo',
    dimension: 'seo',
    phase: 'cdc_target',
    passed: typeof row.updated_at === 'string' && row.updated_at.length > 0,
    severity: 'info',
    field: 'updated_at',
    message: 'updated_at missing (freshness signal / sitemap lastmod)',
    pipeline: 'Payload afterChange hook',
  });

  /* ── Maillage / EEAT ── */
  addCdcCheck(b, {
    id: 'maille.official_url',
    block: 'maille',
    dimension: 'maille',
    phase: 'cdc_target',
    passed: typeof row.official_url === 'string' && row.official_url.startsWith('http'),
    severity: 'warn',
    field: 'official_url',
    message: 'official_url missing (EEAT outbound)',
    pipeline: 'enrich-wikidata-ids.ts / Tavily',
  });
  addCdcCheck(b, {
    id: 'maille.wikidata',
    block: 'maille',
    dimension: 'maille',
    phase: 'cdc_target',
    passed: typeof row.wikidata_id === 'string' && row.wikidata_id.length > 0,
    severity: 'warn',
    field: 'wikidata_id',
    message: 'wikidata_id missing',
    pipeline: 'enrich-wikidata-ids.ts',
  });
  addCdcCheck(b, {
    id: 'maille.wikipedia_fr',
    block: 'maille',
    dimension: 'maille',
    phase: 'cdc_target',
    passed: typeof row.wikipedia_url_fr === 'string' && row.wikipedia_url_fr.length > 0,
    severity: 'info',
    field: 'wikipedia_url_fr',
    message: 'wikipedia_url_fr missing',
    pipeline: 'enrich-wikidata-ids.ts',
  });
  addCdcCheck(b, {
    id: 'maille.sameas',
    block: 'maille',
    dimension: 'maille',
    phase: 'cdc_target',
    passed: sameAsCount(row) >= 1,
    severity: 'info',
    field: 'external_sameas',
    message: 'external_sameas empty (JSON-LD sameAs mesh)',
    pipeline: 'enrichment pipeline',
  });
  addCdcCheck(b, {
    id: 'maille.brand_affiliation',
    block: 'maille',
    dimension: 'maille',
    phase: 'cdc_target',
    passed:
      (typeof row.luxury_tier === 'string' && row.luxury_tier.length > 0) ||
      countVerifiedAffiliations(row) >= 1,
    severity: 'info',
    field: 'luxury_tier|affiliations',
    message: 'no luxury_tier or verified affiliation (marque hub maillage)',
    pipeline: 'affiliations ADR-0023',
  });
  addCdcCheck(b, {
    id: 'maille.signature_experiences',
    block: 'maille',
    dimension: 'maille',
    phase: 'cdc_target',
    passed: jsonLen(row.signature_experiences) >= 1,
    severity: 'info',
    field: 'signature_experiences',
    message: 'signature_experiences empty',
    pipeline: 'editorial pipeline',
  });

  /* ── Agentique ── */
  addCdcCheck(b, {
    id: 'agent.hero_photos',
    block: 'agent',
    dimension: 'agent',
    phase: 'phase1',
    passed: typeof row.hero_image === 'string' && row.hero_image.length > 0,
    severity: 'warn',
    field: 'hero_image',
    message: 'hero missing for getHotelPhotos MCP surface',
    pipeline: 'photos:sync',
  });
  addCdcCheck(b, {
    id: 'agent.gallery_api',
    block: 'agent',
    dimension: 'agent',
    phase: 'phase1',
    passed: gallery.count >= 1,
    severity: 'warn',
    field: 'gallery_images',
    message: 'empty gallery — agent photo endpoint returns thin payload',
    pipeline: 'photos:sync',
  });
  addCdcCheck(b, {
    id: 'agent.factual_agentic',
    block: 'agent',
    dimension: 'agent',
    phase: 'phase1',
    passed: fsFr.length >= FACTUAL_SUMMARY_MIN_CHARS,
    severity: 'warn',
    field: 'factual_summary_fr',
    message: 'factual_summary too short for agent corpus / llms-full.txt',
    pipeline: 'run-hotel-factual-summary.ts',
  });

  /* ── JSON-LD prerequisites ── */
  addCdcCheck(b, {
    id: 'jsonld.faqpage',
    block: 'jsonld',
    dimension: 'jsonld',
    phase: 'phase1',
    passed: faqLen >= FAQ_MIN_ITEMS && isFaqCanonicalSet(row.faq_content, row.name),
    severity: 'blocker',
    field: 'FAQPage',
    message: 'FAQPage JSON-LD prerequisites missing',
    pipeline: 'run-faq-canonical.ts',
  });
  addCdcCheck(b, {
    id: 'jsonld.imageobject',
    block: 'jsonld',
    dimension: 'jsonld',
    phase: 'phase1',
    passed: typeof row.hero_image === 'string' && gallery.count >= 5 && gallery.missingAltFr === 0,
    severity: 'warn',
    field: 'ImageObject[]',
    message: 'ImageObject JSON-LD set incomplete (hero + ≥5 alts)',
    pipeline: 'photos:sync + alt enrichment',
  });
  addCdcCheck(b, {
    id: 'jsonld.place',
    block: 'jsonld',
    dimension: 'jsonld',
    phase: 'cdc_target',
    passed:
      typeof row.latitude === 'number' &&
      typeof row.longitude === 'number' &&
      typeof row.address === 'string',
    severity: 'blocker',
    field: 'Place|GeoCoordinates',
    message: 'Place + GeoCoordinates JSON-LD prerequisites missing',
    pipeline: 'geocode:hotels',
  });
  addCdcCheck(b, {
    id: 'jsonld.aggregate_rating',
    block: 'jsonld',
    dimension: 'jsonld',
    phase: 'cdc_target',
    passed: hasReviewsSignal(row),
    severity: 'info',
    field: 'AggregateRating',
    message: 'AggregateRating JSON-LD requires real reviewCount > 0',
    pipeline: 'Google Places / Phase 6 sentiments',
  });

  /* ── Structured-data récent (provenance / rating /5 / containedInPlace) ── */
  const galleryCredited = galleryWithCredit(row);
  addCdcCheck(b, {
    id: 'jsonld.image_provenance',
    block: '02',
    dimension: 'jsonld',
    phase: 'cdc_target',
    passed: gallery.count === 0 || galleryCredited === gallery.count,
    severity: 'info',
    field: 'gallery_images.credit',
    message: `${gallery.count - galleryCredited}/${gallery.count} gallery images without credit (ImageObject provenance/Licensable)`,
    pipeline: 'photos:sync — credit/licence',
  });
  addCdcCheck(b, {
    id: 'jsonld.google_rating_scale',
    block: '10',
    dimension: 'jsonld',
    phase: 'cdc_target',
    passed: googleRatingScaleOk(row),
    severity: 'blocker',
    field: 'google_rating',
    message: 'google_rating out of /5 scale (AggregateRating bestRating must be 5)',
    pipeline: 'Google Places — rating normalisation',
  });
  addCdcCheck(b, {
    id: 'jsonld.contained_in_place',
    block: '07',
    dimension: 'jsonld',
    phase: 'cdc_target',
    passed: typeof row.city === 'string' && row.city.length > 0 && ctx.guideSlug !== null,
    severity: 'info',
    field: 'containedInPlace',
    message: 'containedInPlace City node has no destination hub (needs city + published guide)',
    pipeline: 'editorial_guides + city',
  });
  addCdcCheck(b, {
    id: 'jsonld.breadcrumb',
    block: 'jsonld',
    dimension: 'jsonld',
    phase: 'cdc_target',
    passed: hasBreadcrumbTrail(row),
    severity: 'warn',
    field: 'BreadcrumbList',
    message: 'BreadcrumbList JSON-LD trail incomplete (needs city + country_code)',
    pipeline: 'geocode:hotels / seed-tier1',
  });
  addCdcCheck(b, {
    id: 'jsonld.hotel_core',
    block: 'jsonld',
    dimension: 'jsonld',
    phase: 'cdc_target',
    passed: hasHotelCoreNode(row),
    severity: 'warn',
    field: 'Hotel|LodgingBusiness',
    message: 'Hotel JSON-LD core thin (needs starRating + amenityFeature + checkin/out times)',
    pipeline: 'amenities enrichment + policies builder',
  });
  addCdcCheck(b, {
    id: 'jsonld.event',
    block: 'jsonld',
    dimension: 'jsonld',
    phase: 'cdc_target',
    passed: eventsJsonLdOk(row),
    severity: 'warn',
    field: 'Event[]',
    message: 'upcoming_events missing Event JSON-LD fields (name + startDate + location)',
    pipeline: 'events:sync',
  });
  addCdcCheck(b, {
    id: 'jsonld.review',
    block: 'jsonld',
    dimension: 'jsonld',
    phase: 'cdc_target',
    passed: reviewsJsonLdOk(row),
    severity: 'info',
    field: 'Review[]',
    message: 'featured_reviews missing Review JSON-LD fields (author + body + source)',
    pipeline: 'seed-featured-reviews.ts',
  });
  addCdcCheck(b, {
    id: 'maille.eeat_sources',
    block: 'maille',
    dimension: 'maille',
    phase: 'cdc_target',
    passed: countEeatSources(row) >= EEAT_SOURCES_MIN,
    severity: 'info',
    field: 'external_sources',
    message: `external_sources thin (need ≥ ${EEAT_SOURCES_MIN} cited facts for the EEAT footer)`,
    pipeline: 'enrichment pipeline (DATAtourisme / Wikidata / Wikipedia / Tavily)',
  });
  addCdcCheck(b, {
    id: 'seo.hreflang_pair',
    block: '01',
    dimension: 'seo',
    phase: 'cdc_target',
    passed: hreflangPairComplete(row),
    severity: 'warn',
    field: 'hreflang(en)',
    message:
      'EN hreflang alternate incomplete (needs name_en + slug_en + meta_title_en + meta_desc_en)',
    pipeline: 'manual SEO / translation',
  });

  /* ── Golden template — concierge handoff richness ── */
  const venues = countCompleteVenues(row.restaurant_info);
  const poiBuckets = evaluatePoiBuckets(row.points_of_interest);
  const poiImages = evaluatePoiImages(row.points_of_interest);
  const poiDedicatedImages = evaluatePoiDedicatedImages(row.points_of_interest);
  const poiStructural = evaluatePoiStructuralCorrespondence(row.points_of_interest);
  const galleryAltCategory = evaluateGalleryAltCategoryCorrespondence(row.gallery_images);
  const spa = evaluateSpaDossier(row.spa_info);
  const events = analyzeEvents(row);
  const igPosts = instagramPostCount(row);

  if (venues.total >= 1) {
    addCdcCheck(b, {
      id: 'gold.venues_handoff',
      block: 'gold',
      dimension: 'golden',
      phase: 'cdc_target',
      passed: venues.complete >= 1,
      severity: 'warn',
      field: 'restaurant_info.venues',
      message: `${venues.complete}/${venues.total} venues with concierge handoff (contact + tip)`,
      pipeline: 'enrichment — restaurant handoff',
    });
    addCdcCheck(b, {
      id: 'gold.venues_all_handoff',
      block: 'gold',
      dimension: 'golden',
      phase: 'cdc_target',
      passed: venues.complete === venues.total,
      severity: severityForKitSlug(row.slug, 'info'),
      field: 'restaurant_info.venues',
      message: `${venues.total - venues.complete} venues missing full handoff`,
      pipeline: 'enrichment — restaurant handoff',
    });
  }

  addCdcCheck(b, {
    id: 'gold.poi_buckets',
    block: 'gold',
    dimension: 'golden',
    phase: 'cdc_target',
    passed: poiBuckets.allBucketsCovered,
    severity: 'warn',
    field: 'points_of_interest.bucket',
    message: `POI buckets not all covered (visit ${poiBuckets.buckets.visit}, do ${poiBuckets.buckets.do}, shop ${poiBuckets.buckets.shop})`,
    pipeline: 'pois:sync — golden buckets',
  });
  addCdcCheck(b, {
    id: 'gold.poi_handoff',
    block: 'gold',
    dimension: 'golden',
    phase: 'cdc_target',
    passed: poiBuckets.complete >= GOLDEN_POI_HANDOFF_MIN,
    severity: 'warn',
    field: 'points_of_interest',
    message: `${poiBuckets.complete} POIs with full handoff (need ≥ ${GOLDEN_POI_HANDOFF_MIN})`,
    pipeline: 'pois:sync + concierge:humanize:pois',
  });
  addCdcCheck(b, {
    id: 'gold.poi_images',
    block: 'gold',
    dimension: 'golden',
    phase: 'cdc_target',
    passed: poiImages.total === 0 || poiImages.withImage === poiImages.total,
    severity: severityForKitSlug(row.slug, 'warn'),
    field: 'points_of_interest.image_public_id',
    message: `${poiImages.total - poiImages.withImage}/${poiImages.total} POIs missing image_public_id (CDC D9)`,
    pipeline: 'resource-{slug}-poi-images.ts — Wikimedia / official / Places',
  });
  addCdcCheck(b, {
    id: 'gold.poi_dedicated_images',
    block: 'gold',
    dimension: 'golden',
    phase: 'cdc_target',
    passed:
      poiDedicatedImages.total === 0 || poiDedicatedImages.dedicated === poiDedicatedImages.total,
    severity: severityForKitSlug(row.slug, 'warn'),
    field: 'points_of_interest.image_public_id',
    message: `${poiDedicatedImages.total - poiDedicatedImages.dedicated}/${poiDedicatedImages.total} POIs reuse hotel gallery press-* instead of dedicated poi-* assets (CDC D9bis)`,
    pipeline: 'resource-{slug}-poi-images.ts + golden manifest poi-{slug} ids',
  });
  addCdcCheck(b, {
    id: 'gold.poi_photo_structural',
    block: 'gold',
    dimension: 'golden',
    phase: 'cdc_target',
    passed: poiStructural.total === 0 || poiStructural.ok === poiStructural.total,
    severity: severityForKitSlug(row.slug, 'warn'),
    field: 'points_of_interest.image_public_id',
    message: `${poiStructural.total - poiStructural.ok}/${poiStructural.total} POIs fail photo-subject structural contract (dedicated poi-* + no gallery recycle)`,
    pipeline: 'audit:photo-subject + resource-{slug}-poi-images.ts',
  });
  addCdcCheck(b, {
    id: 'photos.gallery_alt_category',
    block: '02',
    dimension: 'photo',
    phase: 'cdc_target',
    passed: galleryAltCategory.total === 0 || galleryAltCategory.issues.length === 0,
    severity: severityForKitSlug(row.slug, 'warn'),
    field: 'gallery_images.category',
    message: `${galleryAltCategory.issues.length} gallery photo(s) with category/alt_fr mismatch (e.g. spa labeled as room)`,
    pipeline: 'categorize-with-vision.ts + audit:photo-subject --vision',
  });

  if (isRecord(row.spa_info)) {
    addCdcCheck(b, {
      id: 'gold.spa_dossier',
      block: 'gold',
      dimension: 'golden',
      phase: 'cdc_target',
      passed: spa.complete,
      severity: severityForKitSlug(row.slug, 'warn'),
      field: 'spa_info',
      message: 'spa_info dossier incomplete (need description + hours + contact + tip)',
      pipeline: 'enrichment — spa dossier',
    });
  }

  addCdcCheck(b, {
    id: 'gold.instagram',
    block: 'gold',
    dimension: 'golden',
    phase: 'cdc_target',
    passed: igPosts >= GOLDEN_INSTAGRAM_POSTS_MIN,
    severity: 'info',
    field: 'instagram',
    message: `${igPosts} Instagram posts (need ≥ ${GOLDEN_INSTAGRAM_POSTS_MIN})`,
    pipeline: 'instagram sync → Cloudinary',
  });
  addCdcCheck(b, {
    id: 'gold.concierge_pick',
    block: 'gold',
    dimension: 'golden',
    phase: 'cdc_target',
    passed: hasConciergeField(row.concierge_pick),
    severity: isHotelKitSlug(row.slug) ? 'blocker' : 'info',
    field: 'concierge_pick',
    message: 'concierge_pick missing (Concierge room recommendation)',
    pipeline: 'editorial — concierge pick',
  });

  /* ── Kit PO acceptance (D15–D19) — render parity, not deploy parity ── */
  if (isHotelKitSlug(row.slug)) {
    const waveRoomCtx = isKitWaveSlug(row.slug)
      ? buildKitWaveRoomAuditContext(row.slug, ctx.kitRoomRows)
      : null;
    const kitChecks = evaluateKitAcceptanceGates({
      slug: row.slug,
      name: row.name,
      concierge_pick: row.concierge_pick,
      gallery_images: row.gallery_images,
      google_reviews: row.google_reviews,
      last_reviews_sync: row.last_reviews_sync,
      faq_content_kit: row.faq_content_kit,
      faq_content: row.faq_content,
      concierge_questions: row.concierge_questions,
      signature_experiences: row.signature_experiences,
      points_of_interest: row.points_of_interest,
      rooms: waveRoomCtx?.rooms ?? ctx.kitRoomRows,
      ...(waveRoomCtx?.orderedRoomSlugs !== undefined
        ? { orderedRoomSlugs: waveRoomCtx.orderedRoomSlugs }
        : {}),
    });
    for (const kitCheck of kitChecks) {
      const block = kitCheck.id.startsWith('kit.11.')
        ? '11'
        : kitCheck.id.startsWith('kit.10.')
          ? '10'
          : kitCheck.id.startsWith('kit.02.')
            ? '02'
            : 'kit';
      const dimension: CdcDimension = kitCheck.id.startsWith('kit.11.')
        ? 'faq'
        : kitCheck.id.startsWith('kit.02.')
          ? 'photo'
          : 'golden';
      addCdcCheck(b, {
        id: kitCheck.id,
        block,
        dimension,
        phase: 'cdc_target',
        passed: kitCheck.passed,
        severity: 'blocker',
        field: kitCheck.id,
        message: kitCheck.message,
        pipeline: 'kit-fiche-acceptance-gates.ts — skill hotel-kit-rollout D15–D19',
      });
    }
  }
  addCdcCheck(b, {
    id: 'gold.concierge_hook',
    block: 'gold',
    dimension: 'golden',
    phase: 'cdc_target',
    passed: hasConciergeField(row.concierge_hook),
    severity: 'info',
    field: 'concierge_hook',
    message: 'concierge_hook missing (hero accroche, Concierge voice)',
    pipeline: 'editorial — concierge hook',
  });
  addCdcCheck(b, {
    id: 'gold.events',
    block: 'gold',
    dimension: 'golden',
    phase: 'cdc_target',
    passed: events.count >= 1,
    severity: 'info',
    field: 'upcoming_events',
    message: 'no upcoming_events (Event JSON-LD + "à proximité")',
    pipeline: 'events:sync',
  });
  if (events.count >= 1) {
    addCdcCheck(b, {
      id: 'gold.events_image',
      block: 'gold',
      dimension: 'golden',
      phase: 'cdc_target',
      passed: events.withImage === events.count,
      severity: 'info',
      field: 'upcoming_events.image_url',
      message: `${events.count - events.withImage}/${events.count} events without image (Event.image)`,
      pipeline: 'events:sync — image_url',
    });
  }

  /* ── Restructuration (anti-cannibalisation + fabricated distinction) ──
   * A category section only cannibalises a block that is genuinely populated
   * (rich restaurant_info / spa_info / POI handoff). On bare catalogue fiches
   * the "Restauration"/"Spa"/"À deux pas" narrative is the SOLE carrier of that
   * content, so it is NOT a duplicate — dropping it would be content loss. */
  const populatedBlocks = resolvePopulatedBlocks({
    restaurantInfo: row.restaurant_info,
    spaInfo: row.spa_info,
    pointsOfInterest: row.points_of_interest,
  });
  const dupSections = countCannibalizingSections(row.long_description_sections, populatedBlocks);
  addCdcCheck(b, {
    id: 'struct.no_duplicate_sections',
    block: 'struct',
    dimension: 'structure',
    phase: 'cdc_target',
    passed: dupSections === 0,
    severity: 'warn',
    field: 'long_description_sections',
    message: `${dupSections} long-read sections cannibalise a populated block (anti-cannibalisation)`,
    pipeline: 'editorial restructure — dropCannibalizingSections (post-Golden)',
  });
  addCdcCheck(b, {
    id: 'struct.no_fabricated_star',
    block: 'struct',
    dimension: 'structure',
    phase: 'cdc_target',
    passed: !detectFabricatedStarClaim(narrativeTexts(row), row.awards),
    severity: 'blocker',
    field: 'description|signature_experiences',
    message: 'narrative claims a Michelin star with no verified award (Hard Rule 7)',
    pipeline: 'editorial sanitiser',
  });

  const activeCheck = (c: CdcCheck): boolean => c.phase !== 'phase6_deferred';

  const dimensions: Record<CdcDimension, DimensionScore> = {
    cdc: scoreChecks(b.checks, (c) => c.dimension === 'cdc' && activeCheck(c)),
    seo: scoreChecks(b.checks, (c) => c.dimension === 'seo' && activeCheck(c)),
    geo: scoreChecks(b.checks, (c) => c.dimension === 'geo' && activeCheck(c)),
    agent: scoreChecks(b.checks, (c) => c.dimension === 'agent' && activeCheck(c)),
    faq: scoreChecks(b.checks, (c) => c.dimension === 'faq' && activeCheck(c)),
    maille: scoreChecks(b.checks, (c) => c.dimension === 'maille' && activeCheck(c)),
    photo: scoreChecks(b.checks, (c) => c.dimension === 'photo' && activeCheck(c)),
    jsonld: scoreChecks(b.checks, (c) => c.dimension === 'jsonld' && activeCheck(c)),
    golden: scoreChecks(b.checks, (c) => c.dimension === 'golden' && activeCheck(c)),
    structure: scoreChecks(b.checks, (c) => c.dimension === 'structure' && activeCheck(c)),
  };

  const scoreCdcTarget = scoreChecks(
    b.checks,
    (c) => c.phase === 'cdc_target' && activeCheck(c),
  ).score;
  const scoreCdcPhase1 = scoreChecks(
    b.checks,
    (c) => (c.phase === 'phase1' || c.phase === 'cdc_target') && activeCheck(c),
  ).score;

  const globalDims = [
    dimensions.cdc.score,
    dimensions.seo.score,
    dimensions.geo.score,
    dimensions.faq.score,
    dimensions.maille.score,
    dimensions.photo.score,
    dimensions.jsonld.score,
    dimensions.agent.score,
    dimensions.golden.score,
    dimensions.structure.score,
  ];
  const scoreGlobal = Math.round(globalDims.reduce((a, v) => a + v, 0) / globalDims.length);

  const allGaps = [...base.gaps, ...b.gaps];
  const statusCdc = deriveStatus(row, scoreCdcTarget);

  return {
    ...base,
    score_cdc: scoreCdcTarget,
    score_cdc_phase1: scoreCdcPhase1,
    score_seo: dimensions.seo.score,
    score_geo: dimensions.geo.score,
    score_agent: dimensions.agent.score,
    score_faq: dimensions.faq.score,
    score_maille: dimensions.maille.score,
    score_photo: dimensions.photo.score,
    score_jsonld: dimensions.jsonld.score,
    score_golden: dimensions.golden.score,
    score_structure: dimensions.structure.score,
    score_global: scoreGlobal,
    status_cdc: statusCdc,
    blocks: buildBlockScores(b.checks),
    dimensions,
    cdc_checks: b.checks,
    cdc_gaps: b.gaps,
    gaps: allGaps,
    guide_slug: ctx.guideSlug,
    room_stats: ctx.roomStats,
  };
}

export function aggregateCdcGapCounts(
  results: readonly CdcHotelAuditResult[],
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const r of results) {
    const seen = new Set<string>();
    for (const g of r.cdc_gaps) {
      const key = `${g.field}|${g.message.slice(0, 40)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      counts.set(g.field, (counts.get(g.field) ?? 0) + 1);
    }
  }
  return counts;
}

export function aggregateBlockFailCounts(
  results: readonly CdcHotelAuditResult[],
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const r of results) {
    for (const block of r.blocks) {
      if (block.score < 100) {
        counts.set(block.block, (counts.get(block.block) ?? 0) + 1);
      }
    }
  }
  return counts;
}

export { BLOCK_LABELS };
