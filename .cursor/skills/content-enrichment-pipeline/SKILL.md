---
name: content-enrichment-pipeline
description: Multi-source factual enrichment pipeline for MyConciergeHotel.com — DATAtourisme + Wikidata + Wikipedia + Tavily, layered by trust, with anti-hallucination sentinels and structured extraction via LLM. Use when fetching, normalising, or expanding factual content for hotels, destinations, POIs, awards, or any editorial entity where source attribution and EEAT matter.
---

# Content enrichment pipeline — MyConciergeHotel.com

The editorial copy on this site competes on **factual depth**, not on AI fluency. The enrichment pipeline (`scripts/editorial-pilot/src/enrichment/`) is what turns a hotel name into a fact-grounded brief that the generation LLM can safely expand into 4 000-word prose without hallucinating. Every source is layered, every fact has an audit trail, every missing value is sentineled — never invented.

## Triggers

Invoke when:

- Adding a new factual field to a hotel / guide / ranking / POI / brand.
- Wiring a new external data source (vendor API, open dataset, knowledge graph).
- Designing a structured extraction step that turns Tavily / web content
  into typed records.
- Debugging "hallucinated fact" issues in editorial output.
- Reviewing the freshness or provenance of any published editorial fact.

## Rule 1 — Layer sources by trust, fall through gracefully

The enrichment cascade goes from **most-structured / highest-trust** to
**least-structured / lowest-trust**:

```
DATAtourisme (official FR tourism registry, structured RDF)
   ↓ fill structural facts (address, GPS, official URL, stars, isPalace)
Wikidata (curated knowledge graph)
   ↓ fill encyclopedic facts (architect, inception year, owner, heritage)
Wikipedia REST (lead paragraph + first picture)
   ↓ fill narrative anchors (history opening sentence, hero alt text)
Tavily Search/Extract (web markdown, queryable)
   ↓ fill awards, signature experiences, dining, wellness, capacity
GPT-4o-mini structured extraction
   ↓ extract typed facts from each Tavily document
```

Each layer **only writes what the layer above did not provide**. Reference
implementation: `scripts/editorial-pilot/src/enrichment/brief-builder.ts`
(`buildBriefFromSources`).

## Rule 2 — Use `AUTO_DRAFT` sentinels for missing facts

When a layer cannot fill a field, **do not invent** and do not leave the
field empty. Write a sentinel:

```ts
const AUTO_DRAFT = 'AUTO_DRAFT' as const;

const brief = {
  history_year: wd.inception?.year ?? AUTO_DRAFT,
  architect: wd.architects[0] ?? AUTO_DRAFT,
  dining_outlets: extracted?.outlets ?? [AUTO_DRAFT],
};
```

The generation LLM (pass 4) is prompted to **detect sentinels and degrade
gracefully** (skip the affected sentence, prefer a generic phrasing). The
fact-check pass flags every sentinel-derived sentence as low-confidence.

This is the _single most effective_ anti-hallucination mechanism in the
pipeline. Reference: `brief-builder.ts` comment block.

## Rule 3 — DATAtourisme is the system of record for addresses

When a hotel exists in DATAtourisme, its address, GPS, postal code, and
official URL **win** over any other source. Never override DATAtourisme
fields with Wikipedia or Tavily content — those sources are out of date
more often than they are accurate.

```ts
const hotel: HotelCore =
  dt !== null
    ? hotelCoreFromDt(dt)
    : hotelCoreFromManual({
        /* … */
      });
```

If DATAtourisme returns no match, fall back to a **manual entry** path
(`--no-datatourisme` CLI flag) with explicit source labels:
`"Manual entry — Atout France Palace registry"`.

## Rule 4 — Wikidata: SPARQL is the API, not REST

Wikidata's REST has rate limits and incomplete property coverage. Always
use **`query.wikidata.org/sparql`** with:

- A custom `User-Agent` (Wikimedia policy — anonymous UAs get throttled).
- All requested properties in one query (architects, owner, operator,
  Wikipedia URLs, Commons, TripAdvisor ID, Booking ID, MERIMÉE).
- Zod validation on every binding (responses are loose JSON).

