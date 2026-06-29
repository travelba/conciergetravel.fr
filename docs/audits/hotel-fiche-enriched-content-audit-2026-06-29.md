# Hotel fiche enriched-content audit — 2026-06-29

**Scope:** every published hotel fiche (**2929 published** / 2985 total — live
PostgREST count `hotels?is_published=eq.true`). Read-only audit.
**Data sources:** PostgREST (`NEXT_PUBLIC_SUPABASE_URL` + service role) for all DB
counts; live `curl https://myconciergehotel.com/...` (FR + `/en/`) for surfacing;
the `gsc` MCP (`sc-domain:myconciergehotel.com`, full access) for the "ressort
bien" read. Heavy JSONB columns (`long_description_sections`, `faq_content`,
`gallery_images`, `concierge_advice`) were pulled in full and analysed locally
with the **exact** reader gates (`apps/web/src/server/hotels/get-hotel-by-slug.ts`)
and the **shared `hasLeak()` regex** (`scripts/editorial-pilot/src/enrichment/
scaffolding-gate.ts`). Every number below is a real count unless prefixed
_(est.)_.

---

## Executive summary

- **Editorial enrichment is essentially complete and high-quality in FR AND EN.**
  Across 2929 published fiches: `description_fr/en`, `faq_content`,
  `long_description_sections`, `concierge_advice`, `factual_summary_fr/en`,
  `meta_desc_fr/en`, `external_sources`, `policies` are **all ~99–100% non-null**.
  **Zero scaffolding leaks** (FR + EN, full `hasLeak()` regex), **100% EN section
  parity** (no fiche missing a `body_en` on any valid section), FAQ averages
  **15.0 Q&A**, and **100% of concierge_advice blocks pass the render gate** — the
  prior `tip_for`/`<50-word` EN-break gotcha is **fully resolved** (0 breaks).
- **Image enrichment headline:** the rendered galleries hold **31,115 photos**
  (avg **10.6/fiche**) with **alt_fr 100% · alt_en/caption_fr/caption_en/category
  ~99.9% · width/height 99.5%**. The real image gaps are **structural/coverage,
  not metadata**: **187 fiches still carry <10 photos** (of which **4 carry zero**),
  the **hero_suitable/representativeness score is present on only 69% of photos**,
  and the **10-category floor is reached by exactly 1 fiche** (structurally
  unreachable — `concierge`/`events` categories barely exist).
- **Images surface correctly** on photo'd fiches: live JSON-LD emits **5
  `ImageObject` nodes** (hero + 4 tiles, Cloudinary `f_auto,q_auto`) + a valid
  **`og:image`**. **The 4 zero-photo fiches emit NO `og:image`, NO
  `twitter:image`, NO `ImageObject`** → broken social preview + no image rich
  result. That is the concrete "extrait d'image" gap.
- **"Est-ce qu'on ressort bien" → NOT YET.** Content + structured data are
  ready and clean (Hotel + BreadcrumbList + FAQPage + AggregateRating + Review +
  Award + ImageObject, canonical + reciprocal hreflang, **Phase-6 Offer freeze
  respected — 0 `Offer`/`priceValidUntil`**), but **search visibility is
  near-zero**: 28-day GSC = **5 clicks / 780 impressions / pos 16.2** site-wide,
  **~90 fiches** drew any impression (≈3% of catalogue), **0 hotel-page clicks**,
  image-search ≈ **1 impression**. This is the known **authority/indexation gap**
  (young domain, yonder.fr benchmark) — _not_ a content or metadata defect.
- **Top 5 gaps:** (1) 4 zero-photo fiches with no image surfacing; (2) off-page
  authority/indexation (the dominant "ressort bien" lever); (3) 187 fiches <10
  photos (a live photo-backfill fleet is already closing this — see note);
  (4) hero_suitable/representativeness scoring missing on ~31% of photos;
  (5) `meta_desc_fr` 186 rows slightly out-of-band + `factual_summary_fr` 460
  rows below the CDC ideal band.

> **Live-data caveat (photos):** a `run-zero-photo-backfill` depth fleet
> (Google-Places → Vision → Cloudinary APPEND) was **actively running** during
> this audit (multiple terminals, 11:14–11:27). The catalogue-wide photo audit on
> 2026-06-29 morning counted **765 fiches <10 photos**; this audit's live snapshot
> reads **187**. The `<10` number is therefore a **shrinking moving target** — the
> fleet is closing it at ~100 fiches/18 min. No second orchestrator was launched
> (read-only audit), per `photo-pipeline` §"don't spawn a second orchestrator".

