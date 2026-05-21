# Cahier des Charges — Feature Itinéraires SEO/GEO

## MyConciergeTravel · MyConciergeHotel.com

> **Statut** : Spécification v1.0 — à implémenter via Cursor  
> **Objectif** : Acquérir du trafic SEO organique + être cité par les LLM (ChatGPT, Perplexity, Claude, Gemini) sur les requêtes d'itinéraires de voyage, en redirigeant vers les fiches hôtels 5★ et Palace du catalogue.

---

## 1. Contexte & Justification Produit

### 1.1 Opportunité SEO

Les requêtes itinéraires représentent une part massive du contenu voyage recherché :

- `itinéraire japon 2 semaines` : volume très élevé, concurrence éditoriale forte mais OTA absentes
- `meilleurs hôtels itinéraire toscane` : longue traîne à forte intention transactionnelle
- Les LLM génèrent systématiquement des suggestions d'hébergement dans leurs réponses itinéraires → vecteur GEO majeur

### 1.2 Positionnement différenciant

Contrairement aux blogs voyages généralistes, MyConciergeHotel.com positionne **une sélection exclusive de Palaces et hôtels 5★** au sein de chaque itinéraire. Chaque hôtel recommandé est réservable directement via le tunnel Amadeus/Little/email — c'est le levier de conversion unique.

### 1.3 Intégration dans l'architecture existante

La feature itinéraire s'appuie sur les fondations déjà en place :

- Tables `hotels`, `editorial_guides`, `editorial_rankings` → réutilisées par référence
- Package `@mch/seo` : `buildAeoBlock`, `buildLlmsTxt`, `DEFAULT_AGENT_SKILLS`, JSON-LD `HowTo` + `ItemList` déjà buildés
- Routes Next.js `[locale]` bilingue FR/EN déjà opérationnelles
- Skill `geo-llm-optimization` déjà existant dans `.cursor/skills/`
- Pipeline voix Concierge (`concierge-voice-pipeline`) réutilisable directement

---

## 2. Modèle de Données — Migration 0045

> **Note de renumérotation** : le CDC v1.0 mentionnait `0038` mais ce
> numéro était déjà appliqué (`0038_hotels_source_layering.sql`). Les
> migrations sont forward-only (AGENTS.md §4.5) — la migration a donc
> été créée sous le numéro `0045` (cf.
> `docs/itineraires-integration-plan.md` §1.3 décision D1 et
> `packages/db/migrations/0045_itineraries.sql`).

### 2.1 Table `itineraries`

