# Audit SEO + GEO/AEO en ANGLAIS — classements & fiches hôtel

**Date** : 2026-06-29
**Périmètre** : surfaces EN (`/en/classement/*` + `/en/hotel/*`) de MyConciergeHotel.com.
**Mode** : lecture seule — aucune écriture DB, aucun commit.
**Sources** : DataForSEO (MCP `user-dfs`, location _United States_ 2840 + lecture UK, langue `en`) pour la **demande réelle** ; Google Search Console (MCP `project-0-conciergetravel.fr-gsc`, propriété `sc-domain:myconciergehotel.com`) pour la **perf réelle EN** ; lecture du code (`generateMetadata` classement + fiche, `llms.txt`, JSON-LD live via `curl`).
**Fenêtre GSC** : 28 j (2026-05-30 → 2026-06-27) ; latence ~2-3 j ; 28 j ≈ 90 j (site jeune — cf. `gsc-indexation-2026-06-29.md`).
**À lire avant** : `docs/audits/gsc-indexation-2026-06-29.md` (indexation 2,3 %), `docs/audits/hotel-fiche-grand-audit-2026-06-29.md` (socle écrit 99-100 %).

> **Note méthode DataForSEO** : le serveur MCP `project-0-conciergetravel.fr-dfs`
> renvoie HTTP 401 (auth). Toutes les mesures de demande viennent du serveur
> jumeau **`user-dfs`** (même compte DataForSEO, données identiques). Location
> _United States_ (code 2840) prise comme proxy du marché anglophone ; le marché
> UK est commenté là où il diverge (ex. `luxury hotels london`).

---

## 0. TL;DR chiffré — l'état EN en 12 lignes

