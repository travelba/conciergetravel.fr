# GSC — 30 URLs têtes à soumettre manuellement (2026-07)

> **Contexte** : décision PO **D3** (02/07/2026) — « coupe complète » de la
> surface indexable. Google indexe la longue traîne (`/destination/dommeldange`
> = 1 hôtel, Belgrade, Clervaux) au lieu des pages têtes ; 8 202 URLs soumises,
> **2,3 % avec impressions** ; `le-meurice` est « Discovered — currently not
> indexed ». Le WS-B a réduit `hubs.xml` de **1401 → 211** hubs de destination
> indexables (‑1190 pages `noindex, follow`) et retiré `places.xml` + `rooms.xml`
> de l'index. Ce document liste les **30 URLs têtes** à pousser à la main dans
> **Google Search Console → Inspection d'URL → Demander une indexation**, pour
> forcer le recrawl vers ce qui compte pendant que le crawl budget se
> reconcentre.
>
> **Méthode de priorisation** : volumes de recherche issus de
> [`serp-baseline-2026-06-24.md`](serp-baseline-2026-06-24.md) §2 (DataForSEO
> `serp/google/organic/live/advanced`, location France, langue fr). Chaque URL
> a été vérifiée **live + publiée** en base (PostgREST, 2026-07-02) — aucune ne
> renvoie 404 ni `noindex`.
>
> **URLs canoniques** : locale FR par défaut = **sans préfixe** (`localePrefix:
'as-needed'`). On soumet la version FR canonique ; l'alternate EN
> (`/en/...`) est découverte via les `hreflang` du sitemap, pas besoin de la
> soumettre séparément (quota GSC ≈ 10 demandes/jour/propriété).
>
> **Cadence conseillée** : GSC limite les demandes manuelles. Étaler sur ~3-4
> jours dans l'ordre des tiers ci-dessous (Tier 1 d'abord — plus fort volume +
> concurrence la plus faible sur `palaces {ville}`, cf. baseline §3).

## Tier 1 — Classements ville à fort volume (12 URLs)

Angle prioritaire **`palaces {ville}`** : sur `palaces paris` (12 100) et
`palaces courchevel` (880), yonder **et** travellers sont absents du top 20 —
c'est le gisement le plus accessible (baseline §3, priorité #1).

| #   | URL (canonique FR)                               | Requête cible              | Vol. FR/mois |
| --- | ------------------------------------------------ | -------------------------- | -----------: |
| 1   | `/classement/meilleurs-palaces-paris`            | palaces paris              |       12 100 |
| 2   | `/classement/meilleurs-hotels-romantiques-paris` | hôtel romantique paris     |        1 600 |
| 3   | `/classement/meilleurs-hotels-marrakech`         | meilleurs hôtels marrakech |        1 300 |
| 4   | `/classement/meilleurs-palaces-courchevel`       | palaces courchevel         |          880 |
| 5   | `/classement/plus-beaux-hotels-paris`            | meilleurs hôtels paris     |          590 |
| 6   | `/classement/hotel-de-luxe-paris`                | hôtel de luxe paris        |          390 |
| 7   | `/classement/meilleurs-hotels-rome`              | meilleurs hôtels rome      |          320 |
| 8   | `/classement/meilleurs-hotels-dubai`             | meilleurs hôtels dubai     |          320 |
| 9   | `/classement/meilleurs-hotels-venise`            | meilleurs hôtels venise    |          210 |
| 10  | `/classement/meilleurs-hotels-nice`              | meilleurs hôtels nice      |          140 |
| 11  | `/classement/hotel-de-luxe-megeve`               | hôtel de luxe megève       |          110 |
| 12  | `/classement/hotel-de-luxe-marrakech`            | hôtel de luxe marrakech    |           90 |

## Tier 2 — Fiches hôtels flagship (12 URLs)

Les fiches les plus recherchées en nom de marque (« brand queries » à forte
intention). `le-meurice` est explicitement « Discovered, not indexed » en GSC —
le forçage manuel est le levier direct. Slugs vérifiés en base (2026-07-02).

| #   | URL (canonique FR)                      | Hôtel                    | Ville      |
| --- | --------------------------------------- | ------------------------ | ---------- |
| 13  | `/hotel/hotel-ritz-paris`               | Ritz Paris               | Paris      |
| 14  | `/hotel/le-meurice`                     | Le Meurice               | Paris      |
| 15  | `/hotel/four-seasons-hotel-george-v`    | Four Seasons George V    | Paris      |
| 16  | `/hotel/le-bristol-paris`               | Le Bristol               | Paris      |
| 17  | `/hotel/cheval-blanc-paris`             | Cheval Blanc Paris       | Paris      |
| 18  | `/hotel/le-royal-monceau-raffles-paris` | Le Royal Monceau Raffles | Paris      |
| 19  | `/hotel/claridge-s-londres`             | Claridge's               | Londres    |
| 20  | `/hotel/the-savoy`                      | The Savoy                | Londres    |
| 21  | `/hotel/burj-al-arab`                   | Burj Al Arab Jumeirah    | Dubaï      |
| 22  | `/hotel/atlantis-the-royal`             | Atlantis The Royal       | Dubaï      |
| 23  | `/hotel/hotel-du-cap-eden-roc`          | Hôtel du Cap-Eden-Roc    | Antibes    |
| 24  | `/hotel/les-airelles-courchevel`        | Les Airelles Courchevel  | Courchevel |

## Tier 3 — Hubs majeurs + guides pays + home (6 URLs)

Pages de tête qui distribuent le PageRank interne vers les fiches + classements
(elles restent `index` sous le seuil D3 — toutes ≥ 3 hôtels publiés).

| #   | URL (canonique FR)       | Type            | Note                                |
| --- | ------------------------ | --------------- | ----------------------------------- |
| 25  | `/`                      | Homepage        | URL racine, priorité 1.0 du sitemap |
| 26  | `/destination/paris`     | Hub destination | ville tête (≫ 3 hôtels)             |
| 27  | `/destination/dubai`     | Hub destination | ville tête                          |
| 28  | `/destination/marrakech` | Hub destination | ville tête                          |
| 29  | `/guide/italie`          | Guide pays      | long-read + hub destination         |
| 30  | `/guide/japon`           | Guide pays      | long-read + hub destination         |

## Procédure GSC (rappel)

1. Search Console → propriété `myconciergehotel.com` → **Inspection de l'URL**.
2. Coller l'URL canonique (copier-coller depuis les tableaux ci-dessus,
   **sans** préfixe `/fr/`).
3. Attendre le test live → **« Demander une indexation »**.
4. Répéter dans l'ordre Tier 1 → 2 → 3, ~8-10/jour (limite GSC).
5. À J+7 et J+30, re-mesurer avec `pnpm --filter @mch/editorial-pilot serp:track`
   (même panier que la baseline) et diffuser le diff des positions.

## Suivi de l'effet (à croiser avec la baseline)

- **Signal d'entrée en index** : première apparition d'une des 12 pages
  `/classement/*` du Tier 1 dans le top 20 (baseline §3 point 1). Commencer la
  surveillance par les deux `palaces` (concurrence la plus faible).
- **Couverture GSC** : le ratio « URLs avec impressions » doit remonter au fur
  et à mesure que la longue traîne `noindex` sort de l'index et que le crawl se
  reconcentre sur ces 30 têtes + les ~600-800 URLs indexables restantes.
- **Ne pas re-soumettre** la longue traîne `noindex` : c'est exactement ce que
  D3 retire du crawl. Laisser Google la désindexer naturellement.
