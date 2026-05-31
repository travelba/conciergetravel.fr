---
name: photo-pipeline
description: Hotel/itinerary photo pipeline for MyConciergeHotel.com — sourcing, legal hygiene, Cloudinary migration, alt enrichment, Structured Metadata fields, and the hero fallback chain. Use when a hotel or itinerary photo is missing or wrong, when adding the photos workflow for a new entity, when auditing the catalogue for Pinterest hotlinks or other legal risks, when uploading to Cloudinary at scale, or when wiring photo metadata for JSON-LD `ImageObject` + alt enrichment (Hard Rule 16 in `hotel-detail-page.mdc`).
---

# Photo pipeline — MyConciergeHotel.com

## Sequencing decision (2026-05-25 — DO NOT REORDER)

**Photos ship LAST.** The product owner explicitly chose to complete the
**written content layer** (factual summary, meta description, policies,
long description, FAQ, Concierge Advice, rankings, guides, itineraries)
across the **full catalogue** before touching the photo migration.

Rationale: the written content directly drives SEO ranking, GEO/AEO
citation share, sitemap freshness, and the LLM training corpus.
Photos are a UX/conversion lever that has zero impact on a hotel's
indexability or LLM citeability — even an imageless `<Hotel>` JSON-LD
ranks if `description`, `address`, `aggregateRating` and `amenityFeature`
are solid. Front-loading content also keeps the legal Pinterest
clean-up loaded but ready: we know what's there (214 hotlinks
documented below), we'll move on it once writing is done.

Consequence for agents: when a written-content chantier and a
photo chantier are both possible, **pick the written one**. Use the
itinerary hero fallback (§fallback below) to keep the imageless
pages serviceable in the meantime.

The ordering of written-content chantiers themselves is captured in
`AGENTS.md` §"Content completion order (2026-05-25 audit)" — read
that file before starting a new content session.

## State of the catalogue (audit 2026-05-25)

The catalogue counts **949 published hotels** and **20 published itineraries**.
The photo layer is the **single largest data gap** of the project today:

| Source `hotels.hero_image`                   | Count     | Risk                                                                                                                                                                   |
| -------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NULL`                                       | 622 (65%) | Broken Article rich result, no OG preview, LCP regression                                                                                                              |
| `https://i.pinimg.com/…`                     | 214 (22%) | **⚠️ Legal risk** — Pinterest hotlinks are almost certainly unlicensed. URLs are also unstable (Pinterest rotates CDN paths) and slow (no CWV control).                |
| `https://commons.wikimedia.org/…`            | 109 (12%) | OK legally (Creative Commons) but **hotlink** — bandwidth lives on the Wikimedia CDN, no `f_auto,q_auto`, no responsive variants. Migration to Cloudinary unlocks LCP. |
| Cloudinary public_id (`cct/hotels/<slug>/…`) | 2         | Canonical, what every hotel should eventually use.                                                                                                                     |

The 20 itineraries fare worse: only **5 first-hotels** carry a `hero_image`,
and only **1 itinerary's first-hotel hero** is already on Cloudinary
(`paris-lune-de-miel` → `le-bristol-paris`).

## Triggers

Read this skill BEFORE:

- Touching `apps/web/src/app/[locale]/hotel/[slug]/page.tsx`,
  `.../itineraire/[slug]/page.tsx`, or any component that renders
  `hero_image`, `gallery_images`, or `hero_cloudinary_id`.
- Replacing or assigning a `hero_image` value on a hotel — never plug a
  Pinterest URL, vendor-site direct URL, or any non-licensed source.
- Writing a script that bulk-uploads to Cloudinary (e.g. seeding a
  destination catalogue, migrating Wikimedia hotlinks).
- Designing alt text for any hotel/itinerary photo (Hard Rule 16:
  alt enriched with keyword + context — `"piscine extérieure chauffée
Hôtel X Nice"` not `"piscine"`).
- Configuring Cloudinary Structured Metadata fields via the
  `plugin-cloudinary-cloudinary-smd` MCP (canonical fields below).

## Canonical shape

### Storage

