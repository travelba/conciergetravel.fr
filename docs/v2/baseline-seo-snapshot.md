# Baseline SEO / GEO / perf — capture tâche 0.7

> **Gate Phase 0** (Q5, Q7) : ce document doit être **rempli et daté** avant tout
> changement visible en production ou bascule DNS. Copier ce fichier en
> `docs/v2/baseline-seo-snapshot-YYYY-MM-DD.md` une fois complété.
>
> Accès requis (PO) : Google Search Console, GA4, DataForSEO (MCP `user-dfs`),
> Vercel Analytics / CrUX, Supabase (compteurs catalogue).

---

## 1. Métadonnées de capture

| Champ                    | Valeur                                    |
| ------------------------ | ----------------------------------------- |
| **Date de capture**      | _YYYY-MM-DD_                              |
| **Environnement mesuré** | Production `https://myconciergehotel.com` |
| **Version git**          | _commit SHA_                              |
| **Opérateur**            | _nom / agent_                             |
| **Périmètre locales**    | `fr` (défaut) + `en`                      |
| **Statut gate 0.7**      | ☐ En cours · ☐ Validé PO                  |

---

## 2. Compteurs catalogue (Supabase)

Source : `apps/web/src/lib/catalogue-stats.ts` ou requête directe.

| Entité                               | Total publié | Draft | Notes              |
| ------------------------------------ | ------------ | ----- | ------------------ |
| `hotels`                             |              |       | Cible CDC : ~2 929 |
| `editorial_rankings`                 |              |       |                    |
| `editorial_guides`                   |              |       |                    |
| `itineraries`                        |              |       |                    |
| `places` (lieux)                     |              |       | ADR-0030           |
| Pays distincts (`country_code`)      |              |       |                    |
| Photos Cloudinary (`gallery_images`) |              |       |                    |
| Hôtels ≥ 10 photos                   |              |       | Phase 2 gate       |
| Hôtels ≥ 30 photos / 10 catégories   |              |       | CDC §2.2           |

**Requête type** (PostgREST / MCP Supabase) :

```sql
SELECT
  (SELECT count(*) FROM hotels WHERE is_published = true) AS hotels_published,
  (SELECT count(*) FROM editorial_rankings WHERE is_published = true) AS rankings_published,
  (SELECT count(*) FROM editorial_guides WHERE is_published = true) AS guides_published,
  (SELECT count(*) FROM itineraries WHERE is_published = true) AS itineraries_published,
  (SELECT count(*) FROM places WHERE is_published = true) AS places_published;
```

---

## 3. Google Search Console (28 derniers jours)

Property : `https://myconciergehotel.com/` (ou domain property).

### 3.1 Vue d'ensemble

| Métrique         | FR  | EN  | Total |
| ---------------- | --- | --- | ----- |
| Clics            |     |     |       |
| Impressions      |     |     |       |
| CTR moyen        |     |     |       |
| Position moyenne |     |     |       |

### 3.2 Top pages (clics)

| URL                                  | Clics | Impressions | CTR | Position |
| ------------------------------------ | ----- | ----------- | --- | -------- |
| _/hotel/le-meurice_                  |       |             |     |          |
| _/classement/meilleurs-hotels-paris_ |       |             |     |          |
| _/destination/paris_                 |       |             |     |          |
| _…_                                  |       |             |     |          |

### 3.3 Top requêtes (clics)

| Requête | Clics | Impressions | Position |
| ------- | ----- | ----------- | -------- |
|         |       |             |          |

### 3.4 Couverture / indexation

| Statut                           | Pages |
| -------------------------------- | ----- |
| Indexées                         |       |
| Non indexées (raison principale) |       |
| Erreurs                          |       |

---

## 4. GA4 (28 derniers jours)

Property : _ID GA4_.

| Métrique                      | Valeur |
| ----------------------------- | ------ |
| Utilisateurs                  |        |
| Sessions                      |        |
| Pages / session               |        |
| Durée engagement moyenne      |        |
| Taux de rebond (engagement)   |        |
| Conversions (événements clés) |        |

### 4.1 Top landing pages

| Page                 | Sessions | Engagement |
| -------------------- | -------- | ---------- |
| `/`                  |          |            |
| `/recherche`         |          |            |
| `/hotel/*` (agrégat) |          |            |
| `/classement/*`      |          |            |

### 4.2 Répartition device

| Device  | Sessions | %   |
| ------- | -------- | --- |
| Mobile  |          |     |
| Desktop |          |     |
| Tablet  |          |     |

---

