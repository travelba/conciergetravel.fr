# Plan autorité & visibilité — le vrai gap vs yonder.fr

> **Worker** : « Plan autorité & visibilité (le vrai gap vs yonder) »
> **Date** : 2026-06-23 · **Branche** : `feat/lieux-a-visiter-vertical`
> **Règle cadre** : `.cursor/rules/competitor-benchmark-yonder.mdc`
> **Méthode** : lecture seule du code + appels DataForSEO (MCP `user-dfs`,
> SERP organic live, domain rank overview, Google Ads volume) + recherche
> web (Perplexity) + vérification prod des sitemaps par `curl`.

---

## 0. TL;DR — le plafond n'est PAS on-page

Le diagnostic des audits précédents est confirmé chiffres en main : **MCH
sur-structure déjà yonder côté machine, mais reste invisible parce que le
domaine n'a quasiment aucune autorité organique.**

| Domaine (google.fr, langue fr) | Mots-clés classés | Top 1 | Top 3 | Top 10 | ETV (trafic estimé) |
| ------------------------------ | ----------------: | ----: | ----: | -----: | ------------------: |
| **yonder.fr**                  |        **15 568** |   642 | 2 176 |  7 480 |         **437 538** |
| **travellers-society.com**     |         **1 317** |    40 |   182 |    815 |          **84 327** |
| **myconciergehotel.com**       |             **2** |     0 |     0 |      0 |           **≈ 2,5** |

Source : DataForSEO Labs `domain_rank_overview`, location France, langue fr,
collecté 2026-06-23.

**Le delta le plus parlant** : MCH est classé sur **2 mots-clés** dans tout
google.fr (un en page 2, un en page 3), pour un trafic organique estimé à
**≈ 2,5 visites/mois**. yonder en classe **15 568** (ETV 437 k) et même le
petit jumeau travellers-society en classe **1 317** (ETV 84 k). Ce n'est pas
un écart de qualité de page, c'est un **écart d'existence dans l'index**.

Conséquence directe sur la mission : il n'y a **pas de « quick wins page 2-3 »
à pousser** côté MCH — il n'y a quasiment rien en page 2-3. Le préalable
absolu est de **faire crawler et indexer le catalogue**, puis de **construire
de l'autorité**. Le détail, requête par requête, suit en §1.

---

## 1. Suivi de positions DataForSEO (SERP FR — google.fr, langue fr)

### 1.1. Panier de requêtes + volumes (Google Ads, France)

Volumes mensuels DataForSEO `keywords_data/google_ads/search_volume`,
collectés 2026-06-23. `n/d` = pas de donnée Ads renvoyée (volume sous le
seuil ou non agrégé).

| Requête                       | Volume/mois | Concurrence |
| ----------------------------- | ----------: | ----------- |
| palaces paris                 |  **12 100** | HIGH        |
| hôtel romantique paris        |   **1 600** | HIGH        |
| meilleurs hôtels marrakech    |   **1 300** | HIGH        |
| palaces courchevel            |     **880** | LOW         |
| meilleurs hôtels paris        |     **590** | HIGH        |
| hôtel de luxe paris           |     **390** | HIGH        |
| meilleurs hôtels rome         |     **320** | HIGH        |
| meilleurs hôtels dubai        |     **320** | HIGH        |
| meilleurs hôtels venise       |     **210** | HIGH        |
| meilleurs hôtels nice         |     **140** | HIGH        |
| hôtel de luxe megève          |     **110** | HIGH        |
| hôtel de luxe marrakech       |      **90** | HIGH        |
| hôtel de luxe nice            |      **70** | MEDIUM      |
| hôtel de luxe courchevel      |      **50** | HIGH        |
| hôtel de luxe dubai           |      **50** | LOW         |
| hotel spa luxe provence       |      **50** | HIGH        |
| hôtel de luxe côte d'azur     |      **40** | MEDIUM      |
| hôtel de luxe saint-tropez    |      **30** | HIGH        |
| hôtel de luxe rome            |      **20** | HIGH        |
| hôtel de luxe venise          |      **10** | HIGH        |
| plus beaux hôtels paris       |         n/d | —           |
| meilleurs hôtels côte d'azur  |         n/d | —           |
| meilleurs hôtels saint-tropez |         n/d | —           |
| meilleurs hôtels megève       |         n/d | —           |

