# Prince de Galles — multi-agent execution status

> **Pilot:** `prince-de-galles-paris` → parity with `les-airelles-gordes`  
> **Started:** 2026-06-10  
> **Gap matrix:** [`prince-de-galles-gap-matrix.md`](./prince-de-galles-gap-matrix.md)  
> **Plan reference:** parent session — 8-phase A→Z plan + 5-wave multi-agent split

Status legend: ✅ done (artefact in repo) · 🟡 scaffold / partial · ⏳ not started · 🔒 blocked on prior wave

---

## Summary

| Wave  | Scope                                              | Status         | Outcome                                                              |
| ----- | -------------------------------------------------- | -------------- | -------------------------------------------------------------------- |
| **1** | Research, photo plan, kit scaffold, audit baseline | ✅ Complete    | Brief + 30-image manifest + kit slug + gap matrix                    |
| **2** | Golden domain payloads + rooms promote script      | ✅ Complete    | `prince-de-galles-golden.ts` stack ready; **not yet promoted to DB** |
| **3** | Kit render parity + golden payload completion      | 🟡 In progress | Kit blocks + amenity resolver landed; full render merge ongoing      |
| **4** | Promote DB + dedup narrative                       | ⏳ Pending     | Requires Wave 3 kit stability                                        |
| **5** | Audit ≥ 95 % + user walk FR/EN                     | ⏳ Pending     | Gate before "done"                                                   |

**DB vs repo:** Waves 1–2 wrote **domain + scripts + docs**. Supabase still reflects the **pre-promote baseline** (audit global **78 %**). Expect **≥ 95 %** only after Wave 4 promote + gallery upload.

---

## Wave 1 — completed

Parallel agents: **Research · Photos plan · Kit scaffold · Audit baseline**

### 1. Factual brief ✅

| Item            | Detail                                                                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deliverable** | `docs/pilots/prince-de-galles-factual-brief.md`                                                                                                                                             |
| **Coverage**    | NAP, 3 F&B (19.20, Akira Back, Le Patio), 7 room categories, CALMA Wellness (not large spa), MICE salons, POI Triangle d'Or, Marriott DAM `PARLC` sourcing, EEAT source registry, open gaps |
| **Consumer**    | `buildPrinceDeGallesGoldenFields()` + photo scripts                                                                                                                                         |

### 2. Gallery 30 plan ✅

| Item             | Detail                                                                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Manifest**     | `packages/domain/src/editorial/prince-de-galles-gallery.ts` — **30** `press-1`…`press-30`, **10** CDC categories, hero `press-1`, alt/caption/credit FR/EN |
| **Upload CLI**   | `scripts/editorial-pilot/src/photos/resource-prince-de-galles-gallery-batch.ts`                                                                            |
| **pnpm scripts** | `pdg:photos:plan`, `pdg:photos:gallery:dry`, `pdg:photos:gallery`                                                                                          |
| **Not done yet** | Cloudinary upload + `gallery_images` patch on `hotels` row (Wave 4)                                                                                        |

### 3. Kit scaffold ✅

| Item                  | Detail                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| **Kit slug**          | `prince-de-galles-paris` added to `apps/web/src/server/hotels/kit/is-hotel-kit-slug.ts`                   |
| **Golden patch hook** | `buildPrinceDeGallesGoldenFields` registered in `patch-kit-golden-row.ts`                                 |
| **Room display stub** | `apps/web/src/server/hotels/kit/kit-prince-de-galles-display.ts` — card order, hero mapping, `.rv2-facts` |
| **Kit model branch**  | `prepare-hotel-kit-model.ts` branches PdG room enrichment                                                 |
| **Render**            | Full DA parity (sticky TOC, `#hotel-en-bref`, presse, proximité…) — **Wave 3**                            |

### 4. Audit baseline ✅

| Item                   | Detail                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| **CDC audit PdG**      | `scripts/editorial-pilot/runs/pdg-cdc-audit-2026-06-10.json` — 75 % CDC, 21 failing checks |
| **CDC audit Airelles** | `scripts/editorial-pilot/runs/airelles-cdc-audit-2026-06-10.json` — 96 % CDC, reference    |
| **Gap matrix**         | `docs/pilots/prince-de-galles-gap-matrix.md` (this pilot doc set)                          |

---

## Wave 2 — completed

Parallel agents: **Golden editorial · Golden infra (amenities + FAQ) · Gallery manifest · Chambres**

### 1. Golden editorial ✅

**File:** `packages/domain/src/editorial/prince-de-galles-golden.ts` (~1 440 lines)

