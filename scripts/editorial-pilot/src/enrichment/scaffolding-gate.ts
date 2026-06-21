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
// NOTE on `confidence`: the bare English word is ordinary editorial prose
// ("an air of quiet confidence", "a framework of confidence"). It is ONLY a
// scaffolding leak when followed by a pipeline level (`confidence low/medium/
// high`, or backtick-fenced `confidence \`low\``). Match that shape, not the
// bare word — a 2026-06-19 catalogue audit false-flagged dozens of legit EN
// long-descriptions on the bare token. The FR equivalent `niveau de confiance`
// stays an exact phrase and the backtick rule still catches `` `low` ``.
// NOTE on the "dossier narration" class (2026-06-21 catalogue audit): an
// earlier generation pass, fed a thin data dossier, narrated the dossier's
// OWN incompleteness into live prose on ~424 published fiches — "Aman New York
// avance ici avec un dossier encore incomplet", "les équipements connus du
// brief", "plusieurs rubriques attendent une vérification manuelle", "Date de
// consultation des sources du brief : 2026-05-20". The original `\ble brief\b`
// missed the genitive/dative "du brief" / "au brief" (English never produces
// those, so they are safe to match even though the gate runs on EN too). The
// markers below are all multi-word scaffolding signatures — never legitimate
// hotel prose. Keep them high-precision: a bare "dossier"/"brief"/"en attente"
// would false-flag real copy (cf. the CLEAN cases in scaffolding-gate.test.ts).
export const LEAK_MARKERS =
  /\ble brief\b|\b(?:du|au) brief\b|\bbrief\b(?=[^.]*\b(?:confirme|fournit|signale|indique|incomplet|notes?|mention)\b)|AUTO_DRAFT|niveau de confiance|\bconfidence[\s:`]+(?:low|medium|high)\b|`[^`]*`|reste à (?:vérifier|revalider)|à revalider|sans revalidation|non vérifiée?s?|wikidata|entité\s+Q\d|\bQ\d{5,}\b|matière publiable|ne peut être retenue?|statut\s+pending|\bpending\b|selon les sources publiques|note interne|contr[ôo]le manuel|v[ée]rification manuelle|\b(?:le|ce|du|au) dossier\b(?!\s+(?:de\s+(?:presse|r[ée]servation|candidature|mariage|soins?|sant[ée])|client|[ée]v[ée]nementiel|m[ée]dical))|dossier (?:encore )?(?:incomplet|lacunaire|mince)|en attente d['’]enrichissement|en attente de (?:v[ée]rification|confirmation|recoupement|contr[ôo]le|consolidation|sourcing)|(?:reste|restent|demeure|demeurent|encore) en attente\b|\bplaceholder\b|recherche Wikip[ée]dia|page d['’]homonymie|doivent? [êe]tre enrichis?|enrichissement (?:manuel|substantiel)|date de consultation des sources|pr[ée]-ouverture [ée]ditoriale|\b(?:the|this) dossier\b|\bincomplete dossier\b|\bdossier (?:confirms?|remains?)\b|\b(?:the|this) (?:historical |source |data )?file\b(?=[^.]*\b(?:remains?|incomplete|lacks?|requires?|confirms?|mentions?|notes?|documented)\b)|still to be confirmed|pending (?:verification|enrichment|confirmation)|manual (?:check|verification)\b|awaiting (?:enrichment|verification|confirmation)|Wikipedia (?:search|research)|disambiguation page|no verified information|\b(?:the|this) brief\b(?!\s+(?:moment|interval|interlude|while|period|stay|stroll|walk|pause|window|spell|space|overview|summary|introduction|history|account|chapter|visit|encounter|glimpse|respite|lull|break|calm|silence|quiet|but|yet|list|note|description|mention|exchange|conversation|chat|aside|remark|comment|detour|digression|interruption|tour|moments|episodes?))/iu;

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
