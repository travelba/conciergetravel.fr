# Rankings SEO/GEO competitive audit vs yonder.fr — 2026-06-22

**Scope** : audit READ-ONLY de la verticale `editorial_rankings` (634 pages
publiées) sous l'angle acquisition « **{plus beaux / meilleurs} hôtels
{Ville}** ». Sources fraîches : DataForSEO (search volume Google Ads FR +
SERP organique live + PAA, location France), Tavily extract (yonder.fr),
fetch HTML prod (`myconciergehotel.com` + `/en`), inventaire DB PostgREST
(2 219 hôtels publiés, 634 rankings publiés).

> ⚠️ **La thèse business est à recadrer.** L'hypothèse de départ — capter
> « plus beaux / meilleurs hôtels {ville} » — vise les **formulations les
> moins recherchées** du marché. Les vrais volumes sont sur (1) les **têtes
> thématiques** (`palace paris` 12 100, `hôtel spa paris` 9 900) et (2)
> l'intention **« hôtel de luxe {ville} »** (10–30× « meilleurs hôtels
> {ville} »). Notre on-page écrase déjà yonder ; le verrou est l'**autorité**
> (on est absents du SERP) et un **désalignement de phrasé/titre** sur une
> partie du catalogue.

---

## 0. TL;DR — verdict en 5 points

1. **Phrasé mal calibré.** « meilleurs hôtels {ville} » = 10–110/mois ;
   « plus beaux hôtels {ville} » ≈ **null** hors Paris. Nous avons **521
   slugs `meilleurs-*` vs 1 seul `luxe`** → on a industrialisé la
   formulation la plus faible. Les volumes réels : `palace paris` **12 100**,
   `hôtel spa paris` **9 900**, `hôtel 5 étoiles paris` **9 900**,
   `hôtel de luxe paris` **2 900**, `hôtel piscine paris` **2 900**.
2. **On out-structure massivement yonder.** Notre page SSR émet **10 blocs
   JSON-LD** (ItemList + 8 `Hotel` notés + Speakable, FAQPage 10 Q/R,
   Article, TravelAgency, hreflang réciproque, bloc verdict `#tldr`,
   « mis à jour »). yonder = **BreadcrumbList + NewsArticle + Person**, pas
   de FAQ, pas d'ItemList, pas de `Hotel`, **pas de hreflang**, dates 2020.
   La passe antérieure est **confirmée**.
3. **…mais yonder gagne le SERP.** Frais 2026-06-22 : yonder **#1**
   `hôtel de luxe paris`, **#1 & #8** `plus beaux hôtels paris`, **#2**
   `meilleurs hôtels bordeaux`, **#1 & #13** `meilleurs hôtels saint-tropez`.
   **Nous : absents du top-20 partout.** → gap d'**autorité/indexation**,
   pas de structure.
4. **Le catalogue est international, la demande FR est provinciale.** Les
   villes FR à forte demande `hôtel de luxe` (Marseille 480, Toulouse 320,
   Lille 260, Annecy 260, Strasbourg 170) ont **0 hôtel publié** → non
   servables par une OTA palace/5★. À l'inverse Londres (64), New York (44),
   Dubai (53), Tokyo (34), Rome (22) ont un **inventaire massif** mais **1
   seule page** chacune → gisement EN sous-exploité.
5. **Bruit de matrice à nettoyer.** Pages absurdes générées par le
   combinator sans filtre de faisabilité : `meilleurs-hotels-ski-paris`,
   `montagne-paris`, `vignobles-paris`, `bord-de-mer-paris` + variantes
   arrondissement (`-1/-8/-16`) qui cannibalisent la tête `hôtel 5 étoiles
paris`.

---

## 1. Top 15 requêtes hôtelières « {ville} » — volume × couverture × faisabilité

Volumes Google Ads, France, FR, moyenne 12 mois (DataForSEO `search_volume`).
Couverture = page classement existante ; Faisabilité = nb d'hôtels publiés
dans la ville.