---

## Axis A — Editorial enrichment completeness (FR + EN)

Published denominator = **2929**. Quality gates are the **production envelopes**
the reader/Zod actually enforce; CDC ideals are flagged as aspirational.

| Metric                                       | Count     | %      | Notes / worst offenders                                                                                                                                                                                                                     |
| -------------------------------------------- | --------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `description_fr` non-null / non-empty        | 2929      | 100%   | 0 empty                                                                                                                                                                                                                                     |
| `description_en` non-null / non-empty        | 2929      | 100%   | 0 empty                                                                                                                                                                                                                                     |
| `description_fr` ≥ 600 chars (CDC ideal)     | 2925      | 99.86% | <600: `le-roch-hotel-and-spa` (478), `hotel-du-cap-eden-roc` (568), `cheval-blanc-paris` (573), `les-pres-deugenie` (588) — iconic, known voice-gate tension                                                                                |
| `description_en` ≥ 600 chars (CDC ideal)     | 2921      | 99.73% | <600: `hotel-du-cap-eden-roc` (491), `le-roch-hotel-and-spa` (521), `cheval-blanc-paris` (530), `les-pres-deugenie` (542), `le-bristol-paris` (554), `the-lowell-hotel` (555), `les-airelles-courchevel` (566), `the-peninsula-tokyo` (596) |
| `long_description_sections` non-null         | 2929      | 100%   | —                                                                                                                                                                                                                                           |
| `long_description_sections` ≥ 6 (floor)      | 2924      | 99.83% | <6: `domaine-riberach` (4), `regina-experimental-biarritz` (4), `hotel-casa-de-las-cuatro-torres` (5), `hotel-la-belle-vie` (5), `maison-du-val` (5)                                                                                        |
| sections EN parity (no `body_en` gap)        | 2929      | 100%   | **0 fiches** missing a `body_en` on any valid section                                                                                                                                                                                       |
| sections scaffolding leak (`hasLeak` FR+EN)  | 0         | 0%     | **clean** — full shared regex incl. dossier/brief/word-count/data-gap classes                                                                                                                                                               |
| `faq_content` ≥ 10 (Hard Rule 10)            | 2929      | 100%   | avg **15.0** Q&A/fiche, 0 empty                                                                                                                                                                                                             |
| `concierge_advice` passes render gate        | 2929      | 100%   | 0 `fr`-invalid, **0 `en`-breaks** (prior EN render-fail gotcha resolved); all carry a valid `en` payload                                                                                                                                    |
| `factual_summary_fr` envelope [110-165]      | 2928      | 99.97% | 1 over: `casa-del-coliseo` (173)                                                                                                                                                                                                            |
| `factual_summary_fr` CDC ideal [130-150]     | 2469      | 84.3%  | 460 in [110-129] (thin-source auto-censor); 0 below 110                                                                                                                                                                                     |
| `factual_summary_en` envelope [110-165]      | 2929      | 100%   | —                                                                                                                                                                                                                                           |
| `factual_summary_en` CDC ideal [130-150]     | 2836      | 96.8%  | 93 below 130                                                                                                                                                                                                                                |
| `meta_desc_fr` SEO band [140-170]            | 2743      | 93.6%  | 186 out — **mostly slightly OVER** (171-179, e.g. `acro-suites` 177, `alpes-hotel-du-pralong` 178, `anantara-golden-triangle-…` 179); renderer has a fallback chain so band is a quality gate, not a publish blocker                        |
| `meta_desc_en` SEO band [140-170]            | 2920      | 99.7%  | 9 out                                                                                                                                                                                                                                       |
| `policies` non-null                          | 2926      | 99.90% | 3 null                                                                                                                                                                                                                                      |
| `policies` non-synthetic (`_synthetic≠true`) | 2926/2926 | 100%   | **0 synthetic** — better than the 1 documented in AGENTS.md                                                                                                                                                                                 |
| `geo_qa` non-null                            | 2834      | 96.8%  | 95 null                                                                                                                                                                                                                                     |
| `external_sources` non-null                  | 2929      | 100%   | —                                                                                                                                                                                                                                           |
| `external_sources` ≥ 1 entry (non-`[]`)      | 2784      | 95.0%  | 145 carry an empty `[]` array                                                                                                                                                                                                               |