1. **L'EN génère déjà plus d'impressions que le FR (567 vs 471 / 28 j) mais ne convertit pas : 1 clic, CTR 0,18 %, position moyenne ~17.** Le FR fait 6 clics / 7 (CTR 1,27 %). L'EN « consomme du crawl sans convertir » (constat GSC repris ici, croisé à la demande).
2. **Le seul vrai gisement de volume EN qu'on touche aujourd'hui — Rome — est bloqué en page 4-5.** `/en/classement/meilleurs-hotels-rome` = **105 impressions, 1 clic, position 40,1** (notre 1ʳᵉ page EN en impressions). Sur GSC, ~20 variantes de « best hotels in rome » plafonnent **position 40-55**.
3. **La difficulté n'est PAS le problème : `best hotels in rome` KD=7, `luxury hotels rome` KD=9, `best hotels in london` KD=5, `luxury hotels dubai` KD=4** — on est à la position 40 sur des requêtes faciles. **Le blocage est l'autorité + le maillage, pas le contenu ni l'on-page.**
4. **On cible le mauvais pattern lexical.** Notre matrice génère `meilleurs-hotels-{ville}` = « best hotels {city} ». Or **`luxury hotels {city}` pèse plus** : `luxury hotels london` 22 200/mo, `luxury hotels paris` 18 100/mo, `luxury hotels rome` 6 600/mo — et c'est **LOW competition** (KD 8/21/9). **Aucune page EN ne cible explicitement `luxury hotels {city}`.**
5. **On ne cible pas du tout les requêtes informationnelles à fort volume `where to stay in {city}`** (Paris 5 400, Rome 5 400) ni `best {city} hotels` (inversion lexicale, 12 100 sur Paris) — terrain des AI Overviews.
6. **On-page EN des classements = techniquement sain** : `<title>`/meta/canonical/hreflang (`fr-FR`/`en`/`x-default` réciproques)/JSON-LD (`TravelAgency`+`Article`+`ItemList`+`FAQPage`) tous corrects et **en anglais** (vérifié live sur Rome). Le titre EN est bon ; le problème est ailleurs.
7. **MAIS l'URL EN garde le slug FRANÇAIS** : `/en/classement/meilleurs-hotels-rome`. Aucun `slug_en` côté classements (les fiches hôtel, elles, ont un `slug_en`). Signal de pertinence/CTR/marque dégradé sur l'anglophone.
8. **Concurrents SERP EN identifiés** (la requête PO « benchmark » transposée à l'anglophone) : **Forbes Travel Guide** (pos 1,2), **Condé Nast Traveler** (2,8), **Tripadvisor** (6,8), **US News** (9), **Mr & Mrs Smith** (6,8 — concurrent direct curation luxe), **Small Luxury Hotels** (9), **Five Star Alliance** (6). **MCH absent du top 25.** Écart = autorité (backlinks) + ancienneté de domaine, pas format.
9. **GEO/AEO** : FAQPage JSON-LD émis sur classements ET fiches ✅ ; `llms.txt` surface les classements & guides en **FR-only** (URL `/fr/...`, résumés FR, bloc _about_ FR) — angle mort EN pour ChatGPT/Perplexity/Claude.
10. **Parité contenu EN fiches = excellente** (grand audit) : `factual_summary_en` 100 % enveloppe, `description_en` 100 %, sections EN 98,9 %, mais **34 fiches** avec ≥1 section EN en fallback FR + **`concierge_advice` EN manquant sur 18 fiches phares** (le-meurice, cheval-blanc-courchevel…).
11. **Les fiches hôtel EN rankent bien mais sans volume** : position 2-9 sur les requêtes de marque/nom (`borgo-pignano` pos 5,7 ; `the-box-house-hotel` pos 2,7) — 1 à 9 impressions chacune. Bon signal de qualité, zéro trafic faute de demande sur le nom propre.
12. **Quick wins EN réels** = les classements France de niche déjà en page 1-2 (`romantiques-tour-eiffel` pos 9,5 ; `palaces-paris-8` pos 14,1 ; `bord-de-mer-cote-atlantique` pos 15,7) : faible volume absolu mais à portée de clic. Le gros volume (Rome/Paris/London luxury) exige de l'autorité.

---

## 1. Demande EN réelle (DataForSEO) — ce que les anglophones tapent

### 1.1 Volumes & difficulté sur nos scopes (US, langue `en`, juin 2026)

Tri par volume mensuel décroissant. KD = keyword difficulty DataForSEO (0-100).

| Requête EN                      | Vol/mo (US) |    KD | Intent        | On a une page qui cible ?                          |
| ------------------------------- | ----------: | ----: | ------------- | -------------------------------------------------- |
| luxury hotels new york          |   110 000\* |    35 | commercial    | ❌ (pas de page « luxury hotels NYC »)             |
| luxury hotels london            |      22 200 | **8** | commercial    | ❌                                                 |
| luxury hotels paris             |      18 100 |    21 | commercial    | ❌ (on a « palaces paris », pas « luxury hotels ») |
| best hotels in paris            |      12 100 |    23 | commercial    | 🟡 (palaces paris / paris-8 only)                  |
| best paris hotels               |      12 100 |    18 | commercial    | 🟡                                                 |
| best hotels in london           |       9 900 | **5** | commercial    | ❌                                                 |
| best hotels in tokyo            |       9 900 |    10 | commercial    | ❌                                                 |
| **best hotels in rome**         |   **8 100** | **7** | informational | ✅ `meilleurs-hotels-rome` (**pos 40**)            |
| best hotels in new york         |       8 100 |    35 | commercial    | ❌                                                 |
| luxury hotels dubai             |       8 100 | **4** | commercial    | ❌ (on a `guide/uae` only)                         |
| aman resorts                    |       6 600 |    18 | commercial    | 🟡 (`marque/...` ? pas de page Aman EN dédiée)     |
| luxury hotels rome              |       6 600 | **9** | commercial    | ❌                                                 |
| best hotels in florence         |       5 400 |   n/a | commercial    | ❌                                                 |
| luxury hotels venice            |       5 400 |    15 | commercial    | ❌                                                 |
| where to stay in paris          |       5 400 |   n/a | commercial    | ❌                                                 |
| where to stay in rome           |       5 400 |   n/a | informational | ❌                                                 |
| best hotels in dubai            |       4 400 | **9** | commercial    | ❌                                                 |
| best hotels in venice           |       4 400 |   n/a | informational | ❌                                                 |
| best hotels in lake como        |       3 600 |   n/a | commercial    | 🟡 (guide como)                                    |
| best hotels in amalfi coast     |       2 900 |   n/a | informational | 🟡 (guide)                                         |
| best hotels in santorini        |       2 900 | **7** | commercial    | 🟡 (guide santorin)                                |
| best maldives resorts           |       2 400 | **9** | informational | 🟡 (`hotels/maldives`, `guide/maldives`)           |
| best hotels in bali             |       1 900 |    11 | commercial    | 🟡 (guide bali)                                    |
| luxury hotels marrakech         |       1 900 |    21 | commercial    | ❌                                                 |
| best bali resorts               |       1 600 | **5** | commercial    | 🟡                                                 |
| best hotels in mykonos          |       1 600 |   n/a | commercial    | 🟡 (guide mykonos)                                 |
| best hotels in marrakech        |       1 300 |   n/a | commercial    | 🟡 (guide marrakech)                               |
| best hotels in tuscany          |       1 300 |   n/a | informational | ❌                                                 |
| best hotels in provence         |         590 |   n/a | commercial    | 🟡 (classements provence FR)                       |
| best 5 star hotels paris        |         320 |    25 | commercial    | 🟡                                                 |
| palace hotels paris             |         320 |    23 | navigational  | ✅ `meilleurs-palaces-paris`                       |
| best hotels in courchevel       |         260 |   n/a | commercial    | ✅ (FR)                                            |
| best luxury hotels in the world |         260 |    69 | informational | ❌ (KD trop élevé)                                 |
| best palace hotels              |          10 |     3 | commercial    | ✅                                                 |

\* `luxury hotels new york` : volume très volatil (22 200 → 301 000 selon le mois) ; à traiter comme « gros mais instable ». Hors NYC, le seed adressable ≈ **180 000 recherches/mo**.

**Lecture experte** :

- **Pattern gagnant ignoré** : `luxury hotels {ville}` > `best hotels {ville}` en volume ET en facilité (London KD 8 vs 5, Paris 21 vs 23 — proche, mais Paris luxury 18,1k vs best 12,1k). La règle benchmark `competitor-benchmark-yonder` disait déjà « le volume est sur _hôtel de luxe {ville}_ » : **l'EN le confirme et on ne le cible pas**.
- **KD très bas (4-15) sur la quasi-totalité des `{ville}` à fort volume** : Dubai 4, London 5, Bali-resorts 5, Rome 7/9, Santorini 7, Maldives 9, Tokyo 10. Le ticket d'entrée est faible — **notre absence est due à l'autorité de domaine, pas à la concurrence on-SERP**.
- **Inversion lexicale** : `best paris hotels` (12 100) ≠ `best hotels in paris` (12 100) — deux core_keywords distincts DataForSEO ; nos titres doivent couvrir les deux ordres.
- **Cluster informationnel AI-Overview** : `where to stay in {ville}` (5 400 ×2), `best hotels in {ville}` parfois classé _informational_ (rome, venice, amalfi, tuscany, maldives) → terrain GEO/AEO (réponse extractible), pas seulement liste.

### 1.2 PAA / recherches associées (DataForSEO related, depth 2)

Le SERP de nos requêtes cibles porte `people_also_ask` + `related_searches` (confirmé `serp_item_types`). Les expansions dominantes (`best hotels in rome`, depth 2) sont :

- **attribut + ville** : `hotels near {landmark}`, `boutique hotels {city}`, `5 star hotels {city}`, `hotels with rooftop {city}`, `family hotels {city}`.
- **nom propre d'hôtel** (navigational fort volume) : ex. `hotel artemide` (Rome) = **9 900/mo, KD 12** — type de nom qui alimente nos fiches.
- **questions** (PAA) : « what is the best area to stay in {city} », « which hotels have the best view », « best time to visit ». → à couvrir en `geo_qa` / FAQ EN.

---

## 2. Perf EN réelle (GSC, 28 j) — où on apparaît et à quelle profondeur

### 2.1 Agrégats EN

| Métrique (pages `/en/`)           |                                            Valeur |
| --------------------------------- | ------------------------------------------------: |
| Pages distinctes avec impressions |                                           **100** |
| Impressions                       |                          **567** (54,6 % du site) |
| Clics                             |                                             **1** |
| CTR                               |                                        **0,18 %** |
| Position moyenne                  | ~17 (tirée vers le bas par le cluster Rome à 40+) |

Rappel FR pour contexte : 91 pages, 471 impr, **6 clics**, CTR 1,27 %.

### 2.2 Top pages EN par impressions (classements)

| Page `/en/classement/`                       |    Impr | Clics | Position | Volume EN de la cible             |
| -------------------------------------------- | ------: | ----: | -------: | --------------------------------- |
| meilleurs-hotels-rome                        | **105** |     1 | **40,1** | best hotels in rome 8 100         |
| meilleurs-hotels-bord-de-mer-cote-atlantique |      32 |     0 |     15,7 | niche FR (low)                    |
| meilleurs-palaces-paris-8                    |      31 |     0 |     14,1 | palace hotels paris 320           |
| meilleurs-hotels-kids-friendly-paris-16      |      28 |     0 |     17,3 | niche FR (low)                    |
| meilleurs-hotels-charme-bretagne             |      22 |     0 |     26,2 | niche FR (low)                    |
| meilleurs-hotels-romantiques-saint-tropez    |      21 |     0 |     12,1 | niche FR (low)                    |
| meilleurs-hotels-famille-luberon             |      20 |     0 |     12,7 | niche FR (low)                    |
| meilleurs-hotels-campagne-france             |      19 |     0 |     14,6 | niche FR (low)                    |
| meilleurs-hotels-romantiques-tour-eiffel     |      17 |     0 |  **9,5** | romantic hotels near eiffel tower |
| meilleurs-hotels-piscine-cote-d-azur         |      15 |     0 |     12,1 | niche FR (low)                    |
| marque/airelles                              |      13 |     0 |     13,9 | navigational marque               |
| meilleurs-hotels-urbains-bastille            |      11 |     0 |     13,9 | niche FR (low)                    |
| meilleurs-palaces-paris                      |       1 |     0 |   **98** | best hotels in paris 12 100       |

### 2.3 Requêtes EN où on apparaît mais en page 4-5 (gisement bloqué)

Cluster **Rome** (toutes nos impressions « volume » EN), positions **40-55** :

| Requête                            | Impr (FR+US+GBR vues) | Position |
| ---------------------------------- | --------------------: | -------: |
| best hotels in rome                |                    22 |     44,4 |
| best hotels rome                   |                     9 |     43,2 |
| best hotel in rome                 |                     8 |     46,5 |
| top hotels in rome                 |                     6 |     55,7 |
| best hotel rome                    |                     6 |     44,8 |
| best rome hotels                   |                     4 |     44,5 |
| top hotels rome                    |                     4 |     39,8 |
| best hotel in rome italy           |                     4 |     48,3 |
| best hotels in rome italy          |                     3 |     50,3 |
| top hotel in rome                  |                     3 |     45,3 |
| « what is the best hotel in rome » |                     1 |       67 |

Et **Paris luxe profond** : `palace hotels in paris` pos 96, `luxury palace hotels paris` pos 98, `paris palace hotels` pos 47 → `meilleurs-palaces-paris` est à peine indexé/maillé (1 impr pos 98) alors que `meilleurs-palaces-paris-8` (le sous-classement arrondissement) capte 31 impr pos 14. Cannibalisation interne probable ville vs arrondissement.

### 2.4 Quick wins EN (detect_quick_wins, minImpr 10, CTR<5 %, pos 5-50)

| Requête                               | Page                                     | Position | Impr |
| ------------------------------------- | ---------------------------------------- | -------: | ---: |
| best hotels in rome                   | /en/.../meilleurs-hotels-rome            |     44,4 |   22 |
| family hotels in 16th arr. passy      | /en/.../kids-friendly-paris-16           |     26,4 |   10 |
| hôtels château à france               | /classement/...-chateau-france           |     13,4 |   11 |
| hôtels confortables et sûrs… familles | /classement/...-famille-france           |     11,6 |   11 |
| palaces courchevel                    | /classement/meilleurs-palaces-courchevel |     15,3 |   15 |

→ Le moteur GSC ne sort que **5 opportunités** : confirme que le site est trop jeune pour des quick wins de CTR massifs ; **Rome est la seule à la fois volume + impressions + CTR nul** → priorité n°1.

### 2.5 Fiches hôtel EN — bonne qualité, zéro volume

Les `/en/hotel/*` rankent **position 2-9** mais sur des **noms propres** à 1-9 impressions :
`borgo-dei-conti-resort` pos 3 · `the-box-house-hotel` pos 2,7 · `cap-d-antibes-beach-hotel` pos 5 · `the-lanesborough` pos 5,7 · `borgo-pignano` pos 5,7 · `four-seasons-hotel-george-v` pos 7,9 (8 impr) · `waldorf-astoria-jeddah` pos 4,5 · `armani-hotel-dubai` pos 4 · `mara-plains-camp` pos 1. **Lecture** : nos fiches EN sont jugées pertinentes par Google quand la requête contient le nom — mais la demande sur le nom propre est minuscule. **La fiche ne crée pas sa demande ; elle doit être irriguée par les classements/guides EN qui, eux, captent la requête générique.**

---

## 3. Gaps on-page EN

### 3.1 Ce qui est SAIN (vérifié live `curl` sur `/en/classement/meilleurs-hotels-rome`)

- `<title>` **en anglais** : « The best hotels in Rome: our 2026 selection · MyConciergeHotel » (60 car., dans la cible ≤ 60). ✅
- `<meta name="description">` en anglais, ~150 car. ✅
- `<link rel="canonical" href=".../en/classement/meilleurs-hotels-rome">` self-référent ✅
- `hreflang` **réciproques** : `fr-FR` → `/classement/...`, `en` → `/en/classement/...`, `x-default`. ✅
- `<h1>` en anglais : « The best hotels in Rome in 2026 ». ✅
- JSON-LD : `TravelAgency` + `Article` + `ItemList` + `FAQPage` — tous présents et en anglais. ✅

Code confirmant (`apps/web/src/app/[locale]/classement/[slug]/page.tsx`) : titre = `meta_title_en` ‖ `title_en` (fallback FR) ; meta = `meta_desc_en` ‖ `factual_summary_en` ‖ `intro_en` (fallback FR) ; `alternates` via `buildHreflangAlternates`.

### 3.2 Les VRAIS gaps on-page EN

| #   | Gap                                                                                                                                                                                  | Preuve                                  | Impact                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| G1  | **Slug FR sur URL EN** des classements (`/en/classement/meilleurs-hotels-rome`). Pas de `slug_en` (les fiches en ont un).                                                            | Code + live.                            | CTR/pertinence anglophone, signal de marque, partage. **Moyen** (canonical OK donc pas de duplicate, mais sous-optimal). |
| G2  | **Titre EN ne couvre QUE `best hotels in {city}`** ; n'intègre ni `luxury hotels {city}` (volume supérieur) ni l'inversion `best {city} hotels`.                                     | §1.1.                                   | **Fort** — on rate le pattern le plus volumineux.                                                                        |
| G3  | **Cannibalisation ville vs arrondissement** : `meilleurs-palaces-paris` (pos 98, 1 impr) vs `-paris-8` (pos 14, 31 impr).                                                            | §2.3.                                   | Moyen — diluer ou hiérarchiser via maillage.                                                                             |
| G4  | **Pas de page EN sur `luxury hotels {city}`, `where to stay in {city}`, `best {country} resorts`** (Dubai, London, NYC, Tokyo) — villes/pays où on a l'inventaire mais 0 classement. | §1.1 + matrice.                         | **Fort** (volume neuf).                                                                                                  |
| G5  | Title length OK sur Rome, mais à vérifier sur les longs slugs (arrondissement + thème) qui peuvent dépasser 60 car. en EN.                                                           | Code (pas de troncature EN spécifique). | Faible.                                                                                                                  |

---

## 4. Gaps GEO/AEO EN

| Surface                           | État EN                                 | Détail                                                                                                                                                                   |
| --------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **FAQPage JSON-LD** (classements) | ✅ émis en EN                           | vérifié live Rome.                                                                                                                                                       |
| **FAQPage JSON-LD** (fiches)      | ✅                                      | grand audit : FAQ 100 %, mais EN traduit.                                                                                                                                |
| **geo_qa EN** (fiches)            | 🟡 95,3 % présent                       | couverture PAA EN **non vérifiée** — généré FR-first puis traduit, pas re-grounded sur PAA _anglophones_.                                                                |
| **`llms.txt`**                    | ❌ **FR-only sur classements & guides** | `route.ts` émet `url: /fr/classement/{slug}` + résumés FR + bloc `about` FR. Seules les fiches ont l'URL EN. ChatGPT/Perplexity/Claude ne voient pas nos classements EN. |
| **agent-skills / endpoints LLM**  | 🟡                                      | `get-hotel-sources` etc. existent ; pas d'exposition EN-spécifique des classements.                                                                                      |
| **Speakable**                     | ❌ absent                               | ni classement ni fiche n'émet `speakable`.                                                                                                                               |
| **Parité contenu EN** (fiches)    | 🟡                                      | 34 fiches ≥1 section EN en fallback FR ; `concierge_advice` EN manquant sur 18 fiches phares (le-meurice, cheval-blanc-courchevel, plaza-athenee…).                      |
| **AEO answer-blocks EN**          | 🟡                                      | `factual_summary_en` 100 % (réponse extractible courte) ✅ ; mais pas de bloc « short answer » dédié sur les classements EN.                                             |

**Conséquence GEO** : pour une requête `best hotels in rome` posée à un LLM, MCH n'est ni dans `llms.txt` EN (classements absents), ni assez autoritaire pour être cité — alors que le `factual_summary_en` de chaque fiche EST extractible. **Le maillon manquant est l'exposition EN des pages de liste aux crawlers LLM.**

---

## 5. Benchmark concurrents EN (DataForSEO SERP, US)

Règle PO `competitor-benchmark-yonder` transposée : yonder.fr étant FR, voici **qui rank réellement en anglais** sur nos cibles.

### 5.1 Domaines dominants — `best hotels in {city}` (agrégé Rome/Paris/London/NYC)

| Domaine                           | Pos. moy. | Profil                             | Pourquoi il gagne                                                      |
| --------------------------------- | --------: | ---------------------------------- | ---------------------------------------------------------------------- |
| forbestravelguide.com             |   **1-2** | Guide noté (étoiles Forbes)        | Autorité + signaux de notation (rating schema), marque référente luxe. |
| cntraveler.com (Condé Nast)       |   **2-3** | Magazine                           | Autorité éditoriale énorme, fraîcheur annuelle, backlinks presse.      |
| us.tripadvisor.com                |       6-8 | UGC                                | Volume d'avis, fraîcheur, dominance historique.                        |
| usnews.com/travel                 |        ~9 | Classement noté                    | Méthodo affichée, autorité .com US.                                    |
| **mrandmrssmith.com**             |       6-8 | **Curation luxe (≈ notre modèle)** | Boutique luxe, club payant, éditorial — **concurrent direct**.         |
| **slh.com** (Small Luxury Hotels) |        ~9 | Consortium luxe                    | Marque + inventaire badge.                                             |
| fivestaralliance.com              |        ~6 | Curation 5★                        | Niche luxe pure.                                                       |
| timeout.com / theculturetrip.com  |      5-12 | Magazine ville                     | Fraîcheur, autorité ville.                                             |

**MCH : absent du top 25** sur toutes ces requêtes (cohérent avec pos 40 GSC).

### 5.2 Lecture de l'écart

- **Ce n'est PAS un écart de format** : on émet PLUS de structured data (TravelAgency+Article+ItemList+FAQPage+hreflang) que la moyenne de ces concurrents.
- **Ce n'est PAS un écart de difficulté on-SERP** : KD 5-9.
- **C'est un écart d'AUTORITÉ (backlinks/domain age) et de COUVERTURE** : Forbes/CN ont des milliers de domaines référents ; Mr & Mrs Smith a 15 ans de marque. On est un domaine jeune (indexation 2,3 %).
- **Avantage différenciant MCH à jouer** : catalogue mondial 2984 hôtels + `Conseil du Concierge` (secret opérationnel concret) + JSON-LD supérieur + maillage hôtel↔lieu. Sur la **longue traîne** (`best hotels in {ville secondaire}`, `luxury hotels {quartier}`, nom propre) on peut gagner AVANT d'avoir l'autorité de Forbes.

---

## 6. PLAN D'EXPERT priorisé par ROI

Convention : **Impact** = volume DFS adressable + probabilité de gain compte tenu de l'autorité actuelle. **Effort** = S (≤ ½ j) / M (1-3 j) / L (> 3 j).

### 6.1 QUICK WINS (semaine 1) — exploiter ce qui est déjà indexé

| #   | Action                                                                                                                                                                                                                                                 | Impact                                                            | Effort | Fichier / pipeline                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| QW1 | **Réécrire le `<title>`/H1 EN de Rome en multi-pattern** : « Best Hotels in Rome 2026 — Luxury & 5-Star Stays \| MyConciergeHotel » (couvre `best hotels in rome` 8 100 + `luxury hotels rome` 6 600 + `5 star`). Re-grounder meta_desc_en sur le PAA. | **Fort** (15k vol, KD 7-9, on est déjà pos 40 → CTR + pertinence) | S      | `meta_title_en`/`meta_desc_en` du row `meilleurs-hotels-rome` (DB) + `buildRankingMetaDescription`. |
| QW2 | **Exposer les classements + guides EN dans `llms.txt`** (URL `/en/...` + résumé EN + bloc `about` EN).                                                                                                                                                 | **Fort** (GEO : tous LLM)                                         | S      | `apps/web/src/app/llms.txt/route.ts` — ajouter la variante EN des sections rankings/guides.         |
| QW3 | **Résoudre la cannibalisation Paris** : pointer `meilleurs-palaces-paris-8` → canonical/maillage vers `meilleurs-palaces-paris` OU spécialiser les titres.                                                                                             | Moyen                                                             | S      | maillage + `generateMetadata`.                                                                      |
| QW4 | **Compléter `concierge_advice` EN** sur les 18 fiches phares + 34 sections EN en fallback.                                                                                                                                                             | Moyen (AEO citation)                                              | M      | `translate-sections-en.ts` / `translate-description-en.ts` (déjà outillés).                         |
| QW5 | **Ajouter `geo_qa` EN grounded sur PAA anglophones** sur le top 20 villes (where to stay, best area).                                                                                                                                                  | Moyen-Fort                                                        | M      | `geo-qa-generator.ts` + `groundKeywords(locale='en')`.                                              |

### 6.2 COURT TERME (semaines 2-6) — capter le pattern lexical manquant

| #   | Action                                                                                                                                                                                                           | Impact (vol DFS)                        | Effort | Fichier / pipeline                                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------- |
| CT1 | **Générer les classements `luxury hotels {city}` EN** sur les villes à inventaire : London (22 200, KD 8), Paris (18 100, KD 21), Rome (6 600, KD 9), Venice (5 400), Dubai (8 100, KD 4), Tokyo (9 900, KD 10). | **Très fort** (~70k vol cumulé, KD bas) | L      | matrice `combinator.ts` — nouvel axe lexical `luxury-hotels-{city}` + `run-rankings-v2-bulk.ts`, grounded DFS EN. |
| CT2 | **Introduire un `slug_en` sur les classements** (parité avec les fiches) : `/en/classement/best-hotels-rome`.                                                                                                    | Moyen-Fort (CTR + pertinence)           | L      | schéma `editorial_rankings` + `page.tsx` (slug resolver) + hreflang + redirects.                                  |
| CT3 | **Couvrir `where to stay in {city}`** (informational, AI-Overview) via un bloc/section dédiée dans les guides EN existants (Paris, Rome, Venice…).                                                               | Fort (5 400 ×N)                         | M      | `generate-guide-v2.ts` (section « Where to stay / best areas »), grounded DFS EN.                                 |
| CT4 | **Pages `best {country} resorts` / pays** non couverts : Maldives (2 400, KD 9), Bali (1 900).                                                                                                                   | Moyen                                   | M      | matrice scope `pays`.                                                                                             |
| CT5 | **Maillage EN classements → fiches → guides** (les fiches EN rankent déjà ; les irriguer depuis les listes).                                                                                                     | Fort (transfert d'autorité interne)     | M      | composants de maillage `/en/classement` + `/en/hotel`.                                                            |

### 6.3 STRUCTUREL (trimestre) — gagner l'autorité, débloquer le volume

| #   | Action                                                                                                                                             | Impact                                 | Effort | Où                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------ | ------------------------------------------------------------------------ |
| ST1 | **Plan d'acquisition de backlinks / digital PR EN** (le vrai écart vs Forbes/CN/Mr&Mrs Smith). Cibler presse voyage US/UK, partenariats hôteliers. | **Décisif** (débloque pos 40 → top 10) | L      | hors-code (marketing) — mais prérequis n°1.                              |
| ST2 | **Débloquer l'indexation** (2,3 % seulement — cf. gsc-indexation) : sitemaps EN dédiés, priorité crawl sur classements EN volume, internal links.  | Décisif                                | L      | `sitemap`/`hubs.xml` + maillage.                                         |
| ST3 | **Speakable JSON-LD** sur classements + fiches EN (assistant vocal / AI).                                                                          | Moyen (GEO)                            | M      | `structured-data` builders.                                              |
| ST4 | **Parité EN totale** (sections, geo_qa re-grounded EN, FAQ couvrant PAA EN mesurés) sur tout le catalogue.                                         | Moyen-Fort                             | L      | pipelines `translate-*` + `enrich-*` avec `groundKeywords(locale='en')`. |
| ST5 | **Suivi mensuel DFS↔GSC EN** (ranked_keywords sur notre domaine + position tracking sur les 30 cibles).                                            | Pilotage                               | M      | nouveau runbook audit.                                                   |

### 6.4 Séquencement recommandé

1. **Semaine 1** : QW1 (Rome multi-pattern) + QW2 (llms.txt EN) → débloque le seul actif volume + ouvre le canal GEO. Coût quasi nul.
2. **Semaines 2-6** : CT1 (`luxury hotels {city}` sur 6 villes) + CT3 (`where to stay`) → on adresse ~70-90k de volume neuf à KD bas, en parallèle de ST1 (PR) qui seul transformera les positions 40 en top 10.
3. **Trimestre** : ST1+ST2 (autorité + indexation) sont le **gating factor** — sans eux, les nouvelles pages plafonneront aussi en page 4. Le contenu n'est pas le frein ; l'autorité l'est.

---

## 7. Annexe — fichiers & requêtes vérifiés

- Code : `apps/web/src/app/[locale]/classement/[slug]/page.tsx` (generateMetadata, hreflang, JSON-LD), `.../hotel/[slug]/page.tsx` (slug_en présent), `apps/web/src/app/llms.txt/route.ts` (FR-only sur rankings/guides).
- Live : `curl.exe https://myconciergehotel.com/en/classement/meilleurs-hotels-rome` → title/meta/canonical/hreflang/JSON-LD EN confirmés.
- GSC : `search_analytics` (query+page, 28 j, filtres `/en/` + USA/GBR), `detect_quick_wins`.
- DataForSEO : `dataforseo_labs_google_keyword_overview` + `..._keyword_ideas` + `..._serp_competitors` + `..._related_keywords`, location US 2840, langue `en` (serveur `user-dfs`).
- Contexte : `gsc-indexation-2026-06-29.md`, `hotel-fiche-grand-audit-2026-06-29.md`.

---

## 8. Suivi d'exécution — CT1 (`luxury hotels {city}`)

**2026-06-29 — CT1 livré sur les 6 villes cibles.** Les heads
`hotel-de-luxe-{ville}` (Paris, Londres, Rome, Venise, Dubai, Tokyo) étaient
déjà publiés et grounded DataForSEO (FAQ EN 12-13/fiche, justifications EN,
`factual_summary_en` en bande, `title_en` « The best luxury hotels in {City} »),
mais portaient un **`intro_en` stub** (108-159 c, le « 1 short phrase » du
générateur v2) qui passait le plancher 80 c de `translate-rankings-intro-factual-en.ts`
→ `/en` rendait une intro d'une phrase au lieu du long-read.

Actions :

- **`intro_en` réécrit en long-read natif en-GB** sur les 6 (4 626-5 501 c,
  parité avec `intro_fr`), via le nouveau flag `--force` de
  `scripts/editorial-pilot/src/rankings/translate-rankings-intro-factual-en.ts`
  (force la re-traduction d'un stub ≥ 80 c ; ignoré sous `--all`). Traduction
  fidèle du FR grounded — facts/keywords préservés ; `hasLeak()` = 0.
- **`meta_title_en` multi-pattern (G2/QW1)** : « Best Luxury Hotels in {City}
  2026: 5-Star Stays » (45-47 c) — couvre `luxury hotels {city}` +
  `best luxury hotels {city}` + `5 star hotels {city}`, et corrige le « 2025 »
  périmé (Paris/Tokyo/Venise).
- Anti-cannibalisation `hotel-de-luxe-*` ↔ `meilleurs-hotels-*` : pin
  `geoHeadKind` déjà en place (`find-related-rankings.ts`).

**Reste à faire (différé, non bloquant)** :

- **G1/CT2 — `slug_en`** : les classements gardent le slug FR sur l'URL EN
  (`/en/classement/hotel-de-luxe-rome`). Changement structurel (schéma +
  resolver + redirects) — non traité ici. Canonical/hreflang corrects donc
  pas de duplicate.
- **QW1 — `meilleurs-hotels-rome`** (head « best hotels in rome », pos 40) :
  même traitement meta multi-pattern + re-ground meta_desc à appliquer.

_Fin de l'audit — la section 8 ci-dessus est le seul ajout post-lecture (suivi d'exécution CT1)._
