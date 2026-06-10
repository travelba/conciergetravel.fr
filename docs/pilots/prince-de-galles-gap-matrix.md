# Prince de Galles — gap matrix vs Les Airelles Gordes

> **Audit date:** 2026-06-10  
> **Pilot slug:** `prince-de-galles-paris`  
> **Reference slug:** `les-airelles-gordes`  
> **Tool:** `pnpm --filter @mch/editorial-pilot audit:hotel-fiches-cdc -- --slug=<slug>`  
> **Raw artefacts:** `scripts/editorial-pilot/runs/pdg-cdc-audit-2026-06-10.json`, `scripts/editorial-pilot/runs/airelles-cdc-audit-2026-06-10.json`

Baseline = **Supabase row at audit time** (pre-`promote:prince-de-galles-golden`). Repo golden payloads built in waves 1–2 are noted where they close a gap but are not yet live in DB.

---

## 1. Side-by-side scores

| Dimension                            |     Prince de Galles |       Airelles Gordes | Δ (PdG − Airelles) | CDC target |
| ------------------------------------ | -------------------: | --------------------: | -----------------: | ---------- |
| **Global** (`score_global`)          |             **78 %** |              **98 %** |                −20 | ≥ 95 %     |
| **CDC cible** (`score_cdc`)          | **75 %** (`partial`) | **96 %** (`complete`) |                −21 | ≥ 95 %     |
| **CDC phase 1** (`score_cdc_phase1`) |                 79 % |                  97 % |                −18 | —          |
| **SEO**                              |                100 % |                 100 % |                  0 | 100 %      |
| **GEO / AEO** (`score_geo`)          |                 77 % |                  92 % |                −15 | —          |
| **FAQ**                              |                 50 % |                 100 % |                −50 | —          |
| **Maillage / EEAT**                  |                 89 % |                 100 % |                −11 | —          |
| **Photos**                           |                 71 % |                 100 % |                −29 | —          |
| **JSON-LD prereqs**                  |                 92 % |                 100 % |                 −8 | —          |
| **Golden template**                  |                 78 % |                 100 % |                −22 | 100 %      |
| **Restructuration**                  |                 50 % |                 100 % |                −50 | 100 %      |
| **Agentique**                        |                100 % |                 100 % |                  0 | —          |
| **T3 editorial** (`score_t3`)        |                 81 % |                  90 % |                 −9 | —          |

### CDC §2 block scores (Prince de Galles)

| Bloc   | Label                     |      PdG | Airelles |
| ------ | ------------------------- | -------: | -------: |
| 01     | En-tête identité          |    100 % |    100 % |
| 02     | Galerie média             | **58 %** |     83 % |
| 03     | Résumé factuel            | **50 %** |    100 % |
| 04     | Description longue        | **67 %** |    100 % |
| 05     | Chambres / sous-pages     |    100 % |    100 % |
| 06     | Équipements & services    | **67 %** |    100 % |
| 07     | Localisation & accès      |    100 % |    100 % |
| 09     | Politiques                |    100 % |    100 % |
| 10     | Avis clients              |    100 % |    100 % |
| 11     | FAQ structurée            | **50 %** |     83 % |
| 12     | Guide local (teaser)      |    100 % |    100 % |
| 13     | Réassurance & autorité    | **50 %** |    100 % |
| 14     | MICE / groupes            |  **0 %** |    100 % |
| 15     | Footer fiche (NAP)        | **67 %** |    100 % |
| 16     | Conseil du Concierge      |    100 % |    100 % |
| gold   | Golden template (handoff) | **78 %** |    100 % |
| struct | Restructuration           | **50 %** |    100 % |

---

## 2. Quantitative inventory (DB @ audit)

