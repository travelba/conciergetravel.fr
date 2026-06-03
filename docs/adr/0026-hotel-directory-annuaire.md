# ADR-0026 — Annuaire hôtels par pays et par ville (`/hotels/[pays]/[ville]`)

- **Statut** : Accepté (2026-06-02)
- **Contexte produit** : Phase 1 — éditorial only, APIs de réservation gelées (cf. [ADR-0025](0025-booking-integration-last-brick.md)).
- **Skills liés** : `seo-technical` (§Anti-cannibalisation, §Indexability), `geo-llm-optimization`, `structured-data-schema-org`.

## Contexte

Le catalogue expose aujourd'hui trois familles de pages qui **ramènent vers les
fiches hôtels** : les classements (`/classement/*`, `/classements/*`), les
guides éditoriaux (`/destination/[citySlug]`, `/guide/*`) et les itinéraires
(`/itineraires/*`). Toutes sont **curatées** : un classement plafonne à N
entrées, un guide est un long-read éditorial, un itinéraire est un parcours.

Aucune surface ne répond à l'intention **« donne-moi la liste de TOUS les hôtels
d'un pays / d'une ville »** de façon exhaustive, neutre et structurée — l'usage
classique d'un **annuaire**. Constat précis :

- **Ville** : `/destination/[citySlug]` liste bien tous les hôtels publiés d'une
  ville, mais la page est d'abord un **guide éditorial** (long-read, FAQ 10-Q,
  conseils du Concierge). L'intention « annuaire » est diluée.
- **Pays** : aucune route dédiée. Un pays renvoie soit vers un guide éditorial
  (`/guide/italie`, `/destination/<slug>`), soit vers une simple ancre
  `/hotels#country-XX` noyée dans la page catalogue globale.
- **Monde** : `/hotels` est l'annuaire global (groupé par région FR + par pays
  monde), mais ne descend pas au niveau pays/ville dédié.

## Décision

Créer un **système d'annuaire hiérarchique distinct des pages éditoriales**,
nesté sous l'annuaire global `/hotels` :

| Route                    | Rôle                                                                      | Statut indexation                 |
| ------------------------ | ------------------------------------------------------------------------- | --------------------------------- |
| `/hotels`                | Annuaire global (existe déjà)                                             | index                             |
| `/hotels/[pays]`         | Annuaire **pays** — tous les hôtels publiés du pays, groupés par ville    | index (noindex,follow si 0 hôtel) |
| `/hotels/[pays]/[ville]` | Annuaire **ville** — liste exhaustive des hôtels de la ville dans ce pays | index (noindex,follow si 0 hôtel) |

### Pourquoi `/hotels/[pays]/[ville]` (et pas `/destination/pays/...` ni `/annuaire/...`)

1. `/hotels` est **déjà** l'annuaire global → parent sémantique naturel ; on
   capitalise son autorité et son maillage interne.
2. Le segment `hotels` est **identique FR/EN** → aucun pathname localisé à
   inventer (cohérent [ADR-0008](0008-url-structure-hotel-flat.md), slugs flat
   identiques par locale).
3. La hiérarchie `pays/ville` **résout la collision de slugs de villes
   homonymes** entre deux pays — limite du `/destination/[citySlug]` à plat
   (slug dérivé du seul texte `hotels.city`).
4. Fil d'Ariane propre : `Accueil > Hôtels > Japon > Tokyo`.
5. **Namespace distinct de `/destination/*`** (éditorial) → séparation nette
   annuaire vs guide.

### Slug pays

Pas de colonne `country_slug` en base — comme pour les villes (`citySlug()`
dans `cities.ts`), le slug pays est **dérivé à l'exécution** depuis
`country_label_fr` via le même slugifieur (`Émirats arabes unis` →
`emirats-arabes-unis`, `France` → `france`). La résolution inverse
(slug → `country_code`) se fait en construisant l'index des pays publiés
(`packages/.../server/annuaire/country-slugs.ts`). Slug locale-invariant
(toujours dérivé du label FR) conformément à ADR-0008.

## Anti-cannibalisation (hard rule SEO)

