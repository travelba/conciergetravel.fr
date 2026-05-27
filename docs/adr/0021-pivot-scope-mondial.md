# ADR 0021 — Pivot scope mondial + nouvelle tagline « La sélection du Concierge »

- Status: accepted
- Date: 2026-05-27
- Refs: [ADR-0008 URL structure hotel flat](0008-url-structure-hotel-flat.md), [ADR-0011 Concierge voice](0011-concierge-voice.md), [ADR-0019 Le Concierge Club](0019-le-concierge-club-architecture.md), [ADR-0020 SEA member pricing constraints](0020-sea-member-pricing-constraints.md), `packages/db/migrations/0033_hotels_country_support.sql`, rule `seo-geo`, rule `editorial-voice`, skill `seo-technical`, skill `geo-llm-optimization`, skill `editorial-pilot`

## Contexte

Le 2026-05-27, le walk-prod a confirmé un **décalage massif catalogue ↔
positionnement public** :

- **Catalogue réel** (BDD Supabase) : 1 367 hôtels, **615 publiés dans
  91 pays**, dont 395 internationaux publiés (US 75, IT 33, JP 29, GB 24,
  MX 19, AE 18…), 435 Relais & Châteaux, 228 self-5★, 127 World's 50 Best,
  18 Palaces Atout France. 205 classements publiés, 50 guides éditoriaux,
  20 itinéraires.
- **Surfaces publiques** (audit + walk prod) : titre, H1, AEO, footer,
  `llms.txt`, `llms-full.txt`, `agent-skills.json`, layout root, fiches
  hôtel ouvraient sur « Concierge des Palaces et hôtels 5★ **en France** »
  (positionnement Phase 0 hérité du CDC v1).

L'écart envoyait un signal contradictoire à trois audiences :

- **Moteurs de recherche / LLM** : le `llms.txt` annonçait « Agence IATA
  Hôtels 5★ & Palaces France » alors que l'inventaire indexable contient
  des Aman à Tokyo, des Belmond à Venise, des Singita en Tanzanie. Les
  AI Overviews (Google SGE, Perplexity, ChatGPT) ne pouvaient pas
  classer correctement le domaine.
- **Visiteurs** : la home affichait « +30 pays **bientôt** rejoints »
  alors que 91 pays sont déjà servis. Le bandeau « International coming
  soon » contredisait l'inventaire visible.
- **Hôteliers / partenaires** : la promesse commerciale était bornée à
  la France, ce qui sous-vendait notre capacité réelle.

## Décision

**Pivoter MyConciergeHotel de « Concierge des Palaces 5★ en France » vers
« La sélection du Concierge — hôtels d'exception dans le monde ».**

Ce pivot s'incarne en cinq invariants :

1. **Tagline globale** : `La sélection du Concierge — hôtels d'exception
dans le monde` (FR) / `The Concierge's Selection — extraordinary
hotels around the world` (EN). Aucune mention « en France » comme
   borne géographique, aucune mention « Palaces et 5★ » comme borne de
   scope sur les surfaces SEO / GEO / publiques.
2. **Périmètre publié unique** : 615 hôtels dans 91 pays. Les compteurs
   home (§2 nouvelle home : `91 pays · 615 adresses · 435 R&C · 205
classements`) sont calculés en `cache()` avec `revalidate = 3600`
   sur Supabase — jamais hardcodés.
3. **Signature unique inchangée** : le bloc `## ⭐ Le Conseil du
Concierge` (ADR-0011) reste la promesse différenciante.
   Universellement applicable hôtels FR + international.
4. **Catégories hôtel scope-aware** : la catégorie `palaces-france`
   reste **légitimement bornée FR** (Palace = label Atout France, hors
   périmètre des autres pays). Toutes les autres catégories
   (`hotels-5-etoiles`, `boutique-hotels`, `chateaux-hotels`,
   `chalets-luxe`, `villas`, `maisons-hotes`, `hotels-4-etoiles`) sont
   reformulées sans le suffixe « en France ».
5. **Marques scope-aware** : la page `/marque/[brandSlug]` calcule un
   `BrandScope` (`france-only` | `single-non-france` | `multi-country`)
   à partir du `country_code` des hôtels matchés. Le H1, le `<title>`,
   la `meta description`, le bloc AEO et la FAQ s'adaptent
   dynamiquement.

## Conséquences

### Modifications de surface (Vague 1 — P0)

- `apps/web/src/i18n/messages/fr.json` + `en.json` : `common.tagline`,
  `homepage.metaTitle/metaDesc/title/subtitle/hero.*/aeo.*/featuredHotels.*`,
  `homepage.intlBadge`, `footer.tagline`.
- `apps/web/src/app/layout.tsx` : `metadata.title.default` + `description`.
- `apps/web/src/app/llms.txt/route.ts` et `llms-full.txt/route.ts` :
  tagline + about.
- `packages/seo/src/agent-skills.ts` : descriptions des actions
  `search`, `filter`, `list-rankings` (mention explicite des tiers
  internationaux). Ajout d'un paramètre `country_code` au schéma
  d'entrée de `search` pour permettre aux LLM d'agir nativement
  sur l'international.

### Modifications de navigation et hubs (Vague 2 — P1)

