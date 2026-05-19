---
name: seo-technical
description: Technical SEO rules for MyConciergeHotel.com (metadata, hreflang, canonical, sitemaps, robots, ISR, indexability, anti-cannibalisation). Use for any change touching metadata, URL structure, redirects, or indexing signals.
---

# Technical SEO — MyConciergeHotel.com

SEO is **a platform-level concern, not an after-thought** (CDC v3.0 §6, §8 of the Cursor brief). The site competes against the official hotel websites and must out-rank them.

## Triggers

Invoke when:

- Adding or editing any page metadata.
- Touching `sitemap.xml`, `robots.txt`, hreflang, canonical, redirects.
- Adding a route that may compete with an existing one (review the anti-cannibalisation matrix).
- Modifying `revalidate` values.

## Non-negotiable rules

### Metadata baseline (every page)

- Unique `<title>`: 50–60 chars max; pattern `<intent> · <local> | MyConciergeHotel`.
- Unique `<meta description>`: 140–160 chars.
- `<link rel="canonical">` always set; never points to a redirect target.
- `<link rel="alternate" hreflang="fr-FR">` and `<link rel="alternate" hreflang="en">` plus `x-default` (defaults to `fr-FR`).
- Open Graph (`og:title`, `og:description`, `og:image`, `og:type`, `og:locale`) and Twitter Cards.
- `og:image` dynamic via `opengraph-image.tsx` per route segment.

### URL structure (CDC §3.1) — décision : slug court flat

**Hotel detail URLs stay flat:** `/hotel/[slug]` (singular). We deliberately diverge from CDC §3.3 (`/hotels/[pays]/[ville]/[slug-hotel]`) — see [ADR-0008](../../../docs/adr/0008-url-structure-hotel-flat.md).