## 5. DataForSEO — 50 requêtes témoins

> Seeds ancrés sur le benchmark yonder.fr + volume « hôtel de luxe {ville} ».
> Location : France (2250) / langue fr ; répéter échantillon EN (2840) si budget.
> Outil : MCP `user-dfs` → `dataforseo_labs_google_keyword_overview` +
> `serp_organic_live_advanced` pour position MCH.

### 5.1 Grille de capture

| #   | Requête témoin                  | Volume/mois | Intent | Position MCH | URL MCH classée | Top 3 SERP (concurrent) |
| --- | ------------------------------- | ----------- | ------ | ------------ | --------------- | ----------------------- |
| 1   | hôtel de luxe paris             |             |        |              |                 |                         |
| 2   | meilleurs hôtels paris          |             |        |              |                 |                         |
| 3   | hôtel de luxe nice              |             |        |              |                 |                         |
| 4   | meilleurs hôtels côte d'azur    |             |        |              |                 |                         |
| 5   | hôtel de luxe lyon              |             |        |              |                 |                         |
| 6   | palace paris                    |             |        |              |                 |                         |
| 7   | relais et châteaux france       |             |        |              |                 |                         |
| 8   | hôtel de luxe courchevel        |             |        |              |                 |                         |
| 9   | meilleurs hôtels bordeaux       |             |        |              |                 |                         |
| 10  | hôtel de luxe marseille         |             |        |              |                 |                         |
| 11  | hôtel ritz paris                |             |        |              |                 |                         |
| 12  | hotel de luxe paris             |             |        |              |                 |                         |
| 13  | meilleurs palaces france        |             |        |              |                 |                         |
| 14  | hôtel 5 étoiles paris           |             |        |              |                 |                         |
| 15  | hôtel de luxe cannes            |             |        |              |                 |                         |
| 16  | meilleurs hôtels rome           |             |        |              |                 |                         |
| 17  | hôtel de luxe londres           |             |        |              |                 |                         |
| 18  | hôtel de luxe dubai             |             |        |              |                 |                         |
| 19  | hôtel de luxe marrakech         |             |        |              |                 |                         |
| 20  | meilleurs hôtels bali           |             |        |              |                 |                         |
| 21  | où dormir à paris luxe          |             |        |              |                 |                         |
| 22  | que faire paris hôtel luxe      |             |        |              |                 |                         |
| 23  | hôtel spa paris luxe            |             |        |              |                 |                         |
| 24  | hôtel avec piscine paris        |             |        |              |                 |                         |
| 25  | boutique hotel paris            |             |        |              |                 |                         |
| 26  | hôtel de luxe provence          |             |        |              |                 |                         |
| 27  | meilleurs hôtels provence       |             |        |              |                 |                         |
| 28  | hôtel de luxe suisse            |             |        |              |                 |                         |
| 29  | hôtel de luxe italie            |             |        |              |                 |                         |
| 30  | hôtel de luxe espagne           |             |        |              |                 |                         |
| 31  | cap eden roc                    |             |        |              |                 |                         |
| 32  | le meurice paris                |             |        |              |                 |                         |
| 33  | cheval blanc paris              |             |        |              |                 |                         |
| 34  | aman le moulin                  |             |        |              |                 |                         |
| 35  | four seasons paris              |             |        |              |                 |                         |
| 36  | hôtel de luxe saint tropez      |             |        |              |                 |                         |
| 37  | meilleurs hôtels french riviera |             |        |              |                 |                         |
| 38  | hôtel de luxe megève            |             |        |              |                 |                         |
| 39  | hôtel de luxe deauville         |             |        |              |                 |                         |
| 40  | hôtel de luxe strasbourg        |             |        |              |                 |                         |
| 41  | luxury hotel paris              |             |        |              |                 |                         |
| 42  | best hotels paris               |             |        |              |                 |                         |
| 43  | best luxury hotels france       |             |        |              |                 |                         |
| 44  | paris hotel concierge           |             |        |              |                 |                         |
| 45  | myconciergehotel                |             |        |              |                 |                         |
| 46  | yonder hôtels paris             |             |        |              |                 |                         |
| 47  | classement hôtels luxe          |             |        |              |                 |                         |
| 48  | hôtel de luxe avec vue          |             |        |              |                 |                         |
| 49  | hôtel de luxe gastronomique     |             |        |              |                 |                         |
| 50  | hôtel de luxe famille           |             |        |              |                 |                         |

### 5.2 Synthèse DataForSEO

