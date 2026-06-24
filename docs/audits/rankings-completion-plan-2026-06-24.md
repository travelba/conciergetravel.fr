# Rankings completion plan — MCH vs yonder.fr (2026-06-24)

> **Phase A — Audit & quantification.** Read-only sur le catalogue. Ce
> document chiffre le gap d'inventaire entre MyConciergeHotel et
> **l'intégralité** des classements yonder.fr, audite la sélection MCH
> (sous-remplissage, mauvais city-tags), et propose un plan d'onboarding
> priorisé. Benchmark explicite vs yonder à chaque section, conformément à
> [`.cursor/rules/competitor-benchmark-yonder.mdc`](../../.cursor/rules/competitor-benchmark-yonder.mdc).

## 0. Méthode & artefacts

| Étape                | Outil                                                                          | Sortie                                                                |
| -------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| A1 — crawl yonder    | `src/yonder/build-raw-urls.ts` → `extract-yonder.ts` → `build-rankings-map.ts` | `yonder/hotels.json`, `yonder/pages.json`, `yonder/rankings-map.json` |
| A2 — diff vs MCH     | `src/yonder/diff-mch.ts` (PostgREST, fuzzy slug→name+city→name)                | `yonder/diff-missing.json`, `yonder/diff-already.json`                |
| A3 — audit sélection | `src/yonder/audit-selection.ts` (combinator vs DB entries)                     | `yonder/audit-rankings.json`, `yonder/audit-city-falsepos.json`       |

- **Crawl** : 474 pages de classement yonder LLM-parsées (FR + international +
  palaces + « hôtels du mois » + thématiques romantique/spa/bord-de-mer/golf/
  ski/famille…), agrégées en **2 132 hôtels uniques** cités par yonder.
- **DB** lue en PostgREST (service-role du `.env.local` racine) — le `pg`
  direct échoue sur ce poste (AGENTS.md §gotcha). Snapshot catalogue
  `out/hotels-catalog.json` régénéré (2 219 hôtels publiés).
- Coût A1 : ~0,58 $ (gpt-4o-mini, 3,0 M input + 0,22 M output tokens) + ~487
  crédits Tavily extract.

---

## 1. Gap d'inventaire — hôtels yonder absents de MCH

| Métrique                                      | Valeur             |
| --------------------------------------------- | ------------------ |
| Hôtels yonder uniques                         | **2 132**          |
| Déjà dans MCH (match slug / name+city / name) | **531** (24,9 %)   |
| **Manquants**                                 | **1 601** (75,1 %) |
| → **`qualifie`** (à onboarder)                | **867**            |
| → `hors-cible` (mid-range, ignorés)           | 734                |

**Triage `qualifie`** (un hôtel est retenu si ≥ 1 critère) :

| Critère                                                                                     | Hôtels |
| ------------------------------------------------------------------------------------------- | ------ |
| Cité sur ≥ 1 classement yonder de scope qualifiant (palace / 5★ / Relais & Châteaux / luxe) | 679    |
| Indice ≥ 5 étoiles                                                                          | 358    |
| Marque luxe reconnue (Aman, Four Seasons, Belmond, R&C…)                                    | 113    |
| Mention « Palace » explicite                                                                | 66     |

**Répartition géographique du `qualifie`** : **481 France** / **386 international**.

> **Benchmark yonder** : yonder trustste le top 1-2 SEO FR sur « meilleurs /
> plus beaux hôtels {ville} » avec ~474 pages de classement. MCH ne recoupe
> aujourd'hui que **25 %** de leur inventaire hôtelier. Les 867 `qualifie`
> sont précisément les adresses que yonder met en avant et que nous n'avons
> pas — c'est le gap de **couverture** (axe 1 de la règle PO). Note : nous
> sur-structurons déjà yonder côté machine (≈10 blocs JSON-LD vs ~6), donc
> chaque hôtel onboardé hérite immédiatement d'un balisage supérieur.

### Top 10 zones prioritaires (`qualifie`, ventilé par ville/zone cible)