- Rationale: short slugs < 60 chars rank better on mobile SERPs (Moz Beginner's Guide 2025, Ahrefs slug study 2024), the `/destination/[city]` hub already plays the geo role, and ADR-0007 (ISR via client island) already builds on this path shape.
- Rooms become **child indexable pages** under the parent: `/hotel/[slug]/chambres/[room-slug]` — see [ADR-0009](../../../docs/adr/0009-hotel-room-subpages-indexable.md).
- Editorial deep paths (`/hotel/[slug]/spa`, `/restaurant`, `/evenements`) only open when the editorial team commits to ≥ 300 unique words and a dedicated FAQ block.

Conventions:

- Lowercase, accents stripped, kebab-case, max 60 chars per segment.
- FR root without prefix; EN under `/en/`. Other locales = V2/V3 (see i18n roadmap below).
- Slugs immutable post-publication. If renamed, the old slug becomes a 301.

### Room sub-pages (`/hotel/[slug]/chambres/[room-slug]`)

- One indexable page per **room type** (not per room number). Canonical points to itself, **never** to the parent hotel — they are distinct entities.
- Bidirectional internal linking is mandatory: the hotel page lists every room, and each room page links back to the hotel + sibling rooms.
- Excluded from `ItemList` JSON-LD on `/destination/[city]` (anti-cannibalisation). The only exception is **signature suites** (Cap-Eden-Roc Suite, Cheval Blanc Penthouse...) curated by Payload `is_signature: true`.
- Long-tail target: queries like "suite avec jacuzzi vue mer Cannes", "chambre familiale Disneyland", "junior suite Ritz Paris".
- Minimum unique content: 200 words description + 5 dedicated photos + filled `Offer` schema. Failing any of these → `noindex` until completed.

### i18n roadmap (CDC §3.4)

- **V1 (current)**: FR (default, no prefix) + EN (`/en/`). hreflang `fr-FR` + `en` + `x-default`.
- **V2 (planned)**: + ES + DE + IT for European reach. Use the checklist below — do **not** improvise.
- **V3 (planned)**: + AR (RTL — bidirectional CSS + RTL a11y tests) + ZH + JA for international.
- Each phase adds a Postgres column **per per-locale field** (`description_<xx>`, `name_<xx>`, `meta_title_<xx>`, `meta_desc_<xx>`, `slug_<xx>`), a hreflang alternate, and a sitemap segment. CDC §3.4 (8 langues) is **aspirational** and tracked as a roadmap, not a V1 requirement.
- Translation policy: LLM-generated via the `translate-hotels-<xx>.ts` pattern (calqué sur `translate-hotels-en.ts`), with the **voix Concierge adaptée culturellement** (cf. [concierge-voice-pipeline](../concierge-voice-pipeline/SKILL.md) Pass 8 + Phase 2 prompts). Editorial team reviews a sample of ≥ 10 hotels before publishing the new locale.

### V2 multilingual rollout — état réel (audit mai 2026)

> **STOP — avant d'écrire un mot de contenu DE/ES/IT, lire cette section.**
> La rule [`seo-geo.mdc`](../../rules/seo-geo.mdc) §Rollout multilingue V2 décrit l'**objectif**. Cette sous-section décrit la **réalité** du code au moment de l'audit. Les deux divergent — l'objectif suppose une infra prête, qui ne l'est pas encore.

**Verdict** : le shell (routes `[locale]/`, next-intl, middleware, layout) est prêt. Le code applicatif et le schéma DB sont **verrouillés FR/EN**. Activer naïvement `'de'` dans `routing.locales` produirait des URLs `/de/...` qui rendent du contenu français avec `<html lang="de">` — cloaking SEO involontaire, signal catastrophique pour Google.

**Les 8 blocages structurels** à lever avant tout travail V2 :

| #   | Blocage                                                                              | Fichier / preuve                                                                                                                                                                            | Impact si ignoré                                                                          |
| --- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | Pas de `routing.pathnames` configuré (FR slugs servis tels quels en EN aujourd'hui)  | `apps/web/src/i18n/routing.ts` n'a que `locales` + `defaultLocale` ; commentaire dans `site-footer.tsx` : « Locale-specific slug mapping is deferred to a future `pathnames` migration »    | `/de/recherche` au lieu de `/de/suche` — la rule promet l'inverse                         |
| 2   | `SupportedLocale = 'fr' \| 'en'` hardcodé                                            | `apps/web/src/server/hotels/get-hotel-by-slug.ts` L18 ; type consommé par ~30 readers `pickXxx` / `readXxx`                                                                                 | Compilation ne casse pas à l'élargissement → readers retournent du fallback FR silencieux |
| 3   | ~32 fichiers avec ternaires `locale === 'fr'` / `locale === 'en'` (>200 occurrences) | Hotspots : `guide/[citySlug]/page.tsx` (37), `get-hotel-by-slug.ts` (32), `classement/[slug]/page.tsx` (30), `hotel/[slug]/page.tsx` (12)                                                   | Chaque ternaire est un fallback FR silencieux — aucun test type-level ne le détecte       |
| 4   | `withLocalePrefix(locale, path)` et `alternates.languages` câblés en dur sur FR+EN   | `hotel/[slug]/page.tsx` L119-121 et L322-328, `recherche/page.tsx`, `sitemaps/hotels.xml/route.ts`                                                                                          | hreflang ment à Google, canonical incorrect                                               |
| 5   | Schéma DB dual-locale uniquement                                                     | Migration `0001_init_core_schema.sql` : `name_en`, `description_{fr,en}`, `slug_en`, `meta_{title,desc}_{fr,en}`, `title_{fr,en}`, `content_{fr,en}`. Pas de colonnes `_de` / `_es` / `_it` | Pas d'endroit où stocker le contenu DE des rédacteurs — bloque Payload                    |
| 6   | Pas de fichiers `messages/{de,es,it}.json`                                           | `apps/web/src/i18n/messages/` ne contient que `fr.json` et `en.json` (1056 lignes chacun)                                                                                                   | Tous les libellés UI tombent en FR fallback avec warning next-intl en dev                 |
| 7   | Sub-sitemaps n'itèrent pas sur `routing.locales`                                     | `sitemaps/hotels.xml/route.ts` L33-41 : `alternates: [{ hreflang: 'fr-FR' }, { hreflang: 'en' }, { hreflang: 'x-default' }]` en dur                                                         | Ajouter une locale = éditer 6 sub-sitemaps à la main                                      |
| 8   | Helpers de format locale-spécifiques hardcodés                                       | `hotel/[slug]/page.tsx` L714 : `const localeFmt = locale === 'en' ? 'en-GB' : 'fr-FR'` ; idem `og:locale` (`fr_FR` / `en_US`)                                                               | Dates et OG mal formatés dans la nouvelle locale                                          |

**Décision actée — [ADR-0012](../../../docs/adr/0012-multilingual-db-schema.md)** (status: **accepted** 2026-05-19) : option **B — table normalisée `<entity>_translations`** retenue. Trois options envisagées (analyse complète dans l'ADR) :

- **A.** Colonnes plates (`name_de`, `slug_de`, …) — rejetée : explose à 222 colonnes localisées en V3.
- **B.** Table normalisée `<entity>_translations(<entity_id>, locale, …)` — **retenue** : scalable à V3 sans DDL, contraintes SQL préservées, pattern industriel reconnu (Sanity, Strapi, Shopify, Stripe).
- **C.** JSONB localisé — rejetée : perd les contraintes SQL fortes (slug regex + unique), Payload UX inadaptée.

Cinq nouvelles tables planifiées : `hotel_translations`, `hotel_room_translations`, `editorial_page_translations`, `editorial_guide_translations`, `editorial_ranking_translations`. Plan d'exécution 8 phases détaillé dans l'ADR.

**Ordre de travail imposé (ne pas paralléliser)** :

1. **Phase 0 — ADR-0012** : ✅ acté 2026-05-19. Option B retenue (table normalisée).
2. **Phase 1 — Refactor type-safe (1-2 jours, sans contenu)** :
   - ✅ **Sous-étape 1a faite** (commit `5fc60c4`) : `apps/web/src/i18n/runtime.ts` créé avec `localePathPrefix`, `withLocalePath`, `intlLocaleTag`, `ogLocale`, `hreflangKey`, `buildHreflangAlternates`. Pattern : maps `Record<KnownLocale, …>` exhaustives sur les 8 locales planifiées (FR/EN/DE/ES/IT/AR/ZH/JA), garde `__LOCALE_IS_KNOWN` qui force `routing.locales ⊆ KnownLocale` à la compilation. Couverture test : `apps/web/src/i18n/runtime.test.ts` (13 tests vitest).
   - 🟡 **Sous-étape 1b en cours** (4 / ~50 fichiers — commit `381bedd`) : codemod des hotspots URL prefix / OG / Intl / hreflang. Premier paquet livré : `recherche/page.tsx`, `hotel/[slug]/page.tsx`, `chambres/[roomSlug]/page.tsx`, `[locale]/layout.tsx` (21 ternaires de prefix/OG/Intl supprimés, 2 fonctions locales `withLocalePrefix` collapse vers `withLocalePath`). Le tableau de hotspots initial sous-estimait : survey exhaustif post-codemod liste **plus de 50 fichiers**, dont les 4 gros offenders (`guide/[citySlug]` 37, `get-hotel-by-slug.ts` 32, `classement/[slug]` 30, `hotel/[slug]/page.tsx` 6 restants — tous data-layer). Plan détaillé : [`docs/runbooks/i18n-v2-rollout.md`](../../../docs/runbooks/i18n-v2-rollout.md) §Prochains paquets recommandés.
   - ⏳ **Sous-étape 1c à faire (après 1b complet)** : élargir `SupportedLocale` en y ajoutant DE/ES/IT + insérer des `assertNever` exhaustifs dans chaque `pickXxx` pour que TS force la résolution des cas manquants. Cette étape doit suivre 1b — sinon le widening seul produit des fallbacks FR silencieux.
   - **Bénéfice immédiat de 1a (déjà acquis)** : les helpers sont disponibles et testés. Toute nouvelle PR peut les utiliser sans attendre le codemod complet — le code legacy continue de marcher à l'identique en parallèle.
3. **Phase 2 — `routing.pathnames`** : ajouter le mapping de la rule `seo-geo.mdc`, refactorer tous les `<Link href="/recherche">`.
4. **Phase 3 — Schéma DB + Payload** : appliquer les 3 migrations de l'ADR-0012 (`0034_create_translations_tables.sql`, `0035_backfill_translations_from_legacy_columns.sql`, `0036_drop_legacy_localized_columns.sql` — DROP seulement après 2 semaines d'observation), exposer les champs DE/ES/IT dans Payload, adapter les readers.
5. **Phase 4 — Contenu DE par rédacteur natif** : seulement maintenant la checklist 13 surfaces ci-dessous devient applicable.

**À ne pas faire (anti-patterns) :**

- Ajouter `'de'` à `routing.locales` "pour voir" — produit `/de/...` rendu en français avec `<html lang="de">` → cloaking SEO de fait.
- Lancer un rédacteur freelance DE/ES/IT avant Phase 3 — le contenu produit n'a pas où être stocké ni servi correctement.
- Faire Phase 1 + ADR-0012 + Phase 2 en parallèle — l'ADR conditionne la signature des helpers de Phase 1.
- Traduire uniquement `messages/de.json` en pensant "ça commence quelque part" — sans Phase 1 le contenu éditorial reste FR et l'hreflang ment à Google.

### Add a new locale (V2/V3 extension) — checklist

> **Ne lire cette checklist qu'une fois les phases 0-3 ci-dessus terminées.** Tant que les 8 blocages structurels ne sont pas levés, l'exécuter mène à un déploiement incohérent.

Adding `de` / `it` / `es` / `ar` / `zh` / `ja` requires touching **13 surfaces in lockstep**. Partial coverage is worse than no coverage (incomplete hreflang triggers Search Console "Alternate page with proper canonical tag" warnings + diluted PageRank). Reference order matters — DB schema first so seed scripts have a target, UI last so screenshots are reviewable.

> Read the existing FR/EN implementation of each surface before changing it. Copy the FR side, not the EN side: EN has historical drift from manual edits.

Use `<xx>` as the new ISO 639-1 code (`de`, `it`, `es`, `ar`, `zh`, `ja`).

1. **DB migration** — `packages/db/migrations/00NN_locale_<xx>_columns.sql` adds `description_<xx>`, `name_<xx>`, `meta_title_<xx>`, `meta_desc_<xx>`, `slug_<xx>` (+ unique constraint + slug regex check identical to `slug_en`) on `public.hotels`, `public.editorial_pages`, `public.editorial_guides`, `public.editorial_rankings`. **JSONB fields** (`faq_content`, `long_description_sections`, `signature_experiences`, `concierge_advice`, `mice_info`, `editorial_callouts`) take a new nested key — **no DDL needed**, just update the readers.
2. **Routing** — `apps/web/src/i18n/routing.ts` → add `'<xx>'` to the `locales` array. **Do not** override `prefixes` (the `as-needed` mode handles `/`, `/en/`, `/<xx>/` correctly; explicit prefixes trigger an infinite redirect loop on the default locale — see comment in `routing.ts`).
3. **Messages** — copy `apps/web/src/i18n/messages/fr.json` → `<xx>.json`. Translate every key (≈ 3 700 lines). Run `pnpm --filter @mch/web test i18n-parity` (if present) or grep both files for `JSON.parse` consistency. Keys missing in `<xx>.json` fall back to FR at runtime, but next-intl logs a warning in dev that the editorial team will flag.
4. **Hotel detail metadata** — `apps/web/src/app/[locale]/hotel/[slug]/page.tsx` `generateMetadata` → extend `alternates.languages` map with `<xx>: \`/${xx}/hotel/${slugXx}\``. Mirror the pattern in `apps/web/src/app/[locale]/hotel/[slug]/chambres/[roomSlug]/page.tsx`, `editorial-guides`, `editorial-rankings`, `destination/[city]`, and the home page. **`openGraph.locale`** also needs a matching entry (e.g. `'de_DE'`, `'it_IT'`, `'es_ES'`, `'ar_SA'`, `'zh_CN'`, `'ja_JP'`).
5. **Slug fallback** — every place that reads `slug_en` (see grep `slug_en` in `apps/web/src`) needs an `xx`-aware sibling. Pattern: `const slugXx = row.slug_<xx> ?? row.slug_fr ?? row.slug`. Do **not** fall back to the EN slug — that would crawler-leak EN slugs under the `<xx>` prefix.
6. **Sitemaps** — every route in `apps/web/src/app/sitemaps/*.xml/route.ts` (`hotels`, `rooms`, `editorial`, `hubs`, `guides`, `rankings`) emits one `<url>` per locale × slug. Add the `<xx>` branch and a `<xhtml:link rel="alternate" hreflang="<xx>">` for each existing entry. Run the `verify-sitemap.mjs` script (if present) before merging — duplicate-locale entries kill PageRank.
7. **`llms.txt`** — `apps/web/src/app/llms.txt/route.ts` currently emits FR catalogue items only. Either (a) emit a separate `/<xx>/llms.txt` route with the catalog re-translated, or (b) gate behind an `if (locale === 'fr')` and document the choice in [ADR-0011](../../../docs/adr/0011-concierge-voice.md). Option (a) is preferred for AI Overview surface in the `<xx>` market.
8. **Agent skills** — `packages/seo/src/agent-skills.ts` `DEFAULT_AGENT_SKILLS.skills[].description` are FR-only today. Either build `agent-skills-<xx>.ts` and serve it at `/<xx>/.well-known/agent-skills.json`, or extend the schema to `{ fr: '...', en: '...', <xx>: '...' }` and resolve at request time. Update the Zod schema + tests in `agent-skills.test.ts`.
9. **Hardcoded copy maps** — `apps/web/src/components/hotel/hotel-tldr.tsx` ships a `T = { fr: {...}, en: {...} }` constant. Same pattern in `apps/web/src/components/hotel/concierge-advice.tsx` defaults. Grep `'fr' as const` and `locale === 'fr'` across `apps/web/src/components/` to find all of them — each needs an `<xx>` branch.
10. **Email templates** — `packages/emails/src/templates/booking-confirmation-guest.tsx`, `email-request-guest.tsx`, `email-request-ops.tsx` ship `copy.fr` + `copy.en` only. Add `copy.<xx>`. Brevo template IDs may need to be duplicated per locale (check `packages/emails/src/brevo-client.ts`).
11. **LLM translation script** — create `scripts/editorial-pilot/src/i18n/translate-hotels-<xx>.ts` by **cloning** `translate-hotels-en.ts`. Adjust the `SYSTEM_PROMPT_BASE`: target language, register (DE = slightly more formal, IT = warmer, ES = neutral ES-ES, AR = MSA), preserve the **Concierge voice** + **≤ 25 mots/phrase** rule from ADR-0011. Run on the corpus (`--all --concurrency 4`). Budget ≈ $5-10 in gpt-4o-mini per locale for the full 106 hotels + 30 guides + 101 rankings.
12. **JSON-LD locale resolution** — `packages/seo/src/jsonld/hotel.ts` (and siblings) build `name`, `description`, `address`, `inLanguage` — they currently switch on `locale === 'fr' | 'en'`. Add the `<xx>` branch + a BCP-47 mapping (`fr-FR`, `en-GB`, `de-DE`, `it-IT`, `es-ES`, `ar-SA`, `zh-CN`, `ja-JP`). `inLanguage` must match the page locale.
13. **E2E + axe** — clone `apps/web/e2e/concierge-voice.spec.ts` and `hotel-detail.spec.ts` to add a `<xx>` describe block. Assertions hit `/<xx>/hotel/hotel-de-test-e2e-<xx>` (extend `dev-fake-hotel-detail.ts` with the synthetic translation). One axe scan per locale is mandatory — RTL locales (AR) require a separate axe scan with `dir="rtl"` set.

**Lockstep verification before merge:**

- `pnpm --filter @mch/web tsc` clean.
- `pnpm --filter @mch/web test` clean.
- Manual: open `/fr/hotel/<top-palace>`, `/en/hotel/<top-palace>`, `/<xx>/hotel/<top-palace>` and inspect the `<head>` — three identical `<link rel="alternate" hreflang>` sets (FR, EN, <xx>, x-default) on each.
- Manual: `curl https://<preview>.vercel.app/sitemaps/hotels.xml | rg "hreflang=\"<xx>\""` returns one entry per published hotel.
- Run `verify-content-stats.mjs` and check the new locale appears in the EN-equivalent rollup.

**Anti-patterns refusés:**

- Adding `'<xx>'` to `routing.locales` without DB migration → reads return `null` for narrative fields, page degrades to FR fallback silently, `<html lang="<xx>">` set but content is FR ⇒ Search Console flags duplicate content.
- Translating only `messages/<xx>.json` and leaving the editorial corpus FR → all hotel pages will pull `description_fr` fallback, hreflang lies to Google.
- Adding hreflang to one page (hotel detail) and forgetting the other piliers (rooms, guides, rankings, hubs, home) → "hreflang inconsistency" warning, the new locale never gets full PageRank flow.
- Skipping the Concierge voice adaptation in `translate-hotels-<xx>.ts` → the new locale loses the brand differentiator. Read [concierge-voice-pipeline](../concierge-voice-pipeline/SKILL.md) Rule 1 first.

### Sitemaps

- Multi-sitemap: `sitemap.xml` index pointing to:
  - `sitemap-hotels.xml` — fiche hôtel canoniques
  - `sitemap-rooms.xml` — sous-pages chambres indexables (`/hotel/[slug]/chambres/[room-slug]`)
  - `sitemap-editorial.xml` — classements, sélections, comparatifs, articles, guides
  - `sitemap-hubs.xml` — `/destination/[city]`, pages régionales
  - `sitemap-guides.xml` — guides locaux "Que faire autour" (CDC §2.12)
  - `sitemap-pois.xml` — POIs et lieux référencés (CDC §2.7) si publiés indépendamment
- `<lastmod>` ISO-8601 with timezone on **every** URL.
- Maximum 50k URLs per sub-sitemap.

### Robots

- Allow (2026 standard): `Googlebot`, `Google-Extended`, `Bingbot`, `GPTBot`, `OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`, `Perplexity-User`, `ClaudeBot`, `anthropic-ai`, `Applebot`, `Applebot-Extended`.
- Disallow: known abusive scrapers, `/api/internal/*`, `/admin/*`, `/(account)/*`, `/(booking)/*`, `/monitoring/*` (Sentry tunnel).
- Sitemap reference: `Sitemap: https://myconciergehotel.com/sitemap.xml`.

### AggregateRating mapping (CDC §2.10 vs Schema.org)

- The CDC displays a **note /10** in the UI. Schema.org `AggregateRating` accepts any `bestRating`, **but Google Rich Results always renders /5 in SERPs** — there is zero SEO value in emitting `/10`.
- **JSON-LD always emits `bestRating: '5'`** mapped from Amadeus (`/5`) or Google Places (`/5`). If UI shows `/10`, conversion is explicit (`displayed = stored × 2`) and documented next to the badge.
- Never fabricate `ratingValue` or `reviewCount`. Both must come from a vendor with `reviewCount > 0`.

### Urgency indicators (anti-pattern — CDC §2.8 refused)

- The CDC §2.8 mentions "X personnes consultent / stock restant" indicators. **We refuse them** unless the data is verifiable from Amadeus (`offer.availability: 'LimitedAvailability'` with the actual remaining count). Display "Plus que X chambres" only when sourced from a real ARI call.
- Fabricated urgency = dark pattern under EU Digital Services Act (art. 25) and French DGCCRF — DGCCRF sanctioned Booking (2020) and the EU concluded Expedia/Tripadvisor inquiry on the same grounds (2023-2024). For an IATA-licensed travel agency, this is a real legal risk.
- Documented as a hard refusal in [hotel-detail-page rule](../../rules/hotel-detail-page.mdc).

### Indexability per segment

- Marketing/editorial → `index, follow`.
- Booking tunnel + account → `noindex, nofollow`.
- Search results page (`/recherche`) → `noindex, follow` (can crawl categorical links, do not index parameterized URLs).
- Pagination/filter combos → `noindex, follow` with `rel=prev/next` deprecated; we'll rely on canonical to the unparameterized list.
- **Catalog stub fiches** (hotels published only to feed the rankings
  combinatorial matrix — see `content-modeling` §"Catalog stub fiches")
  → `noindex, follow` _server-side in `generateMetadata`_ when the
  indexability predicate fails. The page renders so deep links
  resolve, but Google does not index thin pages and the site's
  overall quality signal is preserved.

  **Predicate (May 2026 photo-ingest sprint)**:
  `hero_image IS NOT NULL AND (gallery_images_length ≥ 5 OR long_description_sections > 0)`.

  Hero image alone is **not enough** — Google Hotels rich results
  show a thumbnail strip and a fiche with one photo looks broken in
  the SERP. The 5-photo threshold matches what the photo
  orchestrator (`scripts/editorial-pilot/src/photos/sync-hotel-photos.ts`)
  can reliably pull from Wikimedia Commons + Google Places.

### Sub-sitemap exclusion contract

Sub-sitemaps **must mirror the noindex predicate, not the publish
flag**. A row marked `is_published = TRUE` but `noindex` server-side
(stub fiches, half-built rooms, archived comparatifs) is a wasted
crawl-budget URL and will trigger Search Console "Indexed, though
blocked" warnings.

The pattern in this repo:

- `listPublishedHotelSlugs()` → returns every published slug. Used by
  `generateStaticParams` so all routes are pre-rendered (404 would be
  worse than a noindex render).
- `listIndexableHotelSlugs()` → applies the **exact** predicate from
  `page.tsx#generateMetadata`. Used by
  `apps/web/src/app/sitemaps/hotels.xml/route.ts`.

**Lockstep rule** — whenever the indexability predicate evolves
(e.g. raising the photo threshold from 5 to 10), both functions
**must** be updated together. Drop a `// MUST mirror …` comment in
each one. Most index pollution incidents stem from these two going
out of sync.

Same split applies to rooms (`listIndexableRoomSlugs` should mirror
the room-page indexability check: ≥ 5 photos AND ≥ 200 words).

### Anti-cannibalisation (Excel matrix)

- `selection/lune-de-miel/` 301 → `selection/romantiques-et-lune-de-miel/`.
- `selection/ski/` 301 → `selection/montagne/`.
- `selection/plage-privee/` 301 → `selection/bord-de-mer-et-plage/`.
- `selection/thalasso/` and `selection/vignobles/` remain as **child pages** of their parents, not separate piliers.
- `classement/plus-beaux/` (esthétique) and `classement/meilleurs/` (note/service) coexist with **strongly differentiated H1 + intro**.

### Internal linking

- Bidirectional: a hotel page links to its hub, and the hub links back. No orphans.
- A `<RelatedLinks />` component requires explicit pillar/parent/children inputs to render — empty arrays trigger a build warning.
- Breadcrumbs visible + JSON-LD on every page.

### ISR contract

- Marketing/editorial revalidate per the rendering matrix (cf. `nextjs-app-router`).
- `revalidateTag('hotel:<slug>')`, `revalidateTag('editorial:<slug>')` from Payload `afterChange`.

### Redirects

- All historical 301s tracked in `redirects` table (Payload-managed) and projected into `next.config.ts` at build time.
- Redirect status is always 301 unless temporarily 302 (must be commented).

## Anti-patterns to refuse

- Returning HTML 200 from a non-existent slug ("soft 404").
- Pages with the same `<title>` and intent as another (cannibalisation).
- Missing canonical or hreflang.
- Hash-bang URLs.
- Duplicate `<h1>`.
- `noindex` inadvertently set on a marketing template.
- Room sub-page with canonical pointing to the parent hotel (would erase its own indexability).
- Fabricated urgency indicators ("X personnes consultent" without Amadeus signal).
- `bestRating: '10'` in `AggregateRating` JSON-LD (Google renders /5 anyway).
- Adding ES/DE/IT/AR/ZH/JA locales without going through the i18n roadmap (V1/V2/V3) — partial coverage is worse than honest scoping.
- **Starting V2 content production (DE/ES/IT) before clearing the 8 structural blockers** documented in §"V2 multilingual rollout — état réel". The shell is ready; the application code and DB schema are not. Activating `'de'` in `routing.locales` today produces `/de/...` URLs that render French content under `<html lang="de">` — unintentional cloaking and a SEO disaster.

## References

- CDC v3.0 §6, §8 (cursor brief).
- Excel arborescence — anti-cannibalisation sheet, GEO sheet.
- `geo-llm-optimization`, `structured-data-schema-org`, `nextjs-app-router` skills.
- [`concierge-voice-pipeline`](../concierge-voice-pipeline/SKILL.md) — voix Concierge à préserver dans les traductions DE/ES/IT (Pass 8 + ADR-0011).
- [`content-modeling`](../content-modeling/SKILL.md) — modélisation Payload des champs localisés (impacté par l'ADR-0012 si l'option B "table normalisée" est retenue).
- Rule [`seo-geo.mdc`](../../rules/seo-geo.mdc) §Rollout multilingue V2 — décrit l'objectif ; cette skill décrit l'état réel.
- [ADR-0012](../../../docs/adr/0012-multilingual-db-schema.md) — décision schéma DB multilingue (colonnes plates / table normalisée / JSONB). Status: **proposed**, recommande l'option B (table normalisée `*_translations`).
