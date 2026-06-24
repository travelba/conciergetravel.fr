# Baseline SERP — MCH vs yonder vs travellers (2026-06-24)

> **Worker** : « Baseline suivi de positions (DataForSEO) vs yonder »
> **Règle cadre** : [`.cursor/rules/competitor-benchmark-yonder.mdc`](../../.cursor/rules/competitor-benchmark-yonder.mdc)
> **Plan parent** : [`docs/audits/authority-visibility-plan.md`](authority-visibility-plan.md) §1 + action #5
> **Outil** : [`scripts/editorial-pilot/src/grounding/track-serp-positions.ts`](../../scripts/editorial-pilot/src/grounding/track-serp-positions.ts) (`pnpm --filter @mch/editorial-pilot serp:track`)
> **Données brutes** : [`docs/audits/serp-positions-2026-06-24.json`](serp-positions-2026-06-24.json) (le tool écrit aussi une copie scratch dans `scripts/editorial-pilot/runs/`, gitignorée)

C'est la **mesure de référence (T0)** pour piloter l'effet de l'indexation
GSC en cours. Collecte DataForSEO `serp/google/organic/live/advanced`
(depth 20, desktop, location France, langue fr) via le MCP `user-dfs`, le
2026-06-24. À re-mesurer mensuellement avec le même outil et le même panier,
puis differ les snapshots JSON datés.

## 1. Macro — domain rank overview (google.fr, langue fr)

DataForSEO Labs `domain_rank_overview`, location France, langue fr, 2026-06-24
(inchangé vs la mesure du 2026-06-23 — pas de mouvement macro en 24 h, normal).

| Domaine                    | Mots-clés classés | Top 1 | Top 3 | Top 10 | ETV (trafic estimé) |
| -------------------------- | ----------------: | ----: | ----: | -----: | ------------------: |
| **myconciergehotel.com**   |             **2** |     0 |     0 |      0 |           **≈ 2,5** |
| **yonder.fr**              |        **15 568** |   642 | 2 176 |  7 480 |         **437 538** |
| **travellers-society.com** |         **1 317** |    40 |   182 |    815 |          **84 327** |

L'écart est d'ordre de grandeur, pas de degré : MCH classe **2 mots-clés**
(ETV ≈ 2,5 visites/mois) quand yonder en classe **15 568** (ETV 437 k) et
le petit jumeau travellers-society **1 317** (ETV 84 k). Le catalogue MCH
(2 219 hôtels, ~3 380 pages `/classement/*` dans le sitemap prod) est quasi
invisible de Google — c'est un problème d'**indexation + autorité**, pas de
volume de contenu.

## 2. Positions réelles par requête (top 20 organique)

Pour chaque requête : position absolue organique de MCH, yonder, travellers
(ou « absent » hors top 20) + les 3 premiers résultats organiques. Panier =
les 12 requêtes d'acquisition à plus fort volume (§1.1 du plan) qui ont
**toutes** une page `/classement/*` dédiée live (vérifiée dans
`sitemaps/rankings.xml`).

