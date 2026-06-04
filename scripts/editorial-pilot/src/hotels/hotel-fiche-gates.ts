/**
 * Hotel fiche completeness gates — T0 publish, T1 indexability, T3 editorial excellence.
 * Single source of truth for audit-hotel-fiche.ts and unit tests.
 *
 * Skill: editorial-pilot, llm-output-robustness Rule 14 (audit mirrors production envelopes).
 */

import {
  gateFactualSummaryFormat,
  FACTUAL_SUMMARY_MAX_CHARS,
  FACTUAL_SUMMARY_MIN_CHARS,
} from './factual-summary-generator.js';
import {
  CANONICAL_FAQ_QUESTIONS,
  countFeaturedFaq,
  countFeaturedFaqTips,
  isFaqCanonicalSet,
  type FaqItemLike,
} from './canonical-faq-questions.js';
import { ADVICE_BODY_MAX_WORDS, ADVICE_BODY_MIN_WORDS } from './concierge-advice-generator.js';
import { DESCRIPTION_EXTEND_MIN_CHARS } from './description-extend-generator.js';
import { META_DESC_MAX_CHARS, META_DESC_MIN_CHARS } from './meta-desc-generator.js';

/* ── Shared thresholds (mirror apps/web indexability + publish gate) ── */

export const DESCRIPTION_MIN_CHARS = 600;
export const DESCRIPTION_IDEAL_MIN_CHARS = DESCRIPTION_EXTEND_MIN_CHARS;
export const META_TITLE_MIN_CHARS = 30;
export const META_TITLE_MAX_CHARS = 70;
export const FACTUAL_SUMMARY_INDEX_MIN_CHARS = 100;
export const FACTUAL_SUMMARY_PUBLISH_MAX_CHARS = 200;
export const META_DESC_PUBLISH_MIN_CHARS = 100;
export const META_DESC_PUBLISH_MAX_CHARS = 180;
export const PUBLISH_CONCIERGE_MIN_WORDS = 30;
export const FAQ_MIN_ITEMS = 10;
// GEO citation-density band per FAQ answer. Floor aligned to the golden
// reference fiche, whose 10 answers span 30-57 words: a 50 floor made the
// reference fail its own gate (5/10 in band), a uniform false-negative.
export const FAQ_ANSWER_MIN_WORDS = 30;
export const FAQ_ANSWER_MAX_WORDS = 100;
export const LONG_SECTIONS_MIN_COUNT = 3;
export const LONG_FORM_MIN_WORDS = 600;
export const HIGHLIGHTS_MIN_COUNT = 3;
export const POIS_MIN_COUNT = 3;
export const TRANSPORTS_MIN_COUNT = 1;
export const FEATURED_FAQ_COUNT = 5;
/**
 * Minimum featured FAQ items carrying a `concierge_tip_fr`. The humanizer
 * (`run-humanizer-faq.ts`, ADR-0011) is designed to emit 0-2 tips per hotel —
 * 5 is unreachable. The golden reference fiche carries 2, so 2 is the parity
 * bar. (Previously mis-set to FEATURED_FAQ_COUNT=5, a uniform false-negative.)
 */
export const FEATURED_FAQ_TIPS_MIN = 2;
export const T3_COMPLETE_THRESHOLD = 95;
export const T3_PARTIAL_THRESHOLD = 70;

const CONCIERGE_TIP_FOR = ['room', 'dining', 'timing', 'access', 'service', 'wellness'] as const;
type ConciergeTipFor = (typeof CONCIERGE_TIP_FOR)[number];

const AFFILIATION_EXPECTED_TIERS = new Set([
  'relais_chateaux',
  'palace_atout_france',
  'four_seasons',
  'mandarin_oriental',
  'aman',
  'rosewood',
  'peninsula',
  'belmond',
  'ritz_carlton',
  'st_regis',
  'small_luxury_hotels',
]);

const AWARDS_EXPECTED_TIERS = new Set(['palace_atout_france', 'forbes_five_star', 'michelin_key']);

/* ── Types ── */

export type GapSeverity = 'blocker' | 'warn' | 'info';

export interface AuditGap {
  readonly field: string;
  readonly severity: GapSeverity;
  readonly message: string;
  readonly pipeline: string;
}