**Axis A verdict:** the written content layer is **done** to a very high standard
in both locales. Residuals are quality nits (CDC-ideal band tightening on
`factual_summary_fr` / `meta_desc_fr`) and a handful of iconic-hotel edge cases —
no structural holes, no leaks, full EN parity.

---

## Axis B — IMAGE enrichment (PO's explicit focus)

Source = `hotels.gallery_images` JSONB (what the fiche actually renders).
**31,115 photos** across 2929 fiches, **avg 10.6/fiche**.

### B.1 Photo count per fiche (≥10 floor)

| Bucket                          | Fiches  | %        |
| ------------------------------- | ------- | -------- |
| ≥ 10 photos                     | 2742    | 93.6%    |
| **< 10 photos**                 | **187** | **6.4%** |
| — of which 5–9                  | 166     | 5.7%     |
| — of which 1–4                  | 17      | 0.6%     |
| — of which **0 photos**         | **4**   | 0.14%    |
| ≥ 30 photos (Hard Rule 9 ideal) | 6       | 0.2%     |

- **0-photo fiches (P0):** `casa-labia`, `palais-leonia`, `six-senses-bangkok`
  (pre-opening — `official_url` correctly NULL), `villa-moon`. Same 4 carry
  `hero_image = NULL`.
- **<10 worst (sample):** `babuino-181` (1), `casa-bonita-tropical-lodge` (2),
  `21-foch` (2), `capella-kuala-lumpur` (3), `chalet-des-planes` (3),
  `anantara-maia-seychelles-villas` (6) … (full live list shrinking — fleet active).

### B.2 Per-photo metadata coverage (of 31,115 photos)

| Field                                      | Coverage           |
| ------------------------------------------ | ------------------ |
| `alt_fr`                                   | 100.0% (31,100)    |
| `alt_en`                                   | 99.9% (31,077)     |
| `caption_fr`                               | 99.9% (31,077)     |
| `caption_en`                               | 99.9% (31,077)     |
| `category`                                 | 99.9% (31,077)     |
| `width`                                    | 99.5% (30,971)     |
| `height`                                   | 99.5% (30,971)     |
| `hero_suitable` (score field present)      | **69.2% (21,537)** |
| `representativeness` (score field present) | **69.2% (21,537)** |

### B.3 Per-fiche enrichment + category floor

| Metric                                                  | Count | %         |
| ------------------------------------------------------- | ----- | --------- |
| All photos carry `alt_fr`+`alt_en`                      | 2910  | 99.4%     |
| All photos carry `caption_fr`+`caption_en`              | 2910  | 99.4%     |
| All photos carry `category`                             | 2910  | 99.4%     |
| All photos carry `width`+`height`                       | 2918  | 99.6%     |
| Any photo scored (`hero_suitable`/`representativeness`) | 2162  | 73.8%     |
| **Fiches reaching the 10-category floor**               | **1** | **0.03%** |

Distinct-category distribution per fiche: `0→6 · 1→32 · 2→67 · 3→215 · 4→630 ·
5→982 · 6→702 · 7→235 · 8→51 · 9→8 · 11→1`. Modal coverage is **5 categories**,
ceiling ~8 — consistent with `photo-pipeline` §"the 10-category floor is
structurally unreachable" (`concierge`/`events` photos barely exist in Google
Places / press kits). **Do not chase 10/10** — the indexability gate does not
enforce it.

- **15 fiches with ≥1 photo missing alt** (the real per-photo "extrait d'image"
  gap): `four-seasons-hotel-prague`, `the-peninsula-hong-kong`,
  `the-peninsula-istanbul`, `the-pierre`, `gleneagles`, `mandarin-oriental-barcelona`,
  `la-residencia-a-belmond-hotel-mallorca`, `montage-los-cabos`,
  `sofitel-legend-casco-viejo`, `st-nicolas-bay-resort(-hotel-and-villas)`,
  `santa-marina-a-luxury-collection-resort`, `four-seasons-one-dalton-street`,
  `hyatt-regency-sha-tin`, `upper-house-hong-kong`.

### B.4 Image SURFACING (live curl, FR + /en/)

Spot-checked `le-bristol-paris`, `the-peninsula-hong-kong`,
`hotel-du-rond-point-des-champs-elysees` (10 photos), `six-senses-bangkok`
(0 photos):

