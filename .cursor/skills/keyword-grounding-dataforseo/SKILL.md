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
(`hôtel <name>`, `<name> <city>`); non-FR → the property's country / `en`
(`<name> hotel`, `<name> <city>`) because international demand is English. The
country→`location_name` map covers the catalogue's top countries with a
`country_label_en` fallback (a bad location just yields an empty grounding —
degrade-safe). It returns `{ grounding, block, locale }`.

Wired into every hotel generator (all degrade-safe — empty block when DFS off):

| Surface                   | Generator                                                 | Runner                                | DFS aspect                               |
| ------------------------- | --------------------------------------------------------- | ------------------------------------- | ---------------------------------------- |
| `factual_summary_{fr,en}` | `factual-summary-generator.ts` (`options.groundingBlock`) | `run-hotel-factual-summary.ts`        | B — high-volume phrasing                 |
| `meta_desc_{fr,en}`       | `meta-desc-generator.ts` (`options.groundingBlock`)       | `run-hotel-meta-desc.ts`              | B — SERP CTR phrasing                    |
| `highlights`              | `geo-context-generator.ts` (`options.groundingBlock`)     | (geo-context runner)                  | B — demand-aligned labels                |
| **`geo_qa`** (NEW)        | `geo-qa-generator.ts`                                     | `run-hotel-geo-qa.ts`                 | A + C — PAA-anchored answer-engine block |
| `faq_content*`            | Perplexity research template `{{REAL_QUERIES_PAA}}`       | paste from `print-hotel-grounding.ts` | A — PAA-prioritised research             |

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

## Validating live (do this before any wave)

`npx tsx src/grounding/probe-dfs.ts "hôtel Gordes"` prints the related
keywords + volumes, the PAA, the intent labels and the rendered prompt block.
Use it to confirm creds, the v3 contract and the **value** on a real seed
before spending tokens on a wave. Creds live in `.env.local`
(`DATAFORSEO_ENABLED/USERNAME/PASSWORD`) — never on Vercel, never committed.

## Anti-patterns

| Anti-pattern                                    | Why it fails                                            | Correct path                                                                |
| ----------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------- |
| Making the pipeline hard-depend on DFS          | breaks the editorial-only Vercel build                  | `loadDfsConfig() → null` + `--no-grounding` fallback (Rule 1)               |
| Feeding raw PAA into the FAQ verbatim           | celebrity/biography noise pollutes the fiche            | instruct the LLM to select on-topic PAA only (Rule 2)                       |
| One DFS call per seed                           | burns the pay-per-request budget                        | cluster + disk cache (Rule 3)                                               |
| Batch loop without per-item try/catch           | one network blip aborts the whole run, no resume        | isolate per item, idempotent re-run filter (Rule 4)                         |
| Strict Zod that fails on one bad item           | a single deformed vendor row kills the cluster          | permissive schema + per-item `safeParse` (Rule 5)                           |
| Enrich then assume it's live                    | enrich never sets `is_published`                        | run `publish-places.ts` + `resolve-proximity.ts` (Rule 6)                   |
| geo_qa answer says "the brief doesn't provide…" | internal scaffolding word leaks to the public page      | prompt ban + `META_REFERENCE_PATTERNS` gate; redirect to Concierge (Rule 7) |
| `run-hotel-geo-qa --refresh` on a golden fiche  | overwrites hand-seeded Airelles/Prince de Galles geo_qa | validate on a non-golden fiche; `--refresh` only when intentional (Rule 7)  |
| Fabricating a geo_qa answer when DFS is off     | generic invented questions defeat the GEO purpose       | geo_qa requires PAA — skip the hotel, no LLM-only fallback (Rule 7)         |

## References

- `.cursor/skills/content-enrichment-pipeline/SKILL.md` — the factual
  enrichment cascade that grounding complements (facts vs search-demand).
- `.cursor/skills/llm-output-robustness/SKILL.md` — the same per-item
  tolerance philosophy applied to LLM JSON output.
- `.cursor/skills/geo-llm-optimization/SKILL.md` — where the grounded GEO/AEO
  blocks land.
- `.cursor/skills/hotel-faq-perplexity-enrichment/SKILL.md` — the hotel FAQ
  pipeline that grounding will anchor (titles + question phrasing).
- `packages/integrations/src/dataforseo/` + `scripts/editorial-pilot/src/grounding/`
  — the implementation.