| Field / asset                         |               Prince de Galles (DB) |          Airelles Gordes (DB) |               CDC / golden target | Post–wave 2 repo (PdG only)              |
| ------------------------------------- | ----------------------------------: | ----------------------------: | --------------------------------: | ---------------------------------------- |
| `gallery_images` count                |                              **11** |                        **30** |                              ≥ 30 | **30** (`prince-de-galles-gallery.ts`)   |
| Photo categories (distinct)           | **4** (exterior, room, suite, view) |                        **10** |                       10 required | **10** planned                           |
| `amenities` count                     |                              **27** |                        **80** |                              ≥ 80 | **80** (`prince-de-galles-amenities.ts`) |
| `faq_content` count                   |                              **12** | **77** (kit) / **15** promote |          10–15 promote, 40–77 kit | **42** kit / **15** promote              |
| `long_description_sections`           |                               **7** |            **3** (post-dedup) | 3–4 narrative, no cannibalisation | **3** (golden + dedup transform)         |
| Long-read words FR                    |                             **351** |                         ≥ 600 |   ≥ 600 (blocker), 600–1000 ideal | Patched in golden copy                   |
| `restaurant_info.venues`              |                  **3** (handoff OK) |            **6** (handoff OK) |       All venues with tip/contact | **3** enriched in golden                 |
| `points_of_interest`                  |    **18** (8 visit / 6 do / 4 shop) |           **~18** (3 buckets) |                 ≥ N + bucket tips | **18** in golden                         |
| `spa_info`                            |                            **null** |           ✅ Guerlain dossier |        Handoff if facility exists | **CALMA Wellness Suite** in golden       |
| `mice_info`                           |                            **null** |                            ✅ |     Optional unless MICE property | **3 salons** in golden                   |
| `instagram` posts                     |                               **0** |                         **4** |                               ≥ 3 | **≥ 3** in golden                        |
| `upcoming_events`                     |          **5** (0 with `image_url`) |            **6** (all imaged) |              All with `image_url` | Patched in golden                        |
| `email_reservations`                  |                            **null** |                            ✅ |                      NAP complete | Set in golden                            |
| `external_sources`                    |                               **9** |                            ✅ |                   EEAT provenance | Expanded in golden                       |
| `signature_experiences`               |                               **6** |              **6** + Kid Club |                               ≥ 6 | **6** in golden                          |
| `featured_reviews`                    |                               **2** |                        **3+** |                      Presse block | **3** in golden                          |
| `hero_image`                          |                              ✅ set |                            ✅ |                          Required | `press-1` in golden                      |
| `hero_video`                          |                                  ❌ |                            ❌ |                   Optional (warn) | —                                        |
| `virtual_tour_url`                    |                                  ❌ |                            ❌ |                   Optional (info) | —                                        |
| `wikidata_id`                         |                         ✅ Q3145636 |                        varies |                              EEAT | ✅                                       |
| `booking_mode`                        |        **travelport** (live prices) |           display / editorial |           PdG-specific — preserve | —                                        |
| `hotel_rooms` total                   |                               **7** |                        **19** |                         Catalogue | **7** (`prince-de-galles-rooms.ts`)      |
| `hotel_rooms` indexable               |                           **7 / 7** |                    **1 / 19** |                      ≥ 1 showcase | **7 / 7**                                |
| `concierge_hook` / `pick`             |                                  ✅ |                            ✅ |                          Kit hero | ✅                                       |
| `geo_qa` blocks                       |                               **3** |                        varies |                     AEO kit block | —                                        |
| Kit shell (`HOTEL_KIT_SLUGS`)         |                      ✅ slug listed |                            ✅ |                       Full DA kit | Scaffold only — render parity W3         |
| Google rating                         |                     **4,6 / 1 360** |                        varies |                   AggregateRating | —                                        |
| `factual_summary_fr` length           |                           **155 c** |                       in band |                     130–150 ideal | Retrimmed in golden                      |
| `luxury_tier` / verified affiliations |                            **null** |                            ✅ |                  Trust + maillage | Luxury Collection — TBD Payload          |

---

## 3. Field checklist (pass / fail @ audit)

Legend: ✅ pass · ❌ fail · ⚠️ partial · ➖ optional / deferred

