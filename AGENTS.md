# AGENTS.md — MyConciergeHotel.com

> Hi 👋. This file is for **AI coding agents** (Cursor, Claude, Codex CLI, …) that land in this repo.
> Read it once at the start of a session, then jump to the relevant skills/rules for the task.

## 1. What this project is

MyConciergeHotel.com is **La sélection du Concierge** — an **IATA-accredited online travel agency** curating
extraordinary hotels worldwide: Palaces (Atout France label), Relais & Châteaux, Forbes Five Star,
Michelin Keys, Leading Hotels of the World, boutique hotels and editorial gems. The catalogue today
covers **615 published hotels across 91 countries**. Every hotel page closes with a **Concierge's Tip** —
the operational secret guidebooks never share. See [ADR-0021 — Pivot scope mondial](docs/adr/0021-pivot-scope-mondial.md).
The product is split into:

- **`apps/web`** — the public Next.js 15 site (booking, search, editorial, account).
- **`apps/admin`** — the Payload CMS back-office.
- **`packages/`** — shared domain, integrations, SEO, emails, DB, observability, UI primitives.

The monorepo is **pnpm + Turborepo**. TypeScript is **strict** (no `any`, no `as` casts, no `!`).

## 2. Layering — the only architecture diagram you need

```
┌──────────────────────────────────────────────────────────────┐
│  apps/web         apps/admin                                 │
│       ↘             ↙                                        │
│   packages/seo, /emails, /ui, /db, /observability, /config   │
│                       ↑                                      │
│        packages/integrations/<vendor>/  ← Zod, HTTP, Redis   │
│                       ↑                                      │
│              packages/domain/  ← pure TS, no I/O             │
└──────────────────────────────────────────────────────────────┘
```

Lower layers **never** import from higher layers. See `.cursor/rules/architecture-layers.mdc`.

## 3. Where to look first

| Task                                                                                                                              | Start here                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Before commit / push / "it's live" on any user-visible change**                                                                 | [`user-acceptance-loop`](.cursor/skills/user-acceptance-loop/SKILL.md) + hard rule [`.cursor/rules/user-acceptance-before-commit.mdc`](.cursor/rules/user-acceptance-before-commit.mdc) |
| Add a business rule                                                                                                               | `packages/domain/` + `.cursor/rules/architecture-layers.mdc`                                                                                                                            |
| **Editorial voice / brand tone / FR-EN copy**                                                                                     | [`EDITORIAL_VOICE.md`](EDITORIAL_VOICE.md) (root) + [`docs/editorial/style-guide.md`](docs/editorial/style-guide.md)                                                                    |
| New vendor integration                                                                                                            | `.cursor/skills/api-integration/SKILL.md` + `.cursor/rules/integrations-api.mdc`                                                                                                        |
| **LLM pipeline (editorial, AEO, content)**                                                                                        | `.cursor/skills/llm-output-robustness/SKILL.md`                                                                                                                                         |
| **Voix du Concierge** (ADR-0011, pass 8, `<ConciergeAdvice>`, shortener phrases > 25 mots)                                        | `.cursor/skills/concierge-voice-pipeline/SKILL.md`                                                                                                                                      |
| **LLM extraction from web content (Tavily)**                                                                                      | `.cursor/skills/content-enrichment-pipeline/SKILL.md` + `llm-output-robustness` §rule-9                                                                                                 |
| **Multi-source factual enrichment**                                                                                               | `.cursor/skills/content-enrichment-pipeline/SKILL.md`                                                                                                                                   |
| **Photo pipeline / hero / alt enrichment / Pinterest hotlink risk**                                                               | `.cursor/skills/photo-pipeline/SKILL.md`                                                                                                                                                |
| **Zod schema → React props**                                                                                                      | `.cursor/skills/typescript-strict-zod-interop/SKILL.md`                                                                                                                                 |
| **PowerShell / Windows dev commands**                                                                                             | `.cursor/skills/windows-dev-environment/SKILL.md`                                                                                                                                       |
| New public route                                                                                                                  | `apps/web/src/app/[locale]/` + `.cursor/rules/nextjs-app-router.mdc`                                                                                                                    |
| **JSON-LD page → must be `force-dynamic`**                                                                                        | `.cursor/skills/structured-data-schema-org/SKILL.md` §CSP-nonce-contract                                                                                                                |
| **Hotel detail page** (15 blocks)                                                                                                 | `.cursor/rules/hotel-detail-page.mdc` (CDC §2 checklist + ADR-0007/0008/0009)                                                                                                           |
| **Le Concierge Club** (funnel, `/le-concierge-club*`, `<ClubBenefitsBlock>`, JSON-LD `MemberProgram`, Sentry `club.*`, SEA brief) | `.cursor/skills/membership-program/SKILL.md` + [ADR-0019](docs/adr/0019-le-concierge-club-architecture.md) + [ADR-0020](docs/adr/0020-sea-member-pricing-constraints.md)                |
| **Loyalty domain rules** (tier `club`/`prestige`, `hotel_member_benefits`, Stripe Phase 6)                                        | `.cursor/skills/loyalty-program/SKILL.md` + `packages/domain/src/loyalty/`                                                                                                              |
| Room sub-page `/hotel/[slug]/chambres/[room]`                                                                                     | `.cursor/rules/hotel-detail-page.mdc` + ADR-0009                                                                                                                                        |
| **Editorial guide / ranking page**                                                                                                | `.cursor/skills/editorial-long-read-rendering/SKILL.md` + `llm-output-robustness`                                                                                                       |
| **Rankings matrice** (combinator, axes, `slugOverride`, Paris arrdt, Yonder bridging)                                             | `.cursor/skills/editorial-rankings-matrix/SKILL.md`                                                                                                                                     |
| **TOC sidebar / EnrichedText / auto-link**                                                                                        | `.cursor/skills/editorial-long-read-rendering/SKILL.md`                                                                                                                                 |
| New Supabase table / RLS policy                                                                                                   | `packages/db/migrations/` + `.cursor/rules/supabase-rls.mdc`                                                                                                                            |
| **Hotel affiliations** (brand / label / ranking / guide — R&C, Atout France, Forbes, Michelin Keys, LHW, SLH, World 50 Best…)     | [ADR-0023](docs/adr/0023-hotel-affiliations-vs-external-sources.md) + `packages/db/src/schema/affiliations.ts`                                                                          |
| JSON-LD / robots / llms.txt                                                                                                       | `packages/seo/` + `.cursor/rules/seo-geo.mdc`                                                                                                                                           |
| Payload collection / back-office hook                                                                                             | `apps/admin/` + `.cursor/skills/backoffice-cms/SKILL.md`                                                                                                                                |
| E2E for a new journey                                                                                                             | `apps/web/e2e/` + `.cursor/rules/e2e-testing.mdc`                                                                                                                                       |
| Security / CSP / auth                                                                                                             | `.cursor/rules/security-csp.mdc`                                                                                                                                                        |
| Perf, Sentry, logs                                                                                                                | `.cursor/rules/observability-perf.mdc`                                                                                                                                                  |