```ts
const USER_AGENT =
  'MyConciergeHotelEditorialPilot/0.1 (https://myconciergehotel.com; reservations@myconciergehotel.com)';

const r = await fetch(`${WIKIDATA_SPARQL}?format=json`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': USER_AGENT,
    Accept: 'application/sparql-results+json',
  },
  body: `query=${encodeURIComponent(SPARQL)}`,
});
```

Reference: `scripts/editorial-pilot/src/enrichment/wikidata.ts`.

## Rule 5 — Tavily: pair Search → Extract, never raw scrape

The Tavily client provides two endpoints (`/search` and `/extract`) plus
a combined `tavilySearchAndExtract` helper. Pattern:

1. **Search** with `searchDepth: 'advanced'` (2 credits, much better
   recall) and a tight `query` like
   `"Plaza Athénée Avenue Montaigne dining restaurants Alain Ducasse"`.
2. **Pick the top 2-3 results** by `score`, filter by `includeDomains`
   if you can predict the authoritative source (e.g. `*.michelin.com`).
3. **Extract** with `extractDepth: 'advanced'` (handles JS-rendered
   sites). Use `query=…` + `chunksPerSource: 3` to get only the
   relevant chunks.
4. **Feed each result's markdown** into `llmExtract` (see rule 6).

Never `fetch()` a third-party URL directly: you'll fight bot-protection,
JavaScript rendering, and dirty HTML. Tavily abstracts all of that and
returns clean LLM-ready markdown.

## Rule 6 — Structured extraction with `gpt-4o-mini`, temperature 0

Generation uses `gpt-4o` at `temperature: 0.4`. **Extraction** is a
different job and uses `gpt-4o-mini` at `temperature: 0` — ~10× cheaper,
sufficient for pulling typed facts out of clean markdown.

Use the `llmExtract<Schema>` helper, never roll your own:

```ts
const result = await llmExtract({
  content: tavilyMarkdown, // clean markdown from Tavily
  context: 'Plaza Athénée — dining outlets',
  schemaDescription: '…', // human-readable for the LLM
  schema: DiningOutletsSchema, // Zod schema for parsing
});
// result.data is z.infer<typeof DiningOutletsSchema> | null
```

The helper:

- Injects the **anti-hallucination contract** (return null for missing
  fields, no inference, verbatim quotes, no markdown fences).
- Requires `evidence_quote` siblings on every populated field where the
  schema asks for one — auditable proof the LLM did not invent.
- Returns `null` on JSON parse failure or Zod failure — caller falls
  back to `AUTO_DRAFT`.

Reference: `scripts/editorial-pilot/src/enrichment/llm-extract.ts`.

## Rule 7 — Persist provenance alongside every fact

Every record written to Supabase MUST include:

```ts
{
  sourceUri: 'https://www.datatourisme.fr/…',  // canonical record URL
  sourceLabel: 'DATAtourisme catalog',         // human-readable
  enrichmentVersion: '2024-05',                // when this snapshot was taken
  evidenceQuote?: '…',                         // for LLM-extracted facts
}
```

Provenance is what allows the back-office to flag stale facts, support
"see source" UI on contested values, and survive a vendor schema change.

## Rule 8 — Cache aggressively, idempotent re-runs

External-source calls are cached at two levels:

1. **HTTP layer** — Tavily/Wikidata/Wikipedia responses cached on disk
   (`scripts/editorial-pilot/.cache/`) keyed by query+args. Re-running
   the same brief locally is ~free.
2. **DB layer** — `enrich-wikidata-ids.ts` and similar batch scripts
   skip hotels that already have the target columns populated, unless
   the `--force` flag is passed.

Pipelines must be **idempotent** — re-running on the same input MUST NOT
produce different output (apart from non-deterministic LLM extraction,
which is gated to temperature 0).

## Rule 9 — Wikidata external IDs unlock secondary integrations

When you have a Wikidata Q-ID for a hotel, you also typically get:

- `P856` official website
- `P3134` TripAdvisor ID → reviews
- `P5694` Booking.com ID → competitor data
- `P969` street address (street-level fallback)
- `P380` MERIMÉE ID → French heritage registry
- `P373` Commons category → free photos

