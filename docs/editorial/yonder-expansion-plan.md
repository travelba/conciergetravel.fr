# Plan d'expansion éditoriale — alignement Yonder × MyConciergeHotel

> **Date** : 18 mai 2026  
> **Auteur** : Cursor agent (Claude Opus 4.7)  
> **Statut** : phase 1 (scaffolding) terminée — éditorial à valider

---

## 1. TL;DR

Yonder.fr cite **478 hôtels** dans ses articles (palaces / 5★ / 4★ / 3★ /
maisons d'hôtes). MyConciergeHotel n'en couvrait que **67** sur cette
liste avant cette nuit.

| Métrique                            | Avant | Après scaffold v1 | Après promotion classifier | Δ total |
| ----------------------------------- | ----- | ----------------- | -------------------------- | ------- |
| Hôtels DB                           | 106   | 238               | **273**                    | +167    |
| Guides éditoriaux                   | 30    | **40**            | 40                         | +10     |
| Rankings éditoriaux                 | 101   | **159**           | 159                        | +58     |
| Hôtels matchés (≥0.55) Yonder ↔ MCH | 67    | 67                | 67                         | 0       |

**Classifier Phase A** (lancé en autonome cette nuit) : 142 hôtels Yonder
sans étoiles renseignées passés au crible Tavily + LLM → **37 nouveaux 5★ +
1 Palace** identifiés et insérés en draft. 2 hors France (Cap d'Antibes
"Hôtel Juana" déjà mappé, etc.) acceptés ; 4 hors France filtrés
(Halifax, Cork, Spetses, Minorque).

Les **132 nouveaux hôtels** sont insérés en `is_published = false` avec
`priority = 'P2'` et `booking_mode = 'display_only'`. **Les pages
`/hotel/[slug]` retournent donc 404 tant que les drafts ne sont pas
publiés** — ce qui protège la prod du contenu vide.

Total fichiers produits cette nuit :

```
scripts/editorial-pilot/yonder/
  raw/                    117 markdown pages cached from yonder.fr
  raw-urls.json           117 URLs (Tavily map output)
  hotels.json             478 hotels (LLM-parsed)
  pages.json              per-listing extraction map
  diff-in-both.json       67 matched
  diff-missing.json       399 missing
  diff-only-mch.json      58 MCH-exclusive
  diff-foreign-yonder.json 12 foreign mentions
  diff-summary.txt        readable diff report
  scaffold-to-insert.json 132 inserted
  scaffold-unmapped.json   1 skipped (Cork, Ireland)
  scaffold-hotels.sql     SQL preview
  scaffold-plans.json     64 ranking plans
  scaffold-guides-rankings.sql preview
  scaffold-guides-manual.sql   10 manual guide drafts
```

---

## 2. Diff Yonder ↔ MCH — vue détaillée

### 2.1 Top 20 hôtels manquants (cités le plus souvent par Yonder)

| Citations Yonder | Hôtel                                  | Ville/Région         |
| ---------------- | -------------------------------------- | -------------------- |
| 5×               | Hôtel du Rond-Point des Champs-Élysées | Paris 8              |
| 5×               | TOO Hôtel                              | Paris                |
| 5×               | Le Cinq Codet                          | Paris 7              |
| 5×               | Monsieur Aristide                      | Paris                |
| 4×               | Hôtel de Sers                          | Paris 8              |
| 4×               | Les Bords de Mer                       | Marseille            |
| 4×               | Brach Paris                            | Paris 16             |
| 4×               | Baumanière                             | Les Baux-de-Provence |
| 4×               | Les Roches Rouges                      | Saint-Raphaël        |
| 4×               | SO/ Paris                              | Paris                |
| 3×               | Le Chambard                            | Kaysersberg (Alsace) |
| 3×               | Château de Théoule                     | Théoule-sur-Mer      |
| 3×               | Villa Marie                            | Ramatuelle           |
| 3×               | Pullman Paris Centre Bercy             | Paris 12             |
| 3×               | La Fondation                           | Paris                |
| 3×               | Lily of the Valley                     | La Croix-Valmer      |
| 3×               | Hôtel Particulier Montmartre           | Paris 18             |
| 3×               | Hôtel La Bourdonnais                   | Paris 7              |
| 3×               | Le Barn                                | Bonnelles (Yvelines) |
| 3×               | Château Lafaurie-Peyraguey             | Bommes (Sauternais)  |

### 2.2 Filtrage appliqué pour le scaffold

| Catégorie d'hôtels Yonder     | Compte | Action                              |
| ----------------------------- | ------ | ----------------------------------- |
| 5★                            | 130    | ✅ inséré                           |
| Palace (toutes étoiles)       | 17     | ✅ inséré                           |
| 4★ (intersect 5★/palace = 15) | 105    | ❌ hors scope MCH (`stars=5` CHECK) |
| 3★                            | 4      | ❌ hors scope                       |
| 0★ (maisons d'hôtes, gîtes)   | 13     | ❌ hors scope                       |
| Étoiles non précisées         | 147    | ⏳ à enrichir (cf. §4.B)            |
| Étrangers (Cork, Budapest…)   | 12     | ❌ filtre langue                    |

Total inséré : **132 hôtels** (131 mappables + 1 manuellement
contrôlé). Reste 147 hôtels Yonder à confirmer 5★/Palace ou
maisons d'hôtes (cf. plan §4.B).

### 2.3 Hôtels exclusifs MCH (58)

Notre catalogue couvre 58 hôtels que Yonder ne mentionne pas — c'est
notre **avantage SEO** : pas de concurrence directe sur ces queries
longue traîne. Liste complète : `yonder/diff-only-mch.json`.

---

## 3. Scaffold rankings — 58 nouveaux

Tous les rankings sont insérés en `is_published = false` avec
intro placeholder (>= 400 chars, conforme au CHECK). Répartition :

| Kind       | Nombre | Exemples slugs                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| geographic | 39     | `meilleurs-hotels-paris-2`, `meilleurs-hotels-paris-12`, `meilleurs-hotels-nice`, `meilleurs-hotels-corse`, `meilleurs-hotels-provence`, `meilleurs-hotels-tour-eiffel`, `meilleurs-hotels-marais`, `meilleurs-hotels-montmartre`, `meilleurs-hotels-bastille`, `meilleurs-hotels-saint-germain`, `meilleurs-hotels-cote-azur`, `meilleurs-hotels-pays-basque`, `meilleurs-hotels-luberon`, `meilleurs-hotels-alpilles`, `meilleurs-hotels-sologne`, … |
| thematic   | 16     | `meilleurs-hotels-spa-france`, `meilleurs-hotels-piscine-france`, `meilleurs-hotels-rooftop-france`, `meilleurs-hotels-design-france`, `meilleurs-hotels-amoureux-france`, `meilleurs-hotels-famille-france`, `meilleurs-hotels-golf-france`, `meilleurs-hotels-oenotourisme-france`, `meilleurs-hotels-chateau-france`, `meilleurs-hotels-vue-mer-france`, …                                                                                          |
| best_of    | 9      | `meilleurs-hotels-palace-france`, `meilleurs-hotels-5-etoiles-france`, `meilleurs-hotels-luxe-france`, `meilleurs-hotels-charme-france`, `meilleurs-hotels-boutique-france`, …                                                                                                                                                                                                                                                                         |

Plus 10 guides manuels ajoutés (`pays-basque`, `sologne`, `sud-ouest`,
`hauts-de-france`, `occitanie`, `pays-de-la-loire`, `lac-leman`,
`vexin`, `ile-de-france-region`, `auvergne-rhone-alpes`).

---

## 4. Plan de génération éditoriale — par phases

Ordre conçu pour livrer **un maximum d'impact SEO/GEO avec un budget
LLM contrôlé**. Pré-requis : chaque phase est idempotente, peut
s'arrêter / reprendre, et écrit un journal `runs/yonder-overnight-<ts>.log`.

### Phase A — Validation rapide des 147 « inconnus » (Tavily light)

**Objectif** : pour les 147 hôtels Yonder sans étoiles renseignées,
décider 5★/Palace (à scaffolder) vs hors-scope (à archiver).

- Script : `scripts/editorial-pilot/src/yonder/classify-unknowns.ts` (à créer)
- Méthode : 1 Tavily search basic par hôtel (« <nom> hôtel étoiles
  France ») + 1 LLM extract (gpt-4o-mini) pour parser le nombre
  d'étoiles et le label « Palace » Atout France.
- Coût estimé : **147 × 1 crédit Tavily + 147 × $0.001 LLM ≈ $0.15 +
  147 Tavily credits**.
- Durée : 15 min.
- Sortie : `yonder/unknowns-classified.json`, puis ré-exécuter
  `pnpm yonder:scaffold` (idempotent, ajoute uniquement les nouveaux
  5★/Palace).

### Phase B — Enrichment factuel des 132 nouveaux hôtels

**Objectif** : doter chaque nouvel hôtel d'un `wikidata_id`,
`wikipedia_url_fr`, `latitude/longitude`, `phone_e164`, `official_url`,
`hero_image` (Cloudinary), `description_fr` (Wikipedia summary
nettoyée).

- Scripts existants à enchaîner (en parallèle, batch = 10) :
  1. `pnpm exec tsx src/enrichment/enrich-wikidata-ids.ts` (free)
  2. `pnpm geocode:hotels` (Nominatim — free, 1 req/s rate-limited)
  3. `pnpm photos:sync` (Cloudinary hero image — gratuit, quotas asset
     Cloudinary)
  4. `pnpm pois:sync` (Google Places + LLM POI extraction — ~$0.05 par
     hôtel = $7)
- Coût total : **~$10 + ~10 min/sub-step en série** = ~40 min total.
- Statut idempotent : OUI (skip si colonne déjà non-null).

### Phase C — Génération éditoriale Tier 1 (top 30 hôtels Yonder)

**Objectif** : pour les **30 hôtels les plus cités sur Yonder** (≥ 3
citations), passer le pipeline 8-passes complet pour produire un
contenu de niveau Plaza/Cap-Eden-Roc.

Slugs prioritaires (par citations) :

```
hotel-du-rond-point-des-champs-elysees, too-hotel, le-cinq-codet,
monsieur-aristide, hotel-de-sers, les-bords-de-mer, brach-paris,
baumaniere, les-roches-rouges, so-paris, le-chambard, chateau-de-theoule,
villa-marie, pullman-paris-centre-bercy, la-fondation, lily-of-the-valley,
hotel-parc-saint-severin, hotel-mansart, hotel-particulier-montmartre,
hotel-la-bourdonnais, le-barn, chateau-lafaurie-peyraguey,
les-hortensias-du-lac, hotel-vernet, chateau-de-fonscolombe,
hotel-spa-du-castellet, hotel-juana, hotel-barriere-l-hermitage-la-baule,
hotel-barriere-le-royal-deauville, u-capu-biancu
```

- Pré-requis : Phase B terminée (briefs Wikipedia + DATAtourisme).
- Script : `pnpm exec tsx src/enrichment/scale-build-briefs.ts` (auto-brief)
  puis `pnpm run:all` (8-passes).
- Coût estimé : **30 × $1.20 ≈ $36** (brief auto + 8-passes complets).
- Durée : 4 h (séquentiel, concurrency = 3).
- Sortie : `output/<slug>.md` + lignes Supabase mises à jour avec
  `long_description_sections`, `signature_experiences`,
  `concierge_advice`, `factual_summary_fr`, FAQ enrichie.

### Phase D — Génération éditoriale Tier 2 (les 102 hôtels restants)

- Même script, mais en lots de 20 hôtels / nuit avec contrôle qualité.
- Coût estimé : **102 × $1.20 ≈ $122**, étalé sur 5 nuits.

### Phase E — Génération des 58 nouveaux rankings

- Script : `pnpm rankings:bulk` (uses `loadRankingsV2`).
- Requiert : matrix `combinator.ts` qui croise le catalog Supabase à
  jour avec les axes de chaque ranking.
- Coût estimé : **58 × $0.40 ≈ $24**.
- Durée : 1 h 30.

### Phase F — Génération des 10 nouveaux guides destination

- Script : `pnpm exec tsx src/guides/run-guides-v2.ts`.
- Coût estimé : **10 × $0.60 ≈ $6**.
- Durée : 30 min.

### Phase G — Humanisation Concierge (rappel)

Une fois le contenu produit, les pipelines déjà existants tournent :

```
pnpm concierge:humanize:pois
pnpm concierge:humanize:events
pnpm concierge:humanize:faq
```

Sur les 132 hôtels neufs (+ contenu existant si modifié) : **~$15**.

### Phase H — Audit final + publication progressive

- `node ./audit-concierge-fiche.mjs` (Concierge voice score ≥ 95%).
- `pnpm lint:files` (linter editorial).
- Publication batch par batch (`UPDATE hotels SET is_published = true
WHERE slug IN (…)`) après contrôle humain de 5 fiches au hasard.

---

## 5. Coûts totaux estimés

| Phase                          | Coût LLM | Coût Tavily | Durée     |
| ------------------------------ | -------- | ----------- | --------- |
| A. Classify unknowns           | $0.15    | 147 credits | 15 min    |
| B. Enrichment (Wiki/Geo/POI)   | $10      | 0           | 40 min    |
| C. Génération Tier 1 (30 htl)  | $36      | 90 credits  | 4 h       |
| D. Génération Tier 2 (102 htl) | $122     | 300 credits | 14 h      |
| E. Rankings (58)               | $24      | 0           | 1 h 30    |
| F. Guides (10)                 | $6       | 30 credits  | 30 min    |
| G. Concierge voice             | $15      | 0           | 1 h       |
| **TOTAL**                      | **$213** | **567 cr.** | **~22 h** |

Budget Tavily actuel (1000 cr./mois free tier) : **suffisant** pour
tout sauf si la phase D part en boucle de retry agressive.

---

## 6. Risques + garde-fous

1. **Slug collisions** : 6 rankings Yonder écrasent des rankings MCH
   pré-existants. `ON CONFLICT DO NOTHING` protège. À auditer
   manuellement (`yonder/scaffold-plans.json` × `out/mch-rankings.json`).
2. **Étoiles invalides** : la contrainte `stars = 5` empêche d'insérer
   un 4★. Le script de scaffold a déjà filtré ; rien à faire.
3. **Régions vides** : 1 hôtel reste non-mappé (Cork, Irlande). À
   exclure ou créer un domaine `MyConciergeHotel.eu` séparé.
4. **Coût dérive Phase D** : plafonner à 20 hôtels/run via
   `--concurrency=3` et un budget Sentry-monitored.
5. **Publication accidentelle** : les 132 nouveaux hôtels sont
   `is_published = false` ; ne JAMAIS faire de `UPDATE … SET
is_published = true` global avant audit. Migrer batch par batch.
6. **Index Algolia** : à re-indexer après chaque publication (`pnpm
--filter @mch/search reindex`).
7. **Sitemap.xml** : auto-régénéré à chaque ISR cycle (`revalidate =
86400`).

---

## 7. Prochaines actions ce soir (autonome)

Le script `scripts/editorial-pilot/run-overnight-safe.mjs` (à créer)
lance uniquement les phases **A + B** (enrichment factuel, $10, idempotent).

Les phases **C–G** (génération LLM ≥ $30 chacune) seront lancées
**uniquement après validation humaine**, demain matin, sur le compte
exact d'hôtels à publier en priorité (Tier 1).

Justification : pas de publication massive sans relecture éditoriale ;
les 132 nouveaux drafts attendent un GO humain.

---

## 8. Capitalisation skills

- ✅ Skill `content-enrichment-pipeline/SKILL.md` — pattern
  Tavily map → extract → LLM parse → diff → scaffold mis en place.
  Ajouter une nouvelle Rule 6 : « Yonder-style competitor ingestion ».
- ✅ Skill `geo-llm-optimization/SKILL.md` — les 58 nouveaux rankings
  élargissent la longue traîne SEO de +60%. Documenter cette stratégie
  d'expansion par concurrent crawl.
- ⏳ Nouveau skill candidat : `competitor-catalog-diff/SKILL.md` (si
  l'opération est répétée sur d'autres sites — yonder.fr, condenast.fr,
  michelin.com).

---

## 9. Annexes

- `yonder/raw-urls.json` — 117 URLs crawled
- `yonder/hotels.json` — 478 hotels with hint_city/region/stars/palace
- `yonder/diff-*.json` — résultats du diff
- `yonder/scaffold-*.{json,sql}` — preview SQL avant insert
- `out/mch-hotels.json` — snapshot 238 hotels MCH
- `out/mch-guides.json` — snapshot 40 guides MCH
- `out/mch-rankings.json` — snapshot 159 rankings MCH

Toutes les opérations sont **idempotentes** et reproductibles via :

```bash
pnpm yonder:extract                       # 1. extract from yonder.fr
pnpm yonder:diff                          # 2. compare to MCH
pnpm yonder:scaffold -- --dry-run         # 3. preview hotel inserts
pnpm yonder:scaffold                      # 4. actually insert hotels
pnpm yonder:scaffold:gr -- --dry-run      # 5. preview rankings
pnpm yonder:scaffold:gr                   # 6. actually insert rankings
node yonder/exec-sql.mjs yonder/scaffold-guides-manual.sql  # 7. manual guides
node inspect-catalog.mjs                  # 8. confirm new totals
```