| Fiche                             | `og:image` | `ImageObject` | Cloudinary refs | Hotel/BC/FAQ/Agg JSON-LD   | Offer |
| --------------------------------- | ---------- | ------------- | --------------- | -------------------------- | ----- |
| le-bristol-paris (FR+EN)          | ✅ (×10)   | ✅ ×5         | ✅              | ✅ (+ Review ×1, award ×2) | **0** |
| the-peninsula-hong-kong           | ✅ (×10)   | ✅ ×5         | ✅              | ✅ (award ×2)              | **0** |
| hotel-du-rond-point-…-elysees     | ✅ (×10)   | ✅ ×5         | ✅              | ✅ (award ×1)              | **0** |
| **six-senses-bangkok (0 photos)** | **0**      | **0**         | **0**           | ✅ Hotel+FAQ still emit    | **0** |

`ImageObject` carries Hard-Rule-16 alt + transform-matched dims
(`f_auto,q_auto:good,c_fill,w_1200,h_900` hero). **Verdict: images surface
correctly wherever a photo exists; the 4 zero-photo fiches surface no image at
all (broken OG preview + no image rich result).** No fiche surfaces a photo
_without_ enriched alt at the JSON-LD layer — the alt-gap fiches (B.3) leak only
at the gallery `<img>` level, not in `ImageObject`.

---

## Axis C — "Ressort bien" (SEO/GEO signals)

### C.1 On-page health (live sample, all 4 fiches)

`title` + `meta` + `<link rel="canonical">` present; **reciprocal hreflang**
present (emitted as React `hrefLang`, fr↔en); rich JSON-LD graph observed:
`Hotel, BreadcrumbList, FAQPage, AggregateRating, Review, ImageObject, ItemList,
Article, Organization, TravelAgency, TouristAttraction, PostalAddress,
GeoCoordinates, City, Restaurant, Museum, Park, LandmarksOrHistoricalBuildings,
SpeakableSpecification`. The `Place` requirement is met via the `Hotel` node
(a schema.org `LodgingBusiness`→`Place` subtype) carrying `PostalAddress` +
`GeoCoordinates` + the nearby-POI `TouristAttraction` graph. **Phase-6 freeze
respected: 0 `Offer` / 0 `priceValidUntil` on every page.**

### C.2 Google Search Console (28 days, 2026-05-29 → 2026-06-26, `type=web`)

| Scope                      | Clicks | Impressions       | CTR   | Avg position       |
| -------------------------- | ------ | ----------------- | ----- | ------------------ |
| **Site-wide (web)**        | 5      | 780               | 0.64% | 16.2               |
| `/hotel/` pages (page dim) | **0**  | ~210 _(est. sum)_ | 0%    | 1–52 (mostly 3–12) |
| **Image search**           | 0      | 1                 | 0%    | 23                 |

- **~90 hotel fiches** (≈3% of 2929) drew at least one impression in 28 days,
  **overwhelmingly the `/en/` URLs**, **0 clicks** on any hotel page. Best by
  impressions: `hotel-royal` (12), `longueville-manor` (9), `capella-sydney` (9),
  `les-jardins-de-la-koutoubia` (9), `four-seasons-hotel-george-v` (8, EN),
  `myconian-sunrise` (7), `shangri-la-paris` (7). Several rank top-3
  (`mara-plains-camp` pos 1, `twa-hotel` pos 1, `chateau-d-adomenil` pos 2,
  `museum-hotel` pos 2) but on near-zero-volume brand/long-tail queries.
- **Image search is effectively nil** (1 impression) despite 31k enriched,
  Licensable-ready photos — an authority/indexation lag, not a metadata defect.

### C.3 Sitemaps

`hotels.xml` submitted **2929** URLs (exact parity with published count),
last downloaded **2026-06-29**, 0 errors / 0 warnings. Index total **8147** URLs
(hubs 3070, hotels 2929, places 1158, rankings 950, itineraries 23, rooms 17).

> **GSC caveat:** the Sitemaps API reports `indexed: 0` for every sitemap — this
> is a well-known quirk of `sitemaps.list` (it does not expose real index
> coverage). Actual indexation is proven by the C.2 impressions (≥90 hotel pages
> are indexed and serving). Real coverage requires the Index Coverage report,
> not surfaced by this MCP.

**Axis C verdict:** the fiches are technically primed to "ressortir" (clean,
rich, valid structured data; sitemap parity; Offer-freeze respected) but
**do not yet rank with volume**. The bottleneck is **off-page authority +
indexation throughput** of a young domain — the exact gap called out by the
yonder.fr benchmark rule. This is not fixable by more content/metadata.

