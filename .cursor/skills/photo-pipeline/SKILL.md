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

**JSON-LD wiring**: `gallery_images.credit` + `gallery_images.licence` now flow
into the `Hotel` `ImageObject` (`packages/seo/src/jsonld/hotel.ts`):
`credit` → `creditText`/`creator`/`copyrightNotice` (provenance, always); a
**Creative-Commons** `licence` (`cc-by-4.0`/`cc-by-sa-4.0`/`cc0`) → `license` +
`acquireLicensePage` (Google **Licensable** badge). `all-rights-reserved` /
`fair-use` (press kits) emit provenance ONLY — never a licence link (we are not
the licensor). See `photo-quality-seo-geo-agentique` §Provenance & Licensable.

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

## Gotcha — Google Places caps at ~1600 px → soft hero on hi-DPI (2026-06-02)

**Symptom**: "Pourquoi les photos sont floues ?" The hero looks fine at
`dpr=1` but visibly soft on a Retina / `dpr=2` display.

**Root cause**: photos hydrated from the Google Places Photo API top out
around **1600 px** on the long side. The hero preset
(`HERO_TRANSFORM = w_2400,h_1350,…` in `packages/ui/src/cloudinary-presets.ts`)
then **upscales** the 1600 px source to 2400 px — Cloudinary cannot invent
detail, so the result is mushy exactly when the device asks for 2× pixels.
This silently violates the `photo-quality.mdc` Hard Rule (**originals ≥
2400 px**). Confirm the diagnosis by emulating both DPRs:
`browser_cdp Emulation.setDeviceMetricsOverride {deviceScaleFactor: 2}`,
screenshot, compare to `deviceScaleFactor: 1`.

**Fix — re-source genuine ≥ 2400 px from the official Imgix-style CDN.**
Many luxury chains (Airelles `assets.airelles.com`, others on Imgix) serve
press visuals through a CDN where the output width is a **query param**
(`?auto=format%2Ccompress&w=2600`). The underlying originals are 2250–8000 px,
so requesting `w=2600` returns a real high-res frame (not an upscale).
Harvest the base Imgix URLs by scrolling the official category pages in the
browser MCP (Story / Suites / Restaurants / Spa / Pools) — direct
navigation to guessed sub-paths (`/pools`) often 404s; scroll the pages
that exist and read the lazy-loaded `<img>` srcs. Then `uploadFromUrl()`
(which already applies `c_limit, w_2400, h_2400` → caps without upscaling)
and PATCH `hero_image` + `gallery_images`.

**Reference one-shot**: `scripts/editorial-pilot/src/photos/resource-airelles-gordes.ts`
— curated 12-image set (drone hero + 9 categories), `--dry-run` first,
each upload prints real dims (all landed 2400×1349..1612, none upscaled).
Filenames carry `©` / `–`: percent-encode with `encodeURIComponent` and
verify each `?w=2600` URL loads before curating (some `Moyen-…` variants
are fixed-size and 404 at 2600). Source = `press` (official media kit),
photographer credit goes in a Cloudinary tag, not a gallery column.

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
   the first pass (Le Bristol → 0 results). Fix: accept an image when
   its host/URL matches the hotel's `trustedDomainsForHotel` (own
   official domain + parent-group DAM) OR a globally-trusted CDN
   (`HOSTNAME_WHITELIST_GLOBAL`: Contentful, S3, Cloudfront, Wix…).
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
7. **CRITICAL — corporate-path variants are just as toxic as corporate
   root.** The 2026-05-31 re-launch of the 4 reverted Tier A hotels
   re-contaminated `six-senses-bangkok` (hero showed Yao Noi karst
   islands) and `six-senses-milan` (suite tropicale). Cause:
   `official_url = https://www.sixsenses.com/en/corporate/media-center/
press-releases/2025/six-senses-bangkok-announcement` — non-trivial
   path, but a **multi-property aggregator** (press releases reference
   every property in the chain). `isCorporateRootUrl` was extended to
   reject path fragments: `/corporate/`, `/press-releases/`,
   `/press-release/`, `/media-center/`, `/media-centre/`, `/news/`,
   `/new-openings/`, `/newsroom/`, `/about/`, `/about-us/`,
   `/sustainability/`, `/careers/` whenever the hostname is a known
   parent domain. The rule:
   - Reject `sixsenses.com/en/corporate/news/<slug>` ✗
   - Reject `sixsenses.com/en/new-openings/milan` ✗
   - Reject `peninsula.com/en/newsroom/london` ✗
   - Accept `sixsenses.com/en/hotels-resorts/europe/italy/milan` ✓
     (would be the right URL once Six Senses Milan opens)
   - Accept `mandarinoriental.com/en/cortina/cristallo` ✓
     (`/region/hotel-name/` pattern — single property)
     When a hotel has no dedicated page yet (typically still-pre-opening
     properties like Six Senses Bangkok 2025), the only honest
     `official_url` is `NULL`. The press-release URL leads to
     contamination, not to a usable signal.