| Column                           | Type  | Format                                                                                            | Notes                                                                                                                                                          |
| -------------------------------- | ----- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hotels.hero_image`              | text  | Cloudinary public_id, `cct/hotels/<slug>/hero`                                                    | Long-term shape. URLs accepted in legacy rows; new uploads MUST be Cloudinary.                                                                                 |
| `hotels.gallery_images`          | jsonb | `[{"public_id": "...", "alt_fr": "...", "alt_en": "...", "category": "...", "credit": "..."}, …]` | At least 30 entries for a published hotel (Hard Rule 9 in `hotel-detail-page.mdc`).                                                                            |
| `itineraries.hero_cloudinary_id` | text  | Cloudinary public_id                                                                              | Optional — when null, the page falls back to the first hotel's `hero_image` (see `apps/web/src/app/[locale]/itineraire/[slug]/page.tsx` → `pickHeroSource()`). |
| `itineraries.gallery_images`     | jsonb | same shape as `hotels.gallery_images`                                                             | Optional.                                                                                                                                                      |

### Cloudinary public_id convention

`cct/hotels/<hotel-slug>/<role>-<n>` where `role` ∈ `hero`, `exterior`,
`room`, `dining`, `spa`, `pool`, `lobby`, `view`, `detail`, `concierge`.
Example: `cct/hotels/le-bristol-paris/hero-1`,
`cct/hotels/le-bristol-paris/pool-3`.

For itineraries (when an editorial-specific hero is shot or licensed):
`cct/itineraires/<itinerary-slug>/hero`.

### Cloudinary Structured Metadata fields (one-time setup)

Configure once via `plugin-cloudinary-cloudinary-smd` MCP
(`create-metadata-field`). Required fields:

- `hotel_slug` (string, indexed) — joins back to `hotels.slug`
- `room_slug` (string, indexed, optional) — joins to `hotels.rooms[].slug`
- `photo_category` (enum: exterior, interior, room, dining, spa, pool, lobby, view, detail) — Hard Rule 9 (≥ 30 photos covering ≥ 10 categories)
- `alt_text_fr` (string) — required for Hard Rule 16
- `alt_text_en` (string) — required for Hard Rule 16
- `credit` (string) — photographer or source attribution
- `licence` (enum: cc-by-sa-4.0, cc-by-4.0, cc0, all-rights-reserved, fair-use) — legal trail
- `captured_at` (date) — freshness signal for editorial decisions
- `is_hero` (boolean) — at most one per `hotel_slug` (rule enforced by the LLM seeding script, not Cloudinary)

## Hero fallback (runtime, no data migration)

The itinerary detail page already implements a fallback chain in
`apps/web/src/app/[locale]/itineraire/[slug]/page.tsx`:

```ts
function pickHeroSource(itinerary, hotelById) {
  // 1. Editorial intent (set in Payload UI or by a future LLM pipeline)
  if (itinerary.hero_cloudinary_id) return { source: itinerary.hero_cloudinary_id, altHint: null };
  // 2. First hotel's hero (5/20 itineraries benefit immediately)
  const first = hotelById.get(itinerary.hotel_ids[0]);
  if (first?.heroImage)
    return { source: first.heroImage, altHint: `${first.nameFr} — ${first.city}` };
  // 3. Give up — header renders without hero block
  return null;
}
```

`resolveHeroUrl(source, transforms, cloudName)` then distinguishes:

- A Cloudinary public_id (no `http` prefix) → wrap in `buildCloudinarySrc`
- A fully-qualified URL → return as-is

The same helper is reused by `generateMetadata` for the Open Graph image
(separate Supabase round-trip on the first hotel only — sub-100ms, lives
inside the ISR cache window).

**Don't extend this fallback further.** A third hop ("second hotel if
first hotel imageless") makes the page brittle. Instead, finish the
migration so every published hotel has a hero.

## Migration priorities

In decreasing risk order:

1. **214 Pinterest hotlinks → manual re-sourcing**. These are unlicensed.
   Plan: for each hotel, query Wikimedia Commons first
   (`commons.wikimedia.org/wiki/Special:Search?search=<hotel-name>`),
   then the official hotel media kit (most palaces and 5★ have a
   downloadable press kit page), then Tavily extract from the official
   site (with the `image` filter). Upload to Cloudinary under
   `cct/hotels/<slug>/`. **Never** auto-pull a Pinterest URL — Pinterest
   ToS forbids redistribution.
2. **109 Wikimedia hotlinks → bulk Cloudinary migration**. Pipeline:
   - `tavily_extract` or direct `fetch` against the `Special:FilePath`
     URL (Wikimedia is content-Disposition friendly).
   - `plugin-cloudinary-cloudinary-asset-mgmt-upload-asset` with the
     downloaded buffer and `public_id = cct/hotels/<slug>/hero`.
   - SMD: set `credit = "Wikimedia Commons — <author>"`,
     `licence = "cc-by-sa-4.0"` (the most common Wikimedia licence;
     verify per file by parsing the `<licenseinformation>` block).
   - `UPDATE hotels SET hero_image = 'cct/hotels/<slug>/hero' WHERE slug = ?`
   - Don't forget the Payload `afterChange` hook for `revalidateTag`
     (skill `backoffice-cms` §direct-sql-bypass).
3. **622 NULL → editorial sourcing or AI generation**. Two paths:
   - **Sourcing**: Wikimedia → official site → Atout France media database
     (palaces have a public photo set indexed at
     <https://atout-france.fr/professionnels/palace>). Same pipeline as #2.
   - **AI generation**: `plugin-cloudinary-cloudinary-analysis` can
     synthesize a stylised hero with a controlled prompt, but the result
     looks generic and the `credit` field must mention "AI-generated —
     illustrative". Use only as a last resort for inventory hotels we
     have no real photos of, never for palaces.

## Gotcha — Cloudinary "rate_limited" is usually a Commons 429 (fetch the bytes yourself)

When uploading at scale you will hit a wall of
`{"kind":"rate_limited"}` from `uploadFromUrl` that **no Cloudinary plan
upgrade fixes** (verified 2026-05-31: upgraded free → Plus, 0.5 % credit
usage, still rate-limited at concurrency 1). The error is a red herring.

Root cause: passing a **Wikimedia Commons URL** to Cloudinary's _remote
fetcher_ (`uploader.upload(remoteUrl, …)`) makes **Wikimedia** return
`429 Too Many Requests` — Cloudinary's shared egress IP/UA is throttled by
Commons across all its customers. The SDK surfaces this as
`http_code: 400, message: "Error in loading <url> - 429 Too Many Requests"`,
and `mapSdkError` (matching "too many requests") mislabels it as a
Cloudinary rate limit.

The fix (shipped in `packages/integrations/src/cloudinary/client.ts`):
**fetch the source bytes ourselves** with a Wikimedia-policy-compliant
`User-Agent`, then hand Cloudinary a base64 data URI so it never
re-fetches the source. Diagnostic proof:

```text
upload(remoteCommonsUrl)        -> 2 uploads FAILED rate_limited in 177 s
fetch(url,{UA}) -> 200 in 94ms; upload(dataUri) -> 11 uploads OK in 30 s
```

Notes for the next agent:

- Cap the **raw** source bytes at ~14 MB, not 20 MB: the base64 data URI
  inflates the POST payload ~33 %, and Cloudinary's POST limit is 20 MB
  (`media_limits.image_max_size_bytes`). A 16 MB original → 21 MB base64 →
  Cloudinary `asset_too_large`.
- Google Places photo URLs (`lh3.googleusercontent.com`, signed) do **not**
  429 — only the Commons remote fetch does. But fetching bytes ourselves is
  uniformly more robust, so the client does it for every source.
- To re-run only the rows still missing a hero (skip the ~328 already
  hydrated), set `MCH_ONLY_MISSING_HERO=1` on `sync-hotel-photos.ts`.

## Pattern — Tavily press-kit discovery for flagship hotels (2026-05-31)

When the in-place pipeline (`sync-hotel-photos.ts` Commons + Places)
returns too few photos for a flagship hotel, the next legal source is
the **official press kit** crawled via Tavily. The pattern was
validated on 4 hotels (Bristol, Akelarre, Al Moudira, Alila) — went
from 1/9 → 11/14/21/18 photos in 2 minutes of API time.

### Two-script pipeline (READ-ONLY discovery → curated upload)

The split is non-negotiable: Cloudinary uploads consume plan quota,
and hotel sites frequently embed boutique/product/poster images that
look hotel-shaped but are not. The PO (or the agent in PO mode) must
review the JSON before any byte hits Cloudinary.

- **Step 1 (read-only):** `scripts/editorial-pilot/src/photos/discover-press-kit-images.ts`
  - Runs 4 Tavily Searches per hotel (press-kit, rooms-suites, dining-spa, exterior-pool)
  - `include_images: true` + `include_image_descriptions: true` + `include_domains` = trusted set
  - Outputs `runs/press-kit-discovery-<slug>-<ts>.json` with every candidate URL + Tavily caption
- **Step 2 (write):** `scripts/editorial-pilot/src/photos/upload-press-kit-images.ts`
  - Reads the JSON, applies per-slug `HOSTNAME_WHITELIST`
  - For each surviving URL: OpenAI Vision (`gpt-4o-mini`) → `{category, alt_fr, alt_en, caption_fr, caption_en, quality_score 1-10, keep}`
  - Drops `keep=false` or `quality_score < 6`
  - Cloudinary upload via the existing `uploadFromUrl()` (folder `cct/hotels/<slug>/press-<N>`)
  - PATCHes `hotels.gallery_images` JSONB (append, preserve existing)

### Critical learnings (do not re-pay this cost)

1. **Trusted-domain set ≠ image hostname.** Tavily honours `include_domains`
   for the source PAGE, but the page can reference any CDN. Filtering
   images by `host.includes(officialDomain)` rejected ALL images on
   the first pass (Le Bristol → 0 results). Fix: trust the image
   URL because it came from a trusted page; filter only via a
   per-slug `HOSTNAME_WHITELIST` of legitimate CDNs (`images.eu.ctfassets.net`
   for Oetker, `assets.hyatt.com` for Hyatt, `static.wixstatic.com` for
   Wix-hosted sites, etc.).
2. **Parent-group domains matter.** Le Bristol's own site (`hotel-bristol.com`)
   returns 1 thin page. The full press kit is on `oetkercollection.com`
   (Contentful CDN). Akelarre → `relaischateaux.com` (R&C consortium).
   Alila → `hyatt.com` (corporate DAM). Maintain a `PARENT_DOMAINS`
   table in `discover-press-kit-images.ts`.
3. **OpenAI Vision and corporate DAMs.** `assets.hyatt.com` hotlink-blocks
   OpenAI's egress (`Error while downloading`). Fix: fetch the bytes
   yourself (UA `MyConciergeHotelBot/1.0`) and pass `data:image/jpeg;base64,…`
   to the Vision endpoint. Cap source bytes at 5 MB before base64-encoding
   (the OpenAI payload budget is 20 MB but `low`-detail Vision doesn't
   benefit from > 1k × 1k anyway). Fallback to bare URL when fetch fails.
4. **Reject hostlists** (mandatory): `tripadvisor.*`, `booking.com`,
   `expedia.*`, `hotels.com`, `pinimg.com`, `pinterest.*`, `agoda.*`,
   `kayak.*`, `trivago.*`, `fbcdn.net`, `cdninstagram.com`, `twimg.com`.
   These are NEVER official sources per `.cursor/rules/photo-quality.mdc`.
5. **Boutique/shop pollution.** Group websites often surface e-commerce
   (`boutique.oetkercollection.com/cdn/shop/files/…`, posters, branded
   apparel) in the same search. Reject paths containing `/shop/`,
   `/cdn/shop/`, `/products/`, hostname `boutique.`, `shop.`.
6. **CRITICAL — `official_url` MUST point to the hotel's specific page,
   NEVER to the corporate domain root.** The 2026-05-31 Tier-A pilot
   uploaded photos to `mandarin-oriental-cristallo-cortina` that
   visually showed an urban building with a London taxi — because
   `official_url = https://www.mandarinoriental.com/` let Tavily
   crawl every Mandarin Oriental property worldwide and Vision had
   no way to detect the mismatch (it just stamped the hotel name in
   the alt text). The 4 contaminated hotels (`mandarin-oriental-*`
   and `six-senses-*`) had to be SQL-reverted. Operational rules:
   - Accept `https://www.aman.com/resorts/amankila` (path identifies
     the hotel) ✓
   - Accept `https://www.chewtonglen.com/` (single-property domain) ✓
   - Reject `https://www.mandarinoriental.com/` (multi-property root) ✗
   - Reject `https://www.sixsenses.com/` (multi-property root) ✗
   - Reject `https://www.fourseasons.com/` (multi-property root) ✗
   - Reject ANY URL whose hostname is in `PARENT_DOMAINS_BY_GROUP[<group>]`
     without a hotel-specific path.
     The audit should flag these rows; the discover script should refuse
     to use them as `trustedDomainsForHotel` seeds. The right corpus is
     the empty `official_url` set (forcing parent-DAM-only crawl) +
     manually-curated per-hotel URLs.