| CDC field / check                      | PdG | Airelles | Notes                                                           |
| -------------------------------------- | --- | -------- | --------------------------------------------------------------- |
| Publish gate (`t0`)                    | ✅  | ✅       | Both published + indexable                                      |
| `meta_title_*` / `meta_desc_*`         | ✅  | ✅       | SEO 100 % both                                                  |
| `factual_summary` length envelope      | ✅  | ✅       | PdG FR 155c — inside prod envelope, outside ideal               |
| `factual_summary` format (EN prefix)   | ❌  | ✅       | PdG: EN must start with "Palace " or "Hotel "                   |
| `factual_summary` ideal band [130–150] | ❌  | ✅       | PdG 155 chars                                                   |
| `description_fr` min                   | ✅  | ✅       |                                                                 |
| Long-form sections count               | ✅  | ✅       | PdG has 7 — too many pre-dedup                                  |
| Long-form words FR ≥ 600               | ❌  | ✅       | PdG 351 words in sections aggregate                             |
| `amenities` ≥ 80                       | ❌  | ✅       | PdG 27 in DB                                                    |
| `gallery_images` ≥ 30                  | ❌  | ✅       | PdG 11 in DB                                                    |
| Gallery 10 categories                  | ❌  | ✅       | PdG missing lobby, dining, spa, pool, detail, concierge, events |
| Gallery alt FR / EN                    | ✅  | ✅       |                                                                 |
| Gallery credits                        | ❌  | ✅       | PdG 11/11 without credit in DB                                  |
| `faq_content` count ≥ 10               | ✅  | ✅       |                                                                 |
| FAQ canonical slots                    | ✅  | ✅       |                                                                 |
| FAQ exactly 5 `featured`               | ❌  | ✅       | PdG had 6 featured (DB)                                         |
| FAQ concierge tips (featured)          | ⚠️  | ✅       | PdG 1/2 tips                                                    |
| FAQ answer word band 30–100            | ⚠️  | ⚠️       | Both fail `cdc.11.faq_answer_band` (warn)                       |
| `restaurant_info` handoff              | ✅  | ✅       | PdG 3/3 venues with tips                                        |
| `points_of_interest` buckets           | ✅  | ✅       |                                                                 |
| `spa_info` dossier                     | ❌  | ✅       | PdG null in DB                                                  |
| `mice_info`                            | ➖  | ✅       | PdG null — info severity                                        |
| `email_reservations`                   | ➖  | ✅       | PdG null                                                        |
| Verified awards / affiliations         | ⚠️  | ✅       | TrustSignals thin on PdG                                        |
| `instagram` ≥ 3 posts                  | ➖  | ✅       |                                                                 |
| `upcoming_events` all imaged           | ➖  | ✅       | PdG 5/5 without image                                           |
| Anti-cannibalisation (`struct`)        | ❌  | ✅       | PdG 1 section duplicates populated block                        |
| Golden handoff predicates              | ⚠️  | ✅       | 7/9 pass PdG                                                    |
| JSON-LD prereqs (non-Offer)            | ✅  | ✅       |                                                                 |
| `cdc.08.live_offers` (Amadeus)         | ➖  | ➖       | Phase 6 deferred both                                           |
| `hero_video`                           | ➖  | ➖       | Optional — both missing                                         |
| `virtual_tour_url`                     | ➖  | ➖       | Optional — both missing                                         |
| Agent surfaces (`llms.txt`, skills)    | ✅  | ✅       |                                                                 |
| Travelport live offers on rooms        | ✅  | ➖       | PdG-only pilot                                                  |

---

## 4. Priority order (Prince de Galles → Airelles parity)

Ordered by **severity × visual impact × promote dependency**. Items marked **[repo]** are already coded in domain golden payloads; they unlock only after **Wave 4 promote + photo upload**.

