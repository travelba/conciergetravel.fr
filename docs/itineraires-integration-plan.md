# Plan d'intégration — Feature Itinéraires SEO/GEO

> **Audience** : Cursor AI · Benjamin (oversight)
> **Repo** : [`travelba/conciergetravel.fr`](https://github.com/travelba/conciergetravel.fr) > **Référence contractuelle** : [`docs/cdc-itineraires.md`](./cdc-itineraires.md) v1.0
> **Backlog requêtes** : `itineraires_voyages_master.csv` (375 requêtes), `itineraires_voyages_seo_geo.md` (rapport 1 065+ lignes)
> **Statut cible** : Implémentable en 4 sprints Cursor · sortie production sous 3 semaines

---

## 0. TL;DR — Ce que ce document contient

1. **Diagnostic de l'existant** : ce qui est déjà posé dans le repo, ce qui manque, ce qui est cassé.
2. **3 décisions structurantes** à valider avant toute ligne de code (numérotation migration, slug `/itineraires` hub, stratégie sitemap).
3. **Plan en 4 sprints Cursor** avec dépendances, fichiers à toucher, et **prompts Cursor prêts à coller**.
4. **Mapping backlog SEO** : comment brancher les 375 requêtes du `master.csv` sur les itinéraires P0/P1 du CDC, et combler les trous (33 % des clusters du rapport ne sont pas couverts par le CDC actuel).
5. **Definition of Done par sprint** + **checklist GEO** finale.

---

## 1. Diagnostic — État du repo au 21/05/2026

### 1.1 Ce qui est déjà en place ✅

| Élément                     | Localisation                                                              | État                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| CDC complet                 | `docs/cdc-itineraires.md`                                                 | v1.0 — 515 lignes, 10 sections, 35 itinéraires P0/P1 listés                                              |
| Skill agent dédié           | `.cursor/skills/itinerary-editorial-pipeline/SKILL.md`                    | Pipeline 6 passes documenté                                                                              |
| Route détail (stub)         | `apps/web/src/app/[locale]/itineraire/[slug]/page.tsx`                    | Existe, retourne `notFound()` en attendant la table                                                      |
| Routing i18n                | `apps/web/src/i18n/routing.ts` lignes 213-214                             | `/itineraire` + `/itineraire/[slug]` enregistrés                                                         |
| Package `@mch/seo` complet  | `packages/seo/src/`                                                       | `howto`, `item-list`, `faq`, `breadcrumb`, `article`, `aeo`, `agent-skills`, `llms` — **tout est dispo** |
| Patterns réutilisables      | `apps/web/src/components/editorial/`, `apps/web/src/components/rankings/` | `enriched-text`, `toc-sidebar`, `editorial-callout`, `rankings-facets`                                   |
| Pipeline LLM voix Concierge | `.cursor/skills/concierge-voice-pipeline/SKILL.md`                        | Réutilisable directement pour les sections itinéraires                                                   |
| Tables référencées          | `hotels`, `editorial_guides`, `editorial_rankings`, `authors`             | Existantes en production Supabase                                                                        |

### 1.2 Ce qui manque ou est cassé ❌

| Manque                                                                                                                                                                     | Impact                                       | Effort           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ---------------- |
| **Migration `itineraries`**                                                                                                                                                | **Bloquant** — pas de table = pas de contenu | S                |
| **Renumérotation** : le CDC parle de `0038` mais ce numéro est déjà pris (`0038_hotels_source_layering.sql`). Dernière migration = `0044`. À nommer `0045_itineraries.sql` | Documentation à corriger                     | XS               |
| **Hub `/itineraires`** (FR) et `/itineraries` (EN)                                                                                                                         | Pas de page index = pas d'autorité topique   | M                |
| Routing i18n EN — pathname `/itineraries` pour EN manquant                                                                                                                 | Lien EN cassé                                | XS               |
| Page détail désactivée (`notFound()` inconditionnel)                                                                                                                       | Aucun itinéraire affichable                  | M                |
| Composants UI : `<ItinerarySteps>`, `<ItineraryHotelCard>`, `<ItineraryAeoBlock>`, `<RelatedItineraries>`                                                                  | Composants à créer                           | M                |
| Skills agent `get-itinerary` + `list-itineraries` dans `packages/seo/src/agent-skills.ts`                                                                                  | GEO incomplet                                | XS               |
| Section `## Itinéraires` dans `llms.txt` et `llms-full.txt` (routes existantes)                                                                                            | LLM crawlers ignorent la section             | S                |
| Sitemap `/sitemaps/itineraries.xml` + référence dans `/sitemap.xml/route.ts`                                                                                               | URL non découvrables                         | S                |
| Server queries : `getItineraryBySlug`, `listPublishedItineraries`, `getRelatedItineraries` dans `apps/web/src/server/itineraries/`                                         | Dossier inexistant                           | M                |
| Type Zod + Drizzle schema                                                                                                                                                  | Aucune validation à l'import                 | S                |
| Seed SQL P0 (10 France + 10 International)                                                                                                                                 | Aucun contenu                                | L (LLM pipeline) |
| Maillage entrant : guides pays + fiches hôtels + nav principale                                                                                                            | Page orpheline si non câblé                  | M                |
| Cluster `trains-de-luxe` et `croisières luxe` (quick wins identifiés rapport SEO) **non couverts** par les 35 itinéraires CDC                                              | Manque de couverture stratégique             | M                |

### 1.3 Décisions structurantes à acter (3)

| #   | Décision                | Recommandation                                                                        | Raison                                                                |
| --- | ----------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| D1  | **Numéro de migration** | `0045_itineraries.sql` (pas `0038`)                                                   | `0038` déjà appliqué — règle AGENTS.md §4.5 "Migrations forward-only" |
| D2  | **Slug hub FR**         | Garder `/itineraires` (pluriel) cohérent avec `/guides`, `/classements`, `/hotels`    | Cohérence d'arborescence                                              |
| D3  | **Stratégie sitemap**   | Créer un sitemap dédié `/sitemaps/itineraries.xml` plutôt qu'enrichir `editorial.xml` | Volume cible 100+ URLs, séparation = monitoring GSC plus clair        |

---

## 2. Architecture — Couches & dépendances

Respect strict des layers définis dans `AGENTS.md §2` :

```
┌────────────────────────────────────────────────────────────────────┐
│ apps/web                                                           │
│  └── [locale]/itineraires/page.tsx     (hub — SSG + revalidate)    │
│  └── [locale]/itineraire/[slug]/page.tsx (fiche — ISR 3600)        │
│  └── components/itineraries/ (5 nouveaux components RSC)           │
│  └── server/itineraries/ (getBySlug, list, getRelated)             │
│       ↓                                                            │
│ packages/seo  ← jsonld/howto, item-list, faq, agent-skills, llms   │
│ packages/db   ← migration 0045 + Drizzle schema itineraries        │
│ packages/domain ← Zod ItinerarySchema + business rules pures       │
│ packages/ui     ← réutiliser shadcn Card, Badge, Accordion         │
└────────────────────────────────────────────────────────────────────┘
```

**Règles non négociables** rappelées (AGENTS.md §4) :

- Pas de `any`, `as Foo`, `!`
- `dangerouslySetInnerHTML` uniquement via `<JsonLdScript>` (CSP-nonce)
- Server Components par défaut — `'use client'` uniquement si interactivité réelle (filtres hub)
- i18n keys, jamais de strings en dur
- Une seule `Sentry.init` par runtime
- Migration forward-only, pas de réédition

---

## 3. Sprints — Plan détaillé

### Sprint 1 — Fondations DB + Domaine (3-4 jours)

#### Tickets

| ID   | Titre                                              | Fichier(s)                                                | Effort |
| ---- | -------------------------------------------------- | --------------------------------------------------------- | ------ |
| S1.1 | Migration `0045_itineraries.sql`                   | `packages/db/migrations/0045_itineraries.sql`             | S      |
| S1.2 | Drizzle schema `itineraries`                       | `packages/db/src/schema/itineraries.ts`                   | S      |
| S1.3 | Zod `ItinerarySchema` + types `Section`, `FaqItem` | `packages/domain/src/itineraries/schema.ts`               | M      |
| S1.4 | Server queries (3)                                 | `apps/web/src/server/itineraries/` (3 fichiers)           | M      |
| S1.5 | Tests Vitest queries + Zod                         | `*.test.ts` colocalisés                                   | S      |
| S1.6 | Skills agent `get-itinerary` + `list-itineraries`  | `packages/seo/src/agent-skills.ts` (DEFAULT_AGENT_SKILLS) | XS     |
| S1.7 | Tests `agent-skills.test.ts` étendus               | `packages/seo/src/agent-skills.test.ts`                   | XS     |

#### Prompt Cursor — S1.1

```
Crée le fichier `packages/db/migrations/0045_itineraries.sql` à partir
de la spécification SQL du §2.1 de `docs/cdc-itineraires.md`.

Contraintes strictes :
- Numéro de migration : 0045 (PAS 0038 — ce numéro est déjà appliqué).
- Conserver tous les checks, index, RLS policies tels que spécifiés.
- Ajouter un commentaire d'en-tête référençant le CDC.
- Vérifier que la fonction `set_updated_at()` existe bien (elle est définie
  dans les migrations antérieures, ne pas la redéfinir).
- Aucune modification des migrations antérieures (forward-only — AGENTS.md §4.5).

Après création :
- Lancer `pnpm --filter @mch/db migrate` localement contre Supabase.
- Vérifier `\d public.itineraries` et la présence des 5 index + trigger + 2 policies RLS.
- Mettre à jour `docs/cdc-itineraires.md` §2.1 pour remplacer "Migration 0038"
  par "Migration 0045" (commentaire SQL + titre).
```

#### Prompt Cursor — S1.3 / S1.4 (combiné)

```
Crée le domaine `itineraries` :

1. `packages/domain/src/itineraries/schema.ts` :
   - `ItinerarySectionZod` (step, title_fr/en, body_fr/en, hotel_id?, duration_days, city, poi[])
   - `ItineraryFaqItemZod` (q_fr, a_fr, q_en?, a_en?)
   - `ItineraryZod` complet en miroir de la table (Drizzle row → Zod row)
   - Helpers purs : `getTotalDuration(itinerary)`, `getStepHotelIds(itinerary)`,
     `validateMinimumWordCount(itinerary, target=2000)`
   - Pas d'I/O dans ce module (règle AGENTS.md §2 — domain pure)

2. `apps/web/src/server/itineraries/` :
   - `get-itinerary-by-slug.ts` → `getItineraryBySlug(slug, locale)` avec `unstable_cache`,
     tags `[itinerary-${slug}, itineraries-hub, itinerary-${country}]`,
     retourner un Record et NON pas une Map (rappel CDC §3.3 — hotfix 4d02187).
   - `list-published-itineraries.ts` → `listPublishedItineraries(filters: {country?, theme?, durationDays?, travelStyle?, season?, limit?, offset?})`
   - `get-related-itineraries.ts` → `getRelatedItineraries(itinerary, limit=4)` :
     même destination_country en priorité, puis même travel_style, puis même
     season ; exclure l'itinéraire courant.

3. Tests Vitest colocalisés :
   - Zod accepte/refuse les shapes attendus
   - Queries retournent Record (regression test sur le hotfix Map→Record)
   - getRelatedItineraries respecte l'ordre de priorité

Standards :
- TypeScript strict, pas de `any`/`as`/`!`
- Imports tirés via `@mch/db`, `@mch/domain`, `@/i18n/runtime`
- Pas d'import croisé layer (domain ne tire jamais next/* ni @supabase/*)
```

#### Prompt Cursor — S1.6

```
Ajoute deux skills agents dans `packages/seo/src/agent-skills.ts` >
`DEFAULT_AGENT_SKILLS.skills`, conformément au CDC §6.1 :

- `get-itinerary` : récupérer un itinéraire par son slug + locale
- `list-itineraries` : lister par destination, travel_style, duration_days, locale

Inputs en miroir exact du CDC. Mettre à jour `packages/seo/src/agent-skills.test.ts`
pour valider la présence des 2 nouveaux skills + leur shape Zod.

⚠️ Ne pas reformuler les descriptions du CDC — elles ont été optimisées
pour le rappel par les LLM. Copier mot pour mot.

Vérifier que `apps/web/src/app/.well-known/agent-skills.json/route.ts`
expose bien `DEFAULT_AGENT_SKILLS` sans transformation (sinon les nouveaux
skills n'apparaîtront pas en production).
```

#### DoD Sprint 1

- [ ] Migration appliquée en local + Supabase staging (`fsmfozxgujskluxakeoq`)
- [ ] `pnpm typecheck` passe sur tout le monorepo
- [ ] `pnpm test --filter @mch/domain --filter @mch/seo` vert
- [ ] `curl /.well-known/agent-skills.json | jq '.skills[].name'` contient `get-itinerary` et `list-itineraries`
- [ ] Aucune migration antérieure modifiée (`git diff packages/db/migrations/004[0-4]*` vide)

---

### Sprint 2 — Routes + UI (5-6 jours)

#### Tickets

| ID    | Titre                                                                  | Fichier(s)                                             | Effort |
| ----- | ---------------------------------------------------------------------- | ------------------------------------------------------ | ------ |
| S2.1  | Routing i18n EN — pathnames `/itineraires` + `/itinerary/[slug]`       | `apps/web/src/i18n/routing.ts`                         | XS     |
| S2.2  | Hub `/[locale]/itineraires/page.tsx`                                   | nouveau dossier `itineraires/`                         | M      |
| S2.3  | Composant `<ItineraryCard>` (carte hub + maillage)                     | `components/itineraries/itinerary-card.tsx`            | S      |
| S2.4  | Composant `<ItineraryFacets>` (filtres hub)                            | `components/itineraries/itinerary-facets.tsx` (client) | M      |
| S2.5  | Page détail réelle (remplacer `notFound()`)                            | `apps/web/src/app/[locale]/itineraire/[slug]/page.tsx` | M      |
| S2.6  | Composants détail (4)                                                  | `components/itineraries/`                              | L      |
| S2.7  | JSON-LD wiring (HowTo + ItemList + FAQPage + BreadcrumbList + Article) | dans `page.tsx` détail                                 | M      |
| S2.8  | `generateMetadata` + canonical + hreflang                              | dans `page.tsx` détail                                 | S      |
| S2.9  | Strings i18n FR + EN                                                   | `i18n/messages/{fr,en}.json`                           | S      |
| S2.10 | E2E Playwright — `itinerary-detail.spec.ts`                            | `apps/web/e2e/`                                        | M      |

#### Détail composants à créer

```
apps/web/src/components/itineraries/
├── itinerary-card.tsx           (RSC — carte cliquable)
├── itinerary-facets.tsx         (Client — filtres destination/durée/style)
├── itinerary-aeo-block.tsx      (RSC — wrapper buildAeoBlock + data-aeo)
├── itinerary-steps.tsx          (RSC — itération sections JSONB → HowToStep visuels)
├── itinerary-hotel-card.tsx     (RSC — lien fiche hôtel + CTA)
├── itinerary-faq.tsx            (RSC + <details> natif, premier item open)
└── related-itineraries.tsx      (RSC — 2-4 itinéraires similaires)
```

#### Prompt Cursor — S2.2 (hub)

```
Crée la page hub `apps/web/src/app/[locale]/itineraires/page.tsx` :

Spécification (cf. CDC §4.1) :
- Rendering : SSG avec `revalidate = 86400`
- Server Component (pas de 'use client')
- H1 : `t('itineraries.hub.h1')` — "Itinéraires de voyage | Palaces & Hôtels 5★"
- Sections :
  1. `<FeaturedItineraries>` — 6 itinéraires priority='P0' triés `last_updated DESC`
  2. `<ItineraryFacets>` (client) — destination / theme / duration / season
  3. Grid `<ItineraryCard>` paginé (24 par page)
- JSON-LD : `CollectionPage` + `ItemList` (helpers déjà dans @mch/seo)
- Breadcrumbs : Accueil > Itinéraires
- Metadata :
  - title : "Itinéraires de voyage — Palaces & Hôtels 5★ | MyConciergeHotel"
  - description : 140-160 chars, voix Concierge
  - canonical : URL complète /fr/itineraires (resp. /en/itineraries)
  - alternates.languages : fr-FR, en, x-default

⚠️ Avant tout, mettre à jour `apps/web/src/i18n/routing.ts` pathnames :
'/itineraires': { fr: '/itineraires', en: '/itineraries' },
(actuellement défini en string simple ligne 213, à passer en objet locale-aware)

Source des données : appeler `listPublishedItineraries({ limit: 100 })` du sprint 1.
Ajouter les i18n keys dans `messages/fr.json` ET `messages/en.json`.

Tests E2E à ajouter dans `apps/web/e2e/itineraries-hub.spec.ts` :
- Page charge avec 200, H1 présent, ≥ 6 cartes, breadcrumb OK, lien vers ≥ 1 fiche
```

#### Prompt Cursor — S2.5/S2.6/S2.7 (fiche détail — gros morceau)

```
Réécris `apps/web/src/app/[locale]/itineraire/[slug]/page.tsx` :
- Supprimer le `notFound()` inconditionnel
- Implémenter la fiche complète selon CDC §4.2 + §5

Spec :
- `export const revalidate = 3600`
- Server Component (le détail est SSG-ISR)
- `force-dynamic` interdit ici (sauf si CSP-nonce JSON-LD impose — cf. .cursor/skills/structured-data-schema-org/SKILL.md ; si force-dynamic requis, expliquer pourquoi dans le commentaire haut de page)
- Appel `getItineraryBySlug(slug, locale)` ; si null → `notFound()`
- Si `status !== 'published'` ET pas d'auth admin → `notFound()`

Composition (ordre exact CDC §4.2) :
1. <Hero> avec hero_cloudinary_id + badges (durée / thème / saison)
2. <ItineraryAeoBlock> — wrapper buildAeoBlock + <section data-aeo aria-labelledby="aeo-heading"> visible DOM
3. <Intro> — render intro_fr/en (chapeau Concierge 150-200 mots)
4. <ItinerarySteps> — itération sections JSONB ; chaque step = <article> avec H2 "Jour X-Y · {city}", body, <ItineraryHotelCard> si hotel_id
5. <HotelSelectionPanel> — récap des hotel_ids[] avec prix Amadeus si dispo
6. <RelatedRankings> ≥ 2 (related_ranking_ids)
7. <RelatedGuides> ≥ 1 (related_guide_slugs)
8. <RelatedItineraries> ≥ 2 (related_itinerary_slugs OU fallback getRelatedItineraries)
9. <ItineraryFaq> 8-15 Q&A, premier item <details open>
10. <LastUpdatedBadge>

JSON-LD à émettre via <JsonLdScript> (jamais <script> inline — règle 8 AGENTS.md) :
- HowTo (helper @mch/seo déjà existant — packages/seo/src/jsonld/howto.ts)
- ItemList des hôtels
- FAQPage
- BreadcrumbList : Accueil > Itinéraires > {Titre}
- Article (datePublished=created_at, dateModified=last_updated, author)

generateMetadata :
- title : meta_title_{locale} || `${title_{locale}} — MyConciergeHotel`
- description : meta_desc_{locale} (140-160 chars)
- alternates.canonical : URL complète locale-aware
- alternates.languages : fr-FR (slug_fr), en (slug_en), x-default
- openGraph.images : [{ url: cloudinaryUrl(hero_cloudinary_id, 'og') }]
- robots : { index: status==='published', follow: status==='published' }

Composants à créer dans `apps/web/src/components/itineraries/` :
- itinerary-aeo-block.tsx
- itinerary-steps.tsx (itération sections + render markdown body via EnrichedText réutilisable)
- itinerary-hotel-card.tsx (lien /hotel/{slug} + CTA réservation)
- related-itineraries.tsx
- itinerary-faq.tsx (premier item <details open>)

Tests E2E `apps/web/e2e/itineraries-detail.spec.ts` :
- Charge un slug seed, valide :
  * H1 présent
  * AEO block visible (data-aeo)
  * ≥ N steps (selon seed)
  * ≥ 8 FAQ items
  * JSON-LD HowTo détecté + valide (Rich Results offline check)
  * Breadcrumb avec 3 niveaux
  * Lien ancré ≥ 1 hôtel, ≥ 2 classements, ≥ 1 guide
  * Canonical = URL courante (pas /classement/, pas /guide/)
- Mobile + desktop viewport
```

#### Prompt Cursor — S2.9 (i18n)

```
Ajoute toutes les clés i18n pour la feature itinéraires dans
`apps/web/src/i18n/messages/fr.json` et `messages/en.json`.

Sections requises :
- `itineraries.hub.*` (h1, intro, no-results, load-more)
- `itineraries.facets.*` (destination, theme, duration, season, reset)
- `itineraries.card.*` (badge.duration, badge.season, cta)
- `itineraries.detail.*` (intro-label, hotels-recap, related-rankings,
  related-guides, related-itineraries, faq-title, last-updated)
- `itineraries.aeo.heading` (libellé du h2 du bloc AEO)
- `breadcrumbs.itineraries` (libellé "Itinéraires" / "Itineraries")

Naming kebab-case + namespace `itineraries.*` pour éviter collisions
avec `editorial.*` ou `guides.*`. Vérifier que le test
`runtime.test.ts` passe — il valide la complétude des clés FR ↔ EN.
```

#### DoD Sprint 2

- [ ] `pnpm dev` → `/fr/itineraires` charge en 200, ≥ 1 carte (placeholder OK si pas encore de seed)
- [ ] `/fr/itineraire/{slug-seed}` charge fiche complète une fois un seed P0 inséré
- [ ] Google Rich Results Test → HowTo + FAQPage valides sur 3 fiches
- [ ] Lighthouse SEO ≥ 95 mobile + desktop
- [ ] E2E vert (`pnpm test:e2e --filter @mch/web -- itineraries`)
- [ ] Canonical strict locale, hreflang FR↔EN bidirectionnel
- [ ] 0 string en dur (toutes les copies passent par `t()`)

---

### Sprint 3 — Maillage + GEO + Sitemaps (3 jours)

#### Tickets

| ID   | Titre                                                   | Fichier(s)                                           | Effort |
| ---- | ------------------------------------------------------- | ---------------------------------------------------- | ------ |
| S3.1 | Sitemap `/sitemaps/itineraries.xml`                     | `apps/web/src/app/sitemaps/itineraries.xml/route.ts` | S      |
| S3.2 | Référence dans sitemap index                            | `apps/web/src/app/sitemap.xml/route.ts`              | XS     |
| S3.3 | Section itinéraires dans `llms.txt`                     | `apps/web/src/app/llms.txt/route.ts`                 | S      |
| S3.4 | Entrées dans `llms-full.txt`                            | `apps/web/src/app/llms-full.txt/route.ts`            | M      |
| S3.5 | Bloc "Nos itinéraires pour [Pays]" sur guides pays      | `components/editorial/*` (à intégrer)                | M      |
| S3.6 | Widget "Cet hôtel dans nos itinéraires" sur fiche hôtel | `components/hotel/*`                                 | M      |
| S3.7 | Lien "Itinéraires" dans navigation principale           | `components/layout/*`                                | S      |
| S3.8 | OnAir cache invalidation tags                           | côté Payload hook                                    | S      |

#### Prompt Cursor — S3.1

```
Crée `apps/web/src/app/sitemaps/itineraries.xml/route.ts` calqué sur
`apps/web/src/app/sitemaps/rankings.xml/route.ts` (même pattern force-static
+ revalidate 3600 + helper `buildSitemapXml` de @mch/seo).

Contenu :
- Lister toutes les itineraries `status = 'published'` via une query helper
  `listPublishedItinerarySlugs()` à créer dans `apps/web/src/server/itineraries/`.
- Émettre 2 URLs par itinéraire : `/fr/itineraire/{slug_fr}` et `/en/itinerary/{slug_en}` (si slug_en présent)
- `<lastmod>` = `last_updated` ISO-8601
- `<changefreq>` = `monthly`
- `<priority>` : 0.9 si P0, 0.8 si P1, 0.7 si P2, 0.6 si P3

Puis modifier `apps/web/src/app/sitemap.xml/route.ts` pour ajouter
l'entrée `{ loc: `${origin}/sitemaps/itineraries.xml`, lastmod: now }`
dans le tableau buildSitemapIndexXml.

Tests :
- snapshot test XML
- Vérifier > 0 URLs après seed sprint 4
```

#### Prompt Cursor — S3.3/S3.4 (llms.txt + llms-full.txt)

```
Dans `apps/web/src/app/llms.txt/route.ts` :
- Ajouter une section "## Itinéraires de voyage — Palaces & Hôtels 5★"
- Lister tous les itinéraires publiés (`listPublishedItineraries({ limit: 200 })`)
- Format : 2 lignes par itinéraire (FR + EN)
  `${origin}/fr/itineraire/${slug_fr} — ${title_fr} (${duration_days}j, ${travel_style})`
- Préserver l'ordre P0 → P1 → P2 → P3 (déjà respecté par le tri en DB)

Dans `apps/web/src/app/llms-full.txt/route.ts` :
- Pour chaque itinéraire P0 uniquement (top quality), émettre un `LlmsFullTxtPage` :
  * title : title_fr complet
  * url : URL canonique FR
  * summary : intro_fr tronquée 200 mots (helper `truncateWords`)
  * keyFacts : [
      `Durée : ${duration_min_days}-${duration_max_days || duration_min_days} jours`,
      `Destination : ${destination_country}${region ? ' · '+region : ''}`,
      `Hôtels : ${hotel_ids.length} Palace${hotel_ids.length>1?'s':''}/5★ sélectionnés`,
      `Thèmes : ${themes.join(', ')}`,
      `Saison idéale : ${season || 'toute saison'}`,
    ]
  * updatedAt : last_updated

Ne pas faire crasher la route si la table itineraries est vide (catch + skip,
même pattern que listPublishedHotelSummaries — cf. fichier existant).
```

#### Prompt Cursor — S3.5/S3.6 (maillage entrant)

```
Maillage entrant — deux composants à câbler :

A) Guides pays — sur `apps/web/src/app/[locale]/guide/[citySlug]/page.tsx` :
   - Après le bloc principal, insérer `<RelatedItinerariesForCountry country={guide.destination_country} />`
   - Le composant `RelatedItinerariesForCountry` requête `listPublishedItineraries({ country, limit: 6 })`
   - Si 0 résultats → ne rien rendre (pas de bloc vide)
   - Lien interne avec anchor = title_fr

B) Fiches hôtel — sur `apps/web/src/app/[locale]/hotel/[slug]/page.tsx` :
   - Nouveau widget `<HotelInItineraries hotelId={hotel.id} />`
   - Requête : `listPublishedItineraries({ hotelId: hotel.id, limit: 4 })`
     → étendre `list-published-itineraries.ts` pour accepter un filtre `hotelId`
     qui matche `hotel_ids @> ARRAY[$1::uuid]`
   - Position : juste avant la section "Conseil du Concierge" pour booster la conversion
   - Si 0 résultats → ne rien rendre

C) Navigation principale — `components/layout/` :
   - Ajouter un lien "Itinéraires" dans le menu desktop ET mobile
   - Réutiliser le pattern CSS-only dropdown du commit ab79771 (voir l'historique git)
   - Position : entre "Classements" et "Guides" (cohérence du parcours éditorial)

Anti-cannibalisation (cf. CDC §5.5) :
- Le bloc sur la fiche hôtel ne reprend JAMAIS la description_fr de l'hôtel
- Le bloc sur le guide pays ne reprend JAMAIS le contenu du guide
- Anchor texts = titres exacts (pas "cliquez ici", pas "voir plus")
```

#### DoD Sprint 3

- [ ] `/sitemaps/itineraries.xml` valide W3C, listé dans sitemap index
- [ ] `/llms.txt` contient section itinéraires (curl + grep)
- [ ] `/llms-full.txt` contient ≥ 1 entrée par itinéraire P0
- [ ] Guide pays Japon, Italie, Maroc affichent le bloc itinéraires
- [ ] 3 fiches hôtels P0 (Le Bristol, Plaza Athénée, Cap Eden-Roc) affichent leur widget itinéraires
- [ ] Nav principale FR + EN contient le lien (E2E)
- [ ] GSC submission du nouveau sitemap (action manuelle, hors code)

---

### Sprint 4 — Contenu P0 + Pipeline LLM (5-7 jours)

#### Tickets

| ID   | Titre                                                          | Effort |
| ---- | -------------------------------------------------------------- | ------ |
| S4.1 | Adapter pipeline `concierge-voice-pipeline` → seed itineraries | M      |
| S4.2 | Briefs JSON pour les 20 itinéraires P0 (10 FR + 10 INTL)       | L      |
| S4.3 | Génération automatisée (GPT-4o → validation → seed SQL)        | L      |
| S4.4 | Audit AEO word count + voix Concierge                          | M      |
| S4.5 | QA éditoriale humaine (Benjamin) sur les 20 P0                 | L      |
| S4.6 | Seed production via Supabase MCP                               | S      |

#### P0 — Source de vérité

Les 20 P0 sont définis dans CDC §7 (matrice 35 items P0/P1 — prendre les 20 premiers par ordre de priorité business).

**Couverture par cluster du rapport SEO** (croisement entre CDC §7 et `itineraires_voyages_master.csv`) :

| Cluster master.csv      | Couvert par CDC P0/P1 ?                                                | Action                                       |
| ----------------------- | ---------------------------------------------------------------------- | -------------------------------------------- |
| Japon (34 requêtes)     | ✅ Oui — `japon-culture-2-semaines`, `japon-luxe-7-jours`              | Conserver                                    |
| Safari (23)             | ✅ Partiel — `safari-kenya-afrique-du-sud`, `tanzanie-safari-zanzibar` | Conserver + ajouter Botswana                 |
| Méditerranée (23)       | ✅ Partiel — `cote-d-azur-luxe-7-jours`, `grece-iles-couple-10-jours`  | Conserver                                    |
| Maldives (20)           | ✅ Oui — `maldives-luxe-7-jours`                                       | Conserver                                    |
| Asie SE (19)            | ✅ Partiel — Bali, Vietnam, Thaïlande couverts                         | Ajouter Cambodge + Laos en P2                |
| **Trains de luxe (17)** | ❌ **Non couvert**                                                     | **Backlog P1 à créer** (cf. §4 ci-dessous)   |
| Multi-destinations (16) | ✅ Partiel                                                             | Conserver                                    |
| Croisière (14)          | ❌ **Non couvert**                                                     | **Backlog P2 — Méditerranée yacht, Norvège** |

⚠️ **Décision à acter** : ajouter au backlog 4 itinéraires P1 supplémentaires non listés au CDC v1.0 :

- `train-orient-express-paris-venise` (cluster trains de luxe — quick win identifié)
- `train-maharajas-express-rajasthan` (idem)
- `croisiere-yacht-mediterranee-luxe` (cluster croisière — quick win)
- `botswana-okavango-safari-luxe` (gap Afrique)

#### Prompt Cursor — S4.1 (pipeline)

```
Adapte le pipeline `concierge-voice-pipeline` pour générer du contenu
itinéraires conforme à `.cursor/skills/itinerary-editorial-pipeline/SKILL.md`.

Crée `scripts/editorial-pilot/itineraries/` :
- `briefs/` — un .json par itinéraire P0 (cf. structure ci-dessous)
- `generate-itinerary.mjs` — pipeline 6 passes du skill
- `validate-itinerary.mjs` — checks word count, AEO 40-80 mots,
  ≥ 8 FAQ, ≥ N steps avec body ≥ 150 mots
- `seed-itineraries.sql` — fichier généré

Structure d'un brief JSON :
{
  "slug_fr": "japon-luxe-7-jours",
  "slug_en": "japan-luxury-7-days",
  "destination_country": "Japon",
  "destination_city": "Tokyo, Kyoto",
  "themes": ["luxe", "culture", "gastronomie"],
  "duration_min_days": 7,
  "travel_style": "luxe",
  "season": "printemps",
  "hotel_slugs": ["aman-tokyo", "park-hyatt-kyoto"],
  "related_guide_slugs": ["guide-japon"],
  "related_ranking_slugs": ["meilleurs-hotels-tokyo"],
  "priority": "P0",
  "target_word_count": 2200
}

Le générateur :
1. Hydrate les hotel_ids depuis hotel_slugs (lookup Supabase)
2. Hydrate related_ranking_ids depuis related_ranking_slugs
3. Pipeline 6 passes du skill (Brief → Slug/Meta → AEO FR → AEO EN → Sections → FAQ)
4. Validation AEO via `buildAeoBlock` de @mch/seo
5. Validation longueur sentences ≤ 25 mots (helper `check-sentence-length.mjs` existant)
6. Validation anti-traduction littérale (helper `compare-fr-en-divergence.mjs` à
   créer sur le modèle de `detect-yonder-duplicates.mjs`)
7. Output : insert SQL idempotent (ON CONFLICT slug_fr DO UPDATE)

Réutiliser massivement :
- llm-output-robustness/SKILL.md (extraction JSON + Zod)
- concierge-voice-pipeline/SKILL.md (voix, shortener, pass 8)
- editorial-rankings-matrix/SKILL.md (combinator pattern si batch)
```

#### Briefs P0 — Liste exacte (20 items)

À créer dans `scripts/editorial-pilot/itineraries/briefs/` :

**France (10)** :

1. `paris-luxe-3-jours.json`
2. `cote-d-azur-luxe-7-jours.json`
3. `provence-culture-gastronomie-10-jours.json`
4. `bordeaux-vignobles-gastronomie-5-jours.json`
5. `megeve-ski-luxe-5-jours.json`
6. `saint-tropez-ete-5-jours.json`
7. `reims-champagne-week-end.json`
8. `paris-lune-de-miel.json`
9. `lyon-gastronomie-3-jours.json`
10. `biarritz-pays-basque-5-jours.json`

**International (10)** : 11. `japon-culture-2-semaines.json` 12. `japon-luxe-7-jours.json` 13. `bali-lune-de-miel-10-jours.json` 14. `maldives-luxe-7-jours.json` 15. `toscane-gastronomie-7-jours.json` 16. `maroc-culture-10-jours.json` 17. `safari-kenya-afrique-du-sud.json` 18. `new-york-luxe-5-jours.json` 19. `dubai-luxe-week-end.json` 20. `train-orient-express-paris-venise.json` ← **ajout cluster manquant**

#### DoD Sprint 4

- [ ] 20 itinéraires P0 status='published' en production Supabase
- [ ] 20 fiches accessibles, JSON-LD valide Rich Results Test
- [ ] Audit `audit-itineraries.mjs` vert (word count, voix, AEO, FAQ)
- [ ] Sitemap itineraries.xml liste ≥ 20 URLs
- [ ] llms.txt + llms-full.txt rechargés
- [ ] Lighthouse ≥ 95 SEO sur 5 fiches échantillonnées

---

## 4. Backlog post-MVP — Mapping requêtes master.csv → itinéraires

Le `itineraires_voyages_master.csv` contient 375 requêtes priorisées. Une fois les 20 P0 publiés, lancer la phase d'expansion.

### 4.1 Algorithme de génération du backlog P1/P2

```
1. Charger master.csv
2. Pour chaque cluster (Japon, Safari, Maldives, Trains-luxe, …) :
   - Identifier la requête "tête" (volume estimé le plus élevé)
   - Identifier 3-5 requêtes "longue traîne" associées (mêmes destination + variantes durée/style/saison)
3. Générer 1 itinéraire par tête de cluster non encore couverte
4. Pour chaque itinéraire, intégrer les requêtes longue traîne en FAQ
   (cf. CDC §8 — Catégories de FAQ patterns)
```

### 4.2 Cibles quantitatives 6 mois

| Tranche               | Volume                                                    | Sprint       |
| --------------------- | --------------------------------------------------------- | ------------ |
| P0 (publié)           | 20                                                        | Sprint 4     |
| P1 (à publier mois 2) | 30 (15 France + 15 INTL)                                  | Sprint 5     |
| P2 (mois 3-4)         | 50 (combinés multi-destinations + variantes saisonnières) | Sprints 6-7  |
| P3 (mois 5-6)         | 100+ (longue traîne)                                      | Sprints 8-12 |

**Total 6 mois : 200 itinéraires publiés** = couverture quasi-complète des 375 requêtes master.csv (1 itinéraire absorbe en moyenne 2 requêtes via les FAQ).

### 4.3 Clusters strategiques à intégrer en P1 (non listés CDC v1.0)

À ajouter dans CDC v1.1 :

| Cluster                                                                 | Itinéraires à créer                                                                                         |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Trains de luxe** (gap GEO majeur — quasi-désert FR)                   | Orient Express Paris-Venise, Maharajas Express Rajasthan, Rocky Mountaineer Canada, Belmond Andean Explorer |
| **Croisières luxe**                                                     | Yacht Méditerranée 7j, Norvège fjords luxe, Antarctique expédition Silversea, Galápagos National Geographic |
| **Comparatifs honeymoon** (format chouchou des IA — Perplexity/ChatGPT) | Maldives vs Polynésie, Bali vs Phuket, Seychelles vs Maurice, Santorini vs Capri                            |
| **Wellness retraite**                                                   | Bali wellness 7j, Kerala Ayurveda 14j, Koh Samui retraite, Suisse alpine bien-être                          |
| **Multi-destinations combo**                                            | Vietnam+Cambodge, Tanzanie+Zanzibar, Pérou+Bolivie, Maroc+Sahara                                            |

---

## 5. GEO — Stratégie spécifique LLM citation

### 5.1 Pourquoi cela fonctionne (vs concurrence)

- **`agent-skills.json`** déjà exposé → mécaniquement supérieur à 99% des sites voyage qui ne l'ont pas
- **`llms.txt` + `llms-full.txt`** déjà servis → ChatGPT Search, Perplexity, Claude indexent en priorité
- **Voix Concierge** = signal d'autorité unique non reproductible par les agrégateurs
- **JSON-LD HowTo** sur chaque itinéraire = format préféré des LLM pour citer step-by-step

### 5.2 Formats de réponse à privilégier dans le contenu

D'après le rapport SEO précédent (section "Stratégie GEO") :

| Format                                             | Quand l'utiliser           | Bénéfice GEO                       |
| -------------------------------------------------- | -------------------------- | ---------------------------------- |
| Réponse directe en 1 phrase (AEO 40-80 mots)       | En tête de page            | Citation Perplexity / ChatGPT      |
| Tableau jour-par-jour                              | Section `<ItinerarySteps>` | Extraction Google/Bing AI Overview |
| FAQ 8-15 Q&A `<details>`                           | Bas de page                | Featured snippet + LLM Q&A         |
| Données chiffrées (km, jours, °C, prix indicatifs) | Body sections              | Trust signal LLM                   |
| Sources nommées (Atout France, Michelin, Routard)  | Footer + inline            | E-E-A-T                            |
| LastUpdated badge visible                          | Header fiche               | Freshness signal                   |

### 5.3 Robots.txt — vérifier que ces bots sont autorisés

```
User-agent: GPTBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Applebot-Extended
Allow: /
```

→ À vérifier dans `apps/web/src/app/robots.txt/route.ts` avant la mise en prod du Sprint 2.

---

## 6. Checklist transverse pré-prod

### 6.1 Sécurité

- [ ] RLS policies `itineraries_public_read` et `itineraries_staff_all` actives
- [ ] Pas de PII dans logs (slugs OK, pas d'IDs utilisateur)
- [ ] CSP-nonce respecté sur tous les JSON-LD (helper `<JsonLdScript>`)
- [ ] Pas de `dangerouslySetInnerHTML` ailleurs

### 6.2 Performance

- [ ] `revalidate = 86400` sur hub, `3600` sur fiche détail
- [ ] Images hero via Next.js Image + Cloudinary (`q_auto,f_auto`)
- [ ] LCP < 2.5s mobile (Vercel Speed Insights après seed)
- [ ] INP < 200ms (les filtres facettes en client n'ont qu'une interaction)

### 6.3 Observabilité

- [ ] Logger `pino` sur les 3 server queries
- [ ] Sentry instrument sur la route détail (catch + report)
- [ ] Vercel Analytics tracking sur `/itineraires/*`

### 6.4 SEO technique

- [ ] Canonical strict par locale
- [ ] Hreflang bidirectionnel FR↔EN + x-default
- [ ] Sitemap dédié référencé dans sitemap index
- [ ] Pas de noindex sur les pages publiées
- [ ] Breadcrumb avec schema BreadcrumbList

### 6.5 GEO

- [ ] `agent-skills.json` expose 2 nouveaux skills
- [ ] `llms.txt` liste les URLs itinéraires
- [ ] `llms-full.txt` contient les keyFacts P0
- [ ] AEO block présent et validé sur 100% des fiches
- [ ] LastUpdated visible

---

## 7. Risques + mitigation

| Risque                                                                            | Probabilité           | Impact                         | Mitigation                                                                                            |
| --------------------------------------------------------------------------------- | --------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Migration 0045 collision en prod si numéro déjà utilisé sur staging               | Faible                | Bloquant                       | `gh api repos/travelba/conciergetravel.fr/contents/packages/db/migrations` avant de pousser           |
| Cache `unstable_cache` retourne Map au lieu de Record (régression hotfix 4d02187) | Moyen                 | Page crash                     | Test Vitest dédié dans `server/itineraries/`                                                          |
| Slug FR≠EN désynchronisé → hreflang cassé                                         | Moyen                 | Perte SEO EN                   | Check unique constraint en DB + test E2E sur 3 P0                                                     |
| Body section < 150 mots passé en prod                                             | Élevé sans validateur | Pénalité Google "Thin content" | `validate-itinerary.mjs` obligatoire en CI pre-merge                                                  |
| `description_fr` d'hôtel copié dans une section (duplicate content)               | Moyen                 | Cannibalisation                | Linter `detect-hotel-description-leak.mjs` à créer (réutilise pattern `detect-yonder-duplicates.mjs`) |
| Robots.txt bloque accidentellement GPTBot/PerplexityBot                           | Faible                | GEO 0 citation                 | E2E sur `/robots.txt` (assertion Allow: /)                                                            |

---

## 8. Ce que Cursor doit lire AVANT de commencer chaque sprint

| Sprint | Lecture obligatoire                                                                                                                                                        |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1     | `AGENTS.md`, `docs/cdc-itineraires.md` §2, `.cursor/rules/architecture-layers.mdc`, `.cursor/rules/supabase-rls.mdc`                                                       |
| S2     | `.cursor/rules/nextjs-app-router.mdc`, `.cursor/skills/structured-data-schema-org/SKILL.md`, `.cursor/skills/editorial-long-read-rendering/SKILL.md`, `EDITORIAL_VOICE.md` |
| S3     | `.cursor/skills/seo-technical/SKILL.md`, `.cursor/skills/geo-llm-optimization/SKILL.md`                                                                                    |
| S4     | `.cursor/skills/itinerary-editorial-pipeline/SKILL.md`, `.cursor/skills/concierge-voice-pipeline/SKILL.md`, `.cursor/skills/llm-output-robustness/SKILL.md`                |

---

## 9. Annexe — Commandes utiles

```bash
# Validation pré-commit
pnpm lint && pnpm typecheck

# Tests ciblés
pnpm test --filter @mch/domain itineraries
pnpm test --filter @mch/seo agent-skills
pnpm test --filter @mch/web -- itinerar

# E2E ciblés
pnpm test:e2e --filter @mch/web -- itineraries

# Migration
pnpm --filter @mch/db migrate
pnpm --filter @mch/db migrate:status

# Génération de contenu (sprint 4)
node scripts/editorial-pilot/itineraries/generate-itinerary.mjs --brief japon-luxe-7-jours
node scripts/editorial-pilot/itineraries/validate-itinerary.mjs --slug japon-luxe-7-jours

# Vérification GEO post-prod
curl https://myconciergehotel.com/.well-known/agent-skills.json | jq '.skills[] | select(.name | contains("itinerary"))'
curl https://myconciergehotel.com/llms.txt | grep -i "itinerair"
curl https://myconciergehotel.com/sitemaps/itineraries.xml | head -20
```

---

## 10. Récapitulatif final pour Cursor

> **Démarrer le développement dans cet ordre strict** :
>
> 1. Lire AGENTS.md + cdc-itineraires.md + ce document
> 2. Sprint 1 (DB + domaine) — pas de UI tant que les types et queries ne sont pas verts
> 3. Sprint 2 (routes + UI) — viser une fiche fonctionnelle même avec données seed minimales
> 4. Sprint 3 (maillage + GEO) — la feature n'a de valeur que si elle est découvrable
> 5. Sprint 4 (contenu P0) — sans contenu réel, rien ne ranke
>
> **Une seule règle d'or** : si un choix d'architecture diverge du CDC ou de AGENTS.md, créer un ADR (`docs/adr/00NN-itineraries-*.md`) avant d'implémenter.

---

_Document généré le 21 mai 2026 — à valider avant ouverture des PRs._