| #   | Requête                    |   Vol. | MCH        | yonder | travellers | Top 3 organique                                                        |
| --- | -------------------------- | -----: | ---------- | ------ | ---------- | ---------------------------------------------------------------------- |
| 1   | palaces paris              | 12 100 | **absent** | absent | absent     | 5starhotels.paris (#4), atout-france.fr (#6), fr.wikipedia.org (#7)    |
| 2   | hôtel romantique paris     |  1 600 | **absent** | #6     | absent     | booking.com (#3), letsgomylove.com (#4), hotelparisjadore.com (#5)     |
| 3   | meilleurs hôtels marrakech |  1 300 | **absent** | #5     | **#3**     | travellers-society.com (#3), tripadvisor.fr (#4), yonder.fr (#5)       |
| 4   | palaces courchevel         |    880 | **absent** | absent | absent     | excellencecourchevel.com (#3), airelles.com (#4), chevalblanc.com (#5) |
| 5   | meilleurs hôtels paris     |    590 | **absent** | **#4** | absent     | tripadvisor.fr (#3), yonder.fr (#4), timeout.fr (#5)                   |
| 6   | hôtel de luxe paris        |    390 | **absent** | **#4** | absent     | yonder.fr (#4), tripadvisor.fr (#5), hotelaparis.com (#6)              |
| 7   | meilleurs hôtels rome      |    320 | **absent** | **#1** | absent     | yonder.fr (#1), guide.michelin.com (#2), voyage-prive.com (#3)         |
| 8   | meilleurs hôtels dubai     |    320 | **absent** | **#1** | **#3**     | yonder.fr (#1), travellers-society.com (#3), tripadvisor.fr (#4)       |
| 9   | meilleurs hôtels venise    |    210 | **absent** | **#1** | **#2**     | yonder.fr (#1), travellers-society.com (#2), tripadvisor.fr (#3)       |
| 10  | meilleurs hôtels nice      |    140 | **absent** | #3     | absent     | yonder.fr (#3), tripadvisor.fr (#4), lefigaro.fr (#5)                  |
| 11  | hôtel de luxe megève       |    110 | **absent** | #3     | #7         | yonder.fr (#3), booking.com (#4), mdemegeve.com (#5)                   |
| 12  | hôtel de luxe marrakech    |     90 | **absent** | #5     | **#3**     | travellers-society.com (#3), royalmansour.com (#4), yonder.fr (#5)     |

**MCH = absent du top 20 sur les 12/12 requêtes.** yonder est présent sur
10/12 (absent uniquement sur les deux `palaces {ville}`), travellers sur 5/12.

### 2.1. Requêtes où MCH a une page dédiée mais reste « absent » = en attente d'indexation

**Les 12/12.** Chaque requête du panier pointe vers une page `/classement/*`
live recensée dans le sitemap de production — pourtant MCH n'apparaît sur
aucune. C'est le **symptôme central** : le contenu existe, il n'est juste
pas (encore) indexé / classé.

| Requête                    | Page MCH live (sitemap prod)                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| palaces paris              | `/classement/meilleurs-palaces-paris`                                                                            |
| hôtel romantique paris     | `/classement/meilleurs-hotels-romantiques-paris`                                                                 |
| meilleurs hôtels marrakech | `/classement/meilleurs-hotels-marrakech`                                                                         |
| palaces courchevel         | `/classement/meilleurs-palaces-courchevel`                                                                       |
| meilleurs hôtels paris     | `/classement/plus-beaux-hotels-paris` (+ `meilleurs-palaces-paris` ; pas de slug exact `meilleurs-hotels-paris`) |
| hôtel de luxe paris        | `/classement/hotel-de-luxe-paris`                                                                                |
| meilleurs hôtels rome      | `/classement/meilleurs-hotels-rome`                                                                              |
| meilleurs hôtels dubai     | `/classement/meilleurs-hotels-dubai`                                                                             |
| meilleurs hôtels venise    | `/classement/meilleurs-hotels-venise`                                                                            |
| meilleurs hôtels nice      | `/classement/meilleurs-hotels-nice`                                                                              |
| hôtel de luxe megève       | `/classement/hotel-de-luxe-megeve`                                                                               |
| hôtel de luxe marrakech    | `/classement/hotel-de-luxe-marrakech`                                                                            |

### 2.2. Requêtes du panier non interrogées (économie de quota)

La longue traîne ≤ 70 de volume du §1.1 n'a pas été ré-interrogée une à une
(ROI faible vs quota) : `hôtel de luxe {nice (70), côte d'azur (40),
saint-tropez (30), rome (20), venise (10), courchevel (50), dubai (50)}`,
`meilleurs hôtels {côte d'azur, saint-tropez, megève}` (volume n/d Ads).
Toutes sont ajoutables au prochain run en éditant `DEFAULT_BASKET` ou via
`--basket=fichier.json`.

## 3. Lecture — où on attaque, quoi surveiller

**Confirmé** : la baseline du plan (2026-06-23) tient — MCH est **absent
partout**, yonder/travellers présents sur l'essentiel du panier.

- **`palaces {ville}` = l'angle non gardé.** Sur `palaces paris` (12 100,
  le plus gros volume du panier) et `palaces courchevel` (880), **yonder ET
  travellers sont tous deux absents** — le haut est tenu par des annuaires
  (5starhotels.paris, hotelaparis.com), l'institutionnel (Atout France,
  france.fr) et les sites de marques (Airelles, Cheval Blanc). C'est le
  gisement le plus accessible : pas de concurrent-référent à déloger, juste
  des pages à faire indexer puis optimiser. **Priorité #1.**
- **`meilleurs hôtels {ville}` = chasse gardée yonder** (#1 Rome, #1 Dubaï,
  #1 Venise, #4 Paris), complétée par travellers (#2 Venise, #3 Dubaï,
  #3 Marrakech). C'est leur cœur éditorial — plus dur, mais c'est là qu'on
  veut exister à terme (on a la page pour les 6).
- **`hôtel de luxe {ville}`** est tenu par les OTA (Booking, TripAdvisor) +
  marques + yonder ; plus difficile qu'`palaces`.

**À surveiller mois après mois** (diff des snapshots JSON datés) :

1. **Entrée en index** : la première fois qu'une des 12 pages MCH apparaît
   dans le top 20 (même #18-20) = signal que l'indexation GSC produit son
   effet. Commencer par les 2 `palaces` (concurrence la plus faible).
2. **Entrée en page 2 → page 1** : alerte dès qu'une page MCH passe sous #11.
3. **Macro** : la courbe `domain_rank_overview` de MCH (mots-clés classés +
   ETV) — l'objectif intermédiaire réaliste est d'atteindre le niveau
   « petit travellers-society » (~1 300 kw), pas de viser yonder d'emblée.

**Méthode de suivi** : relancer `pnpm --filter @mch/editorial-pilot serp:track`
(nécessite `DATAFORSEO_*` dans `.env.local`), qui réécrit un
`serp-positions-<date>.{json,md}` comparable à celui-ci. Diffuser le diff
des positions à chaque passage.