export interface ConciergeAdviceLocale {
  readonly title?: string;
  readonly body?: string;
  readonly tip_for?: string;
}

export interface ConciergeAdvicePayload {
  readonly fr?: ConciergeAdviceLocale;
  readonly en?: ConciergeAdviceLocale;
}

export interface LongDescriptionSection {
  readonly anchor?: string;
  readonly title_fr?: string;
  readonly title_en?: string;
  readonly body_fr?: string;
  readonly body_en?: string;
}

export interface HotelAuditRow {
  readonly slug: string;
  readonly name: string;
  readonly is_published: boolean;
  readonly luxury_tier: string | null;
  readonly country_code: string | null;
  readonly priority: string | null;
  readonly description_fr: string | null;
  readonly description_en: string | null;
  readonly meta_title_fr: string | null;
  readonly meta_title_en: string | null;
  readonly meta_desc_fr: string | null;
  readonly meta_desc_en: string | null;
  readonly factual_summary_fr: string | null;
  readonly factual_summary_en: string | null;
  readonly concierge_advice: ConciergeAdvicePayload | null;
  readonly faq_content: readonly FaqItemLike[] | null;
  readonly long_description_sections: readonly LongDescriptionSection[] | null;
  readonly highlights: unknown;
  readonly amenities: unknown;
  readonly points_of_interest: unknown;
  readonly transports: unknown;
  readonly restaurant_info: unknown;
  readonly spa_info: unknown;
  readonly policies: Record<string, unknown> | null;
  readonly awards: unknown;
  readonly affiliations: unknown;
  readonly signature_experiences: unknown;
  readonly number_of_rooms: number | null;
  readonly opened_at: string | null;
  readonly official_url: string | null;
  readonly wikidata_id: string | null;
  readonly hero_image: string | null;
  readonly gallery_images: unknown;
  readonly updated_at: string | null;
}

export type FicheStatus = 'complete' | 'partial' | 'gap' | 'draft';

export interface GateCheck {
  readonly id: string;
  readonly passed: boolean;
  readonly tier: 't0' | 't1' | 't2' | 't3';
}

export interface HotelAuditResult {
  readonly slug: string;
  readonly name: string;
  readonly is_published: boolean;
  readonly luxury_tier: string | null;
  readonly country_code: string | null;
  readonly priority: string | null;
  readonly score_t0: number;
  readonly score_t1: number;
  readonly score_t3: number;
  readonly status: FicheStatus;
  readonly indexable: boolean;
  readonly publish_gate_pass: boolean;
  readonly checks: readonly GateCheck[];
  readonly gaps: readonly AuditGap[];
}

/* ── Helpers ── */

export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/u)
    .filter((w) => w.length > 0).length;
}

function charLen(v: string | null | undefined): number {
  return v?.length ?? 0;
}

function jsonArrayLen(v: unknown): number {
  return Array.isArray(v) ? v.length : 0;
}

function wordCountInBand(text: string | null | undefined, min: number, max: number): boolean {
  if (text === null || text === undefined || text.trim().length === 0) return false;
  const n = countWords(text);
  return n >= min && n <= max;
}

function isTipForValid(v: string | undefined): v is ConciergeTipFor {
  if (v === undefined) return false;
  return (CONCIERGE_TIP_FOR as readonly string[]).includes(v);
}

function evaluateConciergeLocale(
  locale: ConciergeAdviceLocale | undefined,
  lang: 'fr' | 'en',
): { passed: boolean; gaps: AuditGap[] } {
  const gaps: AuditGap[] = [];
  const body = locale?.body ?? '';
  const words = countWords(body);
  if (words < ADVICE_BODY_MIN_WORDS) {
    gaps.push({
      field: `concierge_advice.${lang}.body`,
      severity: 'blocker',
      message: `${lang} body too short (${words} words, need ${ADVICE_BODY_MIN_WORDS}-${ADVICE_BODY_MAX_WORDS})`,
      pipeline: 'run-hotel-concierge-advice.ts',
    });
  } else if (words > ADVICE_BODY_MAX_WORDS) {
    gaps.push({
      field: `concierge_advice.${lang}.body`,
      severity: 'warn',
      message: `${lang} body too long (${words} words, max ${ADVICE_BODY_MAX_WORDS})`,
      pipeline: 'run-hotel-concierge-advice.ts',
    });
  }
  if (!isTipForValid(locale?.tip_for)) {
    gaps.push({
      field: `concierge_advice.${lang}.tip_for`,
      severity: 'blocker',
      message: `${lang} tip_for missing or invalid`,
      pipeline: 'run-hotel-concierge-advice.ts',
    });
  }
  return { passed: gaps.length === 0, gaps };
}