| #   | Requête                     |  Vol./mois | Compét. | Notre page                               | Faisab. (hôtels) | Statut                     |
| --- | --------------------------- | ---------: | ------- | ---------------------------------------- | ---------------- | -------------------------- |
| 1   | `palace paris`              | **12 100** | 98      | `meilleurs-palaces-paris` (+arr.)        | 68               | ✅ OK (titre à durcir)     |
| 2   | `hôtel spa paris`           |  **9 900** | 99      | `meilleurs-hotels-spa-paris` (+arr.)     | 68               | ✅ OK                      |
| 3   | `hôtel 5 étoiles paris`     |  **9 900** | 97      | `meilleurs-5-etoiles-paris` (+arr.)      | 68               | ✅ OK                      |
| 4   | `hôtel de luxe paris`       |  **2 900** | 95      | —                                        | 68               | 🔴 **ABSENTE**             |
| 5   | `hôtel piscine paris`       |  **2 900** | 100     | `meilleurs-hotels-piscine-paris`         | 68               | ✅ OK                      |
| 6   | `hôtel romantique paris`    |  **1 600** | 75      | `meilleurs-hotels-romantiques-paris`     | 68               | ✅ OK                      |
| 7   | `hôtel de luxe marrakech`   |    **880** | 93      | `meilleurs-hotels-marrakech` (générique) | 16               | 🟠 FAIBLE                  |
| 8   | `hôtel de luxe lyon`        |    **480** | 100     | `meilleurs-hotels-lyon`                  | 3                | 🟠 FAIBLE (peu d'inv.)     |
| 9   | `hôtel de luxe nice`        |    **480** | 99      | 15 pages Nice                            | 6                | 🟠 thème oui, « luxe » non |
| 10  | `hôtel de luxe marseille`   |    **480** | 93      | —                                        | **0**            | ⚫ NON FAISABLE            |
| 11  | `hôtel de charme provence`  |    **480** | 99      | clusters Provence                        | dispersé         | 🟠 à vérifier              |
| 12  | `ou dormir a paris`         |    **390** | 80      | — (informationnel)                       | 68               | 🟠 guide, pas ranking      |
| 13  | `hôtel de luxe bordeaux`    |    **320** | 90      | `meilleurs-hotels-bordeaux`              | 2                | 🟠 FAIBLE (2 hôtels)       |
| 14  | `hôtel de luxe toulouse`    |    **320** | 100     | —                                        | **0**            | ⚫ NON FAISABLE            |
| 15  | `meilleurs hôtels bordeaux` |    **260** | 80      | `meilleurs-hotels-bordeaux`              | 2                | 🟠 page OK, inv. faible    |

**Autres signaux notables :** `hôtel de luxe` cannes 320 · courchevel 320 ·
dubai 320 · bretagne 320 · lille 260 · annecy 260 · monaco 260 · barcelone
210 · new york 210 · biarritz 210 · aix 210 · saint-tropez 210. La formulation
**« plus beaux hôtels {ville} »** est quasi-nulle hors Paris (70), Marrakech
(90), Côte d'Azur (50), France (40) — **ne pas industrialiser ce phrasé.**

---

## 2. Inventaire `editorial_rankings` — cartographie par axe

634 pages publiées. Répartition par axe (sous-chaîne de slug) :

| Axe                          |   Pages | Tête de requête FR (Paris) |    Volume tête |
| ---------------------------- | ------: | -------------------------- | -------------: |
| `meilleurs-*` (préfixe)      | **521** | —                          |              — |
| `top-*` (chaînes hôtelières) |      80 | —                          |              — |
| `5-etoiles`                  |      53 | `hôtel 5 étoiles paris`    |          9 900 |
| `spa`                        |      42 | `hôtel spa paris`          |          9 900 |
| `romantique`                 |      39 | `hôtel romantique paris`   |          1 600 |
| `charme`                     |      37 | `hôtel de charme {ville}`  | 480 (provence) |
| `palace(s)`                  |      31 | `palace paris`             |     **12 100** |
| `design`/`boutique`          |      24 | —                          |              — |
| `piscine`                    |      23 | `hôtel piscine paris`      |          2 900 |
| `plus-beaux` / `plus-bel`    |      17 | `plus beaux hôtels paris`  |             70 |
| `classement-*` (curés)       |       6 | —                          |              — |
| `luxe`                       |   **1** | `hôtel de luxe paris`      |      **2 900** |

**Lecture :** la couverture thématique Paris (palace/spa/5★/piscine/
romantique) est **bonne** et adresse 27 200/mois cumulés de tête. Le trou
net est l'axe **« hôtel de luxe »** (1 seule page sur tout le catalogue alors
que c'est l'intention transversale la plus régulière par ville). Le surstock
`meilleurs-*` (521) reflète la formulation la moins demandée.