8. **CRITICAL — `upload-press-kit-images.ts` must be safe-by-DEFAULT, never
   pass-through.** Until 2026-05-31 the upload filter (`passesWhitelist`)
   returned `true` for ANY slug missing a hardcoded `HOSTNAME_WHITELIST`
   entry — fine for the 4 tuned flagships, catastrophic the moment you
   point it at the catalogue: a non-tuned hotel would happily upload
   Instagram-via-NitroCDN proxies, Condé Nast / Telegraph press photos
   and agency CDNs to Cloudinary (they all pass `keep` + `quality≥6`),
   silently violating `photo-quality.mdc`. Caught on `southern-ocean-lodge`
   (13 candidates → would have uploaded Instagram + cntraveler). Fix:
   the filter now imports `isBlocklistedHostname` + `trustedDomainsForHotel`
   from `parent-group-mapping.ts` and rejects by default:
   - reject if hostname OR **full URL** is blocklisted (the blocked term
     is often in the PATH, e.g. `cdn-xxx.nitrocdn.com/.../cdninstagram.com/...`
     — checking only `img.hostname` misses it);
   - accept only on the hotel's trusted domains (URL substring match so a
     NitroPack/Cloudflare proxy of the site's own `wp-content/uploads`
     passes) or a globally-trusted CDN;
   - the per-slug map (`SLUG_EXTRA_ALLOWED_HOSTS`) is now an ADD-ON, never
     the only gate (e.g. `fawn-bluff-private-lodge: ['fawnbluff.com']`
     because its brand domain ≠ its `official_url` parent path
     `flospitality.com/fawnbluff`).
9. **Tavily yield is highly source-dependent — do NOT assume a blast reaches
   the floor.** 2026-05-31 B2 pilot (5 under-10-photo hotels): Mandarin
   Oriental Paris +5 (rich `mandarinoriental.com` extraction), Four Seasons
   Seattle +1 of 19 candidates (DAM hotlink-blocks egress → 13 fetch
   errors), and the three Relais & Châteaux portal pages (`relaischateaux.com/...`)
   yielded **0** — their galleries are JS-rendered on off-domain CDNs that
   `include_images` can't extract. Since R&C is the single largest cohort
   (435 published), a catalogue-wide Tavily-on-`relaischateaux.com` run is
   near-worthless; those hotels need the R&C consortium DAM
   (`images.relaischateaux.com`) or Google Places, not the portal page.

## Gotcha — Press-kit cohort pilot capitalised learnings (2026-06-08)

14-hotel pilot (Accor / Marriott / Four Seasons). Full numbers + cohort
sequencing in `docs/runbooks/photo-sourcing-press-kit-pilot.md`. The
non-obvious bits to re-use:

