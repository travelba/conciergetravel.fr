/**
 * Validation gates for Perplexity FAQ kit coverage (audit + push guard).
 */

import {
  CONCIERGE_QUESTIONS_MIN,
  FAQ_FACTUAL_CATEGORIES_FR,
  FAQ_KIT_MIN_ITEMS,
  FAQ_KIT_MIN_PER_CATEGORY,
  FAQ_PROMOTE_MIN_ITEMS,
  type NormalisedConciergeQuestion,
  type NormalisedFaqKitItem,
  PerplexityHotelFaqResearchSchema,
  type PerplexityHotelFaqResearch,
} from './faq-perplexity-taxonomy.js';
import { isFaqCanonicalSet } from './canonical-faq-questions.js';

export interface FaqKitGateIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: 'blocker' | 'warn';
}

export interface FaqKitGateResult {
  readonly ok: boolean;
  readonly issues: readonly FaqKitGateIssue[];
}

function countByCategory(items: readonly { readonly group_fr: string }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.group_fr, (counts.get(item.group_fr) ?? 0) + 1);
  }
  return counts;
}

export function parsePerplexityHotelFaqResearch(
  raw: unknown,
):
  | { readonly ok: true; readonly data: PerplexityHotelFaqResearch }
  | { readonly ok: false; readonly issues: readonly FaqKitGateIssue[] } {
  const parsed = PerplexityHotelFaqResearchSchema.safeParse(raw);
  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }
  const issues: FaqKitGateIssue[] = parsed.error.issues.map((issue) => ({
    code: 'schema',
    message: `${issue.path.join('.')}: ${issue.message}`,
    severity: 'blocker',
  }));
  return { ok: false, issues };
}

export function evaluateFaqKitCoverage(
  kit: readonly NormalisedFaqKitItem[],
  conciergeQuestions: readonly NormalisedConciergeQuestion[],
  hotelName: string,
  promote: readonly NormalisedFaqKitItem[],
): FaqKitGateResult {
  const issues: FaqKitGateIssue[] = [];

  if (kit.length < FAQ_KIT_MIN_ITEMS) {
    issues.push({
      code: 'kit.count',
      message: `faq kit too short (${kit.length} < ${FAQ_KIT_MIN_ITEMS})`,
      severity: 'blocker',
    });
  }

  if (conciergeQuestions.length < CONCIERGE_QUESTIONS_MIN) {
    issues.push({
      code: 'concierge.count',
      message: `concierge_questions too short (${conciergeQuestions.length} < ${CONCIERGE_QUESTIONS_MIN})`,
      severity: 'blocker',
    });
  }

  const categoryCounts = countByCategory(kit);
  for (const category of FAQ_FACTUAL_CATEGORIES_FR) {
    const count = categoryCounts.get(category) ?? 0;
    if (count < FAQ_KIT_MIN_PER_CATEGORY) {
      issues.push({
        code: 'kit.category',
        message: `category "${category}" has ${count} questions (need ≥ ${FAQ_KIT_MIN_PER_CATEGORY})`,
        severity: 'warn',
      });
    }
  }

  if (promote.length < FAQ_PROMOTE_MIN_ITEMS) {
    issues.push({
      code: 'promote.count',
      message: `promote subset too short (${promote.length} < ${FAQ_PROMOTE_MIN_ITEMS})`,
      severity: 'blocker',
    });
  }

  if (!isFaqCanonicalSet(promote, hotelName)) {
    issues.push({
      code: 'promote.canonical',
      message: 'promote subset missing one or more CDC canonical FAQ questions',
      severity: 'blocker',
    });
  }

  const blockers = issues.filter((i) => i.severity === 'blocker');
  return { ok: blockers.length === 0, issues };
}