The `fetchHotelExternalIds` helper pulls all of these in one SPARQL. The
batch enrichment script (`enrich-wikidata-ids.ts`) writes them to
dedicated columns on `public.hotels` — those columns then power
booking, reviews, image fallback, JSON-LD `sameAs[]`, …

## Rule 10 — POI enrichment: DT for patrimony, Overpass for daily-life

The "À proximité" block on a hotel page has **three editorial buckets**
(`visit` / `do` / `shop`) with very different source profiles:

| Bucket | Source                          | Why                                                  |
|--------|--------------------------------|------------------------------------------------------|
| visit  | DATAtourisme                    | Strong on patrimony, museums, religious sites       |
| do     | DATAtourisme                    | Strong on leisure, gastronomy, wineries, beaches    |
| shop   | OpenStreetMap (Overpass)        | DT barely covers daily-life (pharmacy, bakery, ATM) |

Reference orchestrator: `scripts/editorial-pilot/src/pois/sync-hotel-pois.ts`.

**Concrete pattern** (1 hotel ≈ 15 s, ~$0.01 LLM):

```ts
// 1. DT — patrimony + leisure, 3-bucket curated
const dtPois = await fetchPOIsAround(lat, lon, {
  radiusMeters: urban ? DEFAULT_RADII_URBAN : DEFAULT_RADII_RURAL,
  caps: { visit: 8, do: 6, shop: 5 },
});

// 2. Overpass — utility amenities (pharmacy/bakery/supermarket/atm/post/taxi/clinic)
const amenities = await fetchAmenitiesAround(ovCfg, lat, lon, {
  radiusMeters: urban ? 400 : 800,
  limit: 12,
});

// 3. Overpass — transit stations (urban only — rural has no metro)
const transit = urban
  ? await fetchTransitStationsAround(ovCfg, lat, lon, { radiusMeters: 600 })
  : { ok: true, value: [] };

// 4. Merge: dedup OSM amenities within 50 m of an already-included DT POI,
//    sort by distance within each bucket, cap (visit 8, do 6, shop 8).
const merged = mergePois(dtPois, amenities.value, transit.value);

// 5. Attach nearest_transit per POI (≤ 400 m), compute walk_minutes
//    using 83 m/min (5 km/h with luggage).

// 6. LLM-describe each POI in FR + EN (gpt-4o-mini, temp 0.2, EEAT-safe
//    contract: no invented facts, no superlatives, no injunctions, cite
//    distance only if < 800 m).
```

### Urban / rural detection

Hard-coded whitelist (`URBAN_CITIES` in `sync-hotel-pois.ts`) — Paris,
Lyon, Marseille, Nice, Cannes, Bordeaux, Lille, etc. Anything not in
the list uses rural radii (DT: 5-10 km, Overpass: 800 m). Adding a new
city = one line in the set.

### Overpass quirks (real ones we hit)

- The free public instance throttles at ~1 req/s. Run with
  `--concurrency=2` max for batch jobs.
- QL body MUST be `application/x-www-form-urlencoded` (`data=<QL>`),
  NOT JSON. `retryingJsonRequest` supports this via `body: { kind:
  'form', pairs: { data: query } }`.
- A timeout returns **HTTP 200** with a tiny HTML payload "runtime
  error: Query timed out". We map this to `query_timeout` so rural
  hotels degrade gracefully (no `shop` POIs is OK).
- Tags vary wildly between regions — always `passthrough()` the Zod
  schema and only assert on the tags you actually consume.

### LLM POI descriptions — anti-cliché contract

`gpt-4o-mini` at temperature 0.2 is fine but **loves filler phrases**
("dans un cadre agréable", "ambiance conviviale"). The system prompt
forbids:

1. Invented facts (price, hours, year, area, award).
2. Superlatives (`incontournable`, `mythique`, `légendaire`).
3. First person (`nous`, `notre`).
4. Injunctions (`découvrez`, `réservez`, `à ne pas manquer`).
5. Vague distance words (`tout proche`, `à deux pas`) — only "à X
   minutes à pied" when < 800 m, "X mètres" or "X km" otherwise.