### Structural decisions already taken (don't relitigate without an ADR)

| Decision                                                                                                                  | Reference                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Hotel URL = `/hotel/<slug>` (flat slug, against CDC §3.3)                                                                 | [ADR-0008](docs/adr/0008-url-structure-hotel-flat.md)                                                          |
| Room sub-pages `/hotel/<slug>/chambres/<room-slug>` indexable                                                             | [ADR-0009](docs/adr/0009-hotel-room-subpages-indexable.md)                                                     |
| ISR via auth client island (hotel + destination = `revalidate = 3600`)                                                    | [ADR-0007](docs/adr/0007-isr-via-auth-client-island.md)                                                        |
| Locales V1 = `fr` + `en` ; V2 = +es/de/it ; V3 = +ar/zh/ja                                                                | `.cursor/skills/seo-technical/SKILL.md`                                                                        |
| International hotels (`country_code != 'FR'`, `region` nullable, `luxury_tier` CHECK on 19 awards/brands)                 | `packages/db/migrations/0033_hotels_country_support.sql` + `docs/editorial/yonder-intl-expansion-wakeup.md`    |
| `hotels.affiliations jsonb` séparée d'`external_sources` (brands / labels / rankings cumulables, JSON-LD `Hotel.award[]`) | [ADR-0023](docs/adr/0023-hotel-affiliations-vs-external-sources.md) + `packages/db/src/schema/affiliations.ts` |

## 4. Hard rules (non-negotiable)

### Code

1. **No `any`, no `as Foo`, no non-null `!`.** Narrow with Zod or type guards.
2. **No `dangerouslySetInnerHTML`** outside the `JsonLdScript` Server Component.
3. **No PII in logs.** Hash, omit, or summarise. Never email/phone/full name/payment.
4. **No new layer-crossing imports.** Domain never imports `fetch`, `next/*`, `@supabase/*`.
5. **Migrations are forward-only.** Don't edit applied SQL. Don't reorder filenames.
6. **i18n keys, not hard-coded strings.** Even error messages.
7. **Server Components by default.** `'use client'` requires real interactivity.
8. **One `Sentry.init` per runtime.** Use the existing `instrumentation*.ts` files.

### Process

8bis. **User acceptance walk-through is mandatory before commit / push / "it's live"** on any user-visible change (new public route, UI block, copy, nav entry, form). The agent reaches the change by clicking through the site like a real user and reports the walk evidence (URLs walked, discoverability path, screenshots, mobile + desktop, fr + en). 2026-05-26 reference case: the Concierge Club shipped 5 pages with zero nav references and the PO landed on the home blind. See [`.cursor/rules/user-acceptance-before-commit.mdc`](.cursor/rules/user-acceptance-before-commit.mdc) (hard rule) and [`.cursor/skills/user-acceptance-loop/SKILL.md`](.cursor/skills/user-acceptance-loop/SKILL.md) (operating manual — browser MCP recipes, scoring rubric).

### Hotel detail page (CDC §2 — `.cursor/rules/hotel-detail-page.mdc`)