## Pattern — Audit-driven rollout (2026-05-31, lesson from the 4-hotel pilot)

The 4-hotel pilot (Bristol, Akelarre, Al Moudira, Alila) worked but
revealed the cost of acting on a hunch. **Never launch a press-kit
pipeline batch over the catalogue without running the audit first.**

The audit script (`scripts/editorial-pilot/src/photos/audit-photo-readiness.ts`,
3.5 s on 2219 hotels) classifies every hotel into five urgency tiers
and a parent-group bucket — the two axes that drive the rollout
sequence:

| Tier | Definition                                                 | Action                                                    |
| ---- | ---------------------------------------------------------- | --------------------------------------------------------- |
| A    | 0-2 photos + identifiable `parent_group` (≠ `independent`) | Highest ROI — press kit + parent DAM in one shot          |
| B    | 3-9 photos + identifiable `parent_group`                   | Chain-by-chain (`--parent-group=relais_chateaux` etc.)    |
| C    | ≥ 10 photos but `hero_image IS NULL`                       | Pure hero-promotion (no Cloudinary upload needed in many) |
| D    | 0-9 photos + `parent_group = independent`                  | Tavily on `official_url` only + manual editorial review   |
| DONE | ≥ 10 photos AND has `hero_image`                           | Skip entirely (idempotent re-run never re-pays)           |