1. **`upload-press-kit-images.ts` now has retry/back-off + hard timeouts.**
   A freshly-funded OpenAI account sits on a low usage tier → Vision bursts
   trip a **429 "Rate limit"** (distinct from 429 `insufficient_quota` =
   no credit). The script now retries 429/5xx (cap 20 s, honours
   `Retry-After`), with `AbortSignal.timeout` 30 s on the Vision call and
   15 s on the image fetch (a rate-limited request was hanging the whole run
   for 9 min with no timeout). Keep `categorize --concurrency=2`.
2. **Re-running `upload-press-kit` duplicates.** `pressIndex` is positional,
   computed from existing `press-*` public_ids — a partially-uploaded hotel
   re-uploads its survivors as `press-N+1`. On a partial failure, **re-run
   ONLY the hotels at 0 uploads** (or dedupe afterwards).
3. **Accor media live on `ahstatic.com`** (Fairmont/Raffles/Sofitel/Savoy) —
   whitelisted in `HOSTNAME_WHITELIST_GLOBAL`. Property brand sites that
   differ from the parent path need a `SLUG_EXTRA_ALLOWED_HOSTS` add-on
   (e.g. `jasper-park-lodge.com`, `thefairmontroyalyork.com`).
4. **Four Seasons is download-hostile.** `www.fourseasons.com/alt/img-opt/…`
   → OpenAI "Error while downloading"; `press.fourseasons.com/.../news/…`
   → HTML article ("unsupported image"). Only `press.fourseasons.com/content/dam/…`
   (https) is usable → FS yields little. Needs a dedicated fetch (Referer/UA)
   or manual sourcing before an FS cohort.
5. **Acceptance must run on prod/preview, not local.** The local Next 16 dev
   server 404s every route (the i18n proxy `apps/web/src/proxy.ts` is not
   applied on the Turbopack instance; correlated with a broken symlink under
   `apps/web`). Verify the rendered fiche on `myconciergehotel.com` instead.
   When checking "zero supplier leak", scan **image URLs only**
   (src/srcset/og:image/`ImageObject`) — OTA names in the price comparator
   are plain text (legal) and the official-site link is a legitimate anchor.

## Finding — the 10-category coverage floor is structurally unreachable (2026-06-02)

`photo-quality.mdc` frames "10/10 distinct categories" as a non-negotiable
floor that gates indexability. **Two facts make this false in practice —
do not burn quota chasing 10/10:**

1. **The indexability gate does NOT enforce category coverage.**
   `apps/web/src/server/hotels/indexability.ts` has two paths (photo-rich
   OR editorial); neither counts categories. The whole published catalogue
   is already indexable via the editorial path. The 10-category floor is an
   aspirational quality target, not a live `noindex` gate.

2. **Two categories are structurally impossible to source at scale.**
   Catalogue-wide coverage (2219 published, 2026-06-02):
   `room 88% · exterior 71% · dining 67% · pool 55% · view 52% · lobby 46%
· spa 30% · detail 10% · events 7% · concierge 0.1% (3 hotels)`.
   `concierge` (a concierge-desk photo) and `events` (MICE ballrooms)
   barely exist in Google Places / press kits and Vision almost never
   emits them. **No hotel reaches 10; the realistic ceiling is ~8.**

### Reclassifying `other` does NOT recover coverage (empirically tested)

The intuition "re-run Vision on the `other`/null catch-all to recover
mislabeled spa/events/concierge" was tested on the full catalogue via the
new `--reclassify-other` flag on `categorize-with-vision.ts` (re-runs
Vision ONLY on photos whose category is `other` or null — ~$0.67 for 962
photos, vs a ~$16 `--force` sweep). Result:

```text
962 reclassified, 82 dropped (junk), 0/736 hotels reached 10 cats
other 837→721 · null 208→39 · spa 964→973 (+9) · detail 307→325 (+18)
events 198→203 (+5) · concierge 4→4 (+0)
```

The `other`/null reservoir is **redundant with the common categories**
(room/exterior/dining/view), not a hidden stash of rare-category photos.
Average per-hotel coverage moved ~0. **The real (and only) lever for
coverage is sourcing genuinely-new spa/pool/view photos** — the Phase 2
press-kit / Google Places chantier — and even that cannot manufacture
`concierge`/`events` for hotels that have none.

