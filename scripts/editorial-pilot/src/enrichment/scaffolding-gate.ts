/**
 * Shared anti-scaffolding gate (ADR-0029, invariant I1).
 *
 * Single source of truth for detecting leaked brief / pipeline
 * meta-commentary in editorial prose. Used by BOTH:
 *   - the surgical cleaner `hotels/descaffold-sections.ts` (candidate
 *     selection + post-strip validation), and
 *   - the hardened deep-enrichment generator `enrichment/enrich-residual-sections.ts`
 *     (post-generation write gate — refuse to persist any section that
 *     still carries a marker).
 *
 * Keeping the regex here (not duplicated per script) guarantees the two
 * passes agree on what "clean" means: a section the generator deems
 * leak-free can never be re-flagged by a later audit, and vice-versa.
 */

/**
 * Markers of leaked brief / pipeline meta-commentary. A backtick in prose
 * is itself a strong signal — real editorial descriptions never carry
 * code-fenced tokens. Extend here (and only here) when a new leak shape is
 * discovered in the wild.
 */
export const LEAK_MARKERS =
  /\ble brief\b|\bbrief\b(?=[^.]*\b(?:confirme|fournit|signale|indique|incomplet|notes?|mention)\b)|AUTO_DRAFT|niveau de confiance|\bconfidence\b|`[^`]*`|reste à (?:vérifier|revalider)|à revalider|sans revalidation|non vérifiée?s?|wikidata|entité\s+Q\d|\bQ\d{5,}\b|matière publiable|ne peut être retenue?|statut\s+pending|\bpending\b|selon les sources publiques|note interne/iu;

/** True when `text` carries any scaffolding/meta-commentary marker. */
export function hasLeak(text: string | null | undefined): boolean {
  return typeof text === 'string' && LEAK_MARKERS.test(text);
}

/** Whitespace-delimited word count (Unicode-aware). */
export function wordCount(text: string): number {
  return text.split(/\s+/u).filter(Boolean).length;
}

/** Split into sentences on terminal punctuation, trimmed and non-empty. */
export function splitSentences(text: string): readonly string[] {
  return text
    .split(/(?<=[.!?…])\s+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Longest sentence length (in words) — sanity bound for the ≤25-word rule. */
export function maxSentenceWords(text: string): number {
  let max = 0;
  for (const s of splitSentences(text)) max = Math.max(max, wordCount(s));
  return max;
}
