---
name: keyword-grounding-dataforseo
description: DataForSEO keyword/SERP/intent grounding for the editorial pipelines of MyConciergeHotel.com — anchors FAQ questions, page titles/H2/meta and GEO/AEO blocks on REAL search demand (People-Also-Ask, related keywords + volumes, search intent) instead of LLM guesswork. Use when generating or auditing FAQ, titles, meta, or GEO Q&A for hotels, places/POIs, rankings or guides, or when wiring DataForSEO into a new editorial pipeline.
---

# Keyword grounding via DataForSEO — MyConciergeHotel.com

The editorial copy competes on **answering the questions people actually
type**, not on inventing plausible-sounding ones. This skill is the bridge
between the DataForSEO v3 API and the LLM editorial pipelines: it pulls the
real **People-Also-Ask**, **related keywords + search volumes** and **search
intent** for a cluster, then injects that as a grounding block into the
generation prompt so the FAQ, titles and GEO blocks track real demand.

Decision (PO 2026-06-18): **batch-now** — FAQ + titles + GEO + internal-link
anchors are grounded on DataForSEO from the start of every wave, catalogue-wide.

## Triggers

Invoke when:

- Generating or auditing a hotel/place/ranking/guide **FAQ**, **title / H2 /
  meta-title**, or **GEO/AEO Q&A** block.
- Wiring DataForSEO into a new editorial pipeline (the inject pattern).
- Debugging "the FAQ questions feel generic / made up" or "titles don't match
  what people search".
- Estimating or capping DataForSEO request cost on a catalogue-wide run.

## Architecture (two layers)

```
packages/integrations/src/dataforseo/      ← vendor adapter (Layer 2)
  client.ts            HTTP Basic auth, v3 task-envelope, Zod parse
  types.ts             permissive Zod (.passthrough + z.array(z.unknown))
  keyword-research.ts  fetchRelatedKeywords / fetchSerpQuestions /
                       fetchSearchIntent / fetchSearchVolume / fetchAiKeywordVolume
  errors.ts            DataForSeoError union (http|parse_failure|api_error|disabled)
  cache-keys.ts        mch:dfs:<scope>:<hash> builders

scripts/editorial-pilot/src/grounding/     ← editorial orchestrator
  env-dfs.ts            loadDfsConfig() → null when disabled/unconfigured
  keyword-grounding.ts  groundKeywords() + renderGroundingForPrompt()
  hotel-grounding.ts    groundHotel() — hotel-specific seeds + per-country locale
  print-hotel-grounding.ts  CLI: print the PAA block for one hotel (FAQ research)
  probe-dfs.ts          one-shot live validator (creds + contract + value)
```

The pipelines (`enrich-places-editorial.ts`, hotel FAQ/title generators) call
`groundKeywords()` then append `renderGroundingForPrompt()` to the user prompt.

## Hotel pipelines — what is wired (2026-06-18)

`groundHotel(cfg, hotelLlmInput)` (`hotel-grounding.ts`) derives the seeds and
the DataForSEO locale **from the hotel itself**: FR hotels → `France/fr` seeds
(`hôtel <name>`, `<name> <city>`); non-FR → the property's country in its
**native language** (`Italy/it`, `Greece/el`, `Hungary/hu`, …). It walks an
ordered list of locale candidates — `[native, France/fr]` — and keeps the
**first that returns real PAA**, so a country missing from the map or absent
from the DFS Labs registry still grounds on the `France/fr` fallback (also our
primary francophone audience). It returns `{ grounding, block, locale }`.

> ⚠ **DataForSEO Labs quirk — never force `en` on a non-English location.**
> `related_keywords` validates the `(location_name, language_code)` pair and
> rejects unsupported combos with `40501 Invalid Field: 'language_code'`
> (e.g. `Italy/en`, `Spain/en`, `Portugal/en` — English is NOT a valid
> language for most non-English Google domains). The OLD map forced `en` for
> every non-FR country and silently returned zero PAA → `skip_no_paa` for
> ~160 international hotels (geo_qa stuck at 90.7 %). Worse, some countries
> (`Turkey`, `China`) are absent from the Labs registry entirely →
> `40501 Invalid Field: 'location_name'` for ANY language. The fix is
> native-language-first + `France/fr` fallback (2026-06-19, commit
> `98db716` → coverage 97.3 %). Validate a new country with `probe-dfs.ts`
> before adding it to `COUNTRY_DFS_LOCALE`; if it 40501s on location_name,
> leave it out — the fallback handles it.

