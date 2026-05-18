---
name: content-modeling
description: Editorial content modeling for MyConciergeHotel.com (Payload collections, fields, relations, validation, draft/publish, multilingual content). Use when adding or modifying any Payload collection or content shape.
---

# Content modeling — MyConciergeHotel.com

The editorial layer is **first-class product surface**. Content must be reusable across hubs, fiches, and AI surfaces (cf. CDC §5.1, §6, §15). Modeled in **Payload CMS 3** (collections + globals) backed by Postgres on Supabase.

## Triggers

Invoke when:

- Adding/editing any Payload collection or global.
- Designing a new editorial template or section.
- Defining draft/publish lifecycle, scheduling, or localization fields.

## Collections

### `Hotels`

- Shadow of the `hotels` SQL table; Payload is the editing surface, Postgres holds the canonical record.
- Field groups: Identity, Location, Connectivity (booking_mode, IDs), Editorial (descriptions, highlights, FAQ, AEO, factual summary), Media (images, video, 360 tour), SEO (meta, slugs FR/EN, canonical override), Reviews sync, Loyalty eligibility, Awards.
- **Localized fields**: `description_long`, `description_short`, `highlights`, `meta_title`, `meta_desc`, `faq_content`, `aeo_block`, **`factual_summary`** (CDC §2.3, 130–150 chars).
- **Description longue (CDC §2.4)**: 600–1000 unique words, structure H2/H3 imposed (Histoire & identité / Architecture & ambiance / Emplacement / Expérience client / Philosophie & engagements). Lint warns under 600 / over 1000 and runs an anti-duplication check against known OTA copy (Booking, Hotels.com, Expedia).
- **Description courte / résumé factuel (CDC §2.3)**: strict format `[Type] [étoiles] situé [quartier/ville], à [distance] de [POI majeur], avec [3 USP].`. Validation: 130–150 chars, unique per hotel.
- Validation: `slug` unique, lowercase kebab-case, 60 chars max; coords within FR bounds (lat 41–52, lng -5–10).
- **Awards relation**: many-to-one with the `Awards` collection (CDC §2.13).

### `EditorialPages`

- Types: `classement`, `thematique`, `region`, `guide`, `comparatif`, `saisonnier`, `local_guide` (CDC §2.12 — "Que faire autour").
- Fields: `slug` per locale, `title`, `meta_desc`, `aeo_block` (40–80 words), `intro` (rich text, max 200 words), `body` (Lexical/TipTap), `faq_content`, `last_updated`, `author`, `hotels` (m2m to Hotels for ItemList), `priority` (P0–P3), `status` (draft/published).
- Comparatifs require exactly 2 referenced hotels.
- **Local guides** (CDC §2.12): target 2000 mots, structure imposed (Top restaurants / Musées / Plages / Événements saisonniers / Itinéraires 48h-weekend-semaine). Internal-link audit: must link to ≥ 10 hotel detail pages in the same city.

### `Rooms` (CDC §2.5 — standalone indexable)

- One row per **room type** (not per room number).
- Fields: `hotel_id` (FK), `slug` (unique within hotel, kebab-case), `name`, `size_sqm`, `max_occupancy`, `bed_config` (`king`/`twin`/`sofa-bed`/...), `view` (`mer`/`jardin`/`ville`/`patio`), `amenities` (m2m to `Amenities`), `base_price`, `currency`, `photos` (m2m to `Media`, **≥ 5 required**), `description_fr` / `description_en` (≥ 200 words), `is_signature` (bool — appears in `/destination` ItemList if true), `status` (draft/published), `noindex` (bool — auto-set if photo count < 5 or description < 200 words).
- Hooks: `afterChange` → `revalidateTag('room:<id>')` + `revalidateTag('hotel:<slug>')` (the parent rebuilds its room list).
- Validation: each room must have a unique slug within its parent hotel.

### `Pois` (CDC §2.7 — "Autour de l'hôtel")

- Fields: `hotel_id` (FK), `name`, `type` (`airport`/`station`/`metro`/`museum`/`beach`/`restaurant`/`monument`/`shopping`), `lat`, `lng`, `distance_km`, `walk_min` (nullable), `transit_min` (nullable), `drive_min` (nullable), `category` (`tourism`/`transport`/`f&b`/`shopping`), `notes_fr` / `notes_en`.
- 5–15 POIs per hotel. Lint warns if no `walk_min` for distance < 2 km.
- Hook on save: triggers Algolia re-index of the parent hotel (POIs drive long-tail search relevance).