Bounded concurrency = 4 (OpenAI TPM tolerates 8+ but we share quota
with the editorial generation pipeline). Reference:
`scripts/editorial-pilot/src/pois/llm-describe-pois.ts`.

### CLI cheat-sheet

```powershell
# Dry-run with LLM disabled (free, ~5 s) — quick smoke
pnpm pois:sync --slug=le-bristol-paris --dry-run --no-llm

# Real run on one hotel (~25 s, ~$0.01)
pnpm pois:sync --slug=le-bristol-paris

# Batch of all palaces (~10 min, ~$0.40)
pnpm pois:sync --bucket=palaces --concurrency=2

# Full catalogue without LLM descriptions (~5 min, $0)
pnpm pois:sync --bucket=all --concurrency=2 --no-llm
```

Runlog: `scripts/editorial-pilot/out/pois-runlog-YYYY-MM-DD.jsonl` —
one line per hotel for full audit + resume.

## Rule 11 — DATAtourisme events: dates are nested in `takesPlaceAt`, not top-level

This one cost two iterations to find. The DT Catalog endpoint
(`/catalog?filters=type[in]=Event&geo_distance=...`) returns a list
of events but **never** exposes `startDate` / `hasBeginning` /
`endDate` at the top level — even when explicitly requested via
`fields=`. The dates live in `takesPlaceAt[].startDate` /
`takesPlaceAt[].endDate`, and the response trims that field unless
you request it. Three concrete gotchas:

### Gotcha A — `fields=` is mandatory for events

A bare `geo_distance + type[in]=Event` call returns the IDs and
labels but strips out `takesPlaceAt`, `offers`, and `hasContact`.
The catalog response defaults to the indexed projection, not the
full RDF graph. The fix is to specify every nested field you need:

```ts
const EVENT_FIELDS =
  'uuid,uri,type,label,isLocatedAt,hasContact,hasDescription,takesPlaceAt,offers,lastUpdate';
```

### Gotcha B — Date filters on nested fields return 0 results

DT's filter DSL (`filters=hasBeginning[gte]=2026-05-17`) does not
traverse arrays of objects. Trying to filter on `startDate[gte]=...`
or `hasBeginning[gte]=...` silently returns `0` (HTTP 200, empty
`objects`). The pragmatic fix is **client-side filtering**: fetch
the geo + type-filtered slice (typically ≤ 100 events), parse
`takesPlaceAt[]`, then filter on the date window in-process.

### Gotcha C — DT events publish swapped start/end dates

Several regional ODTs publish `takesPlaceAt[].startDate >
takesPlaceAt[].endDate` (e.g. `startDate: "2026-11-19", endDate:
"2026-05-25"` for a season running Nov → May next year). Normalise
by always taking `min(start, end)` as the canonical start and
`max(...)` as the canonical end — relying on the field name is a
data integrity trap.

### Gotcha D — Subtype filters silently return 0

`type[in]=Concert` or `type[in]=MusicEvent` returns 0 results
across all DT regions we tested. The regional ODTs publish under
the abstract `Event` (and the `ExhibitionEvent` / `EntertainmentAndEvent`
subtypes from the reasoner), but never `Concert` / `MusicEvent` /
`SportsEvent`. Always filter on `type[in]=Event` and classify
subtypes client-side via the `type[]` array on each event object.

### Pricing path

Event pricing is **not** at `hasPrice[]` (which is a POI field).
For events the canonical path is
`offers[0].priceSpecification[0].minPrice[0]` — note `minPrice` is
an array (DT models "from X €" as a 1-element list).

### Lifecycle (weekly cron)

Events are time-bound: a January-published season ending in March
is no longer surfaceable in April. The orchestrator persists `[]`
when nothing matches (not `null`) so the page knows the sync ran
without leaving stale entries. The reader
(`readUpcomingEvents` in `apps/web/src/server/hotels/get-hotel-by-slug.ts`)
also filters out anything whose `endDate < today` as a
belt-and-braces guard against a 7-day-old cron run.

CLI:

```powershell
# Pilot one hotel (~3 s, $0.01)
pnpm events:sync:bristol

# Dry-run preview without LLM or DB write (~3 s, $0)
pnpm events:sync:dry --slug=le-bristol-paris

# Full catalogue (~2 min, $0.05)
pnpm events:sync --bucket=all --concurrency=3
```

Cron: `.github/workflows/sync-hotel-events.yml` runs every Monday
04:17 UTC. Manual dispatch supports `--slug`, `--bucket`,
`--dry-run`.

## Anti-patterns

- ❌ Calling `fetch()` directly on a third-party hotel website — bot
  protection, JS rendering, dirty HTML. Use Tavily.
- ❌ `gpt-4o` for extraction tasks — 10× cost for no quality gain over
  `gpt-4o-mini` at temperature 0.
- ❌ Empty string `''` for missing facts — invisible in the DB, hard to
  audit. Use `AUTO_DRAFT` or `null`.
- ❌ Overwriting DATAtourisme address with Wikipedia content.
- ❌ Wikidata SPARQL without a custom `User-Agent` — Wikimedia throttles.
- ❌ Tavily without `includeDomains` when you know the authoritative
  source — wastes credits and lowers signal-to-noise.
- ❌ Writing facts without `sourceUri` + `sourceLabel`.
- ❌ Non-idempotent enrichment scripts (re-running corrupts data).
- ❌ Sending Overpass QL as JSON body — must be `data=<QL>` (form-encoded).
- ❌ Running Overpass with `--concurrency` > 2 — public instance throttles
  hard at ~1 req/s and returns silent timeouts.
- ❌ LLM POI descriptions without an explicit anti-cliché contract —
  `gpt-4o-mini` defaults to "cadre agréable / ambiance conviviale" mush.
- ❌ Skipping the OSM → DT dedup in `mergePois` — same pharmacy can be
  in both datasets, then appears twice in the UI.
- ❌ Calling DT `/catalog` for events without `fields=...takesPlaceAt,offers...` —
  the indexed projection strips dates and pricing.
- ❌ Filtering DT events by `hasBeginning[gte]` / `startDate[gte]` —
  returns silent 0; do client-side filtering on parsed `takesPlaceAt[]`.
- ❌ Filtering DT events by `type[in]=Concert` / `MusicEvent` —
  silent 0 across every region tested; filter on `type[in]=Event` and
  classify subtypes client-side.
- ❌ Trusting `takesPlaceAt[].startDate` < `endDate` — several ODTs
  publish them swapped. Always `min/max` to normalise.
- ❌ Reading event pricing from `hasPrice[]` — that's a POI field.
  Use `offers[0].priceSpecification[0].minPrice[0]`.
- ❌ Persisting `null` to `upcoming_events` when nothing matches —
  always write `[]` so the reader can distinguish "synced, no events"
  from "never synced".

## References

- `llm-output-robustness` — generation pipeline that consumes the enriched briefs.
- `api-integration` — base HTTP / Zod / retry pattern.
- `supabase-postgres-rls` — destination tables and migrations.
- `geo-llm-optimization` — EEAT + source attribution surface in `llms.txt`.
- Reference impls: `scripts/editorial-pilot/src/enrichment/{brief-builder,datatourisme,wikidata,wikipedia,tavily-client,llm-extract}.ts`.
- POI pipeline: `scripts/editorial-pilot/src/pois/{sync-hotel-pois,merge-pois,llm-describe-pois}.ts` + `packages/integrations/src/overpass/`.
- POI JSON-LD: `packages/seo/src/jsonld/place-amenity.ts` (`osmToSchemaClass`, `buildOpeningHoursSpecification`).
- Events pipeline: `scripts/editorial-pilot/src/events/{sync-hotel-events,llm-describe-events}.ts` + `scripts/editorial-pilot/src/enrichment/datatourisme.ts` (`fetchEventsAround`).
- Events JSON-LD: `packages/seo/src/jsonld/event.ts` (`eventJsonLd`, `buildEventListJsonLd`).
- Events reader: `apps/web/src/server/hotels/get-hotel-by-slug.ts` (`readUpcomingEvents`).
- Events cron: `.github/workflows/sync-hotel-events.yml`.