On-page santé (échantillon prod `meilleurs-5-etoiles-paris`) : FAQ 10 Q/R ✅,
sections ✅, entries 8–11 ✅, FR+EN ✅, `dateModified` ✅, hreflang réciproque
fr/en/x-default ✅.

---

## 3. Teardown concurrentiel vs yonder.fr (frais 2026-06-22)

### 3.1 Positions SERP (DataForSEO live, France, FR)

| Requête                         |    yonder    |  Nous  | Autres dominants                                                    |
| ------------------------------- | :----------: | :----: | ------------------------------------------------------------------- |
| `hôtel de luxe paris`           |    **#1**    | absent | tripadvisor, shangri-la, lartisien, thehotelguru, booking, michelin |
| `plus beaux hôtels paris`       | **#1 & #8**  | absent | timeout, littleweekends, michelin, suitespot                        |
| `palace paris`                  |     #11      | absent | atout-france, 5starhotels.paris, wikipedia, parisjetaime            |
| `meilleurs hôtels bordeaux`     |    **#2**    | absent | tripadvisor, lefigaro, booking, voyage-privé, routard               |
| `meilleurs hôtels saint-tropez` | **#1 & #13** | absent | tripadvisor, excellenceriviera, booking, doitinparis                |

**Compétiteurs récurrents** : tripadvisor.fr, booking.com (OTA — head-heavy),
guide.michelin.com (autorité), lefigaro.fr / timeout.fr (presse), voyage-privé,
routard, thehotelguru, luxuryhotel.world, generationvoyage. yonder est le
**spécialiste éditorial** qui truste plusieurs URLs par ville (palaces / 5★ /
plus beaux / charme).

### 3.2 Structure de page (yonder « hôtels de luxe Paris », Tavily extract)

| Critère                  | yonder.fr                                                                   | MyConciergeHotel.com                                                                                                           |
| ------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Longueur                 | ~7 000 mots, 22 hôtels listés                                               | comparable (sections + FAQ + verdict)                                                                                          |
| JSON-LD                  | BreadcrumbList, **NewsArticle**, Person, ImageObject, WebPage, Organization | **TravelAgency, BreadcrumbList, Article, Person, ItemList (11), 8× Hotel + Rating + Speakable, FAQPage (10 Q/R), ImageObject** |
| `Hotel` entities         | ❌ 0                                                                        | ✅ 8 (notés `/5`)                                                                                                              |
| FAQPage                  | ❌ (72 « ? » en prose, pas de schema)                                       | ✅ 10 Q/R balisées                                                                                                             |
| ItemList                 | ❌                                                                          | ✅                                                                                                                             |
| hreflang                 | ❌                                                                          | ✅ fr / en / x-default réciproque                                                                                              |
| Bloc verdict extractible | ❌                                                                          | ✅ `#tldr` + Speakable                                                                                                         |
| Fraîcheur                | dates surtout **2020** (2026 ×2)                                            | `dateModified` + badge « mis à jour »                                                                                          |
| Auteur / EEAT            | ✅ Person + NewsArticle (byline)                                            | ✅ Person (`author_name`/`author_url`) + ExternalSourcesFooter                                                                 |

