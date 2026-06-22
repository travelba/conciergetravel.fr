# ADR 0030 — Vertical éditorial « Lieux à visiter » (`/lieux`)

- Status: accepted
- Date: 2026-06-22
- Refs: ADR-0011 (voix du Concierge), ADR-0013 (ISR vs dynamic / nonce CSP), ADR-0023 (`external_sources` EEAT), ADR-0027 (évolution modèle CSP), ADR-0029 (anti-scaffolding), migration `0076_places_visit_catalog.sql`, skills `content-enrichment-pipeline`, `photo-pipeline`, `keyword-grounding-dataforseo`, `structured-data-schema-org`, `seo-technical`

## Décision

On introduit un **vertical éditorial autonome « lieux à visiter »** — une fiche SEO/GEO indexable par lieu touristique (musée, monument, jardin, point de vue, lieu de culte, théâtre, visite guidée, shopping, plein air, attraction). Le vertical est canonisé dans **`public.places`** (migration `0076`), distinct des POI aujourd'hui embarqués dans `hotels.points_of_interest`, qui n'exposaient aucune page par lieu, ne permettaient ni classement ville-par-ville ni maillage bidirectionnel ni monétisation.

Deux buckets éditoriaux seulement sont promus en fiche autonome : **`visit`** (patrimoine / culture) et **`do`** (activités). Les buckets `eat`/`shop` restent embarqués dans `hotels.points_of_interest` (chantier TheFork futur).

Le pipeline suit le pattern **scaffold-puis-enrichit** déjà éprouvé sur le catalogue hôtels : un scaffold non publié par défaut, des passes de photos et de texte indépendantes et idempotentes, et **un seul publieur** — un gate strict `publish-places.ts`. Aucune étape autre que ce gate ne flippe `is_published`.

## Contexte

État avant cette décision (juin 2026) :

- Les points d'intérêt étaient des **attributs embarqués d'un hôtel** (`hotels.points_of_interest` JSONB, buckets visit/do/eat/shop). Ce modèle duplique le contenu hôtel par hôtel, n'expose aucune URL indexable par lieu, et n'autorise ni page de classement ville ni cross-link bidirectionnel.
- Aucun ADR ni document d'architecture ne couvrait le vertical, alors qu'il a été construit cette session sur plusieurs couches (DB, routes, pipeline, JSON-LD, maillage, i18n, sitemap, llms.txt, E2E). Les conventions du repo imposent un ADR quand on ajoute une stratégie de rendu ou un nouveau domaine (`.cursor/rules/architecture-layers.mdc`, `AGENTS.md` §6). Cet ADR comble ce manque.

## Périmètre & intention

- **Vertical éditorial** « lieux touristiques » : une fiche par lieu, regroupée par ville, classée par bucket (`visit` / `do`).
- **Maillage avec les hôtels** : chaque fiche lieu liste les « hôtels à proximité » ; chaque fiche hôtel liste les « lieux à visiter à proximité ». Relation bidirectionnelle, pré-calculée (haversine) dans `place_hotel_links`, avec fallback géo.
- **GEO/AEO** : JSON-LD `TouristAttraction` + `ImageObject[]` + `FAQPage` + `BreadcrumbList`, FAQ ancrée sur la demande réelle (DataForSEO grounding), exposition dans `llms.txt` + endpoint agent `places-nearby`.

## Routes (`apps/web/src/app/[locale]/lieux/`)

Trois niveaux, tous `export const dynamic = 'force-dynamic'` (lecture du nonce CSP via `headers()` — même précédent que la fiche hôtel / classement, ADR-0013 / ADR-0027) :