```sql
-- ============================================================
-- Migration 0045 — itineraries
-- MyConciergeHotel.com — itinerary SEO/GEO acquisition feature
-- ============================================================

create table public.itineraries (
  id uuid primary key default gen_random_uuid(),

  -- Identification
  slug_fr   text not null,
  slug_en   text,

  -- Contenu éditorial
  title_fr      text not null,
  title_en      text,
  meta_title_fr text,  -- 30-70 chars
  meta_title_en text,
  meta_desc_fr  text,  -- 140-160 chars
  meta_desc_en  text,
  intro_fr      text,  -- 150-200 mots, chapeau voix Concierge
  intro_en      text,

  -- AEO block (validé buildAeoBlock — 40-80 mots)
  aeo_question_fr text,
  aeo_answer_fr   text,
  aeo_question_en text,
  aeo_answer_en   text,

  -- Taxonomie
  destination_country text not null,
  destination_region  text,
  destination_city    text,
  themes              text[] not null default '{}',

  duration_min_days smallint not null,
  duration_max_days smallint,

  travel_style text not null,
  constraint itineraries_travel_style_ck check (
    travel_style in (
      'luxe','famille','couple','solo',
      'aventure','bien-etre','gastronomie','culture','affaires'
    )
  ),

  season text,
  constraint itineraries_season_ck check (
    season is null
    or season in ('printemps','ete','automne','hiver','toute-saison')
  ),

  -- Hôtels recommandés (ordre = étape 1, 2, 3…)
  hotel_ids uuid[] not null default '{}',

  -- Sections éditoriales (structure HowTo)
  -- shape: [{
  --   "step": 1,
  --   "title_fr": "…", "title_en": "…",
  --   "body_fr": "…",  "body_en": "…",  -- >= 150 mots chacun
  --   "hotel_id": "uuid|null",
  --   "duration_days": 2,
  --   "city": "Paris",
  --   "poi": ["Tour Eiffel", "Musée d'Orsay"]
  -- }]
  sections jsonb,

  -- FAQ (FAQPage JSON-LD + AEO longue traîne)
  -- shape: [{"q_fr":"…","a_fr":"…","q_en":"…","a_en":"…"}]
  -- minimum 8 Q&A
  faq_content jsonb,

  -- Maillage interne
  related_ranking_ids      uuid[]  default '{}',  -- editorial_rankings.id
  related_guide_slugs      text[]  default '{}',  -- editorial_guides.slug_fr
  related_itinerary_slugs  text[]  default '{}',  -- itineraries.slug_fr

  -- Médias
  hero_cloudinary_id text,
  hero_alt_fr        text,
  hero_alt_en        text,
  gallery_images     jsonb,

  -- Auteur & fraîcheur
  author_id    uuid references public.authors (id) on delete set null,
  last_updated date not null default current_date,

  -- Workflow
  status text not null default 'draft',
  constraint itineraries_status_ck check (status in ('draft','published')),

  priority text not null default 'P2',
  constraint itineraries_priority_ck check (priority in ('P0','P1','P2','P3')),

  word_count_target integer default 2000,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint itineraries_slug_fr_ck check (slug_fr ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint itineraries_slug_en_ck check (
    slug_en is null or slug_en ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint itineraries_slug_fr_unique unique (slug_fr),
  constraint itineraries_slug_en_unique unique (slug_en)
);

create index itineraries_published_country_idx
  on public.itineraries (status, destination_country);
create index itineraries_themes_gin
  on public.itineraries using gin (themes);
create index itineraries_hotel_ids_gin
  on public.itineraries using gin (hotel_ids);
create index itineraries_faq_gin
  on public.itineraries using gin (faq_content jsonb_path_ops);
create index itineraries_sections_gin
  on public.itineraries using gin (sections jsonb_path_ops);

create trigger itineraries_set_updated_at
before update on public.itineraries
for each row execute function public.set_updated_at();

-- RLS
alter table public.itineraries enable row level security;

create policy itineraries_public_read on public.itineraries
  for select to anon, authenticated
  using (status = 'published');

create policy itineraries_staff_all on public.itineraries
  for all to authenticated
  using  ((auth.jwt() ->> 'role') in ('admin', 'editor'))
  with check ((auth.jwt() ->> 'role') in ('admin', 'editor'));
```

---

## 3. Routes Next.js

### 3.1 Structure des dossiers

```
apps/web/src/app/[locale]/
├── itineraires/
│   └── page.tsx              → hub /itineraires (index)
└── itineraire/
    └── [slug]/
        └── page.tsx          → fiche itinéraire unitaire
```

### 3.2 URL canoniques

| Locale | Hub               | Fiche                      |
| ------ | ----------------- | -------------------------- |
| FR     | `/fr/itineraires` | `/fr/itineraire/[slug_fr]` |
| EN     | `/en/itineraries` | `/en/itinerary/[slug_en]`  |

**i18n routing** — ajouter dans `lib/i18n/routing.ts` > `pathnames` :

```ts
'/itineraires': {
  fr: '/itineraires',
  en: '/itineraries',
},
'/itineraire/[slug]': {
  fr: '/itineraire/[slug]',
  en: '/itinerary/[slug]',
},
```

### 3.3 ISR & cache tags

```ts
export const revalidate = 3600; // fiche
// hub : revalidate = 86400
// Cache tags : `itinerary-${slug}`, `itineraries-hub`, `itinerary-${country}`
// IMPORTANT : unstable_cache retourne Record<…> pas Map/Set → cf. hotfix 4d02187
```

---

## 4. Structure de Page

### 4.1 Hub `/itineraires`

```
H1 : "Itinéraires de voyage | Palaces & Hôtels 5★"
├── FeaturedItineraries (6 P0 mis en avant)
├── FilterByDestination (pays / région)
├── FilterByTheme (luxe, famille, couple, aventure…)
├── FilterByDuration (week-end, 1 sem, 2 sem, 1 mois)
├── ItineraryCard grid (toutes destinations)
└── JSON-LD : CollectionPage + ItemList
```

### 4.2 Fiche `/itineraire/[slug]`

