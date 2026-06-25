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

/* ── DataForSEO PAA coverage gate (PO directive — "check par data seo") ───── */

export interface PaaCoverageResult {
  /** false when DFS was off / returned zero PAA (coverage is then 100, no warn). */
  readonly grounded: boolean;
  /** Number of PAA questions evaluated (those carrying ≥ 1 content token). */
  readonly total: number;
  /** PAA questions covered by ≥ 1 generated Q&A. */
  readonly matched: number;
  /** matched / total × 100 (rounded). 100 when nothing to evaluate. */
  readonly coveragePct: number;
  /** PAA questions left uncovered (capped for logging). */
  readonly uncovered: readonly string[];
}

/**
 * FR + EN stopwords stripped before token-overlap matching. Kept short and
 * high-frequency — the goal is to leave the *content* words (subject of the
 * question) so a soft overlap match is meaningful.
 */
const PAA_STOPWORDS: ReadonlySet<string> = new Set([
  // fr
  'le',
  'la',
  'les',
  'un',
  'une',
  'des',
  'de',
  'du',
  'dans',
  'et',
  'ou',
  'à',
  'au',
  'aux',
  'en',
  'est',
  'sont',
  'que',
  'qui',
  'quoi',
  'quel',
  'quelle',
  'quels',
  'quelles',
  'quand',
  'comment',
  'combien',
  'pourquoi',
  'où',
  'ce',
  'cet',
  'cette',
  'ces',
  'son',
  'sa',
  'ses',
  'leur',
  'leurs',
  'pour',
  'par',
  'sur',
  'avec',
  'sans',
  'plus',
  'moins',
  'peut',
  'on',
  'y',
  'il',
  'elle',
  'ils',
  'elles',
  'vous',
  'nous',
  'se',
  'ne',
  'pas',
  'faut',
  'faire',
  'y-a-t-il',
  'y-a',
  'a-t-il',
  // en
  'the',
  'a',
  'an',
  'of',
  'in',
  'on',
  'at',
  'to',
  'for',
  'and',
  'or',
  'is',
  'are',
  'do',
  'does',
  'can',
  'what',
  'which',
  'who',
  'whom',
  'when',
  'how',
  'many',
  'much',
  'why',
  'where',
  'this',
  'that',
  'these',
  'those',
  'with',
  'without',
  'their',
  'its',
  'you',
  'we',
  'it',
  'they',
  'there',
  'near',
  'best',
  'good',
]);

function paaContentTokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !PAA_STOPWORDS.has(t));
}

/**
 * Evaluate how well the generated FAQ + concierge Q&A cover the REAL
 * People-Also-Ask demand pulled from DataForSEO.
 *
 * Soft matching: a PAA question is "covered" when at least
 * `minTokenOverlap` (default 60 %) of its content tokens appear inside a
 * single generated Q&A blob (`question_fr` + `answer_fr`). This is
 * intentionally lenient — the gate is an observability signal logged as
 * `dfs_paa_coverage=<pct>`, never a hard publish blocker (PO: "le moins
 * destructif mais trace-le"). Skill: keyword-grounding-dataforseo §FAQ kit.
 */
export function evaluatePaaCoverage(
  faqBlobs: readonly string[],
  peopleAlsoAsk: readonly string[],
  options: { readonly minTokenOverlap?: number; readonly maxUncovered?: number } = {},
): PaaCoverageResult {
  if (peopleAlsoAsk.length === 0) {
    return { grounded: false, total: 0, matched: 0, coveragePct: 100, uncovered: [] };
  }
  const threshold = options.minTokenOverlap ?? 0.6;
  const maxUncovered = options.maxUncovered ?? 8;
  const haystacks = faqBlobs.map((t) => new Set(paaContentTokens(t)));

  let total = 0;
  let matched = 0;
  const uncovered: string[] = [];
  for (const paa of peopleAlsoAsk) {
    const tokens = paaContentTokens(paa);
    if (tokens.length === 0) continue;
    total += 1;
    const need = Math.max(1, Math.ceil(tokens.length * threshold));
    const covered = haystacks.some((hs) => {
      let hit = 0;
      for (const tok of tokens) if (hs.has(tok)) hit += 1;
      return hit >= need;
    });
    if (covered) matched += 1;
    else if (uncovered.length < maxUncovered) uncovered.push(paa);
  }

  const coveragePct = total === 0 ? 100 : Math.round((matched / total) * 100);
  return { grounded: true, total, matched, coveragePct, uncovered };
}
