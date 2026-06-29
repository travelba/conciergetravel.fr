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
 * Accent-stripped lower-case copy used for noise-pattern matching only.
 * (Celebrity/salary/biography PAA come back from DataForSEO in FR + EN with
 * mixed casing and accents.)
 */
function normaliseForNoise(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * PAA "noise" patterns — questions DataForSEO returns for a hotel/place seed
 * that are real SERP demand but lie OUTSIDE the editorial scope of a hotel
 * fiche. The LLM is *instructed to ignore them by design* (skill
 * keyword-grounding-dataforseo §Rule 2), so counting them in the
 * `dfs_paa_coverage` denominator made the KPI falsely low (0-15 % on good
 * fiches). We exclude them from the denominator BEFORE computing the ratio.
 *
 * Intentionally conservative — only clearly off-topic families are listed.
 * Anything touching room price, services, access, dining, spa, family, pets,
 * accessibility, sustainability or location is NOT here and stays counted.
 *
 * Matched against the accent-stripped lower-case form, except the two
 * "<Proper Name> stays/lives" patterns which need original casing to spot a
 * person's full name (run on the raw string).
 */
const PAA_NOISE_PATTERNS: readonly RegExp[] = [
  // Celebrity / people: "Quelle star habite à Gordes ?", "Which celebrities…",
  // "Famous people who…", "Qui vit à…", "Where do celebrities stay".
  /\bcelebrit/, // celebrity / celebrities / celebrite(s)
  /\b(quelle?|which) (star|stars|personnalite)\b/,
  /\bfamous (people|person|celebrit)/,
  /\bdes (stars|celebrites|people)\b/,
  // "Who lives / owns…", "Qui habite / vit / possède…", "Où vit…".
  /\b(qui|who) (habite|vit|loge|lives?|owns?)\b/,
  /\b(ou|where) (vit|habite|lives?)\b/,
  /\b(proprietaire|owner) (de|of)\b/,
  // Wealth / biography: net worth, richest, fortune, biography, age.
  /\bnet worth\b/,
  /\b(richest|wealthiest)\b/,
  /\b(le |la )?plus riche\b/,
  /\bfortune (de|of|du|des)\b/,
  /\bbiograph(y|ie)\b/,
  // Staff salaries: "salaire", "combien gagne", "how much do … earn/make".
  /\bsalaire\b/,
  /\bsalary\b/,
  /\bcombien gagne\b/,
  /\bhow much (do|does)\b[^?]*\b(earn|make|paid|salary)\b/,
  // Attraction free-admission (NOT a hotel amenity — "free wifi/parking" stay):
  // "Is entry to Palm Jumeirah free?", "Entrée gratuite du musée…".
  /\bfree (entry|entrance|admission)\b/,
  /\b(entry|entrance|admission)\b[^?]*\bfree\b/,
  /\b(entree|visite) (gratuite|libre)\b/,
  // "Where do (the) rich / wealthy / affluent / billionaires stay" — wealth-
  // class gossip, not a lodging question (no capitalised name → not caught by
  // the person-stay patterns below). "Où logent les riches".
  /\bwhere do(?:es)?\s+(?:the\s+)?(?:rich|wealthy|affluent|billionaire)\b/,
  /\b(?:rich|wealthy|billionaire|millionaire)s?\s+stay\b/,
  /\bou\s+(?:logent|sejournent|vont)\s+les\s+riches\b/,
  // Travel-etiquette trivia: "What is the 5 minute rule in Japan?", "the 15-5
  // rule" — onsen/queue folklore, outside a hotel ranking's editorial scope.
  /\bthe \d[\d\s-]*(?:minute|min|hour|second)?\s*rule\b/,
];

/**
 * Case-sensitive patterns for "Where does <Person Full Name> stay/live" and the
 * FR "Où séjourne <Nom> ?" — a person's name is two+ capitalised words, which
 * is what separates a celebrity-stay question from a legit "where can I stay
 * near…" lodging question.
 */
const PAA_PERSON_STAY_PATTERNS: readonly RegExp[] = [
  /\b[Ww]here\s+(?:do|does|did)\s+(?:[A-Z][\p{L}.'-]+\s+){1,3}(?:stay|stays|stayed|sleep|sleeps|slept|live|lives|lived)\b/u,
  /\b[OoÔô]ù?\s+(?:sejourne|séjourne|loge|dort|vit|habite|reside|réside)\s+(?:[A-Z][\p{L}.'-]+\s*){1,3}/u,
  // EN dominant celebrity shape: "What/Which hotel did/does <Full Name>
  // stay/sleep (in)?" — Kim Kardashian, Meghan Markle, Taylor Swift, Kate
  // Middleton… A two+ capitalised-word name separates this from a legit
  // "what hotel should I stay at" lodging question (lower-case "I").
  /\b(?:What|Which)\s+hotel\s+(?:did|does|do)\s+(?:[A-Z][\p{L}.'-]+\s+){1,3}(?:stay|stays|stayed|sleep|sleeps|slept|live|lives|lived)\b/u,
];

/**
 * True when a PAA question is within the editorial scope of a hotel fiche.
 * Used to filter the `dfs_paa_coverage` denominator (observability only — it
 * never changes generation or publication). See `PAA_NOISE_PATTERNS`.
 */
export function isEditoriallyRelevantPaa(question: string): boolean {
  const normalised = normaliseForNoise(question);
  if (PAA_NOISE_PATTERNS.some((re) => re.test(normalised))) return false;
  if (PAA_PERSON_STAY_PATTERNS.some((re) => re.test(question))) return false;
  return true;
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
 *
 * Editorially off-topic PAA (celebrity / salary / biography / attraction
 * free-entry — see `isEditoriallyRelevantPaa`) are dropped from the
 * denominator BEFORE the ratio, because the LLM ignores them by design; left
 * in, they made the KPI falsely low (0-15 %) on good fiches. This filter
 * touches the logged metric only — never the generation or the publish gate.
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
  // Denominator = real editorial demand only (drop the noise the LLM ignores).
  const relevantPaa = peopleAlsoAsk.filter(isEditoriallyRelevantPaa);

  let total = 0;
  let matched = 0;
  const uncovered: string[] = [];
  for (const paa of relevantPaa) {
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