Wired into every hotel generator (all degrade-safe — empty block when DFS off):

| Surface                                 | Generator                                                                            | Runner                                | DFS aspect                                        |
| --------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------- | ------------------------------------------------- |
| `factual_summary_{fr,en}`               | `factual-summary-generator.ts` (`options.groundingBlock`)                            | `run-hotel-factual-summary.ts`        | B — high-volume phrasing                          |
| `meta_desc_{fr,en}`                     | `meta-desc-generator.ts` (`options.groundingBlock`)                                  | `run-hotel-meta-desc.ts`              | B — SERP CTR phrasing                             |
| `highlights`                            | `geo-context-generator.ts` (`options.groundingBlock`)                                | (geo-context runner)                  | B — demand-aligned labels                         |
| **`geo_qa`** (NEW)                      | `geo-qa-generator.ts`                                                                | `run-hotel-geo-qa.ts`                 | A + C — PAA-anchored answer-engine block          |
| **`faq_content_kit*`** (NEW 2026-06-25) | `run-faq-perplexity-batch.ts` (`groundHotel` → prompt block + `evaluatePaaCoverage`) | `run-faq-perplexity-batch.ts`         | A — PAA-prioritised kit + `dfs_paa_coverage` gate |
| `faq_content*` (curated)                | Perplexity research template `{{REAL_QUERIES_PAA}}`                                  | paste from `print-hotel-grounding.ts` | A — PAA-prioritised research                      |

## Rule 7 — geo_qa REQUIRES grounding + never leaks the source

`hotels.geo_qa` (migration 0072, rendered by `<HotelGeoSection>`) is the purest
GEO/AEO surface: 3 H2-led Q&A mirroring real long-tail queries, answered in 2-3
sentences ≤ 25 words (Concierge voice). The generator (`geo-qa-generator.ts`):

- **Requires PAA** — `run-hotel-geo-qa.ts` aborts when DFS is off and **skips**
  any hotel returning zero PAA. There is no LLM-only fallback: without real
  demand there is no point inventing generic questions (that's what the generic
  FAQ categories already do).
- **Anti-scaffolding-leak gate** (capitalised 2026-06-18): the first live run on
  `le-meurice` produced _"Le brief ne donne pas de prix précis"_ — the internal
  word **"brief" leaked onto the public page**. Fixed with both a prompt rule
  (never mention « le brief / the brief / les données / not provided / as an
  AI ») AND a `gateGeoQa` regex net (`META_REFERENCE_PATTERNS`) that rejects the
  output. When a fact is missing (e.g. price — frozen until Phase 6), the answer
  redirects to the Concierge instead of stating the data is absent.
- **Topic diversity** — the prompt forbids two questions on the same subject
  (the un-tuned run emitted two price questions; the rule fixed it).
- **Don't overwrite golden** — the migration hand-seeded Airelles Gordes +
  Prince de Galles. The batch runner `--refresh` would overwrite them; leave the
  golden references intact and validate on a non-golden fiche (pilot used
  `le-meurice`, the canonical test fiche). `--refresh` only when intentional.

Validation that works:

```
run-hotel-geo-qa --slug=<x> --dry-run   # inspect entries in runs/geo-qa-dry-*.json
run-hotel-geo-qa --slug=<x>             # live write
# walk /fr|/en/hotel/<x> → section [data-geo="hotel-qa"] renders FR+EN
```

## FAQ kit grounding (Perplexity two-tier kit) — wired 2026-06-25