| Block                                         | Status | Notes                                                        |
| --------------------------------------------- | ------ | ------------------------------------------------------------ |
| `PRINCE_DE_GALLES_RESTAURANT_INFO`            | ✅     | 3 venues + concierge handoffs (19.20, Akira Back, Le Patio)  |
| `PRINCE_DE_GALLES_POINTS_OF_INTEREST`         | ✅     | 18 POI, 3 buckets, tips                                      |
| `PRINCE_DE_GALLES_CONCIERGE_*`                | ✅     | hook, pick (`chambre-art-deco-deluxe-balcon`), advice        |
| `PRINCE_DE_GALLES_DESCRIPTION_*`              | ✅     | Long + short copy, voice gate aware                          |
| `PRINCE_DE_GALLES_LONG_DESCRIPTION_SECTIONS`  | ✅     | 3 narrative sections + `dropCannibalizingSections` transform |
| `PRINCE_DE_GALLES_META_*` / factual summaries | ✅     | SEO bands, EN format fix                                     |
| `PRINCE_DE_GALLES_TRANSPORTS`                 | ✅     | CDG, Orly, métro George-V                                    |
| `PRINCE_DE_GALLES_SIGNATURE_EXPERIENCES`      | ✅     | 6 experiences                                                |
| `PRINCE_DE_GALLES_FEATURED_REVIEWS`           | ✅     | Presse block                                                 |
| `PRINCE_DE_GALLES_EXTERNAL_SOURCES`           | ✅     | EEAT scalars                                                 |
| `PRINCE_DE_GALLES_WELLNESS_INFO`              | ✅     | CALMA Paris Wellness Suite (not fake large spa)              |
| `PRINCE_DE_GALLES_MICE_INFO`                  | ✅     | Grand Chaillot 70, Alma 30, Petit Chaillot 8                 |
| `PRINCE_DE_GALLES_UPCOMING_EVENTS`            | ✅     | Paris events + `image_url` from gallery public_ids           |
| `PRINCE_DE_GALLES_INSTAGRAM`                  | ✅     | ≥ 3 posts (Cloudinary mirror URLs)                           |
| `buildPrinceDeGallesGoldenFields()`           | ✅     | Promotion entry point                                        |

### 2. Amenities ✅

| Item      | Detail                                                        |
| --------- | ------------------------------------------------------------- |
| **File**  | `packages/domain/src/editorial/prince-de-galles-amenities.ts` |
| **Count** | **80** curated amenities (CDC §2.6)                           |
| **Wired** | `patchPrinceDeGallesAmenities()` in golden builder            |

### 3. FAQ ✅

| Item        | Detail                                                                                 |
| ----------- | -------------------------------------------------------------------------------------- |
| **File**    | `packages/domain/src/editorial/prince-de-galles-faq.generated.ts`                      |
| **Kit**     | **42** factual Q&A (`PRINCE_DE_GALLES_FAQ_CONTENT_KIT`)                                |
| **Promote** | **15** CDC subset (`PRINCE_DE_GALLES_FAQ_CONTENT_PROMOTE`) with exactly **5** featured |
| **Note**    | Post-promote humanizer pass may still be needed for tip count + 30–100 word band       |

### 4. Rooms promote script ✅

| Item             | Detail                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| **Catalogue**    | `packages/domain/src/editorial/prince-de-galles-rooms.ts` — **7** categories, slugs, sizes, bed types       |
| **CLI**          | `scripts/editorial-pilot/src/hotels/promote-prince-de-galles-rooms.ts`                                      |
| **pnpm**         | `promote:prince-de-galles-rooms`, `promote:prince-de-galles-rooms:dry`                                      |
| **Seed photos**  | `scripts/editorial-pilot/src/photos/resource-prince-de-galles-rooms.ts` (Marriott DAM `press-1`…`press-35`) |
| **Not done yet** | Live `--dry-run=false` promote (Wave 4)                                                                     |

### 5. Golden promote script ✅

| Item             | Detail                                                                   |
| ---------------- | ------------------------------------------------------------------------ |
| **CLI**          | `scripts/editorial-pilot/src/hotels/promote-prince-de-galles-golden.ts`  |
| **pnpm**         | `promote:prince-de-galles-golden`, `promote:prince-de-galles-golden:dry` |
| **Not done yet** | Live promote after gallery upload (Wave 4)                               |

---

## Wave 3 — in progress

Parallel agents launched: **Golden fin · Kit display · Kit render parity**