### `Awards` (CDC §2.13)

- Fields: `hotel_id` (FK), `label` (e.g. "Clef Verte", "Michelin Key", "World Travel Awards Best Spa"), `issuer`, `year`, `logo_url` (Cloudinary), `category` (`certification`/`award`/`press`), `source_url` (verifiable link), `verified` (bool — admin-only checkbox; only verified awards render in JSON-LD).
- Renders as `Hotel.award[]` in JSON-LD when `verified: true`.

### `MiceEvents` (CDC §2.14 — séminaires, mariages, événements)

- Fields: `hotel_id` (FK), `room_name`, `pax_max`, `surface_sqm`, `ceiling_height_m`, `daylight` (bool), `equipment_av` (multi-tag: projector, screen, micro, hybrid_setup), `layouts` (multi-tag: theatre, classroom, U-shape, banquet, cabaret), `photos` (m2m to `Media`).
- Linked from a dedicated MICE block on the hotel detail page + drives a `BookingRequestsEmail.type: 'mice'` workflow.

### `FaqEntries`

- Reusable Q/A library tagged by `topic` (`palace`, `cancellation`, `loyalty`, `parking`, `breakfast`, `wifi`, `pets`, `pool`, ...). Editorial and hotel pages can pull tagged entries OR define inline.
- The **10 questions canoniques** (see `geo-llm-optimization`) are seeded as reusable entries on every hotel page.

### `Authors`

- `name`, `slug`, `bio` (200 words), `expertise` (multi-tag), `socials` (LinkedIn, etc.), `photo`.

### `Media`

- Cloudinary-backed. Each upload requires `alt_text_fr/_en` (**enriched with keyword + context**, CDC §2.2 — example: `"piscine extérieure chauffée Hôtel X Nice"`), `credit`, `category` (10 categories CDC §2.2: `exterior` / `lobby` / `room` / `bathroom` / `restaurant_bar` / `spa` / `pool` / `view` / `equipment` / `event_space`).
- Media types: `photo`, `video` (MP4 H.265, ≥ 30 s, ≤ 50 MB, lazy-loaded), `tour_360` (Matterport or equivalent — stores the embed URL).
- Position ordering required (drag-and-drop) — drives gallery order on the hotel detail page.
- **Visual quality gate**: photos must be ≥ 1920×1080 (WebP + JPEG fallback served via `HotelImage`). Payload validates dimensions on upload.

### `Amenities` taxonomy (CDC §2.6 — Google Hotels parity)

- Static seed of ≥ 80 amenity codes grouped in **12 categories**:
  - `connectivity` — wifi_free, wifi_paid, wifi_speed_mbps
  - `food_and_beverage` — breakfast_included, breakfast_paid, breakfast_hours, restaurant_count, restaurant_michelin_stars, bar, room_service_24h, diet_vegetarian, diet_vegan, diet_gluten_free, diet_halal, diet_kosher
  - `pools_and_beaches` — pool_indoor, pool_outdoor, pool_heated, beach_private, beach_access_min
  - `wellness` — spa, hammam, sauna, jacuzzi, massages, fitness, yoga
  - `transport_parking` — shuttle_airport, parking_covered, parking_free, parking_fee_eur, valet, ev_charger, public_transport_min
  - `activities` — tennis, golf_on_site, golf_partner, excursions_desk
  - `family` — cot_free, kids_club, baby_sitting, family_rooms
  - `pets` — pets_accepted, pets_fee_eur, pets_max_weight_kg, pets_restrictions
  - `accessibility` — lift, room_adapted_pmr, roll_in_shower, hearing_loop, vision_aids
  - `business` — meeting_rooms, coworking, printer, business_center
  - `security` — safe_in_room, smoke_detectors, reception_24h, cctv
  - `payments` — visa, mastercard, amex, cash, crypto, wire_transfer, contactless