| Segment                         | Fichier                                 | Rôle                                                            | JSON-LD                                                                                             |
| ------------------------------- | --------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `/lieux`                        | `lieux/page.tsx`                        | Hub : liste des villes ayant ≥ 1 lieu publié                    | `BreadcrumbList` + `ItemList` (villes)                                                              |
| `/lieux/[citySlug]`             | `lieux/[citySlug]/page.tsx`             | Index ville : sections « à visiter » (visit) + « à faire » (do) | `BreadcrumbList` + `ItemList` ×2                                                                    |
| `/lieux/[citySlug]/[placeSlug]` | `lieux/[citySlug]/[placeSlug]/page.tsx` | Fiche détail                                                    | `TouristAttraction` (ou sous-type) + `BreadcrumbList` + `FAQPage` + `ItemList` (hôtels à proximité) |

- `generateStaticParams` (city + fiche) renvoie `fr` + `en` pour chaque ligne publiée ; `try/catch → []` pour ne jamais casser le build sans Supabase.
- L'index ville `404`e (`notFound()`) quand aucun lieu publié n'existe (ex. `tokyo` n'a que des drafts).
- La fiche détail compose les blocs `PlaceGallery`, `PlaceGygBlock`, `PlaceAskConcierge`, `PlaceNearbyHotels` (`components/lieux/*`).

## Modèle de données (`public.places` + tables liées — migration `0076`)

Trois tables additives, toutes vides après la migration, peuplées par le pipeline server-side (service role, bypass RLS) :

### `public.places` — fiche canonique

Colonnes clés :

- **Identité / routing** : `slug` (FR canonique, contrainte d'unicité `(city_key, slug)`), `slug_en` (alias EN, fallback sur `slug`), `city_key` (clé ville normalisée, ex. `paris` — **pas** une FK, miroir de la convention slug destination), `city` + `country_code` (affichage).
- **Taxonomie** : `bucket` (`check in ('visit','do')`), `kind` (10 valeurs — voir `@mch/domain/places` `PLACE_KINDS`, défaut `attraction`).
- **Géo** : `latitude` / `longitude` (`numeric(9,6)`) — requis pour publier (proximité + JSON-LD geo + carte), `address`.
- **Contenu éditorial** : `name` / `name_en`, `factual_summary_fr` / `_en`, `description_fr` / `_en`, `concierge_advice` (jsonb voix Concierge ADR-0011, 50-110 mots FR), `faq` (jsonb `[{ q_fr, a_fr, q_en, a_en }]`, ≥ 6 pour publier), `external_sources` (jsonb EEAT, même forme que `hotels.external_sources` — ADR-0023).
- **Média** : `hero_image` (Cloudinary `public_id` ou URL), `gallery_images` (jsonb).
- **SEO** : `meta_title_fr/_en`, `meta_desc_fr/_en`.
- **Provenance / publication** : `source_ref` (dedupe : `dt/<uuid>`, `gp/<place_id>`, `node/123`, `osm/<id>`, `hotel-poi`), `is_published` (défaut `false`), `priority` (défaut 100).

Index : `(is_published, city_key, bucket)`, géo partiel, `source_ref` unique partiel. RLS : anon lit les lignes publiées, le staff (`seo`/`editor`/`operator`/`admin`) voit/mute tout.

### `public.place_hotel_links` — proximité pré-calculée (bidirectionnelle)

`place_id` ⨯ `hotel_id` + `distance_meters` + `walk_minutes`, unique `(place_id, hotel_id)`, FK cascade. Géographique pur (haversine, sans jointure ville → fonctionne à travers une frontière de ville). Alimente **les deux** sens du maillage. RLS : anon lit tout (pas de PII).

### `public.place_gyg_products` — produits GetYourGuide (Palier A)

`place_id` + `gyg_tour_id` (unique), `title`, `abstract`, `price_from_minor` (cents) + `currency`, `rating`, `review_count`, `deeplink_url` (porte le `partner_id` affilié — jamais une URL GYG nue), `image_url`, `sort_order`. Monétisation deeplink uniquement, **pas de checkout interne** (conforme à la phase API-last, ADR-0025).

### Miroir Payload

`apps/admin/src/collections/places.ts` est le **miroir éditorial** dans le schéma `cms.places` (`dbName: 'places'`), jamais `public.places` (même pattern qu'ADR-0010 pour Hotels). Validateurs bloquants alignés sur l'enveloppe published-quality : `factual_summary_fr` ∈ [110, 165], `faq` ≥ 6, `concierge_advice.fr.body` 50-110 mots, lat/lng présents.

## Pipeline (scripts/editorial-pilot/src/places/)

Quatre étapes, chacune isolée sur des colonnes disjointes pour tourner en parallèle sans lost-update :

1. **Scaffold géo-fencé** — `backfill-paris.ts` (généralisé bien au-delà de Paris malgré son nom). Lit `hotels.points_of_interest` en read-only, garde les buckets `visit`/`do`, **dédoublonne** cross-hôtel (par `osm_id` puis slug article-insensitif), infère `(kind, bucket)` depuis le `type` OSM, exclut food/lodging/transit + meta (accès, parking, B&B), et UPSERT en `places` toujours **`is_published=false`** (`on_conflict city_key,slug`). Garde-fou clé : `--max-radius-km=N` géo-fence les POI au-delà de N km du centroïde médian des hôtels matchés (anti-contamination cross-ville — un hôtel londonien embarque parfois des monuments parisiens). `--publish-thin` réactive l'auto-publish minimal legacy (pilotes jetables seulement). Résout aussi `place_hotel_links` (haversine in-memory).
   - Alternative de sourcing plus large : `source-places.ts` (Google Places `searchNearby` worldwide + matching GYG) pour les villes sans POI hôtel embarqués.
2. **Photos** — `backfill-place-photos.ts` (**sans OpenAI**). Source via Google Places Photo API (légalement propre, attribué — pas de Pinterest/OTA hotlink), upload Cloudinary sous `cct/places/{cityKey}/{placeSlug}`, alt enrichi FR + EN (Hard Rule 16). PATCH **uniquement** `hero_image` + `gallery_images` (disjoint des colonnes éditoriales). Garde-fou d'isolation : refuse `--city=paris` sans `--allow-paris` (une boucle Paris tourne en continu). `--include-unpublished` car les photos sont backfillées **avant** l'enrichissement texte et la publication.
3. **Enrichissement texte** — `enrich-places-editorial.ts` (**OpenAI + DataForSEO grounding**). Cible les scaffolds `is_published=false` ET `faq IS NULL` d'une ville. Génère l'enveloppe (summary FR/EN + description FR/EN + Conseil du Concierge + FAQ 6-8) en voix Concierge, validée par schéma Zod + linter (phrases ≤ 25 mots, lexique banni), avec passes fix + salvage déterministe en dernier recours. FAQ ancrée sur les PAA / mots-clés réels (DataForSEO, cache disque, dégrade en LLM-only). **Ne flippe jamais `is_published`.**
4. **Publication** — `publish-places.ts` (**seul publieur**). Sélectionne les lignes `is_published=false` ET `faq IS NOT NULL`, re-valide une enveloppe défensive (`gateFailures` : summary FR 100-200c, summary EN ≥ 80c, description FR ≥ 250c / EN ≥ 200c, faq ≥ 5, concierge_advice fr+en ≥ 40c) et flippe `is_published=true` uniquement pour les lignes qui passent. Run-guard `process.argv[1]` : importer le module (ex. depuis `reconcile-places-publish.ts` pour réutiliser `gateFailures`/`PLACE_GATE_COLUMNS`) n'exécute jamais le publieur.

## Indexabilité & SEO

- **Sitemap** — `apps/web/src/app/sitemaps/places.xml/route.ts` (`revalidate = 3600`) : une entrée par fiche publiée + une par index ville + le hub `/lieux`, avec alternates FR/EN (`slug_en` quand présent) et `lastmod = updated_at`. Défensif : `<urlset>` vide plutôt qu'un 500 si Supabase dégrade. Référencé dans l'index sitemap.
- **JSON-LD** — `packages/seo/src/jsonld/tourist-attraction.ts` (`touristAttractionJsonLd`). Émet `TouristAttraction` ou un sous-type plus étroit (`Museum`, `LandmarksOrHistoricalBuildings`, `Park`, `PerformingArtsTheater`, `PlaceOfWorship`, …) selon `placeKindToSchemaClass(kind)` (`@mch/domain/places`), avec `geo`, `address`, `containedInPlace`, et `image[]` en `ImageObject` (hero `representativeOfPage` + galerie, dimensions matchant le transform Cloudinary délivré — Hard Rule 16). Le bloc « hôtels à proximité » est émis séparément en `ItemList` de `Hotel` (pas de propriété `nearbyLodging` standard sur `Place`).
- **llms.txt** — `apps/web/src/app/llms.txt/route.ts` expose le hub `/lieux` (FR + EN) et l'endpoint agent `/api/agent/places-nearby` (lieux par hôtel ou par ville).
- **i18n FR/EN** — namespace `lieux` (+ `hotelPage.nearbyPlaces` côté hôtel). Slugs localisés via `slug_en`.
- **Gotcha de négociation de locale** (capitalisé en E2E) : un navigateur headless envoie `Accept-Language: en` par défaut, donc la route FR non préfixée `/lieux` **307-redirige vers `/en/lieux`**. La config Playwright épingle `use.locale = 'fr-FR'` pour que next-intl négocie FR et résolve la route canonique sans saut `/en/`. Tout changement futur de config/middleware qui casse la négociation FR échoue bruyamment (`apps/web/e2e/lieux.spec.ts`).

## Maillage

Bidirectionnel :

- **Fiche lieu → hôtels** : `PlaceNearbyHotels` + `getNearbyHotelsForPlace` (lit `place_hotel_links`).
- **Fiche hôtel → lieux** : `apps/web/src/components/hotel/hotel-nearby-places.tsx` (bloc `#lieux-a-proximite`) + `apps/web/src/server/hotels/get-nearby-places-for-hotel.ts`. Deux stratégies, par priorité : (1) liens curés `place_hotel_links` (lieux publiés, plus proches d'abord) ; (2) fallback géo (lieux publiés de la même `city_key`, classés par haversine) quand aucun lien curé n'existe. Anti-cannibalisation : le côté hôtel ne montre qu'une carte teaser + lien, jamais la description longue. Self-elide quand la liste est vide. Reader volontairement auto-contenu côté hôtel (n'importe pas `server/places/*`) pour que les deux surfaces évoluent indépendamment.

## Décisions & alternatives

- **Un seul publieur (gate strict).** `publish-places.ts` est l'unique chemin qui flippe `is_published`. Motif : un one-liner OSM n'est pas une fiche publiable ; séparer « écrire le contenu » de « décider qu'il est publiable » évite qu'une passe d'enrichissement partielle ou une édition manuelle ne mette en ligne une fiche thin. Le gate re-valide la ligne persistée (belt-and-braces contre partial-write / drift / édition manuelle). Un run-guard empêche l'import du module de publier.
- **Scaffold non publié par défaut.** `backfill-paris.ts` UPSERT toujours en `is_published=false` ; `--publish-thin` (legacy) n'existe que pour des pilotes jetables. Cohérent avec le pattern scaffold-puis-enrichit du catalogue hôtels et avec l'anti-scaffolding (ADR-0029) : rien ne va en prod sans avoir franchi l'enveloppe éditoriale.
- **Buckets `visit`/`do` seulement.** `eat`/`shop` restent embarqués (chantier TheFork futur) — contrainte DB `places_bucket_ck`.
- **`city_key` non-FK.** Les villes ne sont pas une table ; la clé miroir la convention slug destination, ce qui garde le vertical découplé du modèle `destinations`.
- **GetYourGuide en deeplink seulement (Palier A).** Pas de checkout interne — conforme à la phase API-last (ADR-0025).
- **Statut** : drafts en attente d'enrichissement. Paris est la ville data-rich (boucle d'enrichissement + auto-publish en continu) ; les autres villes sont majoritairement des scaffolds non publiés tant que la passe texte n'a pas tourné. L'index ville 404e proprement tant qu'aucun lieu n'est publié.

## Conséquences / dette

- **~17 lieux mal tagués `city_key`** (contamination cross-ville résiduelle d'avant le géo-fence `--max-radius-km`). À nettoyer via un re-scan géo-fencé + correction de `city_key`. Le géo-fence prévient les nouvelles occurrences mais ne corrige pas le passif.
- **Dépendance OpenAI pour la couche texte.** `enrich-places-editorial.ts` requiert OpenAI ; les étapes scaffold (`backfill-paris.ts`) et photos (`backfill-place-photos.ts`) en sont indépendantes (Google Places + Cloudinary). Une indisponibilité OpenAI bloque la publication (faute de FAQ + description), pas le sourcing.
- **`force-dynamic` sur les trois routes** à cause du nonce CSP (ADR-0013). À rebasculer en ISR si/quand le modèle CSP hash-based (ADR-0027) supprime le besoin de lire le nonce par requête.
- **Couverture photos partielle** (Phase 2) : `PlaceGallery` self-elide sans `gallery_images` ni cloud name ; les fiches sans hero ni galerie n'émettent pas d'`image[]` JSON-LD.

## Validation

- E2E : `apps/web/e2e/lieux.spec.ts` couvre hub/ville/fiche, le 404 ville-draft (jamais 500), le gotcha de locale, la galerie, l'`image[]` JSON-LD, le maillage hôtel ↔ lieux, et un scan axe — les cas data-dépendants `test.skip` proprement sans Supabase (même précédent que `destination.spec.ts`).
- Unit : `publish-places.test.ts` (gate), `place-view.test.ts`, `get-nearby-places-for-hotel.test.ts`, `tourist-attraction.test.ts`, `place-amenity.test.ts`.

## Références

- Migration [`0076_places_visit_catalog.sql`](../../packages/db/migrations/0076_places_visit_catalog.sql) — 3 tables + RLS.
- Domaine : [`packages/domain/src/places/place-kind.ts`](../../packages/domain/src/places/place-kind.ts) — buckets, kinds, mapping Schema.org.
- Routes : [`apps/web/src/app/[locale]/lieux/`](../../apps/web/src/app/%5Blocale%5D/lieux/).
- JSON-LD : [`packages/seo/src/jsonld/tourist-attraction.ts`](../../packages/seo/src/jsonld/tourist-attraction.ts).
- Sitemap : [`apps/web/src/app/sitemaps/places.xml/route.ts`](../../apps/web/src/app/sitemaps/places.xml/route.ts).
- Pipeline : [`scripts/editorial-pilot/src/places/`](../../scripts/editorial-pilot/src/places/) (`backfill-paris.ts`, `backfill-place-photos.ts`, `enrich-places-editorial.ts`, `publish-places.ts`, `source-places.ts`, `reconcile-places-publish.ts`, `audit-places-editorial.ts`).
- Maillage hôtel : [`apps/web/src/components/hotel/hotel-nearby-places.tsx`](../../apps/web/src/components/hotel/hotel-nearby-places.tsx) + [`get-nearby-places-for-hotel.ts`](../../apps/web/src/server/hotels/get-nearby-places-for-hotel.ts).
- Miroir Payload : [`apps/admin/src/collections/places.ts`](../../apps/admin/src/collections/places.ts).
- Skills : [`content-enrichment-pipeline`](../../.cursor/skills/content-enrichment-pipeline/SKILL.md), [`photo-pipeline`](../../.cursor/skills/photo-pipeline/SKILL.md), [`keyword-grounding-dataforseo`](../../.cursor/skills/keyword-grounding-dataforseo/SKILL.md), [`structured-data-schema-org`](../../.cursor/skills/structured-data-schema-org/SKILL.md).