**Why this matters:**

1. **Independents need a different strategy.** Tier D (1282 hotels =
   58 % of the catalogue) cannot rely on a parent press kit. Running
   the same script on them produces noise and wastes Tavily/Vision
   quota. They need either Google Places API (always available) +
   tighter Vision filtering, or manual editorial sourcing.
2. **R&C dominates.** A single `--parent-group=relais_chateaux` batch
   covers 400 Tier B hotels (18 % of the catalogue) with one trusted
   press-kit domain. That's the biggest single ROI unlock — but only
   visible if you aggregated by `parent_group` first.
3. **Hero-only Tier C is "free."** Those hotels already have ≥ 10
   photos in gallery; they just need the existing top-quality entry
   promoted to `hero_image`. No Cloudinary upload required. The audit
   surfaces them so we don't waste a press-kit run on them.
4. **Idempotency check is real.** `MCH_ONLY_MISSING_HERO=1` skips
   already-hydrated rows, but it doesn't tell you ahead of time **how
   many** rows are eligible. The audit's `by_urgency` count does.

The audit also surfaces `suspicious_hotlinks` rows in 3 seconds (every
row that still carries a Pinterest, TripAdvisor, or Booking hostname
in `gallery_images` — these are publish-blocked per
`.cursor/rules/photo-quality.mdc` and surface zero on 2026-05-31 after
the migration).