- Each `amenity` row: `code` (unique), `category`, `label_fr`, `label_en`, `icon` (lucide name or Cloudinary URL), `data_type` (`bool` / `int` / `enum` / `text`).
- `hotel_amenities` row: `hotel_id`, `amenity_id`, `value` (JSON, typed per `data_type`).
- Drives both the visible amenity grid and the JSON-LD `amenityFeature[]` array.

### `Policies` (CDC §2.9 — practical info)

- One row per hotel. Fields: `pets` (jsonb), `children` (jsonb — min_age, cot_supplement, extra_bed), `smoking` (enum: forbidden / smoking_rooms / outdoor_only), `cancellation` (jsonb keyed by rate type: flexible / semi_flex / non_refundable), `modification` (jsonb), `payment_methods` (multi-tag), `deposit` (jsonb), `taxes` (jsonb — city_tax_per_pax_per_night, resort_fees, vat), `check_in_from`, `check_in_to`, `check_out_until`, `early_check_in_fee_eur`, `late_check_out_fee_eur`.
- **Taxes explicites** mandatory (CDC §2.9): `city_tax`, `resort_fees`, `vat`. Display under the booking widget.

### `BookingRequestsEmail`

- Read/edit by operators only. Status workflow: `new → in_progress → quoted → booked | declined`.
- New `type` field: `standard` / `mice` (séminaire, mariage) — drives different reply templates.

### `Bookings`

- Read-only mirror of SQL (Payload custom adapter). Operator can add internal notes + cancel manually.

### `LoyaltyMembers`

- Read with admin privilege. Operator can adjust tier with audit log entry.

### `Redirects`

- `from`, `to`, `status_code` (301/302), `is_active`, `notes`. Projected into `next.config.ts` at build time.

## Globals

### `SiteSettings`

- Phone, email, IATA number, ASPST number, financial guarantee text, social links.

### `RobotsConfig`

- Allow/disallow rules, sitemap URLs (defaults set; editable for emergencies).

### `LlmsTxtSource`

- Editorial header, "à propos" block, curated strategic pages list (used by `/llms.txt` generator).

## Non-negotiable rules

### Localization

- Two locales: `fr` (default) and `en`. Localized fields are real `localized: true` Payload fields, not duplicate fields.
- All slugs validated for uniqueness per locale.

### Draft/publish

- Every editorial collection uses `versions: { drafts: true }`.
- Hooks on publish: revalidate Next.js tags (`hotel:<slug>`, `editorial:<slug>`, `hub:<region>`), reindex Algolia, append entry to `audit_logs`.

### Validation

- Zod schemas mirror Payload field validation in `apps/admin/src/validators/`.
- AEO blocks: `validate: (val) => wordCount(val) ≥ 40 && ≤ 80`.
- Factual summary: 130–150 chars, strict format check.
- FAQ: **≥ 10 entries on hotel detail** (CDC §2.11), ≥ 5 on classements / sélections / comparatifs / guides.
- Description longue: 600–1000 mots, structure H2/H3 minimale.

### Media (CDC §2.2 — galerie média)

- **Required: ≥ 30 photos per published hotel** (CDC §2.2). Validation blocks publish if < 30.
- **Catégorisation obligatoire**: at least one photo in each of the 10 categories (`exterior`, `lobby`, `room`, `bathroom`, `restaurant_bar`, `spa`, `pool`, `view`, `equipment`, `event_space`). Validation blocks publish if any category empty.
- Per room type: **≥ 5 dedicated photos** (CDC §2.5 — drives the room sub-page).
- Featured photo required (used as OG image fallback + `Hotel.image` primary).
- Optional but encouraged: 1 video ≥ 30 s (CDC §2.2) + 1 visite 360° (Matterport URL).
- All photos served via `HotelImage` wrapper (Cloudinary `f_auto,q_auto,c_fill,g_auto`). WebP + JPEG fallback automatic.

### Authoring guardrails

- Word-count target visible on the page editor (`packages/ui/admin/WordCounter`).
- Reading-level estimator for body (Flesch-French). Surface only as advisory.

### Cross-references

- Hub pages auto-include all hotels in their region published with priority P0/P1; manual override possible.
- Editorial pages link bidirectionally to listed hotels; the relation is materialized in `editorial_pages.hotel_ids` array.

## Anti-patterns to refuse

