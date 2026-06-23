# Re-audit VÉRIFICATION prod — Contenu/SEO + Business + Benchmark concurrentiel

> Worker de RE-AUDIT post go-live. La PR #162 a été mergée et **déployée en
> PRODUCTION** (`https://myconciergehotel.com`). Objet : vérifier sur la **prod
> live** que les correctifs Contenu/SEO + Business de
> [`02-contenu-seo.md`](02-contenu-seo.md) + [`04-metier-auth-design.md`](04-metier-auth-design.md)
> ont atterri, refaire le **benchmark obligatoire vs yonder.fr /
> travellers-society.com** (`.cursor/rules/competitor-benchmark-yonder.mdc`),
> et lister le delta restant.
>
> Méthode : `Invoke-WebRequest` (PowerShell) sur la prod + lecture repo + MCP
> web. Pas de Chrome (Playwright KO `Chromium not found`). Audit **lecture seule**
> hors ce `.md`. Date : 2026-06-23. Branche : `feat/lieux-a-visiter-vertical`.

---

## 1. Correctifs Contenu/SEO + Business — PASS/FAIL (preuve prod)

| #   | Correctif attendu                                                 |           Verdict            | Preuve live |
| --- | ----------------------------------------------------------------- | :--------------------------: | ----------- |
| 1   | **og:image classements** (P0 des 688 pages)                       |         ✅ **PASS**          | Voir §1.1   |
| 2   | **Parité EN classements** (intro_en + justif_en)                  |    ✅ **PASS** (1 résidu)    | Voir §1.2   |
| 3   | **Caveat localisation table EN** (badge/teaser/budget FR sur /en) | ⚠️ **CONFIRMÉ — gap ouvert** | Voir §1.3   |
| 4   | **Newsletter** : CTA honnête, plus de form désactivé              |         ✅ **PASS**          | Voir §1.4   |
| 5   | **Copy WhatsApp** : plus de « 24/7 » trompeur, cadré Phase 6      |         ✅ **PASS**          | Voir §1.5   |
| 6   | **JSON-LD** riche + 0 squatter                                    |         ✅ **PASS**          | Voir §1.6   |

### 1.1 og:image + hero podium + millésime 2026 — ✅ PASS (le P0 est déployé)

Le ticket 🔴 de `02-contenu-seo.md` (« prod en retard, 688 pages classement
sans carte sociale ») est **résolu**. Inspection live de 6 classements (3 FR,
3 EN) :

| Page (prod)                              |       `og:image`       | `rk-podium`  | `<title>` millésime                                |
| ---------------------------------------- | :--------------------: | :----------: | -------------------------------------------------- |
| `/classement/meilleurs-hotels-venise`    | ✅ 1200×630 Cloudinary | ✅ (44 hits) | **2026**                                           |
| `/classement/meilleurs-palaces-paris`    |           ✅           |      ✅      | **2026**                                           |
| `/classement/meilleurs-hotels-marrakech` |           ✅           |      ✅      | **2026**                                           |
| `/classement/meilleurs-hotels-spa-paris` |           ✅           |      ✅      | **2026**                                           |
| `/en/classement/meilleurs-hotels-venise` |           ✅           |      —       | « Best hotels in Venice: our **2026** selection »  |
| `/en/classement/meilleurs-palaces-paris` |           ✅           |      —       | « Palaces and Luxury Hotels in Paris in **2026** » |

`og:image` émis (Venise) :
`…/f_jpg,q_auto,c_fill,g_auto,w_1200,h_630/cct/hotels/the-gritti-palace-…/places-5`

- `og:image:width=1200`, `og:image:height=630`, `og:image:alt` localisé. Le hero
  above-the-fold (`w_1200/w_1280`, 24 hits) + le bloc TL;DR `#tldr` (17 hits) sont
  présents. **H1 Venise = « Les meilleurs hôtels de Venise en 2026 »** (millésime
  courant, plus 2025). Carte sociale / Discover réparée sur toute la surface
  d'acquisition #1.

### 1.2 Parité EN classements — ✅ PASS (prose EN réelle, 0 fuite) — 1 résidu connu

`/en/classement/meilleurs-hotels-venise` : intro, justifications, méthodologie
et FAQ rendent une **prose anglaise réelle**, p. ex. :

> « Gritti Palace takes the top spot because it lives and breathes Venice at
> water level, directly on the Grand Canal at Campo Santa Maria Del Giglio…
> Belmond Hotel Cipriani earns its place on our podium because it offers a rare
> reading of Venice: the city opposite, calm on Giudecca. » + « How we rank the
> best hotels in Venice », FAQ « Should I stay near St. Mark's Square… ».