**Output:** `scripts/editorial-pilot/runs/photo-readiness-<ts>.{json,md}`.
The Markdown report is PO-friendly and lists the top 20 countries +
parent groups + the first 50 Tier A slugs verbatim — ready to be
copy-pasted into the next `--slugs=...` invocation.

CLI:

```bash
pnpm photos:audit            # published hotels only
pnpm photos:audit:drafts     # include drafts (full catalogue view)
```

## Pattern — Catalogue-wide `official_url` backfill (Phase A.5, 2026-05-31)

Two months of editorial cohort building left the catalogue with
**~1500 published hotels missing `official_url`** and **64 with a
corporate-root URL** (the Mandarin Cortina contamination case). The
photo pipeline is downstream of `official_url` — when it's wrong,
even the safest Tavily filters produce mismatched photos. Fixing the
upstream signal once unlocks every subsequent photo run.

### Why a single Tavily-driven script (not per-chain templates)

Templating 30+ chain URL patterns (`fourseasons.com/<slug>`,
`hyatt.com/en-US/hotel/<country>/<name>/<code>`, …) looks tempting
but rots fast (chains rename properties, rebrand, change CMS).
Instead: `scripts/editorial-pilot/src/photos/backfill-official-url.ts`
runs **one Tavily search** per hotel (`"<name> <city> official site"`,
OTAs excluded) and applies a confidence rubric to the top 6 results
to pick the right one. **70 % match rate on the first attempt, 100 %
on the top-N pass** on a varied 10-hotel dry-run.

### Confidence rubric (order matters — exit on first match)

1. **Blocklist check** — `isBlocklistedHostname(host)` (OTAs, Forbes
   Travel Guide, Trip.com, Baidu, Facebook, …) → skip.