`--reclassify-other` still earns its keep as a **data-hygiene** pass: it
turns `other`/null into a real category + enriched `alt_*`/`caption_*` +
`representativeness`/`hero_suitable` scores, which improves hero/TOP-4
curation and JSON-LD captions even when the coverage count doesn't move.

**Takeaway for agents:** treat "10/10 categories" as aspirational. Target
the sourceable categories (spa/lobby/view/pool/detail) on Tier A/B hotels
when doing real sourcing; never gate a hotel `noindex` on coverage; and
don't re-run Vision hoping to conjure coverage from `other`.

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

**Rule — photo mismatch (PO consigne D12, skill `hotel-kit-rollout`)** : when a
gallery slot shows the **wrong subject** (patio labeled spa, bathroom labeled
wellness suite), **re-source from the official site** (Tavily → chain DAM /
`official_url` / Google Places) and **re-upload to Cloudinary** — never fix by
metadata/resolver remap alone. Reference fix: PdG `press-17` → Marriott Scene7
`lc-parlc-lux-parlc-spa-double-13746` via `pdg:photos:wellness`.

## Photo-subject correspondence system (CDC §2.2bis — 2026-06-10)

> **Problem class** : a photo can pass every metadata gate (non-null `category`,
> enriched `alt_fr`, dedicated `public_id`) while showing the **wrong pixels**
> (Musée YSL card displaying a Lalique bedroom). Presence ≠ correspondence.

Three enforcement layers — all mandatory on kit pilots, recommended catalogue-wide:

| Layer                    | What it checks                                                                                                                                  | Tool / gate                                                                                                                                    | When                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **L1 Structural**        | POI uses `poi-{slug}` not `press-*`; gallery `category` vs `alt_fr` vocabulary                                                                  | `@mch/domain/photos` · gates `gold.poi_photo_structural`, `photos.gallery_alt_category`                                                        | Every CDC audit + CI             |
| **L2 Sourcing manifest** | Each slot uploaded from Wikimedia / official / AI with venue-specific alt ; kit hero **hors** galerie ; `url`/`source_url` on every gallery row | `resource-{slug}-gallery-batch.ts` · `resource-{slug}-poi-images.ts` · gates `kit.02.gallery_source_url_tracked`, `kit.02.hero_not_in_gallery` | Before `promote:*-golden`        |
| **L3 Vision QA**         | OpenAI Vision confirms POI pixels match venue name                                                                                              | `audit:photo-subject -- --slug=x --vision`                                                                                                     | PO sign-off + spot-check rollout |

### L1 — Domain module (single source of truth)

`packages/domain/src/photos/photo-subject-correspondence.ts` exports:

- `isDedicatedPoiImagePublicId()` / `isRecycledHotelGalleryPublicId()`
- `evaluatePoiStructuralCorrespondence()` — POI contract
- `evaluateGalleryAltCategoryCorrespondence()` — spa/dining/room alt heuristics
- `evaluatePhotoSlotExpectations()` — optional golden manifest per slot (`press-17` → `spa`)

Import: `@mch/domain/photos` (editorial gates) or `@mch/domain/editorial` (re-exports POI helpers).

### L2 — Kit hero + galerie (Rule 7 — 2026-06-10)

**Anti-patterns refusés** :

- `hero_image = press-1` **and** `gallery_images[0].public_id = press-1` → mosaïque affiche la même photo (grande + vignette).
- Batch `GALLERY_SOURCES` avec deux URLs identiques (ex. réception crop + réception full) → doublon pixels invisible sans `url` en DB.
- Chambres sans `resource-{slug}-rooms.ts` → fallback galerie index % length.

**Workflow obligatoire (kit pilots)** :