| #   | Zone                 | `qualifie` manquants | Lecture / priorité                                                  |
| --- | -------------------- | -------------------- | ------------------------------------------------------------------- |
| 1   | **Paris**            | 66                   | Plus gros volume SEO FR ; zone n°1 yonder. Priorité absolue.        |
| 2   | **Megève**           | 16                   | Montagne premium ; alimente ski/montagne/spa Alpes (sous-remplis).  |
| 3   | **Courchevel**       | 12                   | Débloque 8 classements Courchevel cappés à l'inventaire (cf. §3).   |
| 4   | **Marrakech**        | 11                   | International fort volume ; guide ville déjà publié.                |
| 5   | **Zermatt**          | 10                   | Ski international (Suisse).                                         |
| 6   | **Lille**            | 10                   | Ville FR sans classement MCH aujourd'hui.                           |
| 7   | **Marbella**         | 10                   | Espagne balnéaire/golf.                                             |
| 8   | **Cape Town**        | 9                    | International long-courrier.                                        |
| 9   | **Chicago**          | 9                    | USA — alimente `meilleurs-5-etoiles-etats-unis` (shippable, cf §3). |
| 10  | **Saint-Barthélemy** | 8                    | Caraïbes luxe, forte intention « hôtel de luxe ».                   |

Suite (11-30) : Wengen 7, Nice 7, Honfleur 7, Lège-Cap-Ferret 7, Genève 6,
La Rosière 6, Bordeaux 6, Bruxelles 6, Amsterdam 6, Gand 6, Marseille 5,
Avignon 5, Tignes 5, Maldives 5, Saint-Tropez 5, Hyères 5, Luxembourg 5,
Florence 5. (Détail complet : `yonder/diff-missing.json` → `topZonesQualifie`.)

> **Croisement volume DataForSEO** : le volume FR se concentre sur « hôtel de
> luxe {ville} » (10-30× « meilleurs hôtels {ville} »), cf.
> [`competitor-travellers-yonder-audit-2026-06-23.md`](competitor-travellers-yonder-audit-2026-06-23.md).
> Paris, Nice, Saint-Tropez, Marrakech, Megève/Courchevel sont les zones où
> ce volume est le plus élevé → cohérent avec le Top 10 ci-dessus. Aucun
> nouvel appel DataForSEO n'a été passé (audit read-only) ; on réutilise les
> volumes déjà documentés.

---

## 2. Coût & temps d'onboarding estimés

Hypothèses du plan : **~0,15-0,50 $/hôtel** (LLM enrichissement : description,
factual_summary, meta_desc, FAQ, concierge_advice, sections) + **5-15 min/hôtel**
de cycle (scaffold → enrich → photos → publish gate).

| Lot                                  | Hôtels  | Coût LLM        | Temps (à conc. 4)      |
| ------------------------------------ | ------- | --------------- | ---------------------- |
| **Lot 1 — Top 10 zones**             | ~160    | 24 – 80 $       | ~3,5 – 10 h            |
| **Lot 2 — reste France `qualifie`**  | ~321    | 48 – 160 $      | ~7 – 20 h              |
| **Lot 3 — international `qualifie`** | ~386    | 58 – 193 $      | ~8 – 24 h              |
| **Total `qualifie`**                 | **867** | **130 – 433 $** | **~18 – 54 h machine** |

> Les photos (Phase 2) et le booking (Phase 6) restent hors périmètre — ce
> chiffrage couvre la **couche écrite** uniquement, conforme à la décision PO
> « contenu écrit d'abord » (AGENTS.md §4bis).

---

## 3. Audit sélection MCH — classements sous-remplis & gains immédiats

État DB : **704 classements publiés**, **5 573 entries**, **0 classement vide**.

### 3a. Gain immédiat — 421 classements « shippables » sans onboarding

Le combinator génère **3 880 seeds** ; **3 305** n'ont pas encore de page DB.
Parmi eux, **421 ont déjà ≥ `MIN_ELIGIBLE` hôtels MCH publiés** → ce sont des
pages de classement **livrables tout de suite avec l'inventaire actuel**,
sans aucun onboarding. Les plus volumineux :

| Seed shippable                                                   | Hôtels éligibles | Cible |
| ---------------------------------------------------------------- | ---------------- | ----- |
| `meilleurs-5-etoiles-etats-unis`                                 | 250              | 10    |
| `meilleurs-hotels-spa-etats-unis`                                | 145              | 10    |
| `meilleurs-hotels-romantiques-etats-unis`                        | 145              | 10    |
| `meilleurs-5-etoiles-italie`                                     | 138              | 10    |
| `meilleurs-5-etoiles-chine`                                      | 108              | 10    |
| `meilleurs-5-etoiles-royaume-uni`                                | 98               | 10    |
| `meilleurs-5-etoiles-grece` / `-espagne` / `-japon` / `-londres` | 64 – 75          | 8-10  |