**Verdict chiffré :** sur la grille technique GEO/AEO nous menons **10 types
JSON-LD vs 6** (et nous seuls émettons `ItemList`+`Hotel`+`FAQPage`+
`Speakable`+`hreflang`). Ce que yonder fait **mieux** n'est pas on-page :
c'est l'**autorité de domaine** (ancienneté, backlinks presse, signature
éditoriale reconnue) et la **densité d'URLs** par ville. Leur `NewsArticle`

- byline leur donne un léger edge « fraîcheur/EEAT » côté Google News/Discover
  que notre `Article` n'exploite pas.

---

## 4. Audit on-page GEO/AEO de notre template `classement/[slug]`

Code : `apps/web/src/app/[locale]/classement/[slug]/page.tsx` (+ rendu prod
vérifié sur `meilleurs-5-etoiles-paris` FR & EN).

**✅ Présent et solide :**

- **JSON-LD** : `BreadcrumbList`, `Article` (author `Person`),
  `ItemList`→`ListItem`→`Hotel` (avec `image`, `Rating`,
  `SpeakableSpecification`), `FAQPage` (10 `Question`/`Answer`),
  `TravelAgency`+`ContactPoint`, `Organization`, `ImageObject`. (10 blocs.)
- **Bloc verdict `#tldr`** answer-first, extracteur déterministe
  `firstSentence`, ciblé Speakable (l. 446-487).
- **Fraîcheur** : `LastUpdatedBadge` + `dateModified`/`datePublished`,
  titre millésimé.
- **Maillage interne** : `RelatedRankingsList` (classements frères) +
  `RelatedItineraries` + liens fiches hôtel (`/hotel/[slug]`).
- **EEAT/méthodologie** : section « Notre méthodologie » + `author_name`/
  `author_url` + `ExternalSourcesFooter` (sources).
- **hreflang** : `fr-FR`, `en`, `x-default` réciproques ; EN full parity
  (titre/H1 traduits, 579 KB SSR).
- `force-dynamic` assumé pour le contrat nonce CSP (ADR-0013/0027).

**🟠 Gaps on-page (faible effort, vrai impact AEO) :**

- **G1 — Titre/H1 sous-optimisés sur la tête.** Le H1 « Les meilleurs hôtels
  5 étoiles de Paris » capture `hôtel 5 étoiles paris` mais **n'inclut jamais
  « palace » ni « hôtel de luxe »**. Ajouter les synonymes de tête dans
  H2/meta/`alternateName` (palace, hôtel de luxe) sans changer le slug.
- **G2 — Pas de page « hôtel de luxe {ville} ».** Intention transversale la
  plus régulière (2 900 Paris ; 170–880 par ville) **non couverte** (1 slug
  `luxe` au total).
- **G3 — `Article` vs `NewsArticle`.** Envisager `dateModified` proéminent +
  signature pour le edge fraîcheur que yonder exploite.
- **G4 — PAA non répliqués.** Les PAA réels (« Quels sont les 12 palaces de
  Paris ? », « Différence entre 5 étoiles et palace ? », « Où vont les stars
  à St-Tropez ? ») ne sont **pas systématiquement** dans nos FAQPage. Les
  injecter via le grounding DataForSEO (PAA → FAQ) = gain featured snippet /
  AI Overview direct.
- **G5 — Pages absurdes/cannibalisation.** `ski-paris`, `montagne-paris`,
  `vignobles-paris`, `bord-de-mer-paris` (non-sens) + variantes `-1/-8/-16`
  qui se cannibalisent → risque qualité Google + dilution.

---

## 5. Synthèse priorisée (P0/P1/P2 · effort × impact)

### Gaps de CONTENU (créables via pipelines existants — `run-rankings-v2-bulk`, combinator, grounding DataForSEO)