---

## Prioritised gap list

### P0 — fix now (image surfacing + the dominant ranking lever)

| Gap                                                              | Fiches                                                                  | Fix / tool                                                                                                                                                                                                           |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Zero-photo fiches → no `og:image`/`ImageObject`**              | 4 (`casa-labia`, `palais-leonia`, `villa-moon`, `six-senses-bangkok`\*) | `scripts/editorial-pilot/src/photos/gen-places-discovery.ts` → `upload-press-kit-images.ts` (Vision-curated Places APPEND). \*`six-senses-bangkok` is pre-opening → manual press-kit only; keep `official_url` NULL. |
| **Off-page authority / indexation** (the "ressort bien" blocker) | catalogue-wide                                                          | Not a content fix — backlinks, digital PR, GSC URL-inspection priming. Track vs yonder.fr (`competitor-benchmark-yonder` rule).                                                                                      |

### P1 — high ROI

| Gap                                           | Fiches                             | Fix / tool                                                                                                                                                     |
| --------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **<10 photos**                                | 187 (live, shrinking from 765)     | **Already in progress** — `run-zero-photo-backfill.ts --min-gallery=1 --max-gallery=10` depth fleet is active; let it finish, do not spawn a 2nd orchestrator. |
| `hero_suitable`/`representativeness` unscored | ~767 fiches / ~9.6k photos (30.8%) | `scripts/editorial-pilot/src/photos/categorize-with-vision.ts` (scoring pass / `--reclassify-other`) — improves hero + TOP-4 curation and JSON-LD captions.    |
| Photos missing `alt`                          | 15 fiches                          | `categorize-with-vision.ts --slugs=…` on the B.3 list.                                                                                                         |
| `meta_desc_fr` out of [140-170]               | 186 (mostly 171-179)               | `scripts/editorial-pilot/src/hotels/run-hotel-meta-desc.ts --slugs=…`                                                                                          |

### P2 — polish (low ROI / aspirational)

| Gap                                            | Fiches            | Fix / tool                                                             |
| ---------------------------------------------- | ----------------- | ---------------------------------------------------------------------- |
| `factual_summary_fr` below CDC ideal [130-150] | 460 (in-envelope) | `run-hotel-factual-summary.ts --cdc-tightening` (thin-source; ROI low) |
| `geo_qa` null                                  | 95                | `hotels/geo-qa-generator.ts` (PAA-anchored; skip if 0 PAA)             |
| `external_sources` empty `[]`                  | 145               | `enrich-wikidata-ids.ts` → `convert-wikidata-to-external-sources.ts`   |
| `long_description_sections` < 6                | 5                 | `enrichment/enrich-hotel-content.ts --force --slugs=…` (hasLeak-gated) |
| `description_fr/en` < 600 (iconic)             | 4 FR / 8 EN       | manual re-author (Pass-8 voice-gate tension — known)                   |
| `policies` null                                | 3                 | enrichment pass                                                        |
| 10-category photo floor                        | 2928              | **Do not chase** — structurally unreachable, not an indexability gate  |

---

## Answers to the PO's two questions

1. **Is each fiche's enriched content complete & high-quality in FR and EN?**
   **Yes — ~99–100%.** Every editorial field is present in both locales, with
   zero scaffolding leaks, full EN section parity, FAQ avg 15, and 100% of
   concierge blocks rendering. Image _metadata_ is ~100% (alt/caption/category)
   on the 31k rendered photos. Residuals are quality-band nits + a handful of
   iconic edge cases.

2. **Est-ce qu'on ressort bien?** **Not yet.** The fiches are technically
   primed (clean structured data, og:image/ImageObject where photos exist,
   reciprocal hreflang, sitemap parity, Offer-freeze respected), but search
   visibility is near-zero (5 clicks / 780 impressions / 28d; ~3% of fiches
   draw any impression; image-search ≈ 0). The blocker is **off-page authority
   and indexation throughput**, not content — exactly the yonder.fr gap.

**Image-enrichment verdict:** metadata enrichment is **effectively done**
(alt/caption/category ~100%, dims 99.5%); the live gaps are **coverage**
(187 fiches <10 photos — being actively closed; 4 at zero → no surfacing),
**scoring** (hero_suitable/representativeness on 69% of photos), and the
**aspirational 10-category floor** (unreachable, do not chase).