> **Benchmark yonder** : yonder couvre massivement l'international (USA, Italie,
> Grèce, Japon, Royaume-Uni). Ces 421 pages comblent le **gap de couverture
> internationale** sans dépenser un centime d'onboarding — c'est le levier
> SEO/GEO le plus rentable du plan. Action Phase B : `run-rankings-v2-bulk.ts`
> ciblé sur ces seeds (~421 × 5-6 appels LLM).

### 3b. 44 classements publiés sous-remplis (entries < targetLength)

Deux familles :

**(i) Re-remplissables depuis l'inventaire existant** (`eligible ≥ target` — il
suffit de régénérer, **coût ≈ 0 onboarding**) — ~28 classements, dont :

| Slug                                                               | entries | cible | éligibles |
| ------------------------------------------------------------------ | ------- | ----- | --------- |
| `meilleurs-hotels-montagne-france`                                 | 5       | 12    | 606       |
| `meilleurs-hotels-ski-france`                                      | 5       | 12    | 169       |
| `meilleurs-hotels-bord-de-mer-france`                              | 7       | 12    | 537       |
| `meilleurs-hotels-lune-de-miel-france`                             | 8       | 12    | 2219      |
| `meilleurs-hotels-minceur-france`                                  | 8       | 12    | 2219      |
| `plus-beaux-5-etoiles-france`                                      | 9       | 12    | 2219      |
| `meilleurs-hotels-design-france`                                   | 11      | 12    | 870       |
| `meilleurs-hotels-famille-france`                                  | 11      | 12    | 1397      |
| `meilleurs-hotels-golf-france`                                     | 11      | 12    | 48        |
| `meilleurs-5-etoiles-cote-d-azur`                                  | 6       | 10    | 36        |
| `meilleurs-hotels-spa-cote-d-azur` / `-romantiques-` / `-famille-` | 5-6     | 10    | 23-32     |
| `meilleurs-5-etoiles-alpes` / `-ski-alpes` / `-montagne-alpes`     | 5       | 10    | 17        |

**(ii) Cappés par l'inventaire** (`eligible ≈ target` — **onboarding requis**
pour grossir la liste) — ~16 classements, dont les **8 de Courchevel**
(`-ski-`, `-spa-`, `-montagne-`, `-romantiques-`, `-famille-`,
`-kids-friendly-`, `-5-etoiles-`, `plus-beaux-hotels-courchevel` : tous
entries=5 / cible=7 / éligibles=7), plus `meilleurs-hotels-gastronomie-alpes`
(9/9), `meilleurs-hotels-los-angeles` (7/7), `-montagne-saint-tropez` (6/6),
`-rooftop-saint-tropez` (5/5), `-charme-champagne` (5/5), `-piscine-alpes`
(6/6), `-charme-alpes` (7/7), `-montagne-courchevel` (7/7).

→ Ces zones cappées (Courchevel, Megève, Saint-Tropez, Alpes) recoupent
exactement le **Top 10 zones d'onboarding** du §1 : onboarder Megève (16) +
Courchevel (12) + Saint-Tropez (5) débloque simultanément ~12 classements
sous-remplis. **Double dividende** : couverture (nouvelles pages) + densité
(pages existantes remplies).

### 3c. Hôtels mal city-taggés (faux positifs `city.includes()`) — input Phase C3

Le prédicat d'éligibilité combinator matche la ville en **sous-chaîne**, pas en
mot entier → **7 hôtels mal rattachés** (43 paires lieu×hôtel) :

| Hôtel                                  | Vraie ville                | Mal taggé dans                          | Cause                      |
| -------------------------------------- | -------------------------- | --------------------------------------- | -------------------------- |
| `curtain-bluff-resort`                 | St Mary's Parish (Antigua) | **Paris** (×25 lieux)                   | `"paris"` ⊂ `"parish"`     |
| `belmond-hotel-cipriani`               | Venice                     | **Côte d'Azur / French Riviera / Nice** | `"nice"` ⊂ `"venice"`      |
| `san-clemente-palace-kempinski-venice` | Venice                     | idem                                    | `"nice"` ⊂ `"venice"`      |
| `the-st-regis-venice`                  | Venice                     | idem                                    | `"nice"` ⊂ `"venice"`      |
| `planters-inn`                         | Charleston (USA)           | **Provence**                            | `"arles"` ⊂ `"charleston"` |
| `wentworth-mansion`                    | Charleston (USA)           | **Provence**                            | `"arles"` ⊂ `"charleston"` |
| (1 hôtel)                              | Punta Maroma (Mexique)     | **Rome**                                | `"roma"` ⊂ `"maroma"`      |

