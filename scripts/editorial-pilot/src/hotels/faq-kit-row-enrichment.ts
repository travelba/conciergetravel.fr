/**
 * Row-level Perplexity FAQ kit enrichment gates — shared by CDC audit,
 * publish gate, validate/push CLI, and golden-template normalizers.
 *
 * Policy: every published hotel must eventually pass these checks (2219+ catalogue).
 * Skill: hotel-faq-perplexity-enrichment §Rule 7.
 */

import { isFaqCanonicalSet } from './canonical-faq-questions.js';
import { evaluateFaqKitCoverage } from './faq-perplexity-gates.js';
import {
  CONCIERGE_QUESTION_CATEGORIES_FR,
  FAQ_KIT_MIN_ITEMS,
  FAQ_PROMOTE_MIN_ITEMS,
  type NormalisedConciergeQuestion,
  type NormalisedFaqKitItem,
} from './faq-perplexity-taxonomy.js';

export interface FaqKitRowEnrichmentIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: 'blocker' | 'warn';
}

export interface FaqKitRowEnrichmentResult {
  readonly ok: boolean;
  readonly kitCount: number;
  readonly conciergeCount: number;
  readonly issues: readonly FaqKitRowEnrichmentIssue[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function parseKitItems(raw: unknown): NormalisedFaqKitItem[] {
  if (!Array.isArray(raw)) return [];
  const out: NormalisedFaqKitItem[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const category = item['category'];
    const group_fr = item['group_fr'];
    const group_en = item['group_en'];
    const question_fr = item['question_fr'];
    const answer_fr = item['answer_fr'];
    if (
      category !== 'before' &&
      category !== 'during' &&
      category !== 'after' &&
      category !== 'agency'
    ) {
      continue;
    }
    if (
      typeof group_fr !== 'string' ||
      typeof group_en !== 'string' ||
      typeof question_fr !== 'string' ||
      typeof answer_fr !== 'string'
    ) {
      continue;
    }
    const question_en = item['question_en'];
    const answer_en = item['answer_en'];
    const featured = item['featured'];
    out.push({
      category,
      group_fr,
      group_en,
      question_fr,
      answer_fr,
      ...(typeof question_en === 'string' && question_en.length > 0 ? { question_en } : {}),
      ...(typeof answer_en === 'string' && answer_en.length > 0 ? { answer_en } : {}),
      ...(featured === true ? { featured: true } : {}),
    });
  }
  return out;
}

function parseConciergeItems(raw: unknown): NormalisedConciergeQuestion[] {
  if (!Array.isArray(raw)) return [];
  const out: NormalisedConciergeQuestion[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const category_fr = item['category_fr'];
    const category_en = item['category_en'];
    const question_fr = item['question_fr'];
    const reply_fr = item['reply_fr'];
    if (
      typeof category_fr !== 'string' ||
      typeof category_en !== 'string' ||
      typeof question_fr !== 'string' ||
      typeof reply_fr !== 'string'
    ) {
      continue;
    }
    const base: NormalisedConciergeQuestion = {
      category_fr,
      category_en,
      question_fr,
      reply_fr,
    };
    const question_en = item['question_en'];
    const reply_en = item['reply_en'];
    out.push({
      ...base,
      ...(typeof question_en === 'string' && question_en.length > 0 ? { question_en } : {}),
      ...(typeof reply_en === 'string' && reply_en.length > 0 ? { reply_en } : {}),
    });
  }
  return out;
}

function parsePromoteItems(raw: unknown): NormalisedFaqKitItem[] {
  return parseKitItems(raw);
}

/** Prohibited first-person concierge commitment (CDC D10 — informative tone). */
const CONCIERGE_COMMITMENT_FR = /^\s*(je|j[''])\b/i;
const CONCIERGE_COMMITMENT_EN = /^\s*i\b/i;

function conciergeReplyUsesCommitmentTone(replyFr: string, replyEn: string | undefined): boolean {
  if (CONCIERGE_COMMITMENT_FR.test(replyFr.trim())) return true;
  if (typeof replyEn === 'string' && CONCIERGE_COMMITMENT_EN.test(replyEn.trim())) return true;
  return false;
}

/** True when kit volume is high enough to enforce enrichment gates (not just count). */
export function hasFaqKitEnrichmentSurface(kitCount: number): boolean {
  return kitCount >= FAQ_KIT_MIN_ITEMS;
}

/**
 * Perplexity enrichment gates for a hotel DB row (kit + concierge + promote).
 * When kit count < FAQ_KIT_MIN_ITEMS, only volume issues are reported upstream;
 * taxonomy / EN gates are skipped (catalogue not yet enriched).
 */
export function evaluateFaqKitRowEnrichment(params: {
  readonly hotelName: string;
  readonly faq_content_kit: unknown;
  readonly faq_content: unknown;
  readonly concierge_questions: unknown;
}): FaqKitRowEnrichmentResult {
  const kit = parseKitItems(params.faq_content_kit);
  const concierge = parseConciergeItems(params.concierge_questions);
  const promote = parsePromoteItems(params.faq_content);
  const issues: FaqKitRowEnrichmentIssue[] = [];

  if (!hasFaqKitEnrichmentSurface(kit.length)) {
    return { ok: true, kitCount: kit.length, conciergeCount: concierge.length, issues };
  }

  const coverage = evaluateFaqKitCoverage(kit, concierge, params.hotelName, promote);
  for (const issue of coverage.issues) {
    issues.push({
      code: issue.code,
      message: issue.message,
      severity: issue.severity,
    });
  }

  const kitMissingEn = kit.filter(
    (item) =>
      typeof item.question_en !== 'string' ||
      item.question_en.trim().length === 0 ||
      typeof item.answer_en !== 'string' ||
      item.answer_en.trim().length === 0,
  ).length;
  if (kitMissingEn > 0) {
    issues.push({
      code: 'kit.en_parity',
      message: `${kitMissingEn}/${kit.length} kit FAQ items missing EN question or answer`,
      severity: 'blocker',
    });
  }

  const conciergeMissingEn = concierge.filter(
    (item) =>
      typeof item.question_en !== 'string' ||
      item.question_en.trim().length === 0 ||
      typeof item.reply_en !== 'string' ||
      item.reply_en.trim().length === 0,
  ).length;
  if (conciergeMissingEn > 0) {
    issues.push({
      code: 'concierge.en_parity',
      message: `${conciergeMissingEn}/${concierge.length} concierge questions missing EN question or reply`,
      severity: 'blocker',
    });
  }

  const invalidConciergeCategories = concierge.filter(
    (item) => !(CONCIERGE_QUESTION_CATEGORIES_FR as readonly string[]).includes(item.category_fr),
  );
  if (invalidConciergeCategories.length > 0) {
    issues.push({
      code: 'concierge.taxonomy',
      message: `${invalidConciergeCategories.length} concierge items use non-allowlist category_fr`,
      severity: 'blocker',
    });
  }

  const commitmentTone = concierge.filter((item) =>
    conciergeReplyUsesCommitmentTone(item.reply_fr, item.reply_en),
  );
  if (commitmentTone.length > 0) {
    issues.push({
      code: 'concierge.informative_tone',
      message: `${commitmentTone.length} concierge replies use first-person commitment (CDC D10 — use informative tone)`,
      severity: 'blocker',
    });
  }

  if (promote.length < FAQ_PROMOTE_MIN_ITEMS) {
    issues.push({
      code: 'promote.count',
      message: `faq_content promote too short (${promote.length} < ${FAQ_PROMOTE_MIN_ITEMS})`,
      severity: 'blocker',
    });
  }

  if (!isFaqCanonicalSet(promote, params.hotelName)) {
    issues.push({
      code: 'promote.canonical',
      message: 'faq_content promote missing CDC canonical FAQ questions',
      severity: 'blocker',
    });
  }

  const blockers = issues.filter((i) => i.severity === 'blocker');
  return {
    ok: blockers.length === 0,
    kitCount: kit.length,
    conciergeCount: concierge.length,
    issues,
  };
}