```
Hero (image + titre + badges : durée / thème / saison)
├── [AEO Block]  <section data-aeo>  — 40-80 mots
├── [Intro]      chapeau Concierge 150-200 mots
├── [ItinerarySteps]  — chaque étape = HowToStep
│   ├── StepHeader (Jour X-Y · Ville)
│   ├── StepBody   (descriptif ≥ 150 mots + POIs nommés)
│   └── HotelCard  (lien fiche + CTA réservation)
├── [HotelSelectionPanel] — tous les hôtels avec prix live si Amadeus
├── [RelatedRankings]     — ≥ 2 classements (maillage)
├── [RelatedGuides]       — ≥ 1 guide destination (maillage)
├── [RelatedItineraries]  — ≥ 2 itinéraires similaires (maillage)
├── [FAQ]  8-15 Q&A, <details open> sur le premier
└── [LastUpdatedBadge]
```

---

## 5. SEO/GEO — Checklist 15 blocs

### 5.1 Metadata

- [ ] `generateMetadata` avec `title_fr/en` + `meta_desc_fr/en` (140-160 chars)
- [ ] `alternates.canonical` : URL complète de la fiche
- [ ] `alternates.languages` : `fr-FR`, `en`, `x-default`
- [ ] `openGraph.images` : `hero_cloudinary_id` + `hero_alt`
- [ ] Pages non publiées : `robots: { index: false, follow: false }`

### 5.2 JSON-LD (via `@mch/seo/jsonld`)

- [ ] **`HowTo`** — étapes = `HowToStep[]` ; `step.url` = fiche hôtel si `hotel_id` présent ; `totalTime` ISO 8601 (`P7D`)
- [ ] **`ItemList`** — items = hôtels recommandés ; `item['@type'] = 'Hotel'` ; `item.url` = `/hotel/[slug]`
- [ ] **`FAQPage`** — toutes les Q&A de `faq_content` ≥ 8
- [ ] **`BreadcrumbList`** — Accueil > Itinéraires > [Titre]
- [ ] **`Article`** — `datePublished` = `created_at` ; `dateModified` = `last_updated` ; `author`
- [ ] Aucune `AggregateRating` fabriquée
- [ ] Émettre via `<JsonLdScript>` (jamais `<script>` inline → violation CSP)

> **Note** : `HowTo` est déjà buildé dans `packages/seo/src/jsonld/howto.ts`. Réutiliser tel quel.

### 5.3 AEO Block

- [ ] Validé par `buildAeoBlock` de `@mch/seo` (40-80 mots)
- [ ] Fraîcheur : inclure `Mis à jour [mois année]` dans la réponse
- [ ] Rendu dans `<section data-aeo aria-labelledby="aeo-heading">` visible dans le DOM
- [ ] `<details open>` sur le premier item FAQ

### 5.4 Contenu

- [ ] Intro : 150-200 mots, voix Concierge (cf. `editorial-voice.mdc` + `EDITORIAL_VOICE.md`)
- [ ] Chaque step : ≥ 150 mots body unique + ≥ 1 POI nommé
- [ ] Word count total ≥ 1 500 mots (target : 2 000)

### 5.5 Maillage Interne (CRITIQUE)

| Lien sortant         | Minimum     | Composant              | Anchor text                 |
| -------------------- | ----------- | ---------------------- | --------------------------- |
| `/hotel/[slug]`      | 1 par étape | `<ItineraryHotelCard>` | Nom exact de l'hôtel        |
| `/classement/[slug]` | ≥ 2         | `<RelatedRankings>`    | Titre du classement         |
| `/guide/[slug]`      | ≥ 1         | `<RelatedGuides>`      | "Notre guide [Destination]" |
| `/itineraire/[slug]` | ≥ 2         | `<RelatedItineraries>` | Titre de l'itinéraire       |
| `/itineraires` (hub) | 1           | BreadcrumbList         | "Tous nos itinéraires"      |

**Liens entrants à déclencher post-publish :**

- Guides pays → ajouter bloc "Nos itinéraires pour [Pays]"
- Fiches hôtels → widget "Cet hôtel dans nos itinéraires"
- Nav principale → lien "Itinéraires" (CSS-only dropdown, même pattern commit `ab79771`)

**Anti-cannibalisation :**

- Ne jamais coller `description_fr` d'un hôtel — lien uniquement
- Chaque contextualisation d'un hôtel dans une étape : ≥ 50 mots originaux
- `/itineraire/` distinct de `/guide/` et `/classement/` — pas de doublon de contenu

### 5.6 Sitemap

- [ ] Ajouter dans `sitemap-editorial.xml` ou créer `sitemap-itineraries.xml`
- [ ] `lastmod` = `last_updated`, `changefreq = monthly`
- [ ] `priority` : P0 → 0.9 / P1 → 0.8 / P2 → 0.7

