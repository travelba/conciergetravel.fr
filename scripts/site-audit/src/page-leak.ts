/**
 * Page-scoped scaffolding-leak detector.
 *
 * WHY THIS IS NOT just `hasLeak` from the shared editorial gate
 * (`scripts/editorial-pilot/src/enrichment/scaffolding-gate.ts`):
 *
 * The shared gate is the single source of truth for leaks in **editorial
 * prose fields stored in the DB** (description, long_description_sections,
 * concierge_advice…). It deliberately flags lexical tokens that must NEVER
 * appear in hand-written hotel copy — `wikidata`, bare Wikidata `Q…` ids,
 * backtick-fenced code tokens.
 *
 * This auditor runs against the **fully rendered page**, whose visible text
 * legitimately includes those very tokens as EEAT source attributions:
 * `<HotelExternalSourcesFooter>` renders the label "Wikidata" / "Wikipédia"
 * and links to `…/wiki/Q123` reference pages. Running the full editorial gate
 * on whole-page text therefore false-positives on every fiche that ships the
 * (correct, desirable) provenance footer — confirmed on `/hotel/le-meurice`.
 *
 * So the page detector keeps only the HIGH-PRECISION *prose* scaffolding
 * signatures (brief/dossier narration, "non renseigné", "vérification
 * manuelle", word-count bookkeeping, AUTO_DRAFT…) — phrases that are never
 * legitimate UI chrome — and drops the lexical/source-attribution tokens that
 * are valid in a rendered page. Both detectors share the same intent; they
 * differ only because their *input context* differs (DB field vs rendered
 * DOM). Keep the prose sub-patterns here byte-for-byte aligned with the shared
 * gate so a phrase flagged in one is flagged in the other.
 *
 * See AGENTS.md waves 5/11/12/14 for the editorial leak history.
 */

const PAGE_LEAK_MARKERS =
  /AUTO_DRAFT|\ble brief\b|\b(?:du|au|ce) brief\b|niveau de confiance|dossier (?:encore )?(?:incomplet|lacunaire|mince)|le dossier (?:reste|demeure|est)\s+(?:encore\s+)?(?:incomplet|lacunaire|mince|vide)|en attente d['’]enrichissement|en attente de (?:v[ée]rification|confirmation|recoupement|contr[ôo]le|consolidation|sourcing)|aucun fait v[ée]rifi[ée]|aucune (?:donn[ée]e|information)s? v[ée]rifi[ée]e?s?|non renseign[ée]e?s?|(?:reste(?:nt)?|encore) [àa] (?:documenter|confirmer|pr[ée]ciser|d[ée]tailler|renseigner|[ée]tablir|v[ée]rifier)\b|sous r[ée]serve de confirmer|contr[ôo]le manuel|v[ée]rification manuelle|recherche Wikip[ée]dia|page d['’]homonymie|date de consultation des sources|pr[ée]-ouverture [ée]ditoriale|statut\s+pending|\b(?:the|this) dossier\b|\bincomplete dossier\b|\bdossier (?:confirms?|remains?)\b|still to be confirmed|pending (?:verification|enrichment|confirmation)|manual (?:check|verification)\b|awaiting (?:enrichment|verification|confirmation)|no verified (?:information|fact|data)|\bcompt(?:e|eur)\s*(?:de\s+)?mots?\b|\bnombre\s+de\s+mots?\b|\bword[\s-]*count\b/iu;

/** True when rendered page text carries a high-precision prose scaffolding leak. */
export function pageHasLeak(text: string | null | undefined): boolean {
  return typeof text === 'string' && PAGE_LEAK_MARKERS.test(text);
}