- `DRAFT` : **0** ; marqueurs scaffolding (`le brief`/`le dossier`/`AUTO_DRAFT`/
  `niveau de confiance`) : **0** réel (les seuls hits sont des faux positifs
  `Depending` / `pending requests` dans le blob i18n Next embarqué).

**Résidu connu CONFIRMÉ & FLAGGÉ** : `/en/classement/classement-worlds-50-best-hotels-2025`
rend un stub `intro_en` en **FR** :

> « **DRAFT -** Le classement « The World's 50 Best Hotels 2025 ranking » est en
> cours de réd[action]… »

C'est un placeholder FR labellisé `DRAFT` rendu **above-the-fold sur la page
/en**, indexable. À corriger (1 ligne, `intro_en`). Toutes les autres pages EN
échantillonnées sont propres.

### 1.3 Caveat localisation EN — ⚠️ gap ouvert CONFIRMÉ (à chiffrer)

Sur `/en/classement/meilleurs-hotels-venise`, la **table comparative** rend
encore du **français** dans 3 colonnes :

- style/badge : « **Boutique-hôtels 5★ et adresses de design** », « Grand classique » ;
- atmosphère : « **Palazzi historiques et institution[s]** » ;
- budget indicatif : « **environ 450-900€** » (« environ » = FR).

Ampleur : ces colonnes (`badge_fr` / teaser atmosphère / budget indicatif) sont
des champs **FR-only** rendus quel que soit le locale → le défaut touche **la
table comparative des 688 classements sur `/en`** (mélange de langue
catalogue-wide, mais hors prose principale). Gap de localisation à traiter
(ajouter `_en` sur ces champs ou les masquer sur `/en`).

### 1.4 Newsletter — ✅ PASS

`/le-concierge/newsletter` (FR + EN) : **0 `<input disabled>`** (le faux
formulaire grisé a disparu) ; **11 liens** vers `/le-concierge/contact` (CTA
honnête). Plus de surface de capture inerte présentée comme active.

### 1.5 Copy WhatsApp — ✅ PASS (cadré Phase 6 partout)

Prod (`/le-concierge-club`) + i18n source (`apps/web/src/i18n/messages/{fr,en}.json`,
clé `whatsapp_concierge_24_7`) :

- Titre : « **Concierge WhatsApp (dès la Phase 6)** » / « WhatsApp Concierge (from Phase 6) ».
- Body : « canal en cours d'ouverture, déployé dès la Phase 6 » / « channel
  currently being set up, rolling out from Phase 6 ».
- Toutes les mentions Club (`benefits`, FAQ Prestige, `philosophyBody`)
  suffixent « (dès la Phase 6) ».

La promesse trompeuse « WhatsApp 24/7 » est supprimée. NB : les autres « 24/7 »
du repo concernent la **ligne d'urgence de réservation** (communiquée en
confirmation) et une FAQ sécurité Maroc — claims distincts, non trompeurs.
(La clé i18n garde le nom `whatsapp_concierge_24_7` mais le texte rendu ne
promet plus 24/7 — purement cosmétique.)

### 1.6 JSON-LD — ✅ PASS (best-in-class, 0 squatter)