---

## 6. GEO — Être Cité par les LLM

### 6.1 `agent-skills.ts` — 2 skills à ajouter

Fichier : `packages/seo/src/agent-skills.ts` > `DEFAULT_AGENT_SKILLS.skills`

```ts
{
  name: 'get-itinerary',
  description:
    "Récupérer un itinéraire complet par son slug : étapes jour par jour, "
    + "hôtels 5★ recommandés avec liens de réservation, FAQ, conseils "
    + "Concierge saisonniers, JSON-LD HowTo + ItemList. "
    + "URL canonique : /fr/itineraire/{slug} ou /en/itinerary/{slug}.",
  inputSchema: {
    type: 'object',
    properties: {
      slug:   { type: 'string', description: 'Slug kebab-case (ex. "itineraire-japon-2-semaines").' },
      locale: { type: 'string', description: '"fr" (par défaut) ou "en".' },
    },
    required: ['slug'],
  },
},
{
  name: 'list-itineraries',
  description:
    "Lister les itinéraires disponibles par destination, durée, thème ou "
    + "style (luxe, famille, couple, solo). Chaque itinéraire inclut les "
    + "hôtels 5★ et Palaces sélectionnés par le Concierge. URL hub : /itineraires.",
  inputSchema: {
    type: 'object',
    properties: {
      destination:   { type: 'string', description: 'Pays ou région (ex. "japon", "toscane", "paris").' },
      travel_style:  { type: 'string', description: '"luxe"|"famille"|"couple"|"solo"|"aventure"|"bien-etre"|"gastronomie"|"culture"' },
      duration_days: { type: 'integer', minimum: 2, maximum: 30 },
      locale:        { type: 'string', description: '"fr" ou "en".' },
    },
  },
},
```

### 6.2 `llms.txt` — Section à ajouter

```
## Itinéraires de voyage — Palaces & Hôtels 5★

- /fr/itineraires — Hub de tous nos itinéraires de voyage avec sélection d'hôtels 5★ réservables
- /fr/itineraire/{slug} — Itinéraire jour par jour avec hôtels Concierge, FAQ et conseils saisonniers
- /en/itineraries — All our curated travel itineraries with bookable 5-star hotels
- /en/itinerary/{slug} — Day-by-day itinerary with Concierge hotel picks and seasonal tips
```

### 6.3 `llms-full.txt` — Entrée par itinéraire P0

Chaque itinéraire P0 génère une entrée `LlmsFullTxtPage` :

- `title` : titre complet FR
- `url` : URL canonique `/fr/itineraire/[slug]`
- `summary` : `intro_fr` tronquée à 200 mots
- `keyFacts` : `["Durée : X jours", "Destination : …", "Hôtels : N palaces/5★", "Thèmes : …", "Saison idéale : …"]`
- `updatedAt` : `last_updated`

---

## 7. Matrice des 50 Itinéraires P0/P1

### France

| slug_fr                                  | slug_en                         | Jours | Style       | Hôtels cibles                                       |
| ---------------------------------------- | ------------------------------- | ----- | ----------- | --------------------------------------------------- |
| `paris-luxe-3-jours`                     | `paris-luxury-3-days`           | 3     | luxe        | Ritz, Plaza Athénée, Crillon                        |
| `cote-d-azur-luxe-7-jours`               | `french-riviera-luxury-7-days`  | 7     | luxe        | Cap Eden Roc, Grand-Hôtel Cap Ferrat, Chèvre d'Or   |
| `provence-culture-gastronomie-10-jours`  | `provence-culture-food-10-days` | 10    | gastronomie | Villa Gallici, Oustau Baumanière, Crillon le Brave  |
| `alsace-couple-week-end`                 | `alsace-romantic-weekend`       | 3     | couple      | Château de l'Île, Auberge de l'Ill                  |
| `bordeaux-vignobles-gastronomie-5-jours` | `bordeaux-wine-food-5-days`     | 5     | gastronomie | Château Lafaurie-Peyraguey, Les Sources de Caudalie |
| `normandie-culture-week-end`             | `normandy-culture-weekend`      | 2     | culture     | Château La Chenevière, Le Normandy Barrière         |
| `paris-famille-5-jours`                  | `paris-family-5-days`           | 5     | famille     | Hôtels families 5★ Paris                            |
| `megeve-ski-luxe-5-jours`                | `megeve-luxury-ski-5-days`      | 5     | luxe        | Les Fermes de Marie, Chalet du Mont d'Arbois        |
| `saint-tropez-ete-5-jours`               | `saint-tropez-summer-5-days`    | 5     | luxe        | Lily of the Valley, Château de la Messardière       |
| `reims-champagne-week-end`               | `reims-champagne-weekend`       | 2     | gastronomie | Les Crayères                                        |
| `lyon-gastronomie-3-jours`               | `lyon-food-3-days`              | 3     | gastronomie | Villa Maia, Intercontinental Lyon                   |
| `biarritz-pays-basque-5-jours`           | `biarritz-basque-5-days`        | 5     | culture     | Hôtel du Palais                                     |
| `paris-lune-de-miel`                     | `paris-honeymoon`               | 4     | couple      | Le Bristol, Ritz, Four Seasons George V             |
| `val-d-isere-ski-luxe`                   | `val-d-isere-luxury-ski`        | 5     | luxe        | Les Barmes de l'Ours                                |
| `bretagne-bien-etre-7-jours`             | `brittany-wellness-7-days`      | 7     | bien-etre   | Thalasso côte bretonne                              |