2. **Corporate-root check** — `isCorporateRootUrl(url)` → skip.
3. **HIGH-CONFIDENCE** (accept even with trivial path):
   _hostname embeds a significant token of the hotel name AND looks
   like a dedicated single-property site_. Example:
   `fourseasonstianjin.com/en` → ✓ even though the path is `/en` only,
   because the hostname alone identifies the hotel.
4. **Trivial-path SKIP** (anything else with `/`, `/en`, `/fr` only):
   no way to disambiguate.
5. **MEDIUM** — parent-group domain + hotel-name in the path. Example:
   `mandarinoriental.com/en/muscat/shatti-al-qurum`.
6. **MEDIUM** — high Tavily score (≥ 0.8) + dedicated-looking domain
   + name token in path. Example:
   `hongkong.ihghotels.cn/regent-hong-kong/...`.
7. Else **SKIP** with reason logged (`low-confidence(host=...)`).

### Iteration on top-N candidates (critical)

Take the top 6 Tavily results, not just `#1`. The first result is
often Facebook / Instagram / Forbes Travel Guide, but `#2` is the
real hotel site. Iterating recovered ~30 % more matches on the
dry-run. Cost: ~0 extra credits (the search returns all 6 anyway).

### Tavily 100 req/min free-tier ceiling

The catalogue is 1500 NULL + 64 corporate-root rows. At
`concurrency=6` (~6 req/sec = 360/min), the script hits 429s after
~100 hotels (~16s). Two mitigations baked into the script:

- `--throttle-ms=1500` (per-worker sleep between successive Tavily
  calls). With `--concurrency=2`, that's ~1.33 req/s = 80 req/min,
  comfortably under the 100/min ceiling. Estimated runtime for the
  ~1500 NULL set: ~20 min.
- `--resume-from=<jsonl>` reads the previous runlog and excludes
  every slug that finished with `status !== 'failed'`. Hotels that
  were UPDATED are also auto-excluded because their `official_url`
  is no longer NULL.

### CLI cheat sheet

```bash
# Dry-run on 10 hotels covering all paths.
pnpm photos:backfill-url --slugs=akelarre,le-bristol-paris,... --dry-run

# Fix the 64 landmines first (highest ROI per credit spent).
pnpm photos:backfill-url --only-corporate-root --concurrency=4

# Then the ~1500 NULL hotels at a safe pace.
pnpm photos:backfill-url --only-null --concurrency=2 --throttle-ms=1500

# After a 429, resume from the previous runlog.
pnpm photos:backfill-url --only-null --concurrency=2 --throttle-ms=1500 \
  --resume-from=runs/backfill-official-url-2026-05-31T15-48-33-830Z.jsonl
```

### Run-once before any catalogue-wide photo batch

Before ever launching `discover` / `upload-press-kit` at scale,
verify the URL gate is clean:

```sql
SELECT
  CASE
    WHEN official_url IS NULL THEN 'NULL'
    WHEN isCorporateRootUrl(official_url) THEN 'CORPORATE_ROOT'
    ELSE 'OK'
  END AS status,
  COUNT(*)
FROM hotels
WHERE is_published = true
GROUP BY 1;
```

Aim for `OK = total`. Anything else means the next photo batch will
produce Tier A pilot-style contamination.

## Pattern — Shared parent-group mapping (single source of truth)

`scripts/editorial-pilot/src/photos/parent-group-mapping.ts` is the
**single** source of truth for: which hotel chains exist, which
domains host their press kits, which CDNs to trust, which hostnames
are always toxic. Three earlier scripts (`discover-press-kit-images`,
`upload-press-kit-images`, `sync-hotel-photos`) had each grown their
own local `PARENT_DOMAINS` / `HOSTNAME_WHITELIST` / `HOSTNAME_BLOCKLIST`
copy — drift was inevitable.

The module exposes:

- **`ParentGroup`** — closed string union of 19 known groups
  (`oetker`, `cheval_blanc`, `aman`, `four_seasons`,
  `mandarin_oriental`, `belmond`, `six_senses`, `como`, `rosewood`,
  `bulgari`, `relais_chateaux`, `lhw`, `hyatt`, `marriott_lux`,
  `ihg_lux`, `accor_lux`, `auberge_resorts`, `oberoi`, `anantara`).
  Use `independent` as the default fallback.
- **`PARENT_DOMAINS_BY_GROUP`** — `Record<ParentGroup, string[]>`
  mapping each group to its press-kit hostnames. Independents map to
  `[]`; the per-hotel `official_url` is added separately by
  `trustedDomainsForHotel`.