The catalogue-wide Perplexity FAQ kit
(`scripts/editorial-pilot/src/hotels/run-faq-perplexity-batch.ts`) is now
DataForSEO-grounded, closing the gap flagged by the PO directive ("toute la
création de contenu ou de fiche doit être check par data seo"). The voisin
reference is `rankings/enrich-ranking-faq-grounded.ts`.

**Inject (step 0, before Perplexity):**

```typescript
const dfsCfg = args.grounded ? loadDfsConfig() : null; // null → degrade-safe
const { block, grounding } = await groundHotel(dfsCfg, toHotelLlmInput(hotel));
// buildUserPrompt(hotel, block) appends the block under
// "### Ancrage SEO/GEO (DataForSEO)" so the ~40 long-tail FAQ track real PAA.
```

- The `CandidateHotel` row (id/slug/name/city/region/country_code) is projected
  to `HotelLlmInput` via `toHotelLlmInput` — `groundHotel` only reads
  `name`/`name_en`/`city`/`country_code` for seed + locale derivation, the rest
  are null.
- Disk cache (`data/dfs-cache/`) is shared with every other hotel generator, so
  a fiche already grounded for `meta_desc`/`geo_qa` costs **zero** extra DFS
  calls here.
- `--grounded` (default ON) / `--no-grounding`. Per-fiche log:
  `grounding=on dfs_paa_coverage=70%(10PAA)`; runlog summary carries
  `grounded` + `avgPaaCoverage`.

**Verify (post-generation, before DB write) — `evaluatePaaCoverage`:**

`faq-perplexity-gates.ts` exports `evaluatePaaCoverage(faqBlobs, peopleAlsoAsk)`.
It computes the % of real PAA covered by the generated kit + concierge Q&A via
**soft token-overlap matching** (≥ 60 % of a PAA's content tokens — FR+EN
stopwords stripped — found inside a single Q&A blob). It returns
`{ grounded, total, matched, coveragePct, uncovered }`.

- **Non-blocking by design** (PO: "le moins destructif mais trace-le"): low
  coverage logs `⚠ dfs_paa_coverage=<pct>% (matched/total)` + the uncovered
  PAA, but never fails the push. The existing `hasLeak()` anti-scaffolding gate
  and the canonical-coverage gate are untouched and stay the hard blockers.
- `coveragePct` is `null` when not grounded (DFS off / zero PAA) — no false
  warning.

> ⚠ **PAA strings carry no per-question volume.** DataForSEO `peopleAlsoAsk`
> is a deduped string array, not `{question, volume}`. "PAA à fort volume"
> therefore means _the PAA set DFS returned for the seed_ (already SERP-ranked
> by relevance); don't try to weight by volume per question — that signal does
> not exist in the SERP-questions endpoint.

Validation that works (real Perplexity + cached DFS, FR-only to skip OpenAI):

```
run-faq-perplexity-batch --slugs=les-airelles-gordes --dry-run --skip-en --grounded
# → ✓ les-airelles-gordes kit=49 concierge=26 promote=15 grounding=on dfs_paa_coverage=70%(10PAA)
```

### Output gate now covers FAQ kit **+ rankings** (extended 2026-06-25)

The same `evaluatePaaCoverage(faqBlobs, peopleAlsoAsk)` is now the single
output-coverage gate for **two surfaces**:

1. **FAQ kit** — `run-faq-perplexity-batch.ts` (original wiring).
2. **Rankings** — both `rankings/generate-ranking-v2.ts` (FAQ Q&A +
   entry justifications, fed by the generator's own grounding) and the
   curated `rankings/enrich-ranking-faq-grounded.ts` (FAQ-only re-anchor,
   fed by its already-loaded `grounding.peopleAlsoAsk`). Both log the same
   `dfs_paa_coverage=<pct>% (matched/total PAA covered)` line, NON-blocking,
   and degrade to `dfs_paa_coverage=n/a` when DFS is off / zero PAA.

`generate-ranking-v2.ts` self-grounds at entry via `loadDfsConfig()` + seeds
derived from the ranking title (or accepts a pre-loaded `grounding` /
`disableGrounding` via `GenerateRankingV2Options`), injects the block into the
FAQ + factual-summary prompts under `### Ancrage SEO/GEO (DataForSEO)`, then
runs the gate. **Never duplicate the soft-token matcher** — always import
`evaluatePaaCoverage` from `hotels/faq-perplexity-gates.ts`. Still TODO:
`long_description_sections` and lieux (grounded at entry, no output gate yet).

## Rule 1 — Grounding is OPTIONAL and degrade-safe, never a hard dependency

`loadDfsConfig()` returns `null` when `DATAFORSEO_ENABLED` is false or creds
are missing. `groundKeywords(null, …)` returns `{ grounded: false, … }` and
`renderGroundingForPrompt()` returns `''`. The pipeline then falls back to the
LLM-only prompt. Every pipeline that consumes grounding **must** keep a
`--no-grounding` flag and a working LLM-only path. The editorial-only build on
Vercel runs with DFS off — it must not break. DFS is **local-only**, not
provisioned on Vercel (`packages/config/src/env.ts`).

## Rule 2 — Tell the LLM to SELECT relevant PAA and ignore the noise

Real PAA is polluted. The live Gordes probe returned, alongside the gold
("Où puis-je me loger à Gordes ?", "Combien de jours faut-il passer à
Gordes ?"), pure noise: _"Quelle star habite à Gordes ?"_, _"Où vit Patrick
Hernandez aujourd'hui ?"_. The prompt block instructs the model to **select
the PAA that truly concern the entity (séjour/visite/accès/timing/famille) and
ignore people/celebrity/biography noise** — never answer or fabricate facts for
the off-topic ones. Verified working: the generated Château de Gordes FAQ kept
"Gordes vaut-il le détour ?" / "Pourquoi Gordes est-il connu ?" and dropped
every celebrity question.

## Rule 3 — Cluster + disk-cache to control cost

DataForSEO is pay-per-request. `groundKeywords()` takes an array of seeds (a
cluster) and caches the merged result on disk keyed by the seed set + locale.
Re-runs (and the inevitable retries after a rejection or crash) are then free.
A first cold run on a 14-POI city is ~5 live calls/POI; every subsequent run is
cache hits. Always pass the natural cluster (e.g. `[place.name, "${name}
${city}"]`), not one seed per call.

## Rule 4 — Per-item try/catch in EVERY batch editorial loop (crash-resilience)

**Capitalised 2026-06-18 — cost a ~115 min run.** The Gordes places enrich
loop had no per-item isolation. A single transient `Connection error` (OpenAI
or DFS) on place #10 threw out of the loop and **aborted the whole batch**,
losing the tail with no resume. Fix: wrap the per-item body in `try/catch`,
log-and-continue, and rely on the idempotent `faq IS NULL` filter so a re-run
picks up exactly the failed/rejected rows. This applies to **any** batch loop
that does network I/O per item (LLM + vendor). See
`enrich-places-editorial.ts` loop body.

```typescript
for (const item of items) {
  try {
    const grounding = await groundKeywords(dfsCfg, seeds(item), locale);
    // …generate + validate + persist…
  } catch (err) {
    console.warn(`  [enrich] ${item.name}: error (skipped, will retry on re-run) - ${msg(err)}`);
  }
}
```

## Rule 5 — Permissive Zod on vendor responses (one bad item ≠ dead batch)

DataForSEO v3 nests results in a task envelope and occasionally emits a
malformed item inside an otherwise-good array. Schemas use `.passthrough()` and
type array payloads as `z.array(z.unknown())`, then the normalizers `safeParse`
**each item** and skip the bad ones. A single deformed keyword row must never
fail the whole cluster. See `types.ts` + the `normalize*` functions. (Same
philosophy as `llm-output-robustness` for LLM JSON.)

## Rule 6 — places enrich never publishes; `publish-places.ts` is the gate

`enrich-places-editorial.ts` writes the envelope but keeps `is_published=false`
(its header says so). The publish gate is `scripts/editorial-pilot/src/places/
publish-places.ts` — it re-validates the persisted row (summary length, both
locales, faq ≥ 5, concierge_advice present) and flips `is_published=true` only
on pass. Then `resolve-proximity.ts --city=<key>` builds the `place_hotel_links`
(POI ↔ hotel maillage, both directions). Pilot sequence that works:

```
places:backfill (scaffold) → enrich (grounded) → publish-places → resolve-proximity → walk
```

The backfill/gate/reconciler **publish-gate discipline** (a backfill must never
auto-publish; the gate is the sole publisher; an idempotent reconciler
unpublishes hors-gate rows; export the gate behind a `process.argv[1]` run-guard)
is documented end-to-end in
[`content-enrichment-pipeline` §Rule 16](../content-enrichment-pipeline/SKILL.md)
— commit `08bb0f2`, which fixed 199 thin Paris stubs shipped live and brought
the count from 229 → 102 published.

## Validating live (do this before any wave)

`npx tsx src/grounding/probe-dfs.ts "hôtel Gordes"` prints the related
keywords + volumes, the PAA, the intent labels and the rendered prompt block.
Use it to confirm creds, the v3 contract and the **value** on a real seed
before spending tokens on a wave. Creds live in `.env.local`
(`DATAFORSEO_ENABLED/USERNAME/PASSWORD`) — never on Vercel, never committed.

## Anti-patterns

| Anti-pattern                                               | Why it fails                                                             | Correct path                                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Making the pipeline hard-depend on DFS                     | breaks the editorial-only Vercel build                                   | `loadDfsConfig() → null` + `--no-grounding` fallback (Rule 1)                    |
| Feeding raw PAA into the FAQ verbatim                      | celebrity/biography noise pollutes the fiche                             | instruct the LLM to select on-topic PAA only (Rule 2)                            |
| One DFS call per seed                                      | burns the pay-per-request budget                                         | cluster + disk cache (Rule 3)                                                    |
| Batch loop without per-item try/catch                      | one network blip aborts the whole run, no resume                         | isolate per item, idempotent re-run filter (Rule 4)                              |
| Strict Zod that fails on one bad item                      | a single deformed vendor row kills the cluster                           | permissive schema + per-item `safeParse` (Rule 5)                                |
| Enrich then assume it's live                               | enrich never sets `is_published`                                         | run `publish-places.ts` + `resolve-proximity.ts` (Rule 6)                        |
| geo_qa answer says "the brief doesn't provide…"            | internal scaffolding word leaks to the public page                       | prompt ban + `META_REFERENCE_PATTERNS` gate; redirect to Concierge (Rule 7)      |
| `run-hotel-geo-qa --refresh` on a golden fiche             | overwrites hand-seeded Airelles/Prince de Galles geo_qa                  | validate on a non-golden fiche; `--refresh` only when intentional (Rule 7)       |
| Fabricating a geo_qa answer when DFS is off                | generic invented questions defeat the GEO purpose                        | geo_qa requires PAA — skip the hotel, no LLM-only fallback (Rule 7)              |
| Forcing `en` as the DFS language for a non-English country | `40501 Invalid Field: 'language_code'` → zero PAA → silent `skip_no_paa` | native-language locale + `France/fr` fallback; `probe-dfs.ts` to validate a pair |

## References

- `.cursor/skills/content-enrichment-pipeline/SKILL.md` — the factual
  enrichment cascade that grounding complements (facts vs search-demand); also
  §Rule 16 for the full publish-gate discipline (backfill never publishes, one
  gate, idempotent reconciler, module run-guard).
- `.cursor/skills/llm-output-robustness/SKILL.md` — the same per-item
  tolerance philosophy applied to LLM JSON output.
- `.cursor/skills/geo-llm-optimization/SKILL.md` — where the grounded GEO/AEO
  blocks land.
- `.cursor/skills/hotel-faq-perplexity-enrichment/SKILL.md` — the hotel FAQ
  pipeline that grounding will anchor (titles + question phrasing).
- `packages/integrations/src/dataforseo/` + `scripts/editorial-pilot/src/grounding/`
  — the implementation.