| Indicateur                                       | Valeur |
| ------------------------------------------------ | ------ |
| Requêtes témoins avec MCH top 20                 | _/50_  |
| Requêtes témoins avec MCH top 10                 | _/50_  |
| Position médiane (requêtes brand)                |        |
| Position médiane (requêtes génériques ville)     |        |
| Domaine référence yonder.fr — positions moyennes |        |

---

## 6. Web Vitals (CrUX + Vercel Analytics)

Période : 28 jours · stratégie : **p75 mobile** (prioritaire).

### 6.1 Origine (domaine)

| Métrique | p75 mobile | Seuil « Good » | Statut |
| -------- | ---------- | -------------- | ------ |
| LCP      |            | ≤ 2,5 s        |        |
| INP      |            | ≤ 200 ms       |        |
| CLS      |            | ≤ 0,1          |        |

### 6.2 URLs témoin (Field + Lab Lighthouse)

| URL                                  | LCP | INP | CLS | Lighthouse perf (mobile) |
| ------------------------------------ | --- | --- | --- | ------------------------ |
| `/`                                  |     |     |     |                          |
| `/recherche?destination=paris`       |     |     |     |                          |
| `/hotel/le-meurice`                  |     |     |     |                          |
| `/hotel/le-meurice` (EN)             |     |     |     |                          |
| `/classement/meilleurs-hotels-paris` |     |     |     |                          |
| `/destination/paris`                 |     |     |     |                          |
| `/compte` (noindex — perf only)      |     |     |     |                          |

### 6.3 Budgets v2 (cibles post-refonte)

| Surface     | LCP cible | JS first load |
| ----------- | --------- | ------------- |
| Home        | ≤ 2,0 s   | < 180 KB gz   |
| SRP         | ≤ 2,5 s   | < 200 KB gz   |
| Fiche hôtel | ≤ 2,5 s   | < 220 KB gz   |

Référence : [`.cursor/rules/observability-perf.mdc`](../../.cursor/rules/observability-perf.mdc).

---

## 7. Benchmark concurrent (yonder.fr)

| Indicateur                                   | yonder.fr / travellers-society | MCH v1 |
| -------------------------------------------- | ------------------------------ | ------ |
| Requêtes « meilleurs hôtels {ville} » top 10 |                                |        |
| Richesse fiche (mots, photos, FAQ)           |                                |        |
| JSON-LD types / page                         | ~6                             | ~10    |
| Parité mobile SRP                            |                                |        |

Référence : [`.cursor/rules/competitor-benchmark-yonder.mdc`](../../.cursor/rules/competitor-benchmark-yonder.mdc).

---

## 8. Checklist validation gate 0.7

- [ ] GSC exporté (CSV ou capture datée)
- [ ] GA4 exporté
- [ ] 50 requêtes DataForSEO remplies (cache `data/dfs-cache/` commité ou artefact run)
- [ ] Web Vitals CrUX + Lighthouse lab sur 6 URLs témoin
- [ ] Compteurs catalogue Supabase snapshotés
- [ ] Fichier daté archivé : `baseline-seo-snapshot-YYYY-MM-DD.md`
- [ ] PO a validé silencieusement (Q2 — 48 h) ou signé explicitement

---

## 9. Post-bascule (à remplir J+7 / J+30)

| Métrique                     | Baseline (J0) | J+7 | J+30 | Δ acceptable      |
| ---------------------------- | ------------- | --- | ---- | ----------------- |
| GSC clics / sem              |               |     |      | ±15 %             |
| GSC impressions              |               |     |      |                   |
| Position moyenne 50 témoins  |               |     |      |                   |
| LCP p75 mobile (home)        |               |     |      | ≤ baseline + 10 % |
| Erreurs 404 (Search Console) |               |     |      | 0 régression      |

**Rollback trigger** : chute > 25 % clics sur 14 jours glissants + confirmation technique (DNS, 404 massifs) → re-pointage domaine v1 (< 15 min, CDC §9).

---

## Références

- CDC v2 §2 objectif 5 + §9 : [`docs/cdc/cahier-des-charges-v2-booking-like.md`](../cdc/cahier-des-charges-v2-booking-like.md)
- Skill DataForSEO : [`.cursor/skills/keyword-grounding-dataforseo/SKILL.md`](../../.cursor/skills/keyword-grounding-dataforseo/SKILL.md)
- Skill perf : [`.cursor/skills/performance-engineering/SKILL.md`](../../.cursor/skills/performance-engineering/SKILL.md)
- Matrice parité : [`benchmark-booking-parity-matrix.md`](benchmark-booking-parity-matrix.md)