1. Choisir **1 hero exterior/view** (vue d’ensemble) — upload séparé ou slot `press-N` **exclu** des 30 galerie.
2. Remplir `{slug}-gallery.ts` : 30 entrées, `url`/`source_url` par slot, 0 URL dupliquée.
3. `resource-{slug}-gallery-batch.ts` pousse `url` dans le JSONB Supabase (pas seulement Cloudinary).
4. `resource-{slug}-rooms.ts` + `resource-{slug}-poi-images.ts` (POI : réel d’abord, IA documentée en fallback).
5. Gates `kit.02.*` verts + walk mosaïque (skill `hotel-kit-rollout` Rule 6–8).

**Contentful dedup (2026-06-11)** — `packages/domain/src/editorial/kit-gallery-promote.ts` :

- `buildKitGallerySourceUrlsPerPressSlot()` : repli **`w±1`** sur `ctfassets.net` — **pas** `?mchPress=` (HTTP 400 Contentful).
- Préférer 30 URLs uniques dans `*_GALLERY_PRESS_SLOT_URLS` ; hero URL **absente** des 30 slots.
- Tester assets problématiques : `curl.exe -sI "<url>"` avant batch (Suite Eden, Suite Lumière Bristol = 403/400 avec params).

### L2 — POI batch orchestration (Rule 8 — 2026-06-11)

**Timing observé wave 5** (5 fiches, 79 POI séquentiels) :

| Mode POI                  | Durée / image | 18 POI     |
| ------------------------- | ------------- | ---------- |
| Wikimedia → Cloudinary    | ~3–5 s        | ~2 min     |
| OpenAI `gpt-image-1` high | ~45–90 s      | ~15–27 min |

**Règles** :

1. `photos:discover -- --slug=x` **avant** d'écrire `POI_SOURCES`.
2. Remplir Commons/officiel pour **tous** les POI « monument / ville » ; réserver IA aux shops sans photo libre.
3. **Ne pas** enchaîner `{s1}:photos:poi ; {s2}:photos:poi ; …` — lancer **5 terminaux** ou accepter ~1 h IA.
4. Après POI : `promote` seulement si golden référence de nouveaux `poi-*` (souvent déjà OK post-promote phase 3).

Cross-links: skill `hotel-kit-rollout` Rule 8 · D22.

### L2 — POI sourcing pattern (never recycle gallery)

**Anti-pattern refusé** : assign `points_of_interest[].image_public_id = press-24` to pass `gold.poi_images`.

**Workflow obligatoire** :

1. Copy `resource-airelles-poi-images.ts` → `resource-{slug}-poi-images.ts`.
2. One Commons / official / AI source **per POI slug** → Cloudinary `cct/hotels/{slug}/poi-{poi-slug}`.
3. Golden file : `princeDeGallesPoiImage('musee-yves-saint-laurent')` etc.
4. `pnpm --filter @mch/editorial-pilot {prefix}:photos:poi` then re-audit (promote déjà fait phase 3 — Rule 8).
5. `audit:photo-subject -- --slug={slug}` → 0 structural fails.

### L3 — Vision QA (optional but required before PO sign-off)

```powershell
pnpm --filter @mch/editorial-pilot audit:photo-subject -- --slug=prince-de-galles-paris --vision
```

Flags POIs where Vision detects a subject mismatch (hotel room on a museum card). ~$0.001/POI (gpt-4o-mini).

### CDC gates wired (hotel-fiche-cdc-gates.ts)

| Gate id                                  | Severity      | Fails when                                          |
| ---------------------------------------- | ------------- | --------------------------------------------------- |
| `gold.poi_images`                        | warn          | POI missing any `image_public_id`                   |
| `gold.poi_dedicated_images`              | warn          | POI uses `press-*` instead of `poi-*`               |
| `gold.poi_photo_structural`              | warn          | Any L1 POI structural issue                         |
| `photos.gallery_alt_category`            | warn          | Gallery category contradicts `alt_fr` (spa+chambre) |
| `kit.02.hero_not_in_gallery`             | blocker (kit) | `hero_image` appears in `gallery_images[]`          |
| `kit.02.hero_category_exterior_or_view`  | blocker (kit) | Hero not exterior/view overview                     |
| `kit.02.gallery_source_url_tracked`      | blocker (kit) | Gallery row missing `url`/`source_url`              |
| `kit.02.gallery_no_duplicate_source_url` | blocker (kit) | Same source URL on 2+ slots                         |
| `kit.02.gallery_unique_public_id`        | blocker (kit) | Duplicate `public_id` in gallery                    |

