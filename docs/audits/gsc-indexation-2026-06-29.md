# Audit indexation Google Search Console — MyConciergeHotel.com

**Date** : 2026-06-29
**Propriété GSC** : `sc-domain:myconciergehotel.com` (permission `siteFullUser`)
**Source données** : MCP `project-0-conciergetravel.fr-gsc` (lecture seule) + sitemaps prod (`curl`)
**Fenêtres** : 28 j (2026-05-30 → 2026-06-27) et 90 j (2026-03-29 → 2026-06-27).
**Note latence** : données GSC à ~2-3 j. Les deux fenêtres renvoient des chiffres
**identiques** (7 clics / 1038 impressions) : toute l'activité de recherche tient
dans les ~28 derniers jours → le site est très jeune, l'historique 90 j n'apporte
aucune page supplémentaire.

---

## 0. TL;DR chiffré

| Métrique                                                       | Valeur                                    |
| -------------------------------------------------------------- | ----------------------------------------- |
| Clics (28 j = 90 j)                                            | **7**                                     |
| Impressions (28 j = 90 j)                                      | **1 038**                                 |
| CTR moyen                                                      | 0,67 %                                    |
| Position moyenne                                               | **15,4**                                  |
| URLs soumises (index sitemaps)                                 | **8 202**                                 |
| Pages distinctes recevant des impressions (proxy d'indexation) | **191**                                   |
| **Taux de couverture global (proxy)**                          | **≈ 2,3 %**                               |
| Verdicts `index_inspect` PASS / échantillon                    | 8 / 11 (les 3 échecs = catalogue profond) |

**Diagnostic central** : l'indexation n'est PAS bloquée techniquement (robots OK,
canonical OK, pages crawlables, les pages bien maillées passent en _Submitted and
indexed_). Le goulot est **le budget de crawl + l'autorité** : l'immense majorité
des 8 202 URLs reste _Discovered – currently not indexed_ ou _URL unknown to Google_.
Même une fiche phare (`/hotel/le-meurice`) est _Discovered, not indexed_.

---

## 1. Sitemaps — prod vs GSC

### 1.1 Index de sitemaps en production (`/sitemap.xml`)

7 sous-sitemaps référencés. Comptage réel des `<loc>` :

| Sous-sitemap             | `<loc>` en prod         | Soumis dans GSC  | Téléchargé GSC | warnings/errors | indexed (GSC) |
| ------------------------ | ----------------------- | ---------------- | -------------- | --------------- | ------------- |
| `hotels.xml`             | **2 984**               | 2 984            | 2026-06-28     | 0 / 0           | 0             |
| `hubs.xml`               | **3 070**               | 3 070            | 2026-06-28     | 0 / 0           | 0             |
| `rankings.xml`           | **1 040**               | **950** ⚠        | 2026-06-28     | 0 / 0           | 0             |
| `places.xml`             | **1 158**               | 1 158            | 2026-06-26     | 0 / 0           | 0             |
| `itineraries.xml`        | **23**                  | 23               | 2026-06-27     | 0 / 0           | 0             |
| `rooms.xml`              | **17**                  | 17               | 2026-06-28     | 0 / 0           | 0             |
| `guides.xml`             | **0** ❌ (fichier vide) | **non listé** ❌ | —              | —               | —             |
| **Index `/sitemap.xml`** | 7 sitemaps              | **8 202**        | 2026-06-29     | 0 / 0           | 0             |

### 1.2 Anomalies de soumission

1. **`guides.xml` est vide ET cassé.** Le fichier renvoie un `<urlset>` sans aucun
   `<loc>` (HTTP 200), alors que **82 guides sont publiés**. Conséquence : Google
   télécharge un sitemap mort, et `guides.xml` n'apparaît même pas dans
   `list_sitemaps` (jamais enregistré côté GSC). Les guides sont en réalité servis
   sous `/destination/<slug>` (voir §3 — `/guide/courchevel` a pour `userCanonical`
   `/destination/courchevel`). → soit peupler `guides.xml`, soit retirer l'entrée
   morte de l'index.
2. **`rankings.xml` désynchronisé.** Prod = 1 040 `<loc>`, GSC = 950 soumis. Drift
   de 90 URLs entre la dernière version générée et ce que GSC a indexé/compté.
3. **`indexed = 0` sur TOUS les sitemaps.** Le compteur « indexed » des sitemaps
   est notoirement peu fiable sur une propriété _domain_, mais ici il est
   uniformément à 0 — cohérent avec une couverture réelle quasi nulle (cf. §2/§3).
4. **`rooms.xml` = 17 URLs seulement** : la surface « sous-pages chambres » est
   quasi inexistante (négligeable, mais 0 impression).

---

## 2. Couverture réelle (proxy impressions)

Une page ne peut recevoir d'impression sans être indexée → **le nombre de pages
distinctes avec impressions est un plancher de l'indexation réelle**. GSC renvoie
**191 pages distinctes** avec impressions (28 j = 90 j).

### 2.1 Ventilation par type de page

| Type (regex URL)                        | Pages avec impressions | dont FR | dont EN | Référentiel soumis     | Couverture  |
| --------------------------------------- | ---------------------- | ------- | ------- | ---------------------- | ----------- |
| `/hotel/` (fiche)                       | **95**                 | 37      | 58      | 2 984 (`hotels.xml`)   | **3,2 %**   |
| `/classement/` + `/classements/`        | **40**                 | 19      | 21      | 1 040 (`rankings.xml`) | **3,8 %**   |
| `/destination/`                         | 19                     | 15      | 4       | — (dans `hubs.xml`)    | —           |
| `/hotels/<pays>/<ville>` (listing)      | 16                     | 6       | 10      | — (dans `hubs.xml`)    | —           |
| `/categorie/` `/marque/` `/label/`      | 6                      | 3       | 3       | — (dans `hubs.xml`)    | —           |
| Statique + home + `/press/`             | 6                      | 5       | 1       | —                      | —           |
| **Sous-total hubs**                     | **47**                 | —       | —       | 3 070 (`hubs.xml`)     | **1,5 %**   |
| `/lieux/` (POI)                         | **4**                  | 3       | 1       | 1 158 (`places.xml`)   | **0,3 %**   |
| `/itineraire/`                          | **3**                  | 3       | 0       | 23 (`itineraries.xml`) | **13,0 %**  |
| `/guide/` (canonical → `/destination/`) | 2                      | 1       | 1       | 0 (`guides.xml` vide)  | n/a         |
| `rooms`                                 | 0                      | 0       | 0       | 17 (`rooms.xml`)       | **0 %**     |
| **TOTAL**                               | **191**                | **91**  | **100** | **8 202**              | **≈ 2,3 %** |

### 2.2 FR vs EN

| Locale               | Pages avec impressions | Impressions      | Clics | CTR        | Position moy. |
| -------------------- | ---------------------- | ---------------- | ----- | ---------- | ------------- |
| **FR** (`/`, `/fr/`) | 91                     | **471** (45,4 %) | **6** | **1,27 %** | meilleure     |
| **EN** (`/en/`)      | 100                    | **567** (54,6 %) | **1** | **0,18 %** | 17,4          |
| Total                | 191                    | 1 038            | 7     | 0,67 %     | 15,4          |

**Lecture** : l'EN génère **plus d'impressions et plus de pages indexées** (porté
par 58 fiches hôtel EN vs 37 FR), mais **ne convertit pas** (CTR 0,18 %, 1 seul
clic, positions plus profondes). Le FR est le locale fort en valeur (6 clics sur 7).

---

## 3. Inspection ponctuelle (`index_inspect`)

Échantillon représentatif de 11 URLs couvrant chaque type.

| URL                                     | Type               | Verdict     | coverageState                          | lastCrawlTime | robots / indexing | Note                                        |
| --------------------------------------- | ------------------ | ----------- | -------------------------------------- | ------------- | ----------------- | ------------------------------------------- |
| `/`                                     | home               | **PASS**    | Submitted and indexed                  | 2026-06-24    | ALLOWED / ALLOWED | OK                                          |
| `/classement/palaces-de-france-2026`    | ranking            | **PASS**    | Submitted and indexed                  | 2026-06-24    | ALLOWED / ALLOWED | Breadcrumb rich result                      |
| `/hotel/le-bristol-paris`               | hôtel FR           | **PASS**    | Submitted and indexed                  | 2026-05-28    | ALLOWED / ALLOWED | ⚠ Event JSON-LD invalides                   |
| `/en/hotel/four-seasons-hotel-george-v` | hôtel EN           | **PASS**    | Submitted and indexed                  | 2026-06-04    | ALLOWED / ALLOWED | OK                                          |
| `/destination/paris`                    | destination        | **PASS**    | Submitted and indexed                  | 2026-06-24    | ALLOWED / ALLOWED | OK                                          |
| `/guide/courchevel`                     | guide              | **PASS**    | Submitted and indexed                  | 2026-05-31    | ALLOWED / ALLOWED | ⚠ userCanonical = `/destination/courchevel` |
| `/lieux/paris/roland-garros-porte-30`   | POI                | **PASS**    | Submitted and indexed                  | 2026-06-26    | ALLOWED / ALLOWED | OK                                          |
| `/itineraire/maldives-luxe-7-jours`     | itinéraire         | **PASS**    | Submitted and indexed                  | 2026-05-28    | ALLOWED / ALLOWED | OK                                          |
| `/hotel/le-meurice`                     | hôtel FR (profond) | **NEUTRAL** | **Discovered – currently not indexed** | —             | —                 | Phare Paris, maillé, **pas indexé**         |
| `/hotel/jumeirah-bali`                  | hôtel (profond)    | **NEUTRAL** | **Discovered – currently not indexed** | —             | —                 | dans sitemap, non indexé                    |
| `/hotel/jumeirah-al-naseem`             | hôtel (profond)    | **NEUTRAL** | **URL is unknown to Google**           | —             | —                 | **même pas découverte**                     |

**Conclusion §3** : 8/8 des pages bien maillées (home, classements, destinations,
fiches référencées dans les hubs, itinéraires, POI vedette) sont **indexées
proprement** — aucune barrière technique (robots/canonical/fetch tous sains).
3/3 des pages du catalogue profond échouent : deux _Discovered – not indexed_,
une _URL unknown to Google_. **Le problème est l'accès au crawl/autorité, pas la
technique.**

---

## 4. Synthèse

### 4.1 Combien de pages indexées vs ~3 000 (et 8 202 soumises)

- **Proxy d'indexation = 191 pages** reçoivent des impressions (plancher réel).
- Référentiel soumis = **8 202 URLs** (dont ~2 984 hôtels + 3 070 hubs + 1 040
  classements + 1 158 lieux + 23 itinéraires + 17 chambres).
- **Taux de couverture global ≈ 2,3 %.** Même rapporté au seul catalogue hôtels
  publiés (~2 984), les ~95 fiches avec impressions = **3,2 %**.
- Les sitemaps GSC affichent `indexed = 0` partout (compteur lag, mais cohérent
  avec la quasi-absence de couverture).

### 4.2 Gros gaps par type

1. **Lieux/POI — 0,3 %** (4 / 1 158). Le pire taux : 1 158 pages POI minces
   noient le budget de crawl, quasi aucune n'est indexée.
2. **Hubs — 1,5 %** (47 / 3 070). `hubs.xml` est le plus gros sitemap (3 070) mais
   l'un des moins couverts.
3. **Hôtels — 3,2 %** (95 / 2 984). 96 %+ du catalogue (y compris `le-meurice`)
   est _Discovered/Unknown_. C'est le gisement principal en volume.
4. **Classements — 3,8 %** (40 / 1 040). Les « portes d'entrée SEO » du projet ne
   sont indexées qu'à 4 % — chantier prioritaire en valeur business.
5. **Guides — sitemap mort** (`guides.xml` vide ; 82 guides publiés non exposés via
   leur sitemap dédié ; URLs `/guide/*` en doublon canonical de `/destination/*`).

### 4.3 FR vs EN

EN = plus de pages indexées (100 vs 91) et d'impressions (567 vs 471) mais
CTR 0,18 % et 1 clic ; FR = 6 clics, CTR 1,27 %. **Le FR porte la valeur, l'EN
consomme du crawl sans convertir.**

---

## 5. Recommandations priorisées (concrètes)

> Contexte : phase éditoriale (booking gelé), classements = portes d'entrée SEO,
> benchmark yonder.fr. Enjeu n°1 = **couverture d'indexation + autorité**.

1. **Réparer `guides.xml` + lever le doublon `/guide/` ↔ `/destination/`** _(quick win, 1 commit)_.
   Le fichier est vide alors que 82 guides sont publiés. Soit générer les 82 `<loc>`
   dans `guides.xml`, soit **supprimer l'entrée morte de `/sitemap.xml`** pour cesser
   de faire télécharger un sitemap vide à Google. En parallèle, comme `/guide/courchevel`
   déclare `userCanonical = /destination/courchevel`, **301-rediriger les URLs `/guide/*`
   legacy vers `/destination/*`** afin de ne plus gaspiller de crawl sur des doublons.

2. **Concentrer le budget de crawl sur une colonne vertébrale prioritaire.**
   8 202 URLs sur un domaine jeune et peu autoritaire diluent le crawl. Émettre/soumettre
   en priorité un sous-ensemble à forte valeur (les **1 040 classements** + les ~**500
   fiches hôtel phares** + destinations majeures) avec `<priority>` élevé, et différer
   la pression des 1 158 POI minces et des fiches secondaires tant que l'autorité n'a
   pas grimpé. Objectif : faire indexer la colonne vertébrale d'abord, puis élargir.

3. **Corriger les `<lastmod>` (tous identiques = ignorés par Google).** Les 7 sitemaps
   partagent l'horodatage de génération (`...T03:09:50.527Z`) au lieu du `updated_at`
   réel du contenu. Google ignore un `lastmod` non fiable → il ne re-crawle pas en
   priorité les pages réellement modifiées. Mapper `<lastmod>` sur la vraie date de
   mise à jour de la ligne, puis **re-soumettre `rankings.xml`** (1 040 prod vs 950 GSC).

4. **Densifier le maillage interne vers le catalogue profond** _(le levier d'indexation #1 hors backlinks)_.
   `le-meurice` est maillé depuis `/destination/paris` + un classement et reste
   _Discovered – not indexed_ → il faut **plus** de liens contextuels et descendants.
   Garantir que chaque hôtel/POI est atteignable en ≤ 3 clics ; ajouter des modules
   « hôtels à <ville> », « hôtels similaires », « lieux à proximité » (maillage
   hôtel↔lieu bidirectionnel déjà prévu par ADR-0030) sur les pages **déjà indexées**
   (classements, destinations) pour irriguer les pages _Unknown_/_Discovered_.

5. **Gagner de l'autorité (cause racine de la position 15,4 et des _Discovered_).**
   Le site est absent du top-20 ; sur un domaine à faible autorité, faire passer une
   page de _Discovered_ à _Indexed_ dépend surtout des signaux d'autorité. Lancer une
   campagne de netlinking (digital PR, page « pour les hôteliers », presse, partenariats
   Atout France/Relais & Châteaux, citations) — c'est ce qui débloquera massivement
   l'indexation du catalogue.

6. **Trancher la stratégie EN.** L'EN consomme du crawl (100 pages, 567 impressions)
   pour 1 clic (CTR 0,18 %). Soit améliorer titres/meta + vérifier la réciprocité
   `hreflang` FR↔EN (pour éviter cannibalisation/doublon), soit réduire la pression de
   crawl EN afin de concentrer le budget sur la colonne FR (6 clics / 7) tant que
   l'autorité est faible.

7. **Désaturer / muscler les 1 158 POI (`places.xml`).** Couverture 0,3 %. Soit
   surfacer les lieux depuis les hubs destination + JSON-LD `TouristAttraction` +
   maillage hôtel↔lieu, soit retirer temporairement les POI les plus minces du sitemap
   pour ne pas noyer le crawl, jusqu'à montée en autorité.

8. **Nettoyer le JSON-LD `Event` des fiches hôtel** _(hygiène rich results)_.
   `index_inspect` remonte des items `Event` (marchés, expositions POI) avec champs
   requis manquants (`organizer`, `performer`, `image`, `offers`, `validFrom`) sur
   `le-bristol-paris` et `four-seasons-hotel-george-v`. Compléter ou retirer ces blocs
   `Event` pour éviter des items structurés invalides.

---

## 6. Annexe — méthode

- Outils MCP utilisés (lecture seule) : `list_sites`, `list_sitemaps`, `get_sitemap`
  (via `list_sitemaps`), `search_analytics`, `enhanced_search_analytics` (schéma),
  `detect_quick_wins`, `index_inspect`. **`submit_sitemap` non appelé** (audit RO).
- Comptage prod : `curl.exe -s <sitemap> | Select-String "<loc>"`.
- `detect_quick_wins` (minImpr 20, maxCtr 2 %, pos 4-30) = **0 opportunité** : aucune
  page ne réunit volume + position exploitable + CTR faible → confirme un site encore
  trop jeune/peu visible pour des « quick wins » de CTR ; la priorité reste la
  couverture et l'autorité, pas l'optimisation de CTR.
- Baseline catalogue : `apps/web/src/lib/catalogue-stats.ts` (2 984 hôtels / 128 pays
  / 479 R&C ; surfaces sœurs : ~816 classements, 82 guides, 1 147 POI, 23 itinéraires).