| Task                                        | Status | Artefact / notes                                                          |
| ------------------------------------------- | ------ | ------------------------------------------------------------------------- |
| Kit amenity blocks (`#hotel-en-bref`)       | ✅     | `packages/domain/src/editorial/prince-de-galles-kit-blocks.ts` (8 blocks) |
| Brand resolver (no Airelles-only hardcode)  | ✅     | `apps/web/src/server/hotels/kit/resolve-kit-amenity-blocks.ts`            |
| `render-hotel-kit-html.ts` PdG conditionals | 🟡     | Presse, spa/wellness, patio blocks — verify vs Airelles                   |
| Travelport live prices in kit room cards    | 🟡     | `prepare-hotel-kit-model.ts` — must preserve pilot rail                   |
| `geo_qa` AEO block in kit                   | 🟡     | 3 blocks already in DB — wire render                                      |
| Golden payload edge cases                   | 🟡     | Awards deferred per brief; affiliations Luxury Collection TBD             |
| Regression Airelles                         | ⏳     | Mandatory before Wave 4 merge                                             |

---

## Wave 4 — checklist (not started)

| #   | Task                                     | Command / path                                                       | Depends on                  |
| --- | ---------------------------------------- | -------------------------------------------------------------------- | --------------------------- |
| 1   | Upload 30 gallery images to Cloudinary   | `pnpm --filter @mch/editorial-pilot pdg:photos:gallery`              | Wave 1 manifest             |
| 2   | Promote golden row to Supabase           | `pnpm --filter @mch/editorial-pilot promote:prince-de-galles-golden` | Gallery upload + Wave 3 kit |
| 3   | Promote room heroes + facts              | `pnpm --filter @mch/editorial-pilot promote:prince-de-galles-rooms`  | Golden promote              |
| 4   | Dedup long-read on live row              | `dropCannibalizingSections` via promote output                       | Post-promote                |
| 5   | FAQ humanizer pass (tips + word band)    | `run-humanizer-faq.ts --slug=prince-de-galles-paris`                 | Post-promote                |
| 6   | Affiliations / `luxury_tier` if verified | Payload + `affiliations` jsonb                                       | PO decision                 |
| 7   | Re-run CDC audit                         | `audit:hotel-fiches-cdc -- --slug=prince-de-galles-paris`            | All above                   |

**Exit criteria:** `score_cdc ≥ 95 %`, `score_golden = 100 %`, `score_structure = 100 %`, `score_photo = 100 %`.

---

## Wave 5 — checklist (not started)

| #   | Task                   | Detail                                                                      |
| --- | ---------------------- | --------------------------------------------------------------------------- |
| 1   | User walk FR desktop   | `/hotel/prince-de-galles-paris` — kit DA, all TOC anchors, galerie lightbox |
| 2   | User walk EN desktop   | `/en/hotel/prince-de-galles-paris`                                          |
| 3   | User walk mobile 375px | Burger nav + booking bar + sticky TOC                                       |
| 4   | Travelport smoke test  | Live price on ≥ 1 room card in kit                                          |
| 5   | Room sub-page          | 1 indexable URL (e.g. Suite Lalique or pick balcon)                         |
| 6   | View-source JSON-LD    | Hotel + FAQPage + BreadcrumbList + images                                   |
| 7   | Regression Airelles    | `/hotel/les-airelles-gordes` unchanged                                      |
| 8   | Compare side-by-side   | Visual density vs Airelles — same section order                             |
| 9   | Document walk evidence | URLs + screenshots per `user-acceptance-before-commit.mdc`                  |

**Exit criteria:** PO sign-off + audit CDC **complete** + discoverability from `/` in ≤ 2 clicks (hotel search or maillage).

---

## Quick reference — files created in waves 1–2

```
docs/pilots/
  prince-de-galles-factual-brief.md
  prince-de-galles-gap-matrix.md          ← this audit pack
  prince-de-galles-execution-status.md    ← you are here

packages/domain/src/editorial/
  prince-de-galles-golden.ts
  prince-de-galles-amenities.ts
  prince-de-galles-faq.generated.ts
  prince-de-galles-gallery.ts
  prince-de-galles-rooms.ts
  prince-de-galles-kit-blocks.ts          ← wave 3

scripts/editorial-pilot/src/
  photos/resource-prince-de-galles-gallery-batch.ts
  hotels/promote-prince-de-galles-golden.ts
  hotels/promote-prince-de-galles-rooms.ts

apps/web/src/server/hotels/kit/
  is-hotel-kit-slug.ts                    ← PdG slug added
  patch-kit-golden-row.ts
  kit-prince-de-galles-display.ts
  resolve-kit-amenity-blocks.ts           ← wave 3
```

---

## Next action

1. **Finish Wave 3** — kit render parity + Travelport + Airelles regression.
2. **Run Wave 4** — `pdg:photos:gallery` then `promote:prince-de-galles-golden` then `promote:prince-de-galles-rooms`.
3. **Wave 5** — audit + mandatory browser walk before declaring parity with Airelles.

---

_Last updated: 2026-06-10 — aligned with CDC audit snapshot and repo state after waves 1–2._