- `apps/web/src/components/layout/nav-data.ts` : `Tous les Palaces de
France` → `Palaces (label Atout France)`.
- `apps/web/src/server/hotels/editorial-categories.ts` : retrait du
  suffixe « en France » sur les catégories cross-pays.
- `apps/web/src/server/hotels/get-hotel-by-slug.ts` :
  `PublishedHotelIndexCard` étendu avec `countryCode`, `countryLabelFr`,
  `countryLabelEn` (lus depuis la migration 0033).
- `apps/web/src/app/[locale]/marque/[brandSlug]/page.tsx` : helper
  `computeBrandScope` + `BrandScope` discriminated union ; `T.suffix`,
  `T.subtitle`, `T.metaTitle`, `T.metaDesc`, `brandAeoAnswer`,
  `brandFaqItems` deviennent scope-aware.
- `apps/web/src/app/[locale]/classements/page.tsx` : H1 + meta + AEO
  pivotés (mention Palaces + Relais & Châteaux + Forbes + Michelin
  Keys + LHW dans la phrase d'autorité, pas « Palaces et hôtels 5★ en
  France »).

### Modifications éditoriales (Vague 3 — P2)

- `README.md` ligne 3 : descriptif OTA.
- `AGENTS.md` §1 + §4bis + §5 : chiffres `443/924/471` → `615/752/435`,
  positionnement scope monde, snapshot 2026-05-27.
- `EDITORIAL_VOICE.md` §1-2 : positionnement, périmètre catalogue,
  promesse unique.
- `.cursor/rules/seo-geo.mdc` §Décisions structurantes : ajout de la
  ligne ADR-0021.

### Conformité préservée

- **ADR §4ter (booking APIs = Phase 6)** : le pivot ne touche pas au
  gel. La home reste éditoriale, sans `Offer` JSON-LD, sans
  `priceValidUntil`, sans widget booking. Le formulaire de recherche
  pointe vers `/recherche` (catalogue), pas vers Amadeus.
- **ADR-0019 Le Concierge Club** : ribbon `<HomeClubRibbon>` réécrit
  pour rester conforme aux R5/D1 (zéro mention tier hôtel spécifique
  en trafic froid Phase 1).
- **ADR-0020 SEA member pricing** : aucun différentiel tarifaire
  membre ni avantage hôtel-spécifique nominatif n'est ajouté à la
  home suite au pivot.
- **CDC §2.8 + DSA art. 25 + DGCCRF** : aucun indicateur d'urgence
  fabriqué ("X personnes consultent", stock restant) sur la nouvelle
  home.

### Anti-cannibalisation et hreflang

- Les fiches hôtel canonisent vers `/hotel/[slug]` (ADR-0008 inchangé).
- Les pages V2 (DE/ES/IT) restent en `index: false` jusqu'à parité
  contenu native — la nouvelle tagline est ajoutée dans `fr.json` et
  `en.json` uniquement.
- Le `<HomeMetricsStrip>` n'introduit pas de duplicate content : les
  chiffres exacts existent uniquement sur la home.

## Critères go/no-go (extraits du plan home rebrand)

1. Zero occurrence de `en France` / `France's Palaces` dans les
   surfaces SEO publiques (audit Grep contre `apps/web/src/`).
2. `llms.txt` énonce 23 skills et la nouvelle tagline.
3. `TravelAgency` JSON-LD valide sur
   `https://search.google.com/test/rich-results` avec
   `areaServed: Worldwide` et `parentOrganization` vers
   `/le-concierge#organization`.
4. Hero charge un visuel (vidéo Cloudinary ou photo poster, pas un
   fond plat).
5. `<HomeConciergeAdviceCarousel>` rend 3 conseils réels sourcés de
   `hotels.concierge_advice` avec graceful fallback si BDD vide.
6. Walk-through user-acceptance complet (FR + EN, desktop + mobile,
   ≤ 2 clics vers itinéraires / méthode éditoriale / guides intl).

## Alternatives considérées et rejetées

- **Garder « 5★ et Palaces en France » + bandeau « International
  coming soon »** : rejeté car (a) factuellement faux, 91 pays sont
  déjà publiés ; (b) bandeau « bientôt » sape la crédibilité ; (c)
  pénalise l'indexation Google/SGE/Perplexity sur les requêtes
  internationales.
- **Sous-marque internationale séparée** (ex.
  `myconciergehotel.world`) : rejeté car (a) dilue le link equity ;
  (b) duplique l'ops (deux domaines, deux sitemaps, deux comptes
  GSC) ; (c) éloigne la promesse Concierge unique de l'audience FR
  historique.
- **Pivot tagline sans modification catégories/marques** : rejeté car
  l'incohérence resterait visible à un clic de profondeur (H1
  `/marque/four-seasons` annonçant « in France » alors que le hero
  promet le monde).

## Suivi

- Le plan complet `refonte-home-rebrand-concierge` documente les
  trois vagues (P0 surfaces SEO, P1 nav + catégories + marques, P2
  docs + ADR).
- L'audit Grep `en France` est rejoué avant chaque PR touchant
  une surface publique (rule `seo-geo` §Décisions structurantes
  l'exige).
- Les chiffres `615 / 752 / 435 / 91 pays` sont rafraîchis depuis
  Supabase via `<HomeMetricsStrip>` (revalidate 3600s) et doivent
  être recalibrés dans `AGENTS.md` à chaque promotion massive de
  drafts.