- Duplicating French and English as separate documents.
- Editing hotel fields outside Payload (no manual SQL writes from the app).
- Publishing without populating `aeo_block`, `factual_summary`, `faq_content` (≥ 10 Q&A), `last_updated`.
- Publishing a hotel with < 30 photos or with any empty category.
- Publishing a room sub-page with < 5 photos or < 200 words description (must stay `noindex` until completed).
- Awards rendered without `verified: true`.
- Using freeform HTML where structured fields exist.
- Storing inline image URLs not from Cloudinary.
- Storing POI distances without units or without `walk_min` when the POI is < 2 km.

## Idempotent multilingual upserts — preserve `_en` keys across pushes

Whenever an FR-only batch (briefs → SQL → upsert) coexists with an
independent EN translation batch (`translate-hotels-en.ts`), the upsert
**must never wipe** the EN columns. This trap cost us a whole i18n
re-run in May 2026 because the seed upsert overwrote `description_en`,
`faq_content[*].answer_en`, `long_description_sections[*].body_en`, …
with `NULL` (the briefs only carry FR).

### The two-tier protection

**Text EN columns** (`description_en`, `meta_title_en`, `meta_desc_en`):
use `COALESCE(EXCLUDED.x, hotels.x)` so passing `NULL` is a no-op:

```sql
description_en = COALESCE(EXCLUDED.description_en, public.hotels.description_en),
```

**JSONB arrays of mixed-locale objects** (`faq_content`,
`long_description_sections`, `signature_experiences`, `awards`):
declare a Postgres helper that merges per-item:

```sql
CREATE OR REPLACE FUNCTION public._cct_merge_en_array(
  existing jsonb, incoming jsonb
) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $merge$
DECLARE
  result jsonb := '[]'::jsonb;
  i integer; new_item jsonb; old_item jsonb;
  key text; v jsonb;
  existing_len integer; incoming_len integer;
BEGIN
  IF incoming IS NULL THEN RETURN existing; END IF;
  IF jsonb_typeof(incoming) <> 'array' THEN RETURN incoming; END IF;
  IF existing IS NULL OR jsonb_typeof(existing) <> 'array' THEN RETURN incoming; END IF;
  existing_len := jsonb_array_length(existing);
  incoming_len := jsonb_array_length(incoming);
  -- 1. copy incoming items, re-inject existing _en keys at same index
  FOR i IN 0 .. incoming_len - 1 LOOP
    new_item := incoming -> i;
    old_item := CASE WHEN existing_len > i THEN existing -> i ELSE NULL END;
    IF old_item IS NOT NULL AND jsonb_typeof(old_item) = 'object'
       AND jsonb_typeof(new_item) = 'object' THEN
      FOR key, v IN SELECT k, val FROM jsonb_each(old_item) AS o(k, val) LOOP
        IF key LIKE '%_en' AND NOT (new_item ? key) THEN
          new_item := jsonb_set(new_item, ARRAY[key], v);
        END IF;
      END LOOP;
    END IF;
    result := result || jsonb_build_array(new_item);
  END LOOP;
  -- 2. keep extra trailing items from existing (post-import additions
  --    such as FAQ extensions from extend-faq-to-10.ts).
  IF existing_len > incoming_len THEN
    FOR i IN incoming_len .. existing_len - 1 LOOP
      result := result || jsonb_build_array(existing -> i);
    END LOOP;
  END IF;
  RETURN result;
END;
$merge$;
```

Use in the upsert:

```sql
faq_content = public._cct_merge_en_array(public.hotels.faq_content, EXCLUDED.faq_content),
long_description_sections = public._cct_merge_en_array(
  public.hotels.long_description_sections, EXCLUDED.long_description_sections),
```

Reference implementation: `scripts/editorial-pilot/src/import/build-import-sql.ts`
(`EN_TEXT_COLS` + `EN_JSONB_COLS` sets, `_cct_merge_en_array` helper).

### Anti-patterns

- `faq_content = EXCLUDED.faq_content` when the upsert source is FR-only.
  Wipes every `_en` key in the array.
- A post-import enrich (FAQ extender, signature_experiences enricher)
  that lengthens an array but no merge function to preserve the extras
  on the next re-push.
