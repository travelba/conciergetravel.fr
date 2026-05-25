---
name: photo-pipeline
description: Hotel/itinerary photo pipeline for MyConciergeHotel.com — sourcing, legal hygiene, Cloudinary migration, alt enrichment, Structured Metadata fields, and the hero fallback chain. Use when a hotel or itinerary photo is missing or wrong, when adding the photos workflow for a new entity, when auditing the catalogue for Pinterest hotlinks or other legal risks, when uploading to Cloudinary at scale, or when wiring photo metadata for JSON-LD `ImageObject` + alt enrichment (Hard Rule 16 in `hotel-detail-page.mdc`).
---

# Photo pipeline — MyConciergeHotel.com

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

## References

- `.cursor/rules/hotel-detail-page.mdc` §Hard Rules 9 + 16 (≥ 30 photos,
  alt enriched).
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