Cross-links: skill `hotel-kit-rollout` D13–D14, D20–D22, Rule 7–8 · rule `hotel-detail-page.mdc` §2.2bis · `photo-quality.mdc` §Correspondance sujet.

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
   - name token in path. Example:
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

### Hardening — `backfill-official-url` re-pollutes with name-bearing squatters (2026-06-02)

When you re-source `official_url` for the **hard cohort** (hotels whose
URL was just NULLed because it was toxic — ME/Asia chains, Greek
resorts, etc.), Tavily surfaces a dense ecosystem of SEO-spam that
**embeds the hotel name in the hostname**, so the naive "hotel-name-in-
host" rule promotes them straight back as "high confidence". A dry-run
on 140 cleaned fiches proposed garbage like
`lessourcesdecaudalie.com-hotel.com`, `slshotel.ae-dubai.info`,
`scribe.parishotelinn.com`, `four-seasons-11321.hotels-riyadh.com`,
`britishchamberdubai.com` (Waldorf "Dubai" → matched the _city_ token),
`ubyemaar.com/.../address-sky-view`, `travelweekly.com/...`,
`britishairways.com/.../Aguas-de-Ibiza`. Running it live would have
re-polluted the exact rows the cleanup just scrubbed.

Four fixes (commit `2e305bb`), all in `backfill-official-url.ts` +
the new shared `enrichment/toxic-official-url.ts`:

1. **Match the HOSTNAME only** for the "name-in-host" rule. The
   original `tokenAppearsInUrl` matched the whole URL incl. path, so
   `ubyemaar.com/.../address-sky-view` (name in path) won. Added
   `tokenAppearsInHost`.
2. **Drop the `score≥0.8 + token-in-path` fallback** entirely — it was
   the airline/trade-press vector (`britishairways.com`,
   `travelweekly.com`). A high Tavily score on an unknown host is NOT
   evidence; leaving `official_url` NULL beats guessing.
3. **Exclude city/country tokens** from the host match
   (`geoTokensFor(hotel)`). `britishchamberdubai.com` only matched
   because "dubai" is in the name; a chamber-of-commerce directory is
   not the hotel.
4. **Shared toxic detector** `isToxicOfficialUrl(url)` (unit-tested,
   56 cases) vetoes every squatter family observed: `*.com-hotel.com`,
   cc-glued `.<cc>-<word>.(com|info)`, `*hotelinn.com`, geo-aggregators
   (`hotels-<city>`, `<city>-hotels-<cc>`, `hotelsof<geo>`), `h-rez.com`,
   `reserve-online`, `hotel-dir`, OTAs. Host-anchored so brand domains
   (`rosewoodhotels.com`, `eighthotels.it`) are NEVER caught. The SAME
   module is imported by `convert-wikidata-to-external-sources.ts` so
   the photo pipeline and the EEAT provenance array can never drift.

Result on the 140-cohort: 101 clean sites sourced, **0 toxic**, 39
genuinely unsourceable left NULL. Always **dry-run + eyeball the
proposed hosts** before a live `official_url` backfill on a hard
cohort — iterate the ruleset until the toxic/aggregator scan returns
zero, then write.

Provenance note: `official_url` is a scalar column whose discovery
channel is not recorded, so the converter attributes it as
`source: 'official_site'` / `confidence: 'medium'` — NOT `'wikidata'`
(Wikidata corroboration lives in its own `wikidata_id` entry; claiming
it served the URL would be false provenance).

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
- `.cursor/skills/hotel-kit-rollout/SKILL.md` (PO consignes D7–D22, Rule 7–8 batch orchestration, photo
  re-source workflow, pilot checklist).
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