- COALESCE-ing a JSONB array as a whole (`COALESCE(EXCLUDED.x, …)`):
  the upsert always carries a non-null value, so COALESCE never kicks
  in — you still lose `_en` per-index. Per-element merge is required.

## Catalog stub fiches (combinatorial matrix only)

Some product surfaces — e.g. the editorial **rankings combinatorial
matrix** in `scripts/editorial-pilot/src/rankings/run-rankings-v2-bulk.ts`
— need a wide hotel catalog to be **eligible** for many seeds
(`region × theme × type × occasion`). Enriching every fiche before
expanding the catalog is impractical, but publishing thin fiches kills
EEAT and pollutes Google's index.

**Pattern**: insert _stub_ hotels (`is_published = TRUE` so they exist
as routes) but **gate indexability server-side**, not via the publish
flag. The fiche renders so deep links from rankings resolve, but it is
hidden from Google.

**The two locks** (must always be paired):

1. **`generateMetadata` returns `robots: { index: false, follow: true }`**
   when the indexability predicate fails. `follow` lets Google traverse
   the deep links the rankings emit toward the (indexable) parent
   ranking page. See `apps/web/src/app/[locale]/hotel/[slug]/page.tsx`.
2. **The public sub-sitemap omits the stubs** — never just relax the
   `is_published` filter. Use a dedicated query
   (`listIndexableHotelSlugs()` in `get-hotel-by-slug.ts`) that mirrors
   **exactly** the same predicate. Otherwise Google wastes crawl
   budget on pages it will refuse to index.

**Indexability predicate (May 2026, photo-ingest sprint)**:

```
hero_image IS NOT NULL
 AND (jsonb_array_length(gallery_images) >= 5
      OR jsonb_array_length(long_description_sections) > 0)
```

Rationale for the **AND** + the **5-photo threshold**:

- A hero image alone is not enough — Google Hotels rich results show
  a thumbnail strip and "no extra photos" looks broken in the SERP.
- Five gallery photos + hero is the minimum that fills the SERP
  thumbnail row credibly without forcing a long-form editorial body.
- The editorial-only branch (`sections > 0`) keeps the lift fast for
  hotels where the editor wrote 800-word sections before the photo
  orchestrator finished — rare, but supported.

The `page.tsx` predicate (`isIndexable`) and the
`listIndexableHotelSlugs()` SQL filter **MUST** stay in lockstep. If
they ever diverge, Google sees a sitemap that advertises URLs the
page marks `noindex` — a contradictory signal that downgrades the
site's overall quality score. Add a comment in both files pointing
at the other.

**Reverse direction**: as soon as the photo orchestrator
(`scripts/editorial-pilot/src/photos/sync-hotel-photos.ts`) hydrates
hero + 5 gallery photos, the page becomes indexable on the next
render — the hotel detail route is `force-dynamic`, so there's no
cache to invalidate.

**Bulk-import gotcha** (Atout France CSV pipeline):

- Filter on `TYPOLOGIE = "HÔTEL DE TOURISME"` AND
  `CLASSEMENT = "5 étoiles"`. Without the typology filter you import
  campings, résidences de tourisme, villages vacances classified at
  5★ — they exist in the CSV.
- Normalise URLs to satisfy `hotels_official_url_ck` (`^https?://`)
  before insert. The CSV ships bare hostnames like
  `www.example.com` — prefix with `https://` or NULL out the field.
- Cap `--per-city` (default 2 in
  `import-atout-france-5stars.ts`) so a single touristy city does not
  monopolise the catalog and skew the geographic ranking matrix.

## References

- CDC v3.0 §3.2 (i18n), §4 (data model), §6.2 (hotel anatomy), §11 (back-office).
- Excel sheets — Pages Éditoriales, Topic Clusters.
- `backoffice-cms`, `seo-technical`, `geo-llm-optimization` skills.
- **`llm-output-robustness`** — when populating content fields via an LLM
  pipeline (editorial guides, rankings, hotel fiches, AEO blocks).
- **`typescript-strict-zod-interop`** — when a Zod schema for a content
  field will be consumed by a React component (front-end rendering).
- **`concierge-voice-pipeline`** — `concierge_advice` field shape (Payload
  collection + validation + Zod schema + publication blocker hook).