### International

| slug_fr                           | slug_en                           | Jours | Style       | Hôtels cibles                                   |
| --------------------------------- | --------------------------------- | ----- | ----------- | ----------------------------------------------- |
| `japon-culture-2-semaines`        | `japan-culture-2-weeks`           | 14    | culture     | Aman Tokyo, Park Hyatt Kyoto                    |
| `japon-luxe-7-jours`              | `japan-luxury-7-days`             | 7     | luxe        | Tokyo + Kyoto 5★                                |
| `bali-lune-de-miel-10-jours`      | `bali-honeymoon-10-days`          | 10    | couple      | COMO Uma Ubud, Four Seasons Jimbaran            |
| `maldives-luxe-7-jours`           | `maldives-luxury-7-days`          | 7     | couple      | One&Only Reethi Rah, Soneva Fushi               |
| `toscane-gastronomie-7-jours`     | `tuscany-food-wine-7-days`        | 7     | gastronomie | Borgo San Felice, Rosewood Castiglion del Bosco |
| `maroc-culture-10-jours`          | `morocco-culture-10-days`         | 10    | culture     | La Mamounia, Royal Mansour                      |
| `italie-culture-2-semaines`       | `italy-culture-2-weeks`           | 14    | culture     | Rome + Florence + Venise 5★                     |
| `grece-iles-couple-10-jours`      | `greek-islands-couple-10-days`    | 10    | couple      | Mystique Santorini, Canaves Oia                 |
| `safari-kenya-afrique-du-sud`     | `kenya-south-africa-safari`       | 12    | aventure    | Singita Grumeti, Royal Malewane                 |
| `new-york-luxe-5-jours`           | `new-york-luxury-5-days`          | 5     | luxe        | The Mark, Aman New York                         |
| `dubai-luxe-week-end`             | `dubai-luxury-weekend`            | 3     | luxe        | Burj Al Arab, Atlantis The Royal                |
| `sri-lanka-aventure-2-semaines`   | `sri-lanka-adventure-2-weeks`     | 14    | aventure    | Heritance Kandalama, Cape Weligama              |
| `perou-machu-picchu-10-jours`     | `peru-machu-picchu-10-days`       | 10    | aventure    | Inkaterra Machu Picchu, Palacio del Inka        |
| `vietnam-culture-10-jours`        | `vietnam-culture-10-days`         | 10    | culture     | Metropole Hanoi, Four Seasons Nam Hai           |
| `patagonie-aventure-10-jours`     | `patagonia-adventure-10-days`     | 10    | aventure    | Awasi Patagonia, Explora Patagonia              |
| `inde-rajasthan-culture-10-jours` | `india-rajasthan-culture-10-days` | 10    | culture     | Oberoi Udaivilas, SUJÁN Sher Bagh               |
| `indonesie-luxe-couple-10-jours`  | `indonesia-luxury-couple-10-days` | 10    | couple      | Amankila, Four Seasons Bali                     |
| `tanzanie-safari-zanzibar`        | `tanzania-safari-zanzibar`        | 10    | aventure    | Singita Faru Faru, &Beyond Mnemba               |
| `thailande-bien-etre-10-jours`    | `thailand-wellness-10-days`       | 10    | bien-etre   | Kamalaya Koh Samui, Amanpuri                    |
| `islande-aventure-7-jours`        | `iceland-adventure-7-days`        | 7     | aventure    | Ion Adventure Hotel, The Retreat Blue Lagoon    |