- **`inferParentGroup(hotel)`** — inference order:
  1. `SLUG_PARENT_GROUP_OVERRIDES[slug]` (escape hatch for outliers)
  2. `official_url` hostname matches a known parent domain
  3. `luxury_tier` matches a known group enum
  4. fall back to `independent`
- **`trustedDomainsForHotel(hotel)`** — concatenates the hotel's own
  domain (from `official_url`) with its parent group's domains. The
  set is passed verbatim to Tavily's `include_domains`.
- **`HOSTNAME_BLOCKLIST_GLOBAL`** — exact-match hostnames that are
  NEVER official (TripAdvisor, Booking, Pinterest, Instagram, …).
  Use `isBlocklistedHostname(host)` — it handles subdomain matches.
- **`HOSTNAME_WHITELIST_GLOBAL`** — CDNs commonly hosting press-kit
  bytes for trusted brands (`images.eu.ctfassets.net` for Oetker,
  `assets.hyatt.com` for Hyatt, `static.wixstatic.com` for Wix-
  hosted boutiques, …). Tavily honours `include_domains` for the
  source PAGE; the actual image URL almost always lives on a CDN,
  hence the whitelist.
- **`countSuspiciousGalleryRows(gallery)`** — audit helper, returns
  how many entries reference a blocklisted hostname.

**Extending it:** when you discover a new parent group, add:

1. A new entry in the `ParentGroup` union.
2. Its press-kit domains in `PARENT_DOMAINS_BY_GROUP`.
3. The matching `LUXURY_TIER_PARENT_GROUP` mapping (if the group is
   already an enum on `hotels.luxury_tier`).
4. Optional `SLUG_PARENT_GROUP_OVERRIDES` entries for outliers.

Then rerun `pnpm photos:audit` — the count of `independent` should
drop. If it doesn't, the inference order is failing for that group.

## Pattern — Hero alt MUST come from the matching gallery row (2026-05-31 bug fix)

`apps/web/src/app/[locale]/hotel/[slug]/page.tsx` historically used
`galleryImages[0]?.alt` as the hero alt fallback. That breaks when
the `hero_image` `public_id` is **not** in `gallery_images` (e.g. the
hero was uploaded via a different pipeline, or the matching row was
later removed). For Le Bristol Paris, the hero (`commons-1`) had no
gallery row, so the alt silently inherited `commons-10` (a stray
"Toyota Century parked in front of Le Bristol" archive photo — a
WCAG 1.1.1 violation and a Hard Rule 16 violation).

Correct lookup:

```ts
const heroGalleryMatch =
  heroPublicId !== null ? galleryImages.find((g) => g.publicId === heroPublicId) : undefined;
const heroDescriptor =
  heroPublicId !== null ? { publicId: heroPublicId, alt: heroGalleryMatch?.alt ?? name } : null;
```

Fallback to the hotel `name` (always safe + descriptive). NEVER to a
random gallery entry. Audit any new code that uses `gallery[0]` or
`[N]` indexing — it's almost always a smell when the underlying data
isn't guaranteed-sorted.

## Anti-patterns

- ❌ Plugging a Pinterest URL into `hero_image`. **Hard refused at PR
  review** — it's an open legal risk + ToS violation.
- ❌ Hotlinking the official hotel's website asset (`https://www.<hotel>.com/photos/hero.jpg`).
  Same legal issue + breaks when they redesign + no Cloudinary perf.
- ❌ Using `next/image` on `<ItineraryHero>` or `<HotelGallery>`.
  `apps/web/src/components/itineraire/itinerary-hero.tsx` line 48 explains:
  `next/image`'s loader routes through `/_next/image`, breaking the
  Cloudinary `f_auto,q_auto` CDN cache.
- ❌ Storing the alt text only in French. Hard Rule 16 requires
  alt enriched in **both** locales (`alt_text_fr` AND `alt_text_en` in SMD).
- ❌ Bulk-uploading to Cloudinary without setting SMD fields. Photos
  without `hotel_slug`/`photo_category` cannot be reverse-joined when
  the catalogue grows past 10k assets.
- ❌ Building a third fallback level in `pickHeroSource` (e.g. second
  hotel, ranking entries, random destination photo). Fix the data
  instead.
- ❌ Using `galleryImages[0]?.alt` (or any positional index) as the
  hero alt fallback — see "Hero alt MUST come from the matching
  gallery row" above. Use `find(g => g.publicId === heroPublicId)`
  and fall back to the hotel `name`.