| P      | Gap                  | Audit check / field                               | Actuel (DB)    | Cible                      | Pipeline / owner wave                                               |
| ------ | -------------------- | ------------------------------------------------- | -------------- | -------------------------- | ------------------------------------------------------------------- |
| **P0** | Galerie CDC          | `cdc.02.gallery_cdc`                              | 11 photos      | 30                         | `pdg:photos:gallery` + `PRINCE_DE_GALLES_GALLERY_IMAGES` **[repo]** |
| **P0** | Catégories photo     | `cdc.02.categories_10`                            | 4 / 10         | 10                         | Same batch — lobby, dining, spa, pool, detail, concierge, events    |
| **P0** | Amenities            | `cdc.06.amenities_cdc`                            | 27             | 80                         | `prince-de-galles-amenities.ts` → promote **[repo]**                |
| **P0** | FAQ featured         | `cdc.11.faq_featured`                             | 6 featured     | exactly 5                  | `PRINCE_DE_GALLES_FAQ_CONTENT_PROMOTE` **[repo]**                   |
| **P0** | Long-read words      | `cdc.04.words_min`                                | 351 words      | ≥ 600                      | Golden long sections + promote **[repo]**                           |
| **P0** | Factual format EN    | `cdc.03.factual_format`                           | invalid prefix | Palace/Hotel prefix        | `PRINCE_DE_GALLES_FACTUAL_SUMMARY_EN` **[repo]**                    |
| **P1** | Promote DB           | —                                                 | legacy row     | golden row live            | `promote:prince-de-galles-golden` (Wave 4)                          |
| **P1** | Restructuration      | `struct.no_duplicate_sections`                    | 7 sections     | 3 post-dedup               | `dropCannibalizingSections` after promote (Wave 4)                  |
| **P1** | FAQ tips + band      | `cdc.11.faq_tips`, `cdc.11.faq_answer_band`       | thin           | 2 tips + 30–100 w          | FAQ humanizer pass post-promote                                     |
| **P1** | Factual ideal FR     | `cdc.03.factual_ideal`                            | 155 c          | 130–150                    | Already retrimmed in golden **[repo]**                              |
| **P1** | Trust / affiliations | `cdc.13.trust_signal`, `maille.brand_affiliation` | none           | Luxury Collection verified | Payload affiliations ADR-0023                                       |
| **P1** | Kit render parity    | —                                                 | kit slug only  | full DA like Airelles      | Wave 3 — `resolve-kit-amenity-blocks`, Travelport rail              |
| **P1** | Gallery credits      | `jsonld.image_provenance`                         | 0 / 11         | 30 / 30                    | Credits in gallery manifest **[repo]**                              |
| **P2** | Spa dossier          | `gold.spa_dossier`                                | null           | CALMA Wellness             | `PRINCE_DE_GALLES_WELLNESS_INFO` **[repo]**                         |
| **P2** | MICE                 | `cdc.14.mice_info`                                | null           | 3 salons                   | `PRINCE_DE_GALLES_MICE_INFO` **[repo]**                             |
| **P2** | Email NAP            | `cdc.15.email`                                    | null           | official email             | In golden promote **[repo]**                                        |
| **P2** | Instagram            | `gold.instagram`                                  | 0 posts        | ≥ 3                        | `PRINCE_DE_GALLES_INSTAGRAM` **[repo]**                             |
| **P2** | Events images        | `gold.events_image`                               | 0 / 5          | 5 / 5                      | `PRINCE_DE_GALLES_UPCOMING_EVENTS` **[repo]**                       |
| **P2** | Room promote         | —                                                 | DB partial     | heroes + facts synced      | `promote:prince-de-galles-rooms` (Wave 4)                           |
| **P3** | `hero_video`         | `cdc.02.hero_video`                               | —              | optional                   | Phase 2 photo pipeline                                              |
| **P3** | `virtual_tour_url`   | `cdc.02.virtual_tour`                             | —              | optional                   | Matterport / official extract                                       |
| **P3** | Acceptance walk      | —                                                 | —              | FR+EN desktop+mobile       | Wave 5 — user-acceptance-loop                                       |
| **P3** | Final audit          | —                                                 | 75 % CDC       | ≥ 95 % CDC complete        | Re-run `audit:hotel-fiches-cdc` post-promote                        |

---

## 5. Top failing `cdc_checks` (2026-06-10)

### Prince de Galles — 21 failures