| P      | Action                                                                                                                                                    |           Volume capté | Effort | Faisab.            |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------: | ------ | ------------------ |
| **P0** | Créer **`hotel-de-luxe-paris`** (ou re-titrer une page Paris vers cette tête)                                                                             |               2 900/mo | S      | 68 hôtels ✅       |
| **P0** | **Durcir titres/meta/H2** des pages Paris têtes (palace/spa/5★) : intégrer « palace », « hôtel de luxe » en synonymes                                     | jusqu'à 35 k/mo cumulé | S      | ✅                 |
| **P0** | **PAA → FAQ** : grounder les FAQPage sur les PAA réels DataForSEO (G4)                                                                                    |      featured snippets | M      | ✅ outil existant  |
| **P1** | **Rankings EN « best hotels {city} »** sur le top inventaire intl (Londres 64, NYC 44, Dubai 53, Tokyo 34, Rome 22, Barcelone 21, Istanbul 28, Prague 18) |         gros (SERP EN) | M      | ✅ inventaire fort |
| **P1** | Renforcer `hotel-de-luxe-{ville}` là où l'inventaire suit (Marrakech 16, Nice 6, Courchevel 7, St-Tropez 9, Cannes 4)                                     |             210–880/mo | M      | ✅                 |
| **P1** | **Nettoyer le bruit matrice** (ski/montagne/vignobles/bord-de-mer-paris) + dédupliquer variantes arrondissement (`canonical`/regroupement)                |                qualité | S      | ✅                 |
| **P2** | Page guide informationnelle **« où dormir à Paris »** (390/mo, intent guide) reliée aux classements                                                       |                 390/mo | M      | ✅                 |

### Gaps d'AUTORITÉ (hors pipeline — Phase 5 : GSC / backlinks / indexation)

| P      | Action                                                                                                             | Pourquoi                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| **P0** | **Soumission GSC + sitemap** des 634 rankings, suivi d'indexation                                                  | on est **absents du SERP** malgré une structure supérieure → problème d'indexation/autorité, pas de contenu |
| **P1** | Programme **backlinks/presse + signature éditoriale** (le vrai moat de yonder : ancienneté + liens)                | yonder gagne par autorité, pas par on-page                                                                  |
| **P1** | **Cadence de fraîcheur** (re-`reviewed_at` + `dateModified` visibles) pour matcher le signal NewsArticle de yonder | fraîcheur = facteur de classement sur ces requêtes                                                          |
| **P2** | Densité d'URLs/ville maîtrisée (yonder a 3-4 URLs/ville) **sans** retomber dans le bruit matrice                   | couverture longue traîne                                                                                    |

### ⚫ À NE PAS poursuivre (faisabilité nulle)

Villes FR à forte demande mais **0 hôtel publié** : Marseille (480), Toulouse
(320), Lille (260), Annecy (260), Strasbourg (170), Montpellier (40), Avignon
(30), Saint-Malo (20), La Rochelle (20), Chamonix (90). Une OTA IATA
palace/5★ ne peut pas produire un classement crédible sans inventaire — ne
pas générer de pages vides (risque qualité). À reconsidérer si le catalogue
s'élargit.

---

## 6. Méthode & limites

- **DataForSEO** : `keywords_data/google_ads/search_volume/live` (FR, France,
  ~0,075 $/lot) + `serp/google/organic/live/advanced` (depth 20, PAA depth 1).
  Volumes = moyenne 12 mois ; faibles en absolu (marché de niche luxe FR), à
  lire en **valeur relative** entre formulations.
- **yonder** : Tavily `extract` (advanced) pour le corps + fetch HTML brut
  pour le `<head>`/JSON-LD (rendu JS → coque 2,8 KB, JSON-LD lisible).
- **Nous** : fetch HTML prod SSR complet (658 KB FR / 579 KB EN).
- **Inventaire** : PostgREST `hotels` (2 219 publiés, paginé) + `editorial_rankings`
  (634 publiés). READ-ONLY, aucune écriture DB ni contenu.
- **Note data quality** : doublons de clé ville `Londres`/`London`,
  `Dubai`/`Dubaï` à réconcilier (impacte le comptage de faisabilité).

---

_Audit généré le 2026-06-22 — branche `feat/lieux-a-visiter-vertical`.
Aucune donnée ni contenu modifié (audit read-only)._