9. **≥ 30 photos catégorisées** (10 categories required) avant publication. Validation Payload bloque.
10. **≥ 10 FAQ Q&A** (les 10 questions canoniques obligatoires). Validation Payload bloque.
11. **`AggregateRating.bestRating: '5'`** dans le JSON-LD. Jamais `'10'` (Google Rich Results affiche /5 quoi qu'il arrive).
12. **`Offer.priceValidUntil`** obligatoire (CDC §2.8).
13. **Indicateurs d'urgence** ("X personnes consultent", "stock restant") **interdits** sauf preuve Amadeus (`offer.availability: 'LimitedAvailability'` réelle) — DSA art. 25, DGCCRF.
14. **Awards** rendus en JSON-LD uniquement si `verified: true` côté Payload.
15. **Room sub-page canonical** strict vers elle-même, jamais vers la fiche parent.
16. **Alt enrichi** mots-clés + contexte sur toute image hôtel (`alt="piscine extérieure chauffée Hôtel X Nice"`).

## 4bis. Content completion order (2026-05-25 audit — written content first, photos last)

Product-owner decision (2026-05-25): **finish the written content layer
across the full catalogue before touching photos** (`.cursor/skills/photo-pipeline/SKILL.md`
§Sequencing decision documents the rationale). When you face a choice
between a written-content chantier and a photo chantier, **pick the
written one**.

Catalogue snapshot (refreshed 2026-05-31 — post Track A geographic rankings):

| Surface              | Total | Published | Draft |
| -------------------- | ----- | --------- | ----- |
| `hotels`             | 2219  | **2219**  | 0     |
| `editorial_rankings` | 217   | **217**   | 0     |
| `editorial_guides`   | 99    | **99**    | 0     |
| `itineraries`        | 20    | 20        | 0     |

**Catalogue 100% published across all 4 editorial surfaces** as of
2026-05-31 17:58. Last remaining drafts (Quartier Latin, Tours, Vexin)
deleted with rationale in
`docs/audits/thin-ranking-drafts-deleted-2026-05-31.md`.

**Track A — 7 geographic rankings published 2026-05-31**:

| Slug                                   | Lieu scope | Entries | FAQ | Sections | Words  |
| -------------------------------------- | ---------- | ------- | --- | -------- | ------ |
| `meilleurs-hotels-emirats-arabes-unis` | pays (AE)  | 10      | 14  | 7        | 8 099  |
| `meilleurs-hotels-mexique`             | pays (MX)  | 10      | 12  | 6        | 7 193  |
| `meilleurs-hotels-rome`                | ville      | 8       | 12  | 7        | 7 542  |
| `meilleurs-hotels-venise`              | ville      | 8       | 13  | 8        | 7 212  |
| `meilleurs-hotels-prague`              | ville      | 8       | 12  | 7        | 6 967  |
| `meilleurs-hotels-marais`              | quartier   | 5       | 12  | 7        | 6 448  |
| `meilleurs-hotels-reims`               | ville      | 5       | 12  | 7        | 6 865  |
| **Total**                              |            | **54**  | 87  | 49       | 50 326 |

Implementation: extended `combinator.LieuDef` to support a new `pays` scope
with optional `countryCodes` field (matches hotels by `country_code` instead
of `hotelCityKeys`), added 5 new `LIEUX` entries (Mexique, EAU, Rome,
Venise, Prague), and 7 `MANUAL_OVERRIDES` for the freshly enabled slugs.
The bulk pipeline (`run-rankings-v2-bulk.ts`) ran in 240 s + a single Rome
retry (LLM had emitted a `justification_fr > 1200` chars on one entry).
All 7 walks confirmed live on prod (Rome / Mexique / Marais snapshotted).

**0 drafts remaining** — the 3 thin scaffold drafts (Quartier Latin,
Tours, Vexin) were deleted 2026-05-31 (rationale + future-paths in
`docs/audits/thin-ranking-drafts-deleted-2026-05-31.md`).

**Curated ranking T+L 2025 published 2026-05-31 17:56**:

`classement-travel-leisure-worlds-best-2025` — 84 authentic Travel + Leisure
award entries, previously stuck as a draft because the v2 bulk runner
(`push-ranking-v2.ts` → delete-and-replace) would have destroyed the
authentic ordering. Resolved via a new surgical script
`scripts/editorial-pilot/src/rankings/enrich-ranking-sections-only.ts`
that calls Call M Meta + Calls S + Call FAQ (reusing helpers exported
from `generate-ranking-v2.ts`) and PATCHes only `editorial_sections`

- `faq` + `is_published`. Result: 7 editorial sections (~4 000 words),
  13 FAQ Q&A, 84 entries preserved untouched. Walk-through validated on
  prod (2574-line snapshot, the richest ranking page in the catalogue).
  This new script is now the canonical path for any future curated
  ranking that must preserve manually-sourced entries.

Of the 2219 published hotels: see the per-country breakdown in
`apps/web/src/lib/catalogue-stats.ts` (single source of truth) — the
earlier 615/752 split was stale (pre-2026-05-28 Phase 1 catalogue flip).

**Flip 2026-05-31 15:36 — `akelarre-restaurant-hotel`**:

Dernier draft hôtel restant (Akelarre, restaurant 3⭐ Michelin de Pedro
Subijana à Saint-Sébastien, Relais & Châteaux). Passé tous les gates du
`publish-eligible-drafts.ts` après le clear des pipelines `humanizer-faq`

- `enrich-signatures` + `enrich-policies` (terminés 15:33-15:35) :
  `desc_fr=1120c`, `md_fr=138c`, `fs_fr=145c` (in CDC band [130, 150]),
  FAQ=10, concierge_advice ✅. **Le catalogue hôtels est désormais zéro
  draft.**

**Cleanup 2026-05-31 — 5 doublons éditoriaux supprimés**:

- 4 `editorial_rankings` `classement-*` chaînes (Aman, Four Seasons,
  Mandarin Oriental, Park Hyatt) qui doublonnaient les `top-*` canoniques
  déjà publiés (cf. `run-chain-ranking.ts`).
- 1 `editorial_guides` `guide-espagne` (stub abandonné, doublon du
  `editorial_guides/espagne` déjà publié).
- Snapshot intégral des 5 rows + manifest dans
  `scripts/editorial-pilot/runs/duplicates-deleted-2026-05-31.md` +
  `scripts/editorial-pilot/runs/duplicates-snapshot-2026-05-31.json`.

The 11 ranking drafts restants sont des **geographic/awarded sans
`editorial_sections`** (Marais, Reims, Mexique, Prague, Quartier Latin,
Rome, Tours, Venise, Vexin, EAU, Travel+Leisure World's Best 2025). Pour
les publier, lancer `scripts/editorial-pilot/src/rankings/run-rankings-v2-bulk.ts`
ciblé sur ces 11 slugs (~50-60 LLM calls). Pas urgent — Phase 1.5
tightening + photos prioritaires.

Field-by-field completeness on the **443 published hotels** (chase
these gaps in this order — top of the list is the most painful trade-off
between effort and impact):

> ⚠ **Audit metric ≠ production validator.** Two thresholds coexist for
> every text field: (a) the **production envelope** baked into the Zod
> schema that gates publish (e.g. `factual_summary` = 110-165 chars in
> `scripts/editorial-pilot/src/hotels/factual-summary-generator.ts`),
> and (b) the **CDC ideal** documented in the spec (e.g. 130-150 chars
> in CDC §2.3). The first is the real blocker; the second is
> aspirational. Always cite the production envelope when reporting gaps
> — otherwise we over-count work and burn tokens re-generating already-
> passing rows. See the dedicated section in
> [`editorial-pilot/SKILL.md`](.cursor/skills/editorial-pilot/SKILL.md)
> §"Audit metric vs production validator".

| Rank | Field                                                                                                                                                                              | Envelope conforming (prod Zod)                                                                                                                                                                                                                                                         | CDC ideal conforming                                                                                                                                                                                                                                                                                                                                                                                         | Pipeline outillé ?                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `policies` (CDC §2.9 hard rule — check-in / pets / cancel / taxes / wifi)                                                                                                          | **2219 / 2219 (100%)** policies present, **2218 / 2219 with real source-derived data** (only 1 row still flagged `_synthetic: true` after the catalogue flip; the rest carry concrete check-in/out / pet fees / wifi scope from the enrichment pipeline)                               | (same — the field has no separate CDC ideal beyond "non-synthetic")                                                                                                                                                                                                                                                                                                                                          | ✅ migration `0055_hotels_policies_safe_defaults.sql` + ongoing enrichment via Tavily/Google Places when the source emits a real value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2    | `factual_summary_fr/en` (envelope 110-165 chars; CDC §2.3 = 130-150)                                                                                                               | **2219 / 2219 (100%)** envelope                                                                                                                                                                                                                                                        | **FR 2113 / 2219 (95.2 %) and EN 2059 / 2219 (92.8 %)** after 2026-05-31 tightening run (368 hotels processed, +207 FR / +176 EN pushed into [130, 150] band). 103 FR / 160 EN remain at 110–129 because the LLM auto-censors on very thin source data; they stay inside envelope so they render fine.                                                                                                       | ✅ `scripts/editorial-pilot/src/hotels/run-hotel-factual-summary.ts --cdc-tightening`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 3    | `meta_desc_fr/en` (generator envelope 140-170 chars in `meta-desc-generator.ts`; renderer has a graceful fallback chain so the band is an SEO quality gate, NOT a publish blocker) | **2218 / 2219 (99.95 %)** both locales (FR + EN) in the [140, 170] SEO band                                                                                                                                                                                                            | (same — band is the only target)                                                                                                                                                                                                                                                                                                                                                                             | ✅ `scripts/editorial-pilot/src/hotels/run-hotel-meta-desc.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 4    | `description_fr` (NO production envelope — renderer accepts any non-null string; CDC §2.4 = 600-1000 words ideal)                                                                  | renderer accepts all 2219 / 2219                                                                                                                                                                                                                                                       | **2218 / 2219 (99.95 %)** at ≥ 600 chars after 2026-05-31 voice-gate fix (oscillation detector + opening-split hint hoisted to top). The 4 iconic outliers were reduced to **1 residual** (Hôtel du Cap-Eden-Roc 534 c — gpt-5.4 holds 1602 c FR and refuses to cut below 1500). The 3 others extended: Sources de Cheverny 494 → 1309 c, Airelles Saint-Tropez 368 → 1343 c, Hôtel des Berges 597 → 1404 c. | ⚠ `run-hotel-description-extend.ts` exists and extends descriptions correctly, **but the Pass 8 voice gate (≤ 28 mots/phrase) rejects long opening lines** of these 4 fiches (e.g. "Dominant les collines tropéziennes, l'Airelles Saint-Tropez Château de la Messardière, classé Palace par Atout France, s'étend sur 12,5 hectares…" = 33 mots). The preserve-opening rule and the shortener rule are in tension. Fix path: (a) re-author the 4 openings manually under 28 mots, (b) add an `--allow-open-cut` flag bypassing preserve-opening on sentence 1, or (c) accept the 4 outliers (already published, renderable). Decision deferred — low ROI, CDC ideal is aspirational on this field. |
| ✅   | `long_description_sections` ≥ 3                                                                                                                                                    | **2219 / 2219 (100 %)** since 2026-05-31 closure — the last 4 R&C / Marriott scaffold rows (Akelarre, Borgo San Felice, Ritz-Carlton Astana, St. Regis Hong Kong) were enriched with 7-8 sections + ~3700 mots FR/EN each. Walked Akelarre live = 5 H2 sections + sticky TOC rendered. | (same)                                                                                                                                                                                                                                                                                                                                                                                                       | ✅ `scripts/editorial-pilot/src/enrichment/enrich-hotel-content.ts` — auto-filters `long_description_sections=is.null`. Requires `EDITORIAL_PILOT_OPENAI_TIMEOUT_MS=600000` (heavy LLM call: 6-8 sections × ≥ 350 mots FR + EN + 6 signature experiences). Patched 2026-05-31 to preserve pre-existing `signature_experiences` instead of overwriting them.                                                                                                                                                                                                                                                                                                                                         |
| ✅   | `faq_content` ≥ 10                                                                                                                                                                 | 2219 / 2219 (100 %)                                                                                                                                                                                                                                                                    | (same)                                                                                                                                                                                                                                                                                                                                                                                                       | already done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ✅   | `concierge_advice`                                                                                                                                                                 | 2219 / 2219 (100 %)                                                                                                                                                                                                                                                                    | (same)                                                                                                                                                                                                                                                                                                                                                                                                       | already done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

Then the 924 draft hotels need the same 4 blocks (they already have
long_description_sections + faq + concierge_advice → only #1-4 separate
them from publish). Then editorial guides drafts (36), then rankings
drafts (85). Itineraries are 20/20 published — done.

> Note: the draft count jumped from 506 → 924 on 2026-05-25 after the
> Relais & Châteaux scaffold pass (418 new drafts inserted as
> `luxury_tier='relais_chateaux'`, `booking_mode='display_only'`, `P2`).
> See `scripts/editorial-pilot/src/global-sources/extract-relais-chateaux.ts`
> and `scripts/editorial-pilot/global-sources/rc-hotels.json` for the
> source artefacts; 53 pre-existing rows were also patched with R&C
> membership in `external_sources` (idempotent jsonb merge).

**Phase 1 published-quality envelope closure (2026-05-25)**

By end of session 2026-05-25 the four gaps on published hotels at the
production envelope level were closed:

- `factual_summary_fr/en` — 443 / 443 in band (1 NULL backfilled via
  `run-hotel-factual-summary.ts`).
- `policies` — 443 / 443 non-null via migration
  `0055_hotels_policies_safe_defaults.sql`. 357 carry `_synthetic: true`
  for the future Google Places + Tavily enrichment pass.
- `meta_desc_fr/en` — 427 / 443 (96 %) in the 140-170 band via
  `run-hotel-meta-desc.ts`. 16 hotels with thin source data remain
  out-of-band — they need Tavily enrichment of the underlying
  `description_fr/en` before regeneration.
- `description_fr` — has no production envelope; the renderer accepts
  any non-null string. The 9 hotels below 200 chars and the
  `hotel-corsica` literal `**occupe**` typo are listed for Phase 1.5
  cleanup (manual edits or a small extension pipeline).

**Phase 1.5 = optional CDC-ideal tightening**: regenerate the 243
`factual_summary` rows currently in [110, 130) to land in the 130-150
ideal band, replace the 357 synthetic policies with real Google
Places / Tavily-sourced data, extend the 106 short `description_fr`
to ≥ 600 chars, and re-run meta_desc on the 16 thin-source failures
after their descriptions are enriched.

**Phase 1.5 partial close (2026-05-31 — chantier "A et B")**

Two tightening sweeps ran across the catalogue and closed substantial
gaps without re-touching photos or APIs (full Phase 6 still frozen).
The pipelines + their state are now part of the standard toolbox.

| Metric                                            | Before               | After 1st wave       | After 2nd wave (12:30 PM) | Total Δ |
| ------------------------------------------------- | -------------------- | -------------------- | ------------------------- | ------- |
| `factual_summary_fr` in CDC ideal band [130, 150] | ~1014 / 2218         | 1516 / 2218 (68 %)   | **1903 / 2218 (86 %)**    | +889    |
| `factual_summary_en` in CDC ideal band [130, 150] | ~1014 / 2218         | 1548 / 2218 (70 %)   | **1881 / 2218 (85 %)**    | +867    |
| `factual_summary_fr` above 150 (over-band)        | 41                   | 41                   | **2**                     | -39     |
| `factual_summary_en` above 150 (over-band)        | 61                   | 61                   | **1**                     | -60     |
| `meta_desc_{fr,en}` in 140-170 band               | 2216 / 2218 (99.9 %) | 2218 / 2218 (100 %)  | 2218 / 2218 (100 %)       | +2      |
| `external_sources` populated (≥ 1 entry)          | 26 / 2218 (1.2 %)    | 1370 / 2218 (61.8 %) | 1370 / 2218 (61.8 %)      | +1344   |
| `external_sources` with 5+ provenance entries     | 0                    | 409 (18.4 %)         | 409 (18.4 %)              | +409    |

**2nd wave fix recap (2026-05-31 commit `497a6b6`)** — the `--cdc-
tightening` re-run had previously only landed 10 % of outputs in the
[130, 150] sweet spot. Root cause: the canonical FR example in
`prompts/hotel-factual-summary.md` was 118 chars and explicitly
annotated `(118 caractères ✅)`, biasing the LLM toward sub-130
outputs regardless of the stated rule. Replaced with a 141-char
example + warning paragraph + added optional `idealBand` retry hint
to the generator with safe fallback to the last in-envelope attempt.
Dry-run hit rate jumped from 1/10 to 8/10. The 313 FR / 336 EN rows
still under 130 chars carry the "thin source data" signature (Ritz-
Carlton APAC, Belmond, etc.) — they need Tavily / Google Places
enrichment of the underlying `description_fr/en` before another
tightening pass can move them.

**Tooling capitalised** (now reusable across the project):

- New flag `--cdc-tightening` on `run-hotel-factual-summary.ts` —
  forces `--include-all` server-side then filters client-side on the
  CDC ideal band [130, 150]. The factual_summary prompt was also
  tightened to target the 130-150 sweet spot while keeping the
  110-165 production envelope as the hard Zod gate.
- New pipeline
  [`scripts/editorial-pilot/src/enrichment/convert-wikidata-to-external-sources.ts`](scripts/editorial-pilot/src/enrichment/convert-wikidata-to-external-sources.ts) —
  re-projects the Wikidata-resolved scalar columns
  (`wikidata_id`, `wikipedia_url_fr/en`, `official_url`,
  `tripadvisor_location_id`, `booking_com_hotel_id`, `commons_category`,
  `external_sameas.{architects,inception_year,heritage_designations,
twitter,instagram,facebook,youtube,linkedin}`) into structured
  provenance entries on `hotels.external_sources` (see ADR-0023 +
  `seed-grecotel-external-sources.ts` for the shape). Zero new API
  calls — purely a data-shape conversion. Idempotent merge by
  `(source, field)`. Re-run whenever `enrich-wikidata-ids.ts`
  resolves new identifiers.

**Phase 5 mini-sweep — EEAT becomes LLM-actionable (2026-05-31)**

The EEAT `external_sources` data backfilled above is now exposed as a
first-class agent skill, so ChatGPT / Claude / Perplexity / MCP can
cite provenance without scraping the page:

- New endpoint
  [`/api/agent/hotel-sources/{slug}`](apps/web/src/app/api/agent/hotel-sources/[slug]/route.ts) —
  returns `{ slug, hotelName, sources[], canonicalUrl, updatedAt }`
  where each source carries `{ field, value, source, sourceUrl,
confidence, collectedAt }`. Soft-404s with `note: 'no_sources_yet'`
  when the row exists but has no provenance. Rate-limited (60/min/IP),
  cached `private max-age=1800`.
- New skill `get-hotel-sources` in
  [`packages/seo/src/agent-skills.ts`](packages/seo/src/agent-skills.ts) —
  ships with `inputSchema` + `endpoint`, validated by the existing
  `agent-skills-routes.test.ts` (every advertised endpoint must resolve
  to a route file on disk).
- New data-layer reader
  [`apps/web/src/server/hotels/get-hotel-external-sources.ts`](apps/web/src/server/hotels/get-hotel-external-sources.ts) —
  lenient parser that drops bad entries instead of failing the row.
- [`llms.txt`](apps/web/src/app/llms.txt/route.ts) updated: stale `16
actions` count refreshed to `24`, `about` block now mentions the
  EEAT provenance surface, new endpoint listed in the "API LLM-
  actionnables" section.

**Why this matters for SEO/GEO**: it closes the loop between the
backfill (data on disk) and the surface (agent-consumable). Before
this commit, the new `external_sources` rows were rendered server-side
in the page DOM (so LLM crawlers eventually picked them up) but
weren't directly queryable from a tool call — agents now have a 1-RPC
shortcut to citation-grade provenance for any of the 1370 hotels with
≥ 1 source.

**Phase 5 mini-sweep follow-up — EEAT becomes user-visible (2026-05-31)**

The API surface was great for LLMs, but Google crawlers and humans
read the page DOM. The new
[`<HotelExternalSourcesFooter>`](apps/web/src/components/hotel/hotel-external-sources-footer.tsx)
component (CDC §2 bloc 13bis) renders the `external_sources` payload
visibly at the bottom of the EEAT cluster (after `<HotelTrustSignals>`,
before `<HotelReassurance>`). Two complementary blocks:

- **Faits vérifiés** — opening year, architects, heritage designations
  attributed to Wikidata (high-trust because the Q-page link is one
  click away).
- **Références externes** — canonical URLs (Wikidata, Wikipédia FR/EN,
  Wikimedia Commons, official site, TripAdvisor, Booking.com) with
  `rel="nofollow noopener"`.

Self-elides when the column carries no publicly useful entries
(currently 848 fiches at Phase 1.5 close — drafts promoted without
Wikidata resolution). Powered by a new `readExternalSourcesProvenance`
reader in `get-hotel-by-slug.ts` (same lenient parsing as the agent
endpoint — duplicated schema to avoid circular imports, tested in
[`external-sources-provenance.test.ts`](apps/web/src/server/hotels/external-sources-provenance.test.ts)
with 10 cases). i18n keys live under `hotelPage.sources.*`.

Verified end-to-end on Ritz Paris (12 sources): both FR and EN render
the block with all facts + 6 references; Le K2 Palace (no sources)
correctly skips the block. The shape difference between editorial
provenance (per-citation `{url, label_fr, label_en, type}`) and hotel
provenance (per-fact `{field, value, source, source_url}`) is
documented in
[`get-hotel-external-sources.ts`](apps/web/src/server/hotels/get-hotel-external-sources.ts)
§"Why the shape diverges".

**What's still gappy** (carry-over for the next Phase 1.5 pass):

- 702 FR / 670 EN `factual_summary` rows remain in the production
  envelope [110, 165] but outside the CDC ideal [130, 150]. They
  cluster in [110, 129] (LLM under-shot) or [151, 165] (LLM
  over-shot). A 2nd pass is possible but ROI is dropping — these are
  the structurally short or long hotels where the source text doesn't
  give the generator enough hooks. Defer to a manual editorial sweep.
- 848 / 2218 hotels still have no `external_sources` because they
  carry NO Wikidata-derived scalar at all (drafts/scaffolds promoted
  via the publish flip). They are the natural targets for the next
  enrichment wave: re-run `enrich-wikidata-ids.ts` (Wikidata
  resolver) on the un-resolved drafts, then re-run
  `convert-wikidata-to-external-sources.ts` to fold the new
  identifiers into the provenance array.
- 1 hotel (Hôtel du Cap-Eden-Roc) keeps `description_fr` at 534 c.
  Voice-gate fix 2026-05-31 (oscillation detector + opening-split
  hint hoisted to TOP — commit `923e181`) resolved 3/4 outliers
  (Cheverny 494 → 1309, Airelles 368 → 1343, Berges 597 → 1404).
  Cap-Eden-Roc holds 1602 c FR on every retry and refuses to cut
  below the 1500 c cap. Acceptable as 1/2219 outlier (0.045 %).

Once published-quality is conformant, Phase 2 promotes the 924 drafts
(now including the full Relais & Châteaux roster scaffolded on
2026-05-25). Phase 3 finishes editorial guides + rankings. Phase 4 is
the photo migration. Phase 5 ships multilingual V2/V3. **Phase 6 (and
only then) wires the booking APIs** — see §4ter below for the explicit
phasing decision and the list of items that are deliberately out of
scope until then.

## 4ter. Booking API integration is the LAST brick (2026-05-25)

Product-owner decision (2026-05-25): **all reservation / pricing /
availability data is sourced from APIs that will only be wired at the
end of the project**. Until then, the site ships as an editorial-only
property. When an agent considers proposing or implementing any
booking-side work, **stop** and reread this section first.

### Phasing matrix (top-down) — single source of truth for sequencing

Aligns the §4bis content-completion ladder with the API-last decision.

| Phase                                               | Status                               | Includes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 — Editorial-only on published catalogue**       | 🟢 mostly DONE                       | Catalogue flip 2026-05-28: **615 → 2134 published hotels in 127 countries** via `publish-eligible-drafts.ts` (1519 drafts promoted). Indexability gate refactored (`apps/web/src/server/hotels/indexability.ts`) so editorial-rich rows without photos pass. Catalogue counters refreshed in `lib/catalogue-stats.ts` (single source of truth). Concierge advice = 99.6 % (1274/1279). Factual summary, meta_desc, description, FAQ, concierge advice — 100 % on all 2134 published. **Remaining**: 73 drafts with `description_fr IS NULL` need a Tavily seed (Phase 1.5).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **1.5 — Known gaps to close**                       | ⏳                                   | (a) **73 drafts all-empty** (Brach, Claridge's, Le Petit Nice, Lou Pinet, La Mamounia, etc.) — Tavily seed → run pipelines → flip publish. (b) **FAQ canonical gap**: only 60.8 % of fiches carry a "transferts" question (LLM substitutes "ski transfer" / "navette ville" by context); 8/10 canonical Q at >89 %. Extend `extend-faq-postgrest.ts` to enforce missing canonical slots. (c) **Photo gate** — 1807/2134 published hotels have no `hero_image` and currently take the editorial path; once photos ship, photo-rich gate auto-supersedes. (d) **Sitemap revalidate** depends on Vercel deploy of the indexability fix.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **2 — Photo pipeline**                              | ⏳                                   | Sourcing, legal hygiene, Cloudinary migration, alt enrichment, Structured Metadata fields, hero fallback chain, JSON-LD `ImageObject` (≥ 30 photos per hotel, 10 categories). See `.cursor/skills/photo-pipeline/SKILL.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **3 — Editorial pages (guides + rankings + itin.)** | 🟡 partial 2026-05-28                | 14 city guides ALL generated + published in `editorial_guides` (NYC, Dubaï, Bali, Tokyo, Amalfi Coast, Marrakech, Mykonos, Santorin, St-Moritz, Phuket, Lake Como, Madeira, Riviera Maya, Algarve — 12-14 sections, 29-42 FAQ, 16-18 TOC anchors, 5-10 sources each). **Blocker — ADR-0015 step 1 still pending**: `/destination/[citySlug]/page.tsx` renders the hotel hub only, the long-read body is invisible on the canonical public route (visible only in `llms.txt` + hotel-detail `<LocalGuideTeaser>`). PR-15bis follow-up = 3-5 hours of work, see [ADR-0015 §Implementation status](docs/adr/0015-merge-guide-destination.md#implementation-status-2026-05-28-audit). Rankings: 8 chain rankings live in prod (Aman + Mandarin Oriental piloted, 6 others published). Itineraries: 20/20 published. Remaining: 6-8 cross-chain rankings (Top 25 Aman, Top 30 FS palaces, Best MO, Top 20 Six Senses, Cheval Blanc 6 maisons, Best Belmond, etc.) + 3 multi-country itineraries (Grand Tour Aman Asie, Méditerranée Belmond, Maldives Atoll Hopping). |
| **4 — Multilingual V2 / V3**                        | ⏳                                   | DE / ES / IT (V2 — German first per `seo-geo.mdc`), then AR / ZH / JA (V3). Native rewrites, not machine translations.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **5 — Observability & GSC submit**                  | ⏳                                   | Sitemap regen (252 → 2134 entries), GSC submit, Sentry release tag `catalogue-gap-2026`, llms.txt + agent-skills.json refresh, Screaming Frog hreflang audit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **6 — Booking APIs (LAST brick)**                   | 🔴 frozen until catalogue is shipped | Amadeus GDS Self-Service Hotels (search, offers, booking, sentiments), Little Hotelier (loyalty-eligible inventory), Makcorps + Apify (non-affiliated price comparator), Amadeus Payments (3DS2, Apple/Google Pay). All `Offer` JSON-LD, `priceValidUntil`, `LimitedAvailability`, idempotency keys, payment iframe, sentiment enrichment go live at this stage.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

### What is OUT of scope until Phase 6 (do NOT propose, do NOT implement)

- `Offer` + `priceValidUntil` emission in JSON-LD (depends on Amadeus
  offers). The hotel detail page must NOT emit an `Offer` block — emit
  only `Hotel` + `Place` + `BreadcrumbList` + `FAQPage` +
  `AggregateRating` (when real reviews exist) + `Review[]` +
  `ImageObject[]` + `Award[]`.
- Booking widget in the hotel fiche. Keep an editorial CTA "Réserver via
  le Concierge" that opens a static `/le-concierge/reserver` /
  `/le-concierge/contact` flow — no GDS round-trip.
- Funnel `/recherche → /results → /offer → /checkout` with live GDS
  calls. The `/recherche` page may exist but renders only catalogue
  filters; no Amadeus, no Algolia hotelOffer index, no `priceValidUntil`.
- Makcorps / Apify price comparator widget.
- Amadeus sentiments enrichment in `ReviewsBlock`.
- Loyalty tier calculation derived from booking history.
- "X personnes consultent" / `LimitedAvailability` / stock indicators
  (the CDC §2.8 rule banning them stays in force AND the topic itself
  is non-applicable until the API ships).
- Payment iframe (Amadeus Payments, 3DS2, Apple Pay).
- All `idempotencyKey` flows that wrap booking-side actions.
- `force-dynamic` on routes that are only dynamic because of booking
  cookies — flip them back to ISR if the only reason was an Amadeus
  fetch.

### What IS in scope right now (the real chantier)

- The 443 published + 924 drafts hotel fiches (close the 4 gaps in §4bis).
- The Concierge voice + `<ConciergeAdvice>` block in every hotel page.
- Rankings, guides, itineraries content completion.
- Internal maillage (the menu audit 2026-05-25 is the canonical TODO —
  see `canvases/audit-menu-navigation.canvas.tsx`).
- AEO / FAQ / `llms.txt` / `agent-skills.json` quality.
- EEAT: `external_sources` + `author_name` + outbound links to Atout
  France / Michelin Guide / Forbes / R&C.
- Photo pipeline (Phase 2 next).
- Institutional pages (mentions légales, méthode éditoriale, conseil
  du concierge, pour les hôteliers, MICE, presse, etc.).
- Multilingual FR ↔ EN parity, then DE/ES/IT in Phase 4.

### Implications for code review

- A PR that adds an Amadeus / Little / Makcorps client call to a public
  route is **out of phase** — defer it, do not merge.
- A PR that adds an `Offer` to the hotel JSON-LD is **out of phase**.
- A PR that touches the `/le-concierge/reserver` static page is fine
  (it's an editorial CTA, not a booking surface).
- A PR that strengthens the editorial validators (Zod schema, gate QA,
  factual summary band, FAQ rules) is **in phase** and should be
  prioritised.

The corresponding code skills (`amadeus-gds`, `little-hotelier`,
`booking-engine`, `payment-orchestration`,
`competitive-pricing-comparison`, `loyalty-program`) stay in
`.cursor/skills/` as reference material — **don't act on them until
Phase 6**. They describe the target architecture, not the next sprint.

## 5. Operational essentials

- **Database**: live Supabase project ID `fsmfozxgujskluxakeoq` (region eu-west). Populated catalogue refreshed 2026-05-31: 2219 hotels (all published, 127 countries — 435 Relais & Châteaux), 217 rankings (all published), 99 editorial guides (all published), 20 itineraries (all published). Catalogue is 100% published across all 4 editorial surfaces — zero drafts. Migrations applied via the Supabase MCP (`apply_migration`).
- **Vercel**: previews per PR, production = `main`. Sentry source maps uploaded on prod builds only (`SENTRY_AUTH_TOKEN`).
- **CI**: GitHub Actions runs lint → typecheck → unit → build → e2e. Husky `pre-commit` runs `lint-staged`, `pre-push` runs `tsc --noEmit`.
- **MCP servers** wired up locally (status as of 2026-05-25):
  - ✅ **Operational**: `user-supabase` (DB schema + SQL exec), `plugin-vercel-vercel` (deployments + build logs), `plugin-sanity-Sanity` (CMS docs, OAuth `contact@travelba.fr`), `plugin-cloudinary-cloudinary-asset-mgmt` (27 tools — upload, search, transform), `plugin-cloudinary-cloudinary-env-config` (26 tools — presets, transformations, triggers), `plugin-cloudinary-cloudinary-smd` (11 tools — Structured Metadata fields + rules), `cursor-app-control`, `cursor-backend-control`, `cursor-ide-browser`.
  - ⚠️ **Auth claimed but tools not yet exposed**: `plugin-cloudinary-cloudinary-analysis` — `mcp_auth` returned success but no tools surface in the available list. Possibly a lazy-load quirk. Retry `mcp_auth` if the next call still fails.
  - ⚠️ **Needs OAuth click** (only expose `mcp_auth`): `plugin-opsera-devsecops-opsera`. Authenticate when the task actually needs it — the OAuth popup must be clicked in the IDE within 2 min.
  - ❌ **Broken credentials**: `plugin-tavily-tavily` (token expired — "Not connected"; reconnect via Cursor → Settings → Tools & Integrations → MCP → Tavily → Reconnect), `plugin-resend-resend` ("API key is invalid" — regenerate at `resend.com/api-keys` with Full Access then paste in Cursor MCP settings).
  - 🚫 **Mentioned in past sessions but NOT configured on this machine**: Datadog, GitHub, Superhuman, shadcn — either install them or stop referencing them in agent prompts.

  **Gotcha — Cloudinary is exposed as 5 separate MCPs in Cursor**:
  `asset-mgmt`, `env-config`, `smd` (Structured Metadata), `analysis` (AI vision),
  `mediaflows` (workflow automation). **Each has its own OAuth** even though the
  vendor dashboard groups them under one Cloudinary login. Clicking "Connect" on
  the Cursor plugin row covers `asset-mgmt + env-config` only; the other three
  require an extra `mcp_auth` round-trip per MCP. **Auth them lazily** when a
  workflow actually needs them — don't bulk-auth upfront.

  Prefer MCP tools to manual shell when the task fits, but always check the MCP descriptor (`mcps/<server>/tools/<tool>.json`) before calling — schema drift is the #1 source of `Invalid arguments` errors.

## 6. Commit / PR hygiene

- Conventional Commits: see `.cursor/rules/commit-conventions.mdc`.
- One concern per PR. Prefer 5 small PRs over a 60-file giant.
- Always update or add a test alongside a business-rule change.
- Reference an ADR (`docs/adr/0000-*.md`) when you change a layer boundary or rendering strategy.

## 7. When in doubt

- Check `.cursor/skills/<topic>/SKILL.md` — there are 35+ skills covering every vertical. Browse the catalogue: [`.cursor/skills/README.md`](.cursor/skills/README.md).
- Open `docs/adr/` for past decisions.
- Ask a human before disabling a CI check, lowering a Supabase RLS policy, or removing a Sentry init.

## 8. Capitalisation continue — if you discover a new pattern, capture it

The agent who follows you should not pay the cost of a lesson you already
paid. **When you hit a non-obvious gotcha during a session, before closing
the task:**

1. Decide if it's reusable (will another agent or session hit this?).
2. Pick the closest existing skill and add a short subsection, OR create a
   new skill via `.cursor/skills/<new-skill>/SKILL.md` (see
   `~/.cursor/skills-cursor/create-skill/SKILL.md` for the template).
3. Cross-link it from the related skills' "References" section so it's
   discoverable from multiple angles.
4. Update [`.cursor/skills/README.md`](.cursor/skills/README.md) — both
   the catalogue and the "problem → skill" matrix.

Patterns worth capturing: vendor API quirks, schema validation traps,
shell/env gotchas, prompt-engineering tactics that worked, type-level
interop oddities. Anything that took you more than one iteration to fix.

Welcome aboard.

## Cursor Cloud specific instructions

### Environment basics

- **Node 20.19.4** (from `.nvmrc`) via nvm; **pnpm 10.33.2** via corepack.
- The update script handles `nvm install`, `corepack prepare`, and `pnpm install --frozen-lockfile`.
- After install, pnpm warns about ignored build scripts (esbuild, sharp, msw, etc.). The platform-specific binaries (`@esbuild+linux-x64`, `@next/swc-linux-x64-gnu`) are installed as separate packages so **no manual `pnpm approve-builds` or `pnpm rebuild` is needed** — the dev server and build work without running postinstall scripts.

### Running the web app (`apps/web`)

- Create `apps/web/.env.local` (not just workspace root) with `SKIP_ENV_VALIDATION=true` and `NEXT_PUBLIC_SKIP_ENV_VALIDATION=true`. The `@t3-oss/env-nextjs` loader in the middleware will crash without this flag when real credentials are absent.
- The `pnpm dev:web` script uses `--turbopack`, which is **incompatible** with `experimental.typedRoutes` in `next.config.ts`. Run the dev server without Turbopack: `cd apps/web && npx next dev --port 3000`.
- First page compile takes ~15–19 s (webpack mode); subsequent HMR is fast.
- The app degrades gracefully without real Supabase/Redis/Algolia/Amadeus credentials — pages render but data-dependent sections return empty/null.

### Running lint / typecheck / tests

- `pnpm lint` — runs ESLint on `@mch/web` and `@mch/admin` (2 packages have lint scripts).
- `pnpm typecheck` — runs `tsc --noEmit` across all 11 workspace packages.
- `pnpm test:unit` — runs Vitest in `@mch/domain`, `@mch/web`, `@mch/integrations`.
- All three commands work out of the box with no external services.

### Build

- `SKIP_ENV_VALIDATION=true NEXT_PUBLIC_SKIP_ENV_VALIDATION=true pnpm build` succeeds without real credentials (~90 s).
- Sentry wrapper is automatically skipped when `SENTRY_AUTH_TOKEN` is absent.

### Key gotchas

- `.env.local` must live in `apps/web/` (not just the monorepo root) because `next dev` reads env from its CWD.
- The `pre-push` hook runs `pnpm turbo run typecheck` and `pnpm validate:skills` — ensure both pass before pushing.