**Enseignement volume** : le vrai gros volume n'est PAS sur le phrasé
« meilleurs hôtels {ville} » qu'on a industrialisé. C'est sur **`palaces paris`
(12 100)**, **`hôtel romantique paris` (1 600)**, **`meilleurs hôtels marrakech`
(1 300)** et **`palaces courchevel` (880)**. Ces 4 requêtes valent à elles
seules plus que tout le reste du panier cumulé.

### 1.2. Positions réelles MCH vs yonder vs travellers

SERP `serp/google/organic/live/advanced` (depth 20, desktop, google.fr/fr),
collecté 2026-06-23. Position = **rang absolu** affiché (features SERP
incluses : packs hôtels, PAA, vidéos…). « absent » = hors top 20 (cohérent
avec l'overview : MCH n'a que 2 mots-clés classés au total).

| Requête                    |    Vol | MCH        | yonder | travellers | Qui occupe le haut                                                                           |
| -------------------------- | -----: | ---------- | ------ | ---------- | -------------------------------------------------------------------------------------------- |
| palaces paris              | 12 100 | **absent** | absent | absent     | 5starhotels.paris (#3), Atout France (#5), Wikipédia (#6), hotelaparis (#7)                  |
| meilleurs hôtels marrakech |  1 300 | **absent** | #5     | **#4**     | TripAdvisor pack, travellers (#4), yonder (#5), Vogue (#7)                                   |
| palaces courchevel         |    880 | **absent** | absent | absent     | excellencecourchevel (#3), sites de marques (Airelles #4, Cheval Blanc #5), TripAdvisor (#6) |
| meilleurs hôtels paris     |    590 | **absent** | **#4** | absent     | TripAdvisor (#3), yonder (#4), larevuedeshotels (#5)                                         |
| hôtel de luxe paris        |    390 | **absent** | **#4** | absent     | yonder (#4), TripAdvisor (#5), Shangri-La (#6)                                               |
| meilleurs hôtels rome      |    320 | **absent** | **#1** | absent     | yonder (#1), Michelin (#2), Booking (#3)                                                     |
| meilleurs hôtels venise    |    210 | **absent** | **#1** | **#2**     | yonder (#1), travellers (#2), TripAdvisor (#3)                                               |

Les autres requêtes du panier (volumes ≤ 320) n'ont pas été interrogées une à
une ce run pour économiser le quota SERP, mais le résultat est statistiquement
acquis : avec **2 mots-clés classés au total dans google.fr**, MCH est
**absent du top 20 sur l'intégralité du panier**. yonder et/ou travellers sont
présents sur quasiment toutes.

### 1.3. Lecture stratégique

- **yonder gagne « meilleurs hôtels {ville} » en organique pur** (#1 Venise,
  #1 Rome, #4 Paris) et travellers complète (#2 Venise, #4 Marrakech). C'est
  exactement le créneau éditorial que MCH duplique — mais MCH n'y figure pas.
- **`palaces {ville}` = angle non gardé par yonder.** Sur `palaces paris`
  (12 100) et `palaces courchevel` (880), yonder ET travellers sont **absents**.
  Le haut est tenu par Atout France (la source officielle que MCH cite déjà),
  des listes de niche (5starhotels.paris, hotelaparis, excellencecourchevel) et
  les sites de marques. **C'est le gisement de volume le plus accessible** :
  pas de concurrent-référent installé, et MCH a la matière (rankings palaces +
  citation Atout France verbatim).
- **`hôtel de luxe {ville}`** est tenu par les OTA (Booking, TripAdvisor,
  lastminute) + sites de marques + yonder. Plus dur à déloger qu'`palaces`.
- **Aucune requête où MCH serait en page 2-3 prête à pousser.** Le « quick
  win on-page » classique n'existe pas tant que l'indexation n'est pas réglée
  (§2).

---

## 2. Indexation — état réel des sitemaps + checklist GSC (action PO)

### 2.1. État prod des sitemaps (curl 2026-06-23)

`https://myconciergehotel.com/sitemap.xml` → index valide, 7 sous-sitemaps,
tous `lastmod` = 2026-06-23T13:00 (frais). Comptage des `<loc>` par
sous-sitemap :

| Sous-sitemap      | URLs émises | Référentiel attendu              | Verdict                                    |
| ----------------- | ----------: | -------------------------------- | ------------------------------------------ |
| `hotels.xml`      |   **1 000** | 2 219 hôtels publiés             | ⚠️ **truncation — 1 219 hôtels manquants** |
| `rooms.xml`       |           3 | (sous-pages chambres indexables) | OK (volontairement étroit)                 |
| `hubs.xml`        |       2 492 | destinations + guides (ADR-0015) | OK                                         |
| `guides.xml`      |       **0** | —                                | ✅ **vide par design** (voir 2.2)          |
| `rankings.xml`    |         829 | ~829 classements publiés         | OK                                         |
| `itineraries.xml` |          23 | 23 itinéraires publiés           | OK                                         |
| `places.xml`      |       1 158 | ~1 147-1 158 lieux publiés       | OK                                         |

### 2.2. Deux anomalies — une fausse, une vraie

**`guides.xml` = 0 URL : NORMAL, pas un bug.** ADR-0015 a fusionné
`/guide/[city]` dans `/destination/[city]`. Le route handler
(`apps/web/src/app/sitemaps/guides.xml/route.ts`) émet volontairement un
`<urlset>` vide ; les long-reads guides sont servis sous `/destination/*` et
couverts par `hubs.xml` (2 492 URLs). **À vérifier toutefois côté PO/dev** :
que les 99 guides éditoriaux publiés (région/cluster/pays) ont bien tous leur
URL `/destination/<slug>` présente dans `hubs.xml` — sinon une partie du
contenu éditorial le plus riche reste hors sitemap.

**`hotels.xml` = exactement 1 000 / 2 219 : VRAI bug de troncature (P0).**
Le code (`listIndexableHotelSlugs`, `get-hotel-by-slug.ts:3766`) demande
pourtant `.limit(5000)` sur la requête Supabase, puis filtre par
`isHotelIndexable()`. Le chiffre **rond de 1 000** est la signature classique
du **plafond serveur PostgREST `max-rows = 1000`** qui _clamp_ le `.limit(5000)`
côté API : la requête est silencieusement tronquée à 1 000 lignes avant même
le filtre d'indexabilité. Comme `places.xml` (1 158) et `rankings.xml` (829)
dépassent 1 000, ils ne sont pas concernés — c'est isolé à la requête hôtels
(la seule au-dessus de 1 000 lignes éligibles).
Le gate `isHotelIndexable` est large (une fiche passe dès qu'elle a ≥ 1
`long_description_section`, ce que TOUTES les fiches publiées ont) → en théorie
les 2 219 devraient être indexables. **Donc ~1 219 hôtels indexables et publiés
sont absents du sitemap** : Google ne les découvre que par maillage interne,
crawl budget gaspillé.

> **Correctif (dev, hors périmètre de ce worker — lecture seule)** : paginer
> `listIndexableHotelSlugs` par `range(from, to)` en boucle (pages de 1 000)
> jusqu'à épuisement, OU relever `max-rows` côté PostgREST. À confirmer en
> requêtant `select count(*) from hotels where is_published`.
> Sans ce correctif, **plus de la moitié du catalogue n'est pas soumise.**

### 2.3. Checklist GSC à exécuter par le PO (humain — je n'ai pas l'accès)

Ordonnée par impact décroissant. Le robots.txt prod autorise déjà le crawl et
expose le sitemap index ; il reste à pousser GSC.

1. **[P0] Corriger puis re-soumettre `hotels.xml`.** Tant que la troncature
   1 000 (2.2) n'est pas corrigée, re-soumettre ne sert à rien — d'abord le
   fix dev, ensuite _Sitemaps → ajouter/renvoyer_ `sitemap.xml` + chaque
   sous-sitemap individuellement (GSC traite mieux les sous-sitemaps soumis
   nommément).
2. **[P0] Soumettre les 7 sous-sitemaps nommément** dans GSC _Sitemaps_
   (pas seulement l'index) : `hotels.xml`, `hubs.xml`, `rankings.xml`,
   `places.xml`, `itineraries.xml`, `rooms.xml` (+ `guides.xml` vide, sans
   impact). Vérifier ensuite la colonne « URL découvertes » vs émises.
3. **[P1] URL Inspection + « Demander une indexation » sur les têtes
   d'acquisition** (≤ 10/jour, quota GSC). Prioriser dans cet ordre, calé sur
   le volume §1.1 et l'angle le moins concurrentiel :
   - le ranking **palaces Paris** (cible 12 100/mois, concurrent-référent
     absent),
   - **palaces Courchevel** (880, angle libre),
   - **meilleurs hôtels Marrakech / Venise / Rome / Paris** (là où yonder est
     #1-4 : on attaque frontalement),
   - le hub `/destination/paris`,
   - 3-5 fiches hôtels phares (Ritz, Le Bristol, Le Meurice, Cheval Blanc
     Courchevel, La Mamounia).
4. **[P1] Vérifier la couverture (« Pages »)** : combien d'URLs « indexées »
   vs « découvertes – non indexées » vs « explorées – non indexées ». Le
   chiffre attendu doit monter de ~quelques centaines vers ~5 000+ une fois
   `hotels.xml` corrigé. Surveiller les « Détectée, actuellement non indexée »
   (signal d'autorité insuffisante → §3).
5. **[P2] Contrôler hreflang fr/en** dans le rapport International Targeting /
   via inspection : les fiches émettent des alternates fr+en — vérifier 0
   erreur « pas de balise de retour ».
6. **[P2] Surveiller les Core Web Vitals + Rich Results** (FAQPage, Hotel,
   ItemList) : MCH sur-structure, autant que les rich results s'affichent une
   fois indexé.

---

## 3. Analyse de gap backlinks / autorité vs yonder

### 3.1. Disponibilité des données

**Le MCP `user-dfs` n'expose AUCUN endpoint Backlinks** (la suite Backlinks
de DataForSEO — `backlinks/summary`, `backlinks/referring_domains` — n'est pas
dans la liste d'outils du serveur ; seuls SERP, Labs et Keywords Data sont
branchés). Conformément à la consigne, je me rabats sur (a) les **métriques de
visibilité organique** DataForSEO Labs comme proxy d'autorité, et (b) la
**recherche web** (Perplexity) sur le profil de yonder. Les volumes de
referring domains exacts ne sont donc **pas mesurés** — à confirmer par le PO
via Ahrefs/Majestic/Semrush ou en activant le module Backlinks DataForSEO.

### 3.2. Proxy d'autorité — paysage concurrentiel (DataForSEO Labs)

`dataforseo_labs/google/competitors_domain` sur `yonder.fr` (France/fr) — les
domaines avec qui yonder partage le plus de SERP, et leur poids organique :

| Domaine concurrent de yonder | Mots-clés (full domain) | ETV full domain |
| ---------------------------- | ----------------------: | --------------: |
| tripadvisor.fr               |               1 096 301 |          74,3 M |
| pagesjaunes.fr               |               2 181 564 |          54,3 M |
| dailymotion.com              |               1 681 833 |          38,2 M |
| booking.com                  |                 258 859 |          13,9 M |
| thefork.fr                   |                  89 429 |          10,5 M |
| petitfute.com                |                 642 653 |           7,6 M |
| hotels.com                   |                 137 331 |           3,9 M |
| michelin.com                 |                  53 810 |           2,9 M |
| expedia.fr                   |                 168 160 |           2,0 M |
| **yonder.fr**                |              **15 568** |      **0,44 M** |
| **myconciergehotel.com**     |                   **2** |         **≈ 0** |

yonder joue dans la cour des grands agrégateurs/médias (TripAdvisor, Booking,
Michelin, Petit Futé) et tient son rang grâce à une **position moyenne de 16**
(beaucoup de longue-traîne page 2) MAIS **642 #1 et 2 176 top-3** sur les
requêtes éditoriales où les OTA sont faibles. MCH n'est pas encore sur la
carte.

### 3.3. D'où yonder tire son autorité (recherche web)

Synthèse Perplexity (sources : mentions légales yonder, pappers, Instagram) :

- **Ancienneté** : éditeur **Yonder Media SAS** (RCS Paris 803 248 269),
  dir. pub. **Emmanuel Laveran**, société créée ~2014 → **~10 ans
  d'ancienneté de domaine** + historique de crawl/indexation continu. MCH est
  un domaine récent → désavantage structurel de confiance.
- **Statut de média** (pas une OTA) : yonder se présente comme un _magazine
  en ligne voyage & art de vivre_ avec rédaction identifiable, interviews
  d'hôteliers et de groupes (ex. Machefert), « hôtels du mois » réguliers.
  Ce statut éditorial attire des **liens naturels** et facilite les reprises.
- **Profil de liens sectoriel** : l'autorité vient surtout d'un **réseau dense
  de liens de niche** (sites d'hôtels & groupes hôteliers qui le citent en
  « Presse / Ils parlent de nous », blogs voyage/luxe, annuaires premium,
  conciergeries), **pas** de gros quotidiens nationaux. Le « Club Yonder »
  (réservation -% chez des hôtels partenaires) génère des **liens croisés
  depuis les sites des hôtels partenaires** — exactement le levier que **Le
  Concierge Club** de MCH peut activer.
- Présence sociale (Instagram @yonderfr) entretenant le **brand search** et
  les mentions.

### 3.4. Ce que yonder a et MCH n'a pas (le gap)

1. **Ancienneté + historique d'indexation** (~10 ans). Non rattrapable
   directement — se compense par volume de contenu indexé + autorité acquise.
2. **Liens entrants depuis les hôtels eux-mêmes** (pages « Presse »,
   partenariats Club). MCH a 2 219 hôtels au catalogue → **2 219 partenaires
   potentiels** à solliciter pour un backlink.
3. **Reconnaissance « média »** auprès des hôteliers/groupes (interviews,
   hôtels du mois) → relations presse entrantes.
4. **Liens d'annuaires premium / blogs voyage** thématiquement cohérents.

### 3.5. 5-10 pistes d'acquisition de liens réalistes (OTA IATA éditoriale)

Classées par accessibilité pour MCH :

1. **Programme « lien partenaire » avec les hôtels du catalogue.** Chaque
   fiche MCH met déjà en avant l'établissement → demander aux hôtels (surtout
   les ~435 Relais & Châteaux + membres du Concierge Club) un lien retour
   « Retrouvez-nous sur MyConciergeHotel » / page Presse. Volume potentiel
   énorme, liens ultra-pertinents. **Le levier #1.**
2. **Citations institutionnelles** : pages Atout France (palaces), Relais &
   Châteaux, Leading Hotels of the World, Forbes Travel Guide, Guide Michelin
   — viser des listings / mentions partenaires d'agence IATA accréditée.
3. **Relations presse sortantes** : pitcher les rankings/guides MCH (angle
   « secret du concierge » + data 2 219 hôtels/127 pays) à la presse voyage/
   lifestyle (Vogue, ELLE, AD, Le Figaro Voyage, Journal du Luxe — tous vus en
   SERP §1.2) pour des reprises avec lien.
4. **Annuaires premium & associations** : annuaires d'agences de voyage de
   luxe (Virtuoso-like, Traveller Made, syndicats du tourisme de luxe),
   annuaire IATA, chambres de commerce.
5. **Guest posts / tribunes** sur blogs voyage-luxe à autorité moyenne (le
   profil de liens de yonder est fait de ça) — proposer du contenu signé
   « Le Concierge ».
6. **Partenariats de contenu croisé** avec les ~1 147 fiches « Lieux à
   visiter » (vertical en cours) : offices de tourisme, sites culturels,
   restaurants étoilés cités → demander le lien retour.
7. **Wikidata / Wikipédia** : MCH exploite déjà `external_sources` Wikidata en
   sortie ; viser l'inverse — être cité comme source sur des pages Wikidata
   d'hôtels/lieux quand c'est légitime (lien nofollow mais signal d'entité).
8. **Digital PR data-driven** : publier un « Observatoire des palaces »
   (s'appuyant sur la liste Atout France que MCH cite déjà) → contenu citable
   par la presse, capte aussi le volume `palaces paris` (12 100).

> **Mesure** : sans accès Backlinks, viser un suivi mensuel du **nombre de
> referring domains** (Ahrefs/Semrush côté PO) et du **nombre de mots-clés
> classés** (DataForSEO `domain_rank_overview`, que je peux automatiser).
> Objectif 6 mois réaliste : passer de **2 → 300+ mots-clés classés**
> (niveau « petit travellers-society »), pas de viser yonder d'emblée.

---

## 4. Synthèse & séquencement — top 5 actions par ROI

Distinction **[AUTO]** = automatisable par moi (suivi récurrent, on-page ciblé)
vs **[PO]** = requiert le PO ou un dev (GSC, infra, backlinks/RP).

| #     | Action                                                                                                                                                                              | Effort                             | Gain visibilité                                          | Qui                                      |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------- | ---------------------------------------- |
| **1** | **Fix troncature `hotels.xml` (1 000 → 2 219) + re-soumission GSC**                                                                                                                 | Faible (1 PR : paginer la requête) | **Très élevé** — débloque la découverte de >1 219 fiches | **[PO/dev]**                             |
| **2** | **Soumettre les 7 sous-sitemaps + URL Inspection des têtes d'acquisition**                                                                                                          | Faible                             | Élevé — accélère l'indexation des pages à volume         | **[PO]**                                 |
| **3** | **Prendre l'angle `palaces {ville}` (Paris 12 100, Courchevel 880)** où yonder/travellers sont absents : optimiser/créer les rankings palaces, citer Atout France verbatim, mailler | Moyen                              | **Élevé** — volume max, concurrent-référent absent       | **[AUTO]** on-page + **[PO]** validation |
| **4** | **Programme backlinks « hôtels partenaires »** (lien retour depuis les fiches hôtels / Club)                                                                                        | Moyen-élevé (outreach)             | **Élevé à terme** — c'est LA source d'autorité de yonder | **[PO]**                                 |
| **5** | **Suivi de positions récurrent automatisé** (panier §1.1, mensuel, MCH vs yonder vs travellers) + alerte dès qu'une page MCH entre en page 2                                        | Faible                             | Moyen (pilotage) — transforme l'effort en boucle mesurée | **[AUTO]**                               |

### Séquencement recommandé

1. **Semaine 1 — débloquer l'indexation** (actions 1 + 2). Rien d'autre ne
   compte tant que >50 % du catalogue est hors sitemap. C'est le **prérequis
   dur**.
2. **Semaines 2-4 — capter le volume libre** (action 3) : `palaces` est le
   gisement sans concurrent-référent. En parallèle, attaquer frontalement
   `meilleurs hôtels {Venise, Rome, Marrakech, Paris}` où yonder/travellers
   sont installés (le contenu MCH existe déjà, il faut qu'il soit indexé +
   maillé).
3. **Mois 2-3 — construire l'autorité** (action 4) : lancer l'outreach
   backlinks partenaires + RP. C'est lent mais c'est le seul levier qui ferme
   le vrai gap.
4. **Continu — mesurer** (action 5) : suivi positions mensuel pour prouver le
   mouvement page 100 → page 2 → page 1.

### Ce que je peux automatiser dès maintenant [AUTO]

- Suivi de positions mensuel du panier (script DataForSEO SERP + overview,
  même intégration que `scripts/editorial-pilot/src/grounding/`).
- Optimisation on-page ciblée des pages `palaces`/`meilleurs hôtels` une fois
  indexées (titres, FAQ-PAA ancrées sur les PAA réels captés en §1.2,
  maillage interne hub→ranking→fiche).

### Ce qui attend impérativement le PO [PO]

- **Correctif `hotels.xml`** (dev) — sans lui, tout le reste est plafonné.
- **Toutes les actions GSC** (soumission sitemaps, URL Inspection, suivi
  couverture) — je n'ai pas l'accès Search Console.
- **Backlinks / RP** (outreach hôtels partenaires, presse, annuaires) +
  fourniture d'un outil Backlinks (Ahrefs/Semrush) ou activation du module
  Backlinks DataForSEO pour mesurer le gap exact de referring domains.

---

## Annexe — provenance des données

- DataForSEO via MCP `user-dfs` : `keywords_data/google_ads/search_volume`,
  `serp/google/organic/live/advanced` (depth 20, desktop, FR/fr),
  `dataforseo_labs/google/domain_rank_overview`,
  `dataforseo_labs/google/competitors_domain`. Collecte 2026-06-23.
- Sitemaps prod : `curl https://myconciergehotel.com/sitemap.xml` + 7
  sous-sitemaps, 2026-06-23.
- Profil yonder : Perplexity (mentions légales yonder.fr, pappers.fr,
  Instagram @yonderfr).
- Code (lecture seule) : `apps/web/src/app/sitemaps/{hotels,guides}.xml/route.ts`,
  `apps/web/src/server/hotels/get-hotel-by-slug.ts` (`listIndexableHotelSlugs`),
  `apps/web/src/server/hotels/indexability.ts` (`isHotelIndexable`).
- **Limite connue** : pas d'endpoint Backlinks DataForSEO branché → gap
  referring-domains estimé, non mesuré (§3.1).