| Surface                               | Blocs clés émis (live)                                                                                                                                                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/classement/meilleurs-hotels-venise` | `ItemList` ×1, **`Hotel` ×8** (1/entrée), `FAQPage` ×1, `BreadcrumbList` ×1, `Question`/`Answer` ×13, `SpeakableSpecification` ×8, `Rating` ×8, `GeoCoordinates` ×8, `Article`, `TravelAgency`, `Organization`, `ImageObject`, `Person`, `ContactPoint` |
| `/hotel/le-bristol-paris`             | `Hotel`, `FAQPage`, `BreadcrumbList`, `ItemList`, `AggregateRating`, `Review` ×3, `Restaurant` ×5, `TouristAttraction` ×8, `Museum` ×8, `ImageObject` ×5, `PostalAddress`, `Brand`, `City`, `TravelAgency`                                              |

- **Squatter scan** (`Restaurant.url` / `sameAs` vs familles SEO-squatter
  connues `hotels-in-`, `hotels-of-`, `.info`, `com-hotel`, `h-rez`…) : **0 hit**.
- **Pas d'`Offer` / `priceValidUntil`** sur la fiche hôtel → conforme au gel
  Phase 6 (AGENTS.md §4ter).

→ Confirme le moat structuré : MCH émet ~10 types JSON-LD sur le classement
(dont `Hotel` par entrée + `FAQPage` + `Speakable`), supérieur aux ~6 des
concurrents.

---

## 2. Benchmark MCH vs yonder.fr / travellers-society.com (re-vérifié live 2026-06-23)

> Règle PO `.cursor/rules/competitor-benchmark-yonder.mdc`. Confirmé sur les
> pages live des concurrents (WebSearch + lecture page yonder Venise) + DB
> PostgREST MCH. Réf. audit fondateur du même jour.

### 2.1 Couverture — l'écart s'est RÉDUIT depuis le go-live

Mise à jour PostgREST live (2026-06-23) vs l'audit fondateur du matin :

| Métrique MCH                                                                                                                         | Audit fondateur |   **Live ce soir** | Δ       |
| ------------------------------------------------------------------------------------------------------------------------------------ | --------------: | -----------------: | ------- |
| Classements publiés                                                                                                                  |             671 |            **688** | +17     |
| Slugs `hotel-de-luxe-*` (phrasing à volume)                                                                                          |           **1** |             **14** | **+13** |
| Slugs `plus-beaux-hotels-*`                                                                                                          |              17 |                  9 | —       |
| Les **12 destinations-gap** (Vienne, Crète, Rajasthan, Seychelles, Genève, Lisbonne, LA, Maurice, Majorque, Ibiza, St-Barth, Sicile) |      0 publiées | **12/12 publiées** | **+12** |

→ Le P0 #2 du fondateur (« générer les 12 gap rankings ») et le P1 #4
(« phrasing `hotel-de-luxe-{ville}` ») ont **atterri**. Vérifié live : les 12
slugs renvoient **200** avec titre millésimé 2026, `og:image`, 4-10 entrées
`Hotel` JSON-LD chacune (Vienne 8, Seychelles 10, Lisbonne 8, Sicile 4).

**Ce que les concurrents couvrent et qu'on ne couvre toujours pas** :

- yonder publie **~430 listicles** (68 `hotels-du-mois` + ~360 `les-tops`) +
  ~600 reviews single-hôtel + 1 772 cityguides ; couverture géographique
  **plus large en France secondaire** (Périgord, Pays Basque, Loire châteaux,
  Cassis, Honfleur, Deauville, arrondissements parisiens micro-locaux) et en
  **petites destinations internationales** (Zanzibar, Tahiti, Sardaigne, Açores,
  Tbilissi, Bergen…). MCH reste **plus profond par ville couverte** (matrice
  multi-axes spa/romantique/piscine × ville) mais **plus étroit géographiquement**.
- Sur le phrasing : malgré +13 slugs `luxe`, le volume FR réel reste sur
  `hôtel de luxe {ville}` (Paris 2 900 vs « meilleurs » 110 = ×26 ; Dubai ×10 ;
  Marrakech ×6). Vérifier que les 14 slugs `luxe` ciblent bien les villes à
  plus haut volume (Paris, Marrakech, Dubai, NY, Venise) et arbitrer
  canonical vs alias pour éviter la cannibalisation avec `meilleurs-*`.

### 2.2 Patron éditorial — l'écart de richesse par hôtel TIENT (gap #1 humain)

Relecture live de la page yonder Venise (`hotels-du-mois`, byline « Alicia
Dorey, mardi 16 décembre 2025 ») + travellers-society Venise :

| Dimension         | yonder / travellers                                                                                                                                                                                                                                | MCH (`/classement/*`)                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Entrées par page  | **15-17 hôtels**, groupés **par quartier** (San Marco, Dorsoduro, Lagune/Lido)                                                                                                                                                                     | **8-10 entrées** à plat                                                                                                  |
| Mix d'étoiles     | 4★ + 5★ + boutique (Nolinski, Londra Palace, Combo, Cima Rosa B&B)                                                                                                                                                                                 | **palace/5★ seulement** (catalogue)                                                                                      |
| Concret par hôtel | **architecte/designer nommé** (Yann Le Coadic, J-M Gathy), **nombre de clés** (« 56 clés »), **« prix à partir de 820 € la nuit »**, **anecdote** (Clooney 2014, chambre Tchaïkovski), **table gastro nommée** (Oro), label R&C, **site officiel** | prose ~150 mots, souvent en **adjectifs** (« s'impose naturellement »), pas de prix, pas de clé, peu d'anecdotes nommées |
| Photos            | **hero + 5-10 photos créditées/hôtel**                                                                                                                                                                                                             | hero podium (déployé) + **1 photo/entrée** sous longue prose                                                             |
| Fraîcheur         | **byline datée + « hôtels du mois »** (refresh mensuel)                                                                                                                                                                                            | badge millésime 2026 (statique, `reviewed_at`)                                                                           |
| Hook business     | **Club Yonder** / `club.travellers-society` funnel -25 %                                                                                                                                                                                           | « Réserver via le Concierge » (éditorial, Phase 6) + Concierge Club                                                      |

→ Les concurrents écrivent **du fait nommé** (la richesse qu'ils monétisent) ;
MCH reste souvent **générique en FR** (104 formules templatées mesurées au
fondateur) — c'est l'écart de lecture humaine n°1, intact.

### 2.3 Parité EN — l'écart s'est FORTEMENT réduit (était le P0 fondateur)

Mesure PostgREST live sur les 5 439 entrées des 688 classements :

| Champ EN                                       | Audit fondateur                  | **Live ce soir**                          |
| ---------------------------------------------- | -------------------------------- | ----------------------------------------- |
| `intro_en` NULL (rankings)                     | 67                               | **0**                                     |
| `factual_summary_en` NULL (rankings)           | 70                               | **0**                                     |
| Entrées `justification_en` NULL/stub           | ~85 stubs (15 mots EN vs 172 FR) | **0 NULL** — toutes peuplées (avg ~849 c) |
| Entrées `badge_en` manquant (badge_fr présent) | n/a                              | **28** (résiduel)                         |

→ Le **P0 fondateur** (justifications EN = 15 mots vs 172 FR, 91 % de gap) est
**clos** : chaque entrée a désormais une `justification_en` réelle (~849 c),
confirmé live sur `/en/classement/meilleurs-hotels-venise` (prose anglaise
complète, 0 fuite scaffolding).

**Résidu de localisation (NOUVEAU constat précis)** : la **table comparative**
de chaque classement vit dans la colonne `editorial_rankings.tables` (JSON
`{badge, budget, ambiance, points_forts}`) **FR-only — aucune clé `_en`**.
**674 / 688** classements publiés portent une table non vide → sur `/en`, **674
pages** rendent un tableau « At a glance » en français (« environ 450-900 € »,
« Grand hôtel historique sur le Grand Canal », « Adresse iconique, vues sur
l'eau »). C'est le **plus gros gap de localisation EN restant** (hors prose
principale, déjà clôturée). + le stub `worlds-50-best` `intro_en` « DRAFT - … » FR.

### 2.4 Structured data — le moat MCH TIENT (à défendre)

|                                      | MCH classement                                                                                                                              | yonder / travellers                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Types JSON-LD                        | **~10** : `ItemList`+`Hotel`×8+`FAQPage`+`Speakable`×8+`BreadcrumbList`+`Rating`×8+`GeoCoordinates`+`Article`+`TravelAgency`+`Organization` | ~6 (Article/BlogPosting, BreadcrumbList, parfois ItemList, Organization, WebPage) |
| `Hotel` par entrée                   | ✅                                                                                                                                          | ❌                                                                                |
| `FAQPage` + `Speakable`              | ✅                                                                                                                                          | ❌ (souvent absent)                                                               |
| 0 squatter `Restaurant.url`/`sameAs` | ✅ vérifié                                                                                                                                  | n/a                                                                               |

→ MCH **sur-structure** les deux concurrents — moat GEO/AEO + rich results
intact, hérité par les 12 nouveaux gap rankings.

---

## 3. Ce qui manque côté MCH — delta actionnable priorisé

### 3.1 À CORRIGER (résidus de cette session, ROI immédiat)

1. **P0-quick — Stub `intro_en` FR sur `/en/classement/classement-worlds-50-best-hotels-2025`.**
   Rend « DRAFT - Le classement … est en cours de rédaction » **above-the-fold,
   indexable** sur la page EN. 1 ligne à remplir (`intro_en`). Fuite de marqueur
   `DRAFT` en prod.
2. **P1 — Localiser la table comparative (`editorial_rankings.tables`).** 674/688
   pages EN rendent un tableau « At a glance » 100 % FR (badge/budget/ambiance/
   points_forts). Ajouter des clés `_en` (réutiliser le pattern `translate-*`
   REST + gate `hasLeak()`) ou masquer la table sur `/en`. C'est le **plus gros
   gap de localisation EN restant**.
3. **P2 — 28 entrées sans `badge_en`** (badge_fr présent) → micro-mix de langue
   sur les puces de podium. Petit reste, à boucler avec le même sweep.

### 3.2 À CRÉER (couverture — net-new)

4. **Étendre la couverture géographique secondaire** que les concurrents
   monétisent et qu'on ne couvre pas : France secondaire (Périgord/Dordogne,
   Pays Basque, Loire châteaux, Cassis, Honfleur, Deauville) + petites destinations
   internationales (Sardaigne, Zanzibar, Tahiti, Açores). Gater sur inventaire
   ≥ 4 hôtels publiés via `combinator.ts MIN_ELIGIBLE` avant génération
   (`run-rankings-v2-bulk.ts`, zéro sourcing si l'inventaire existe).
5. **Vérifier le ciblage des 14 slugs `hotel-de-luxe-*`** : confirmer qu'ils
   couvrent les villes à plus haut volume (Paris 2 900, Marrakech 880, Dubai 320,
   NY 210, Venise 170) et arbitrer **canonical vs alias** avec les `meilleurs-*`
   pour éviter la cannibalisation.

### 3.3 À AMÉLIORER (qualité éditoriale — lecture humaine)

6. **Réécriture « concrete-specifics »** des justifications génériques (104
   formules templatées « s'impose naturellement ») → faits nommés : architecte/
   designer, la chambre/suite à réserver, la table Michelin + chef, une anecdote
   vérifiable, « à partir de X € TTC ». Prioriser les 20-30 classements les plus
   exposés (Paris, Venise, Marrakech, Dubai, NY). C'est exactement la richesse
   que yonder/travellers monétisent.
7. **Profondeur par page** : envisager d'inclure le 4★/boutique éditorial là où
   le catalogue le permet (yonder fait 15-17 entrées groupées par quartier vs nos
   8-10 palace/5★ à plat) + un **regroupement par quartier** sur les grandes
   villes.
8. **Signal de fraîcheur** : `reviewed_at` à jour + envisager un « mis à jour le »
   visible (yonder rafraîchit mensuellement via `hotels-du-mois`).

### 3.4 CE QUI NOUS DISTINGUE (moat à défendre + amplifier)

- **JSON-LD best-in-class** (`ItemList`+`Hotel`/entrée+`FAQPage`+`Speakable`+
  hreflang) — moat GEO/AEO que des listicles d'affiliation ne peuvent égaler à
  moindre coût. Hérité automatiquement par les 12 nouveaux gap rankings.
- **Voix Concierge + `⭐ Le Conseil du Concierge`** — le secret opérationnel
  (n° de chambre, timing, accès) qu'aucun concurrent n'a.
- **Angle OTA IATA + Concierge Club** (≈ le Club -25 % de yonder) — hook
  trust/valeur à surfacer dans le bloc de fin d'entrée.
- **Profondeur multi-axes** (688 classements spa/romantique/piscine/vue × ville)
  - **maillage hôtel ↔ 1 147 lieux** en parité EM totale — surface que yonder
    n'a pas sous cette forme structurée.
- **Gap d'autorité/indexation** (MCH absent du top-20 « meilleurs/plus beaux
  hôtels {ville} », yonder #1, travellers #2) : ne se corrige PAS par le contenu
  seul → backlinks + soumission GSC + fraîcheur. Le vrai écart restant.

---

## 4. Score cluster « Vérification Contenu/SEO + Business + Compét » /10

**8,5 / 10**

Justification : la **vérification prod confirme que le go-live a tenu ses
promesses**. Les 5 correctifs majeurs sont **PASS live** : (1) `og:image` +
hero podium + millésime 2026 déployés sur la surface classement (le 🔴 du
fondateur est levé) ; (2) parité EN des classements **close** (intro_en/
factual_summary_en/justification_en NULL = 0, prose anglaise réelle, 0 fuite) ;
(4) newsletter en CTA honnête ; (5) WhatsApp recadré « Phase 6 » ; (6) JSON-LD
best-in-class + 0 squatter. **Bonus** : les 12 gap rankings + 13 slugs `luxe`
ont été générés (l'écart de couverture vs yonder a rétréci).

Déductions (−1,5) : (a) **table comparative `tables` FR-only sur 674/688 pages
EN** — gap de localisation EN restant le plus net ; (b) **stub `intro_en` FR
« DRAFT »** indexable sur `worlds-50-best` ; (c) **richesse éditoriale par hôtel**
toujours générique vs le concret nommé des concurrents (architecte/chambre/
chef/prix) ; (d) **autorité/indexation** — MCH toujours absent du top-20 SERP
(hors périmètre contenu, mais c'est le vrai plafond de verre).

> Méthodologie : `Invoke-WebRequest` prod (6 classements FR/EN, fiche hôtel,
> newsletter, club), PostgREST live (688 rankings, 5 439 entrées, colonnes
> `tables`/`*_en`), WebSearch + lecture page yonder/travellers Venise, i18n repo.
> Aucune modification hors ce `.md`.