> **Correctif Phase C3** : remplacer le `city.includes(key)` du combinator par
> un **match mot-entier** (la fonction `isWholeWord` de `audit-selection.ts`
> fournit l'implémentation de référence). Faux positifs **légitimes** à NE PAS
> corriger : `baux-de-provence` ⊂ `Les Baux-de-Provence`, `porto-vecchio` ⊂
> `Lecci de Porto-Vecchio`, `rethymno` ⊂ `Rethymnon` (même lieu, libellé long).

### 3d. 129 classements DB hors-matrice

129 classements publiés n'ont pas de seed combinator correspondant (chaînes
hôtelières, curated T+L, overrides manuels). **Non bloquant** — ils sont
légitimes et vivent hors du combinator (cf. `run-chain-rankings-batch.ts`,
`enrich-ranking-sections-only.ts`). À surveiller seulement pour éviter les
doublons lors de la génération des 421 seeds shippables.

---

## 4. Plan d'action priorisé (sortie Phase A → entrées Phases B/C)

| Prio   | Action                                                         | Effort                       | Dépendance                |
| ------ | -------------------------------------------------------------- | ---------------------------- | ------------------------- |
| **P0** | Générer les **421 seeds shippables** (inventaire existant)     | ~421 × 5-6 LLM, 0 onboarding | `run-rankings-v2-bulk.ts` |
| **P0** | Re-remplir les **28 classements re-remplissables** (i)         | régénération, 0 onboarding   | bulk runner ciblé         |
| **P1** | Corriger les **7 city-tags** (whole-word match)                | patch combinator + test      | Phase C3                  |
| **P1** | Onboarder **Lot 1 — Top 10 zones** (~160 `qualifie`)           | 24-80 $, ~3,5-10 h           | pipeline scaffold→enrich  |
| **P2** | Onboarder **Lot 2 France** (~321) puis **Lot 3 intl** (~386)   | 106-353 $, ~15-44 h          | idem                      |
| **P2** | Re-remplir les **16 classements cappés** après onboarding zone | régénération post-Lot 1      | dépend onboarding         |

---

## 5. Résidu / limites

- Le triage `qualifie`/`hors-cible` s'appuie sur les **indices yonder**
  (scope du classement source, étoiles, marque) — quelques `hors-cible`
  peuvent être de vrais 4★ haut de gamme à repêcher manuellement (revue
  humaine recommandée sur les ~734 avant rejet définitif).
- Le matching A2 (name+city → name) peut produire de rares faux « already »
  (homonymes de chaînes) ; `yonder/diff-already.json` liste les 531 matchs
  avec leur `reason` pour audit.
- 1 hôtel `roma`⊂`Punta Maroma` non nominativement identifié dans ce rapport
  (slug dans `yonder/audit-city-falsepos.json`).
- Aucun appel DataForSEO neuf (read-only, quota préservé) — priorisation
  volume basée sur l'audit existant du 2026-06-23.
- Snapshot `out/hotels-catalog.json` = photo du catalogue au 2026-06-24
  (2 219 publiés) ; à régénérer avant la Phase B si onboarding intercalé.

---

## Annexe — fichiers produits

```
scripts/editorial-pilot/yonder/hotels.json            2132 hôtels yonder uniques
scripts/editorial-pilot/yonder/pages.json             474 pages → hôtels cités
scripts/editorial-pilot/yonder/rankings-map.json      ranking → [hôtels] + scope
scripts/editorial-pilot/yonder/diff-missing.json      1601 manquants (867 qualifie)
scripts/editorial-pilot/yonder/diff-already.json      531 déjà présents
scripts/editorial-pilot/yonder/audit-rankings.json    704 DB + 3880 seeds + gaps
scripts/editorial-pilot/yonder/audit-city-falsepos.json  43 paires mal-taggées
```