`/destination/[citySlug]` et `/hotels/[pays]/[ville]` adressent tous deux la
même ville. Pour respecter la règle anti-cannibalisation
(`.cursor/rules/seo-geo.mdc`) :

- **`/hotels/...`** = annuaire **neutre, factuel, exhaustif** (intention
  « liste / tous les hôtels / annuaire »). Canonical de cette intention.
  H1 type « Hôtels à Tokyo ».
- **`/destination/[citySlug]`** = reste **éditorial / curaté** (guide + sélection
  du Concierge). **Révision 2026-06-02 (cf. § « Évolution » ci-dessous)** : le
  guide **ne liste plus aucun hôtel** — ni grille, ni `ItemList` JSON-LD. Il
  promeut un **CTA unique** « Voir les N hôtels à … » vers l'annuaire ville et
  conserve les mentions d'hôtels auto-liées vers la fiche dans le corps
  éditorial. L'intention « guide / que faire / meilleurs hôtels » reste portée
  par le long-read ; l'intention « tous les hôtels » est **entièrement** déléguée
  à l'annuaire (porteur unique du signal). Le cap `DESTINATION_HOTEL_PREVIEW_CAP`
  et le batch de notes Amadeus sont supprimés de cette page.
- Chaque page `alternates.canonical` vers elle-même, hreflang `fr-FR` / `en` /
  `x-default`. Liens réciproques entre les deux surfaces.

## Conséquences

- **JSON-LD** : `/hotels/[pays]` et `/hotels/[pays]/[ville]` émettent
  `CollectionPage` + `ItemList` (hôtels) + `BreadcrumbList`, via `JsonLdScript`
  (nonce CSP) → `force-dynamic` ([ADR-0013](0013-isr-vs-dynamic-csp-nonce.md)).
- **Pas d'`Offer`** (Phase 6 gelée) — annuaire 100 % éditorial, en phase.
- **Sitemap** : nouvelles URLs ajoutées à `/sitemaps/hubs.xml`.
- **Maillage** : `/hotels` (en-têtes pays/région) et `/destination` (« Autres
  pays au catalogue ») pointent désormais vers `/hotels/[pays]`.

## Évolution 2026-06-02 — annuaire « liste + carte » (type Booking) + dé-listage du guide

Suite au retour produit, l'annuaire passe d'une simple liste à une expérience
**liste indexable à gauche + carte interactive à droite** (modèle Booking), sur
les **deux** niveaux (`/hotels/[pays]` et `/hotels/[pays]/[ville]`). Le guide
destination est, lui, **vidé de toute liste d'hôtels**.

### Carte = Leaflet + tuiles raster Wikimedia (choix SEO/CWV)

- **Leaflet** (vanilla, npm, ~40 KB, pas de WebGL) préféré à MapLibre (~200 KB
  WebGL) : protège les **Core Web Vitals** (facteur de ranking) là où un canvas
  WebGL dégraderait le LCP/INP sur mobile.
- **Tuiles Wikimedia** déjà whitelistées en CSP `img-src` → **aucun changement
  CSP**. JS/CSS Leaflet bundlés via npm (pas de CDN tiers). Les styles inline de
  Leaflet sont couverts par le `'unsafe-inline'` de `style-src` déjà présent
  (Tailwind).

### Architecture SEO-safe : contenu serveur, carte en îlot client paresseux

- Le **contenu indexable reste 100 % serveur** : la liste RSC (cartes hôtel,
  liens fiches) + le JSON-LD `ItemList` sont rendus côté serveur, dans le HTML
  crawlé. C'est ce que lisent Google **et** les LLM/agents.
- La **carte est un îlot client non-SSR** chargé en lazy
  (`next/dynamic`, `ssr:false`, `loading:()=>null`) :
  [`directory-map-layout.tsx`](../../apps/web/src/components/directory/directory-map-layout.tsx).
  Elle n'entre pas dans le HTML initial, n'impacte ni le LCP ni l'indexation.
- **Sync bidirectionnelle** liste ↔ carte via `data-hotel-id` (porté par
  [`directory-hotel-card.tsx`](../../apps/web/src/components/directory/directory-hotel-card.tsx))
  : survol/focus d'une carte → highlight du pin ; clic d'un pin → popup
  (nom + lien fiche) + scroll vers la carte liste.