| Severity    | Check ID                       | Dimension | Phase           | Message / remediation                                       |
| ----------- | ------------------------------ | --------- | --------------- | ----------------------------------------------------------- |
| **blocker** | `cdc.02.gallery_cdc`           | photo     | cdc_target      | 11 photos (CDC min 30) → upload 30 `press-N`                |
| **blocker** | `cdc.02.categories_10`         | photo     | phase1          | Missing lobby, dining, spa, pool, detail, concierge, events |
| **blocker** | `cdc.03.factual_format`        | geo       | cdc_target      | EN factual must start with "Palace " or "Hotel "            |
| **blocker** | `cdc.04.words_min`             | cdc       | phase1          | 351 words FR in long-read (min 600)                         |
| **blocker** | `cdc.06.amenities_cdc`         | cdc       | cdc_target      | 27 amenities (CDC min 80)                                   |
| **blocker** | `cdc.11.faq_featured`          | faq       | cdc_target      | 6 featured FAQ (need exactly 5)                             |
| warn        | `cdc.02.hero_video`            | cdc       | cdc_target      | hero_video missing                                          |
| warn        | `cdc.03.factual_ideal`         | geo       | cdc_target      | factual_summary_fr 155 chars (ideal 130–150)                |
| warn        | `cdc.04.words_ideal`           | cdc       | cdc_target      | Long-read below 600–1000 ideal band                         |
| warn        | `cdc.11.faq_tips`              | faq       | cdc_target      | 1 featured concierge tip (need 2)                           |
| warn        | `cdc.11.faq_answer_band`       | geo       | cdc_target      | FAQ answers outside 30–100 words                            |
| warn        | `cdc.13.trust_signal`          | cdc       | cdc_target      | No verified award or affiliation                            |
| warn        | `struct.no_duplicate_sections` | structure | cdc_target      | 1 long-read section cannibalises populated block            |
| info        | `cdc.02.virtual_tour`          | cdc       | cdc_target      | virtual_tour_url missing                                    |
| info        | `cdc.08.live_offers`           | jsonld    | phase6_deferred | Amadeus Offer — out of phase                                |
| info        | `cdc.14.mice_info`             | cdc       | cdc_target      | mice_info missing                                           |
| info        | `cdc.15.email`                 | cdc       | cdc_target      | email_reservations missing                                  |
| info        | `maille.brand_affiliation`     | maille    | cdc_target      | No luxury_tier / verified affiliation                       |
| info        | `jsonld.image_provenance`      | jsonld    | cdc_target      | 11/11 gallery images without credit                         |
| info        | `gold.instagram`               | golden    | cdc_target      | 0 Instagram posts (need ≥ 3)                                |
| info        | `gold.events_image`            | golden    | cdc_target      | 5/5 events without image_url                                |

### Les Airelles Gordes — 4 failures (reference)

| Severity | Check ID                 | Dimension | Notes                     |
| -------- | ------------------------ | --------- | ------------------------- |
| warn     | `cdc.02.hero_video`      | cdc       | Same optional gap as PdG  |
| info     | `cdc.02.virtual_tour`    | cdc       | Same optional gap         |
| info     | `cdc.08.live_offers`     | jsonld    | Phase 6 deferred          |
| warn     | `cdc.11.faq_answer_band` | geo       | Minor FAQ word-band drift |

**Interpretation:** Airelles is the only published fiche at **CDC complete (96 %)**. Prince de Galles is **partial (75 %)** — gaps concentrate on **photos, amenities, FAQ shape, long-read structure, and golden handoff fields** not yet promoted to Supabase.

---

## 6. Related artefacts

| Artefact                     | Path                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------- |
| Factual brief (Phase 1)      | `docs/pilots/prince-de-galles-factual-brief.md`                                 |
| Execution status (waves 1–5) | `docs/pilots/prince-de-galles-execution-status.md`                              |
| Golden payload               | `packages/domain/src/editorial/prince-de-galles-golden.ts`                      |
| Gallery manifest (30)        | `packages/domain/src/editorial/prince-de-galles-gallery.ts`                     |
| Gallery upload CLI           | `scripts/editorial-pilot/src/photos/resource-prince-de-galles-gallery-batch.ts` |
| Promote golden               | `scripts/editorial-pilot/src/hotels/promote-prince-de-galles-golden.ts`         |
| Airelles reference           | `packages/domain/src/editorial/airelles-golden.ts`                              |

---

_Matrix generated from live CDC audit 2026-06-10. Re-run after Wave 4 promote to refresh scores._