function longFormWordCount(row: HotelAuditRow): number {
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

function countValidLongSections(row: HotelAuditRow): number {
  const sections = row.long_description_sections ?? [];
  return sections.filter((s) => {
    const hasTitle =
      (typeof s.title_fr === 'string' && s.title_fr.trim().length > 0) ||
      (typeof s.title_en === 'string' && s.title_en.trim().length > 0);
    const hasBody =
      (typeof s.body_fr === 'string' && s.body_fr.trim().length > 0) ||
      (typeof s.body_en === 'string' && s.body_en.trim().length > 0);
    return hasTitle && hasBody;
  }).length;
}

function countLocalisedHighlights(row: HotelAuditRow): number {
  const items = row.highlights;
  if (!Array.isArray(items)) return 0;
  return items.filter((item) => {
    if (typeof item === 'string') return item.trim().length > 0;
    if (item !== null && typeof item === 'object') {
      const rec = item as Record<string, unknown>;
      const fr = rec['label_fr'] ?? rec['name_fr'];
      const en = rec['label_en'] ?? rec['name_en'];
      return (
        (typeof fr === 'string' && fr.trim().length > 0) ||
        (typeof en === 'string' && en.trim().length > 0)
      );
    }
    return false;
  }).length;
}

function countPoisWithDistance(row: HotelAuditRow): number {
  const items = row.points_of_interest;
  if (!Array.isArray(items)) return 0;
  return items.filter((item) => {
    if (item === null || typeof item !== 'object') return false;
    const rec = item as Record<string, unknown>;
    const hasDistance =
      typeof rec['distance_meters'] === 'number' ||
      typeof rec['distance_km'] === 'number' ||
      (typeof rec['distance_fr'] === 'string' && rec['distance_fr'].length > 0);
    return hasDistance;
  }).length;
}

function policiesIsSynthetic(row: HotelAuditRow): boolean {
  if (row.policies === null) return false;
  const flag = row.policies['_synthetic'];
  return flag === true;
}

function policiesHasCoreBlocks(row: HotelAuditRow): boolean {
  if (row.policies === null) return false;
  const keys = ['check_in', 'check_out', 'cancellation', 'pets', 'wifi'];
  return keys.every((k) => {
    const block = row.policies?.[k];
    return block !== null && block !== undefined && typeof block === 'object';
  });
}

function countVerifiedAffiliations(row: HotelAuditRow): number {
  if (!Array.isArray(row.affiliations)) return 0;
  return row.affiliations.filter((item) => {
    if (item === null || typeof item !== 'object') return false;
    const rec = item as Record<string, unknown>;
    return rec['verified'] === true;
  }).length;
}

function countAwards(row: HotelAuditRow): number {
  return jsonArrayLen(row.awards);
}

function hasRestaurantOrSpa(row: HotelAuditRow): boolean {
  const resto = row.restaurant_info;
  const spa = row.spa_info;
  const hasResto = resto !== null && typeof resto === 'object';
  const hasSpa = spa !== null && typeof spa === 'object';
  return hasResto || hasSpa;
}

function faqAnswersInWordBand(row: HotelAuditRow): boolean {
  const items = row.faq_content ?? [];
  if (items.length < FAQ_MIN_ITEMS) return false;
  return items.every((it) =>
    wordCountInBand(it.answer_fr, FAQ_ANSWER_MIN_WORDS, FAQ_ANSWER_MAX_WORDS),
  );
}

function addCheck(
  checks: GateCheck[],
  gaps: AuditGap[],
  id: string,
  tier: GateCheck['tier'],
  passed: boolean,
  gap?: AuditGap,
): void {
  checks.push({ id, passed, tier });
  if (!passed && gap !== undefined) gaps.push(gap);
}

function scoreFromChecks(checks: readonly GateCheck[], tier: GateCheck['tier']): number {
  const subset = checks.filter((c) => c.tier === tier);
  if (subset.length === 0) return 100;
  const passed = subset.filter((c) => c.passed).length;
  return Math.round((passed / subset.length) * 100);
}

export function deriveStatus(row: HotelAuditRow, scoreT3: number): FicheStatus {
  if (!row.is_published) return 'draft';
  if (scoreT3 >= T3_COMPLETE_THRESHOLD) return 'complete';
  if (scoreT3 >= T3_PARTIAL_THRESHOLD) return 'partial';
  return 'gap';
}

/* ── T0 — publish-eligible-drafts.ts ── */

export function evaluatePublishGate(row: HotelAuditRow): { pass: boolean; failures: string[] } {
  const failures: string[] = [];
  const descFr = row.description_fr ?? '';
  const descEn = row.description_en ?? '';
  if (descFr.length < DESCRIPTION_MIN_CHARS) {
    failures.push(`description_fr too short (${descFr.length} < ${DESCRIPTION_MIN_CHARS})`);
  }
  if (descEn.length < DESCRIPTION_MIN_CHARS) {
    failures.push(`description_en too short (${descEn.length} < ${DESCRIPTION_MIN_CHARS})`);
  }
  const mdFr = row.meta_desc_fr ?? '';
  const mdEn = row.meta_desc_en ?? '';
  if (mdFr.length < META_DESC_PUBLISH_MIN_CHARS || mdFr.length > META_DESC_PUBLISH_MAX_CHARS) {
    failures.push(`meta_desc_fr out of band (${mdFr.length} chars)`);
  }
  if (mdEn.length < META_DESC_PUBLISH_MIN_CHARS || mdEn.length > META_DESC_PUBLISH_MAX_CHARS) {
    failures.push(`meta_desc_en out of band (${mdEn.length} chars)`);
  }
  const fsFr = row.factual_summary_fr ?? '';
  const fsEn = row.factual_summary_en ?? '';
  if (
    fsFr.length < FACTUAL_SUMMARY_INDEX_MIN_CHARS ||
    fsFr.length > FACTUAL_SUMMARY_PUBLISH_MAX_CHARS
  ) {
    failures.push(`factual_summary_fr out of band (${fsFr.length} chars)`);
  }
  if (
    fsEn.length < FACTUAL_SUMMARY_INDEX_MIN_CHARS ||
    fsEn.length > FACTUAL_SUMMARY_PUBLISH_MAX_CHARS
  ) {
    failures.push(`factual_summary_en out of band (${fsEn.length} chars)`);
  }
  const ca = row.concierge_advice;
  if (ca === null) {
    failures.push('concierge_advice missing');
  } else {
    const wFr = countWords(ca.fr?.body ?? '');
    const wEn = countWords(ca.en?.body ?? '');
    if (wFr < PUBLISH_CONCIERGE_MIN_WORDS) {
      failures.push(`concierge_advice.fr.body too short (${wFr} words)`);
    }
    if (wEn < PUBLISH_CONCIERGE_MIN_WORDS) {
      failures.push(`concierge_advice.en.body too short (${wEn} words)`);
    }
  }
  const faqLen = jsonArrayLen(row.faq_content);
  if (faqLen < FAQ_MIN_ITEMS) {
    failures.push(`faq_content too short (${faqLen} items)`);
  }
  return { pass: failures.length === 0, failures };
}

/* ── T1 — indexability.ts (editorial path; photo path tracked separately) ── */

export function evaluateIndexability(row: HotelAuditRow): boolean {
  const hasHero = typeof row.hero_image === 'string' && row.hero_image.length > 0;
  const sections = row.long_description_sections ?? [];
  const galleryCount = jsonArrayLen(row.gallery_images);

  if (hasHero && (galleryCount >= 5 || sections.length > 0)) return true;
  if (sections.length > 0) return true;

  const descLen = charLen(row.description_fr);
  const factualLen = charLen(row.factual_summary_fr);
  const hasConcierge = row.concierge_advice !== null;
  const faqCount = jsonArrayLen(row.faq_content);

  return (
    descLen >= DESCRIPTION_MIN_CHARS &&
    factualLen >= FACTUAL_SUMMARY_INDEX_MIN_CHARS &&
    hasConcierge &&
    faqCount >= FAQ_MIN_ITEMS
  );
}

/* ── T3 — editorial excellence (SEO / GEO / agentique, no photos) ── */

export function evaluateHotelFiche(row: HotelAuditRow): HotelAuditResult {
  const checks: GateCheck[] = [];
  const gaps: AuditGap[] = [];

  // T0 checks mirrored as t0 tier
  const t0 = evaluatePublishGate(row);
  addCheck(checks, gaps, 't0.publish_gate', 't0', t0.pass, {
    field: 'publish_gate',
    severity: 'blocker',
    message: t0.failures.join('; ') || 'publish gate failed',
    pipeline: 'publish-eligible-drafts.ts',
  });

  // T1
  const indexable = evaluateIndexability(row);
  addCheck(checks, gaps, 't1.indexable', 't1', indexable, {
    field: 'indexability',
    severity: 'blocker',
    message: 'not indexable (editorial or photo-rich path)',
    pipeline: 'indexability.ts',
  });

  // A — metadata
  const mtFr = row.meta_title_fr ?? '';
  const mtFrOk = mtFr.length >= META_TITLE_MIN_CHARS && mtFr.length <= META_TITLE_MAX_CHARS;
  addCheck(checks, gaps, 't3.meta_title_fr', 't3', mtFrOk, {
    field: 'meta_title_fr',
    severity: 'blocker',
    message: `meta_title_fr out of band (${mtFr.length}, target ${META_TITLE_MIN_CHARS}-${META_TITLE_MAX_CHARS})`,
    pipeline: 'manual / seed-tier1-content.ts',
  });

  const mtEn = row.meta_title_en ?? '';
  const mtEnOk = mtEn.length >= META_TITLE_MIN_CHARS && mtEn.length <= META_TITLE_MAX_CHARS;
  addCheck(checks, gaps, 't3.meta_title_en', 't3', mtEnOk, {
    field: 'meta_title_en',
    severity: 'blocker',
    message: `meta_title_en out of band (${mtEn.length})`,
    pipeline: 'manual / seed-tier1-content.ts',
  });

  const mdFr = row.meta_desc_fr ?? '';
  const mdFrOk = mdFr.length >= META_DESC_MIN_CHARS && mdFr.length <= META_DESC_MAX_CHARS;
  addCheck(checks, gaps, 't3.meta_desc_fr', 't3', mdFrOk, {
    field: 'meta_desc_fr',
    severity: 'blocker',
    message: `meta_desc_fr out of band (${mdFr.length}, target ${META_DESC_MIN_CHARS}-${META_DESC_MAX_CHARS})`,
    pipeline: 'run-hotel-meta-desc.ts',
  });

  const mdEn = row.meta_desc_en ?? '';
  const mdEnOk = mdEn.length >= META_DESC_MIN_CHARS && mdEn.length <= META_DESC_MAX_CHARS;
  addCheck(checks, gaps, 't3.meta_desc_en', 't3', mdEnOk, {
    field: 'meta_desc_en',
    severity: 'blocker',
    message: `meta_desc_en out of band (${mdEn.length})`,
    pipeline: 'run-hotel-meta-desc.ts',
  });

  const fsFr = row.factual_summary_fr ?? '';
  const fsFrLenOk =
    fsFr.length >= FACTUAL_SUMMARY_MIN_CHARS && fsFr.length <= FACTUAL_SUMMARY_MAX_CHARS;
  addCheck(checks, gaps, 't3.factual_summary_fr.length', 't3', fsFrLenOk, {
    field: 'factual_summary_fr',
    severity: 'blocker',
    message: `factual_summary_fr length (${fsFr.length}, target ${FACTUAL_SUMMARY_MIN_CHARS}-${FACTUAL_SUMMARY_MAX_CHARS})`,
    pipeline: 'run-hotel-factual-summary.ts',
  });

  const fsEn = row.factual_summary_en ?? '';
  const fsEnLenOk =
    fsEn.length >= FACTUAL_SUMMARY_MIN_CHARS && fsEn.length <= FACTUAL_SUMMARY_MAX_CHARS;
  addCheck(checks, gaps, 't3.factual_summary_en.length', 't3', fsEnLenOk, {
    field: 'factual_summary_en',
    severity: 'blocker',
    message: `factual_summary_en length (${fsEn.length})`,
    pipeline: 'run-hotel-factual-summary.ts',
  });

  if (fsFrLenOk && fsEnLenOk) {
    const formatOk = gateFactualSummaryFormat({ fr: fsFr, en: fsEn }) === null;
    addCheck(checks, gaps, 't3.factual_summary.format', 't3', formatOk, {
      field: 'factual_summary',
      severity: 'warn',
      message: gateFactualSummaryFormat({ fr: fsFr, en: fsEn }) ?? 'format invalid',
      pipeline: 'run-hotel-factual-summary.ts',
    });
  }

  // B — narrative body
  const sectionCount = countValidLongSections(row);
  const sectionsOk = sectionCount >= LONG_SECTIONS_MIN_COUNT;
  addCheck(checks, gaps, 't3.long_description_sections', 't3', sectionsOk, {
    field: 'long_description_sections',
    severity: 'blocker',
    message: `${sectionCount} sections (need ≥ ${LONG_SECTIONS_MIN_COUNT})`,
    pipeline: 'editorial-pilot 8-pass / extend long-form',
  });

  const longWords = longFormWordCount(row);
  const longWordsOk = longWords >= LONG_FORM_MIN_WORDS;
  addCheck(checks, gaps, 't3.long_form_words_fr', 't3', longWordsOk, {
    field: 'long_description_sections',
    severity: 'blocker',
    message: `${longWords} words FR (need ≥ ${LONG_FORM_MIN_WORDS})`,
    pipeline: 'editorial-pilot 8-pass / extend long-form',
  });

  const descFrOk = charLen(row.description_fr) >= DESCRIPTION_MIN_CHARS;
  addCheck(checks, gaps, 't3.description_fr.min', 't3', descFrOk, {
    field: 'description_fr',
    severity: 'blocker',
    message: `description_fr ${charLen(row.description_fr)} chars (min ${DESCRIPTION_MIN_CHARS})`,
    pipeline: 'run-hotel-description-extend.ts',
  });

  const descFrIdeal = charLen(row.description_fr) >= DESCRIPTION_IDEAL_MIN_CHARS;
  addCheck(checks, gaps, 't3.description_fr.ideal', 't3', descFrIdeal, {
    field: 'description_fr',
    severity: 'warn',
    message: `description_fr ${charLen(row.description_fr)} chars (ideal ≥ ${DESCRIPTION_IDEAL_MIN_CHARS})`,
    pipeline: 'run-hotel-description-extend.ts',
  });

  const descEnOk = charLen(row.description_en) >= DESCRIPTION_MIN_CHARS;
  addCheck(checks, gaps, 't3.description_en.min', 't3', descEnOk, {
    field: 'description_en',
    severity: 'blocker',
    message: `description_en ${charLen(row.description_en)} chars`,
    pipeline: 'run-hotel-description-extend.ts',
  });

  const hlCount = countLocalisedHighlights(row);
  const hlOk = hlCount >= HIGHLIGHTS_MIN_COUNT;
  addCheck(checks, gaps, 't3.highlights', 't3', hlOk, {
    field: 'highlights',
    severity: 'warn',
    message: `${hlCount} highlights (need ≥ ${HIGHLIGHTS_MIN_COUNT})`,
    pipeline: 'enrichment / editorial pipeline',
  });

  // C — Concierge advice
  const adviceFr = evaluateConciergeLocale(row.concierge_advice?.fr, 'fr');
  addCheck(checks, gaps, 't3.concierge_advice.fr', 't3', adviceFr.passed, adviceFr.gaps[0]);
  for (const g of adviceFr.gaps.slice(1)) gaps.push(g);

  const adviceEn = evaluateConciergeLocale(row.concierge_advice?.en, 'en');
  addCheck(checks, gaps, 't3.concierge_advice.en', 't3', adviceEn.passed, adviceEn.gaps[0]);
  for (const g of adviceEn.gaps.slice(1)) gaps.push(g);

  // D — FAQ
  const faqLen = jsonArrayLen(row.faq_content);
  const faqCountOk = faqLen >= FAQ_MIN_ITEMS;
  addCheck(checks, gaps, 't3.faq.count', 't3', faqCountOk, {
    field: 'faq_content',
    severity: 'blocker',
    message: `${faqLen} FAQ items (need ≥ ${FAQ_MIN_ITEMS})`,
    pipeline: 'extend-faq-postgrest.ts / run-faq-canonical.ts',
  });

  const faqCanonical = isFaqCanonicalSet(row.faq_content, row.name);
  addCheck(checks, gaps, 't3.faq.canonical', 't3', faqCanonical, {
    field: 'faq_content',
    severity: 'blocker',
    message: 'FAQ set is not the 10 CDC canonical questions',
    pipeline: 'run-faq-canonical.ts',
  });

  const featuredCount = countFeaturedFaq(row.faq_content);
  const featuredOk = featuredCount === FEATURED_FAQ_COUNT;
  addCheck(checks, gaps, 't3.faq.featured', 't3', featuredOk, {
    field: 'faq_content.featured',
    severity: 'blocker',
    message: `${featuredCount} featured FAQ (need exactly ${FEATURED_FAQ_COUNT})`,
    pipeline: 'run-humanizer-faq.ts',
  });

  const faqWordsOk = faqAnswersInWordBand(row);
  addCheck(checks, gaps, 't3.faq.answer_words', 't3', faqWordsOk, {
    field: 'faq_content.answer_fr',
    severity: 'warn',
    message: `FAQ answers outside ${FAQ_ANSWER_MIN_WORDS}-${FAQ_ANSWER_MAX_WORDS} words band`,
    pipeline: 'run-faq-canonical.ts',
  });

  const tipCount = countFeaturedFaqTips(row.faq_content);
  const tipsOk = tipCount >= FEATURED_FAQ_TIPS_MIN;
  addCheck(checks, gaps, 't3.faq.concierge_tips', 't3', tipsOk, {
    field: 'faq_content.concierge_tip_fr',
    severity: 'warn',
    message: `${tipCount} featured tips (need ${FEATURED_FAQ_TIPS_MIN})`,
    pipeline: 'run-humanizer-faq.ts',
  });

  // E — structured blocks
  const policiesPresent = row.policies !== null;
  addCheck(checks, gaps, 't3.policies.present', 't3', policiesPresent, {
    field: 'policies',
    severity: 'blocker',
    message: 'policies missing',
    pipeline: 'Tavily enrichment + migration 0055 backfill',
  });

  if (policiesPresent) {
    const notSynthetic = !policiesIsSynthetic(row);
    addCheck(checks, gaps, 't3.policies.real', 't3', notSynthetic, {
      field: 'policies',
      severity: 'warn',
      message: 'policies are synthetic defaults (_synthetic: true)',
      pipeline: 'Google Places / Tavily enrichment',
    });
    const coreOk = policiesHasCoreBlocks(row);
    addCheck(checks, gaps, 't3.policies.core_blocks', 't3', coreOk, {
      field: 'policies',
      severity: 'warn',
      message: 'policies missing core sub-blocks (check_in/out/cancel/pets/wifi)',
      pipeline: 'Google Places / Tavily enrichment',
    });
  }

  const poiCount = countPoisWithDistance(row);
  const poiOk = poiCount >= POIS_MIN_COUNT;
  addCheck(checks, gaps, 't3.points_of_interest', 't3', poiOk, {
    field: 'points_of_interest',
    severity: 'warn',
    message: `${poiCount} POIs with distance (need ≥ ${POIS_MIN_COUNT})`,
    pipeline: 'pois:sync',
  });

  const transportCount = jsonArrayLen(row.transports);
  const transportOk = transportCount >= TRANSPORTS_MIN_COUNT;
  addCheck(checks, gaps, 't3.transports', 't3', transportOk, {
    field: 'transports',
    severity: 'warn',
    message: `${transportCount} transport modes (need ≥ ${TRANSPORTS_MIN_COUNT})`,
    pipeline: 'enrichment pipeline',
  });

  const restoSpaOk = hasRestaurantOrSpa(row);
  addCheck(checks, gaps, 't3.restaurant_or_spa', 't3', restoSpaOk, {
    field: 'restaurant_info|spa_info',
    severity: 'info',
    message: 'neither restaurant_info nor spa_info populated',
    pipeline: 'enrichment pipeline',
  });

  const tier = row.luxury_tier ?? '';
  if (AFFILIATION_EXPECTED_TIERS.has(tier)) {
    const affCount = countVerifiedAffiliations(row);
    const affOk = affCount >= 1;
    addCheck(checks, gaps, 't3.affiliations.verified', 't3', affOk, {
      field: 'affiliations',
      severity: 'warn',
      message: `no verified affiliation for tier ${tier}`,
      pipeline: 'affiliations backfill / ADR-0023',
    });
  }

  if (AWARDS_EXPECTED_TIERS.has(tier)) {
    const awardsOk = countAwards(row) >= 1;
    addCheck(checks, gaps, 't3.awards', 't3', awardsOk, {
      field: 'awards',
      severity: 'info',
      message: `no awards for tier ${tier}`,
      pipeline: 'Payload awards collection',
    });
  }

  const roomsOk = row.number_of_rooms !== null && row.number_of_rooms > 0;
  addCheck(checks, gaps, 't3.number_of_rooms', 't3', roomsOk, {
    field: 'number_of_rooms',
    severity: 'info',
    message: 'number_of_rooms missing',
    pipeline: 'Wikidata / Tavily enrichment',
  });

  const openedOk = row.opened_at !== null && row.opened_at.length > 0;
  addCheck(checks, gaps, 't3.opened_at', 't3', openedOk, {
    field: 'opened_at',
    severity: 'info',
    message: 'opened_at missing',
    pipeline: 'Wikidata / Tavily enrichment',
  });

  const eeatOk =
    (typeof row.official_url === 'string' && row.official_url.length > 0) ||
    (typeof row.wikidata_id === 'string' && row.wikidata_id.length > 0);
  addCheck(checks, gaps, 't3.eeat_ids', 't3', eeatOk, {
    field: 'official_url|wikidata_id',
    severity: 'warn',
    message: 'no official_url or wikidata_id',
    pipeline: 'enrich-wikidata-ids.ts',
  });

  const amenitiesPresent = jsonArrayLen(row.amenities) >= 1;
  addCheck(checks, gaps, 't3.amenities.present', 't3', amenitiesPresent, {
    field: 'amenities',
    severity: 'info',
    message: 'amenities empty',
    pipeline: 'amenities enrichment (future)',
  });

  const sigOk = jsonArrayLen(row.signature_experiences) >= 1;
  addCheck(checks, gaps, 't3.signature_experiences', 't3', sigOk, {
    field: 'signature_experiences',
    severity: 'info',
    message: 'signature_experiences empty',
    pipeline: 'editorial pipeline',
  });

  const scoreT0 = scoreFromChecks(checks, 't0');
  const scoreT1 = indexable ? 100 : 0;
  const scoreT3 = scoreFromChecks(checks, 't3');
  const status = deriveStatus(row, scoreT3);

  return {
    slug: row.slug,
    name: row.name,
    is_published: row.is_published,
    luxury_tier: row.luxury_tier,
    country_code: row.country_code,
    priority: row.priority,
    score_t0: scoreT0,
    score_t1: scoreT1,
    score_t3: scoreT3,
    status,
    indexable,
    publish_gate_pass: t0.pass,
    checks,
    gaps,
  };
}

export function aggregateGapCounts(
  results: readonly HotelAuditResult[],
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const r of results) {
    const seenFields = new Set<string>();
    for (const g of r.gaps) {
      if (seenFields.has(g.field)) continue;
      seenFields.add(g.field);
      counts.set(g.field, (counts.get(g.field) ?? 0) + 1);
    }
  }
  return counts;
}

export { CANONICAL_FAQ_QUESTIONS };