- **Niveau pays** : pins de **tous** les hôtels géolocalisés du pays,
  **clusterisés** (`leaflet.markercluster`).
- **Mobile** : liste par défaut + bascule plein écran « Carte » (overlay).
- Les hôtels **sans coordonnées** restent dans la liste mais pas sur la carte ;
  un libellé « N sur M localisés » l'indique (i18n `directoryPage.map.*`).

### Donnée — coordonnées

- `latitude` / `longitude` ajoutés à `HOTELS_FOR_GROUPING_COLUMNS` +
  `HotelGroupRowSchema` (transform `numberOrNull`, Postgres pouvant renvoyer des
  chaînes) dans
  [`cities.ts`](../../apps/web/src/server/destinations/cities.ts), projetés dans
  `DirectoryHotel` (`lat`/`lng`) par
  [`directory-shared.ts`](../../apps/web/src/server/annuaire/directory-shared.ts).
  Helper pur `toDirectoryMapPoints(hotels, pathFor)` → points carte géolocalisés.
- Couverture vérifiée : **98,9 %** des hôtels publiés ont des coordonnées.

### JSON-LD GEO (signal GEO/agentique, zéro fabrication)

- `ItemListHotelDetails` étendu avec `latitude?`/`longitude?`
  ([`item-list.ts`](../../packages/seo/src/jsonld/item-list.ts)). `GeoCoordinates`
  émis **uniquement** si lat **et** lng non-nuls.
- **Optimisation payload** : sur une liste exhaustive (un pays peut compter des
  centaines d'hôtels), on émet un nœud `Hotel` **allégé** (`@type`, `name`,
  `url`, `geo`) plutôt que la sortie complète de `hotelJsonLd` (qui injecte des
  champs page-level par item). Les items « riches » (avec `starRating` /
  `aggregateRating`, listes curatées) gardent le builder complet.

### Surface agentique

- Endpoints rate-limités (60/min, `Cache-Control private max-age=1800`) :
  - [`/api/agent/directory/[pays]/[ville]`](../../apps/web/src/app/api/agent/directory/[pays]/[ville]/route.ts)
  - [`/api/agent/directory/[pays]`](../../apps/web/src/app/api/agent/directory/[pays]/route.ts)
  - Shape : `{ countryName, (cityName|cities[]), hotels:[{name,slug,url,lat,lng,isPalace}], count, located, canonicalUrl }`.
- Skills `list-directory-country` / `list-directory-city` enregistrées dans
  [`agent-skills.ts`](../../packages/seo/src/agent-skills.ts) (validées par
  `agent-skills-routes.test.ts`) et listées dans
  [`llms.txt`](../../apps/web/src/app/llms.txt/route.ts).

### Guide destination — retrait total de la liste d'hôtels

- [`destination/[citySlug]/page.tsx`](../../apps/web/src/app/[locale]/destination/[citySlug]/page.tsx)
  : suppression de la grille `previewHotels.map(...)`, du const
  `DESTINATION_HOTEL_PREVIEW_CAP`, du helper `narrowStars`, du batch
  `getAmadeusAggregateRatingsBatch` et de l'`ItemList` JSON-LD.
- Conservés : `Article` / `Place` / `BreadcrumbList` / `FAQPage`, le long-read
  `<CityGuideArticle>`, les mentions d'hôtels auto-liées (linkMap).
- L'`aside` de cross-link devient un **CTA promu** « Voir les N hôtels à {city} »
  → `/hotels/[pays]/[ville]`, juste après le bloc AEO.

## Alternatives écartées

- `/annuaire/[pays]/[ville]` — namespace neuf, mais oblige à localiser le
  segment (`/directory` en EN) et n'hérite pas de l'autorité de `/hotels`.
- `/destination/pays/[code]` — collision conceptuelle avec le namespace
  éditorial `/destination` et avec les guides pays existants.
- Pagination plate de tous les hôtels d'un pays — moins lisible qu'un
  regroupement par ville (structure répertoire).