---

## 8. Longue Traîne — Requêtes FAQ à Couvrir

Pour chaque itinéraire, les FAQ + AEO doivent capturer ces variantes conversationnelles :

| Catégorie   | Patterns à couvrir                                                                      |
| ----------- | --------------------------------------------------------------------------------------- |
| Durée       | "combien de jours pour [destination]", "[destination] en [N] jours suffisant"           |
| Hébergement | "meilleur hôtel 5★ pour un itinéraire [destination]", "palace [destination] bien situé" |
| Style       | "[destination] lune de miel", "[destination] en famille", "[destination] solo"          |
| Saison      | "meilleure période [destination]", "éviter [destination] en [mois]"                     |
| Budget      | "budget itinéraire luxe [destination]", "prix séjour [destination] 5 étoiles"           |
| Logistique  | "comment se déplacer [destination]", "transports [destination]"                         |

---

## 9. Plan de Travail — 4 Sprints Cursor

### Sprint 1 — DB & API

1. `packages/db/migrations/0045_itineraries.sql` (schéma §2.1 — renuméroté depuis `0038` car ce numéro était déjà appliqué)
2. Type Zod `ItinerarySchema` dans `packages/db/src/types/itinerary.ts`
3. `getItineraryBySlug(slug, locale)` avec `unstable_cache` → retourner `Record` pas `Map`
4. `listPublishedItineraries(filters)` paginé
5. `getRelatedItineraries(id, limit)` pour le maillage
6. Ajouter `get-itinerary` + `list-itineraries` dans `packages/seo/src/agent-skills.ts`
7. Tests Vitest : query + validation AEO

### Sprint 2 — Routes & UI

1. `apps/web/src/app/[locale]/itineraires/page.tsx` (hub)
2. `apps/web/src/app/[locale]/itineraire/[slug]/page.tsx` (fiche)
3. Composants : `<ItinerarySteps>`, `<ItineraryHotelCard>`, `<RelatedItineraries>`, `<ItineraryAeoBlock>`
4. JSON-LD : HowTo + ItemList + FAQPage + BreadcrumbList + Article
5. Routing i18n dans `lib/i18n/routing.ts`

### Sprint 3 — Maillage & GEO

1. Sitemap : ajouter query `itineraries` dans `apps/web/src/app/sitemap.xml/route.ts`
2. `llms.txt` + `llms-full.txt` : ajouter section itinéraires
3. Guides pays → ajouter bloc "Nos itinéraires pour [Pays]"
4. Fiches hôtels → widget "Cet hôtel dans nos itinéraires"
5. Navigation principale → lien "Itinéraires" (CSS-only dropdown, pattern commit `ab79771`)

### Sprint 4 — Contenu P0

1. Seed SQL 10 itinéraires P0 France
2. Seed SQL 10 itinéraires P0 International
3. Pipeline GPT-4o (réutiliser `concierge-voice-pipeline` + `llm-output-robustness`)
4. Audit AEO word count (adapter `audit-pushed-drafts.mjs`)

---

## 10. Definition of Done

### SEO

- [ ] Lighthouse SEO ≥ 95 sur 3 fiches
- [ ] Google Rich Results Test : HowTo + FAQPage valides
- [ ] `alternates.canonical` + hreflang corrects (Screaming Frog)
- [ ] Sitemap itinéraires soumis GSC
- [ ] 0 contenu dupliqué avec guides/classements

### GEO

- [ ] `agent-skills.json` expose `get-itinerary` + `list-itineraries`
- [ ] `llms.txt` liste les URLs itinéraires P0
- [ ] `llms-full.txt` inclut keyFacts de chaque itinéraire P0
- [ ] AEO block validé `buildAeoBlock` sur 100% des fiches publiées

### Maillage

- [ ] ≥ 1 lien hôtel par étape
- [ ] ≥ 2 liens classements par fiche
- [ ] ≥ 1 lien guide destination par fiche
- [ ] Guides pays → liens vers itinéraires
- [ ] Hub `/itineraires` accessible depuis nav principale

### Performance

- [ ] LCP < 2.5s mobile (Vercel Speed Insights)
- [ ] `revalidate = 3600` configuré
- [ ] Images hero via Next.js Image + Cloudinary