- ❌ Filtering Tavily images by `hostname.includes(officialDomain)`.
  Images live on the page's CDN, not on the page's domain. Maintain
  a per-slug `HOSTNAME_WHITELIST` of trusted CDNs instead.
- ❌ Passing a raw URL to OpenAI Vision when the source is a corporate
  DAM (Hyatt, Marriott, IHG). Most hotlink-block OpenAI's egress;
  fetch the bytes yourself with a descriptive UA and pass a base64
  data URI.
- ❌ Launching a press-kit batch over the catalogue without running
  `pnpm photos:audit` first. The tier (A/B/C/D/DONE) drives the
  strategy: Tier C only needs hero promotion (no upload), Tier D
  needs a different script (independents don't have a parent press
  kit), and `MCH_ONLY_MISSING_HERO` alone doesn't tell you how many
  hotels are actually eligible per group. Three seconds of audit
  save hours of wasted Tavily/Vision quota.
- ❌ Duplicating `PARENT_DOMAINS` / `HOSTNAME_WHITELIST` / `HOSTNAME_BLOCKLIST`
  inside a new photo script. Import them from
  `scripts/editorial-pilot/src/photos/parent-group-mapping.ts`
  instead. If a chain is missing, add it to the shared module — every
  other script benefits immediately.
- ❌ Accepting a corporate-domain root (`mandarinoriental.com/`,
  `sixsenses.com/`, `fourseasons.com/`, `hyatt.com/`) as a hotel's
  `official_url`. It POISONS the Tavily crawl with photos from sibling
  properties and Vision cannot detect the mismatch (the alt is built
  from the hotel name, not from the image content). The 2026-05-31
  Tier-A pilot lost 4 hotels this way — `mandarin-oriental-cristallo-cortina`
  ended up with photos of a Mandarin in central London. Always
  require either a path-specific URL (`aman.com/resorts/amankila`)
  or leave `official_url` NULL (the parent-DAM crawl is safer than
  a misleading corporate root).
- ❌ Trusting Vision to spot a hotel mismatch. `gpt-4o-mini` will
  cheerfully stamp "Luxueux Hôtel <name> <city>" on any palace-style
  image, because the prompt frames the hotel name as ground truth.
  Mismatch detection requires either (a) an `official_url` that
  scopes the crawl to one property, or (b) a manual editorial review
  pass after upload.

## References

- `.cursor/rules/hotel-detail-page.mdc` §Hard Rules 9 + 16 (≥ 30 photos,
  alt enriched).
- `.cursor/rules/photo-quality.mdc` (sourcing legality, banned domains).
- `.cursor/skills/photo-quality-seo-geo-agentique/SKILL.md` (signature
  transform `ADR-0024`, JSON-LD ImageObject contract).
- `.cursor/skills/content-enrichment-pipeline/SKILL.md` (Wikimedia,
  Tavily extract).
- `.cursor/skills/backoffice-cms/SKILL.md` §direct-sql-bypass (cache
  invalidation after bulk update).
- `.cursor/skills/api-integration/SKILL.md` (HTTP client patterns for
  the Cloudinary upload script).
- `apps/web/src/app/[locale]/itineraire/[slug]/page.tsx` → `pickHeroSource()`,
  `resolveHeroUrl()` — current fallback implementation.
- `apps/web/src/server/itineraries/get-related-data.ts` → `HotelLookup.heroImage`
  exposes the field downstream.
- `scripts/editorial-pilot/src/photos/discover-press-kit-images.ts` →
  Tavily press-kit discovery script (read-only, JSON report).
- `scripts/editorial-pilot/src/photos/upload-press-kit-images.ts` →
  Vision-curated Cloudinary upload + Supabase patch (write).
- `apps/web/src/app/[locale]/hotel/[slug]/page.tsx` → `heroDescriptor`
  lookup pattern (match `publicId`, fallback to `name`).
- `scripts/editorial-pilot/src/photos/audit-photo-readiness.ts` →
  catalogue-wide urgency-tier audit (`pnpm photos:audit`).
- `scripts/editorial-pilot/src/photos/parent-group-mapping.ts` → single
  source of truth for `ParentGroup`, `PARENT_DOMAINS_BY_GROUP`,
  `HOSTNAME_BLOCKLIST_GLOBAL`, `HOSTNAME_WHITELIST_GLOBAL`.
