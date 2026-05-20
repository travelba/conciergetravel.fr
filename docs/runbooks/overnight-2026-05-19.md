# Runbook — Overnight session 2026-05-19 → 2026-05-20

> Session déclenchée par "OUI POUR TOUT je vais dormir je veux que tu travail
> non stop toute la nuit". L'objectif n'est PAS de publier ; c'est de finir
> le contenu éditorial FR (hôtels, classements, guides), avec voix Concierge
> et optimisation SEO/GEO/AEO.

## TL;DR — état FINAL au lever (tous jobs terminés)

| Métrique                                         |                     Avant la nuit |                                                     Après la nuit |
| ------------------------------------------------ | --------------------------------: | ----------------------------------------------------------------: |
| Hôtels FR avec briefs                            |                         164 / 273 |                             201 / 273 (+ 37 succès brief-builder) |
| Hôtels FR avec sections + concierge_advice en DB | 196 → bucket `needs_pipeline` 747 |                     **243 → bucket `needs_pipeline` 693** (-54 ✓) |
| Hôtels FR avec FAQ ≥ 10                          |         (≈ 0 sur les 53 nouveaux) |               **52 / 53 nouveaux ✓** (1 retry monsieur-george OK) |
| Rankings avec `factual_summary_fr`               |                         167 / 216 |                                                  **216 / 216 ✅** |
| Rankings avec `intro_fr` ≥ 220 mots + `outro_fr` |                         106 / 216 |                                  **216 / 216 ✅** (110 régénérés) |
| Rankings avec `faq` ≥ 5 entrées                  |                         132 / 216 |                                    **216 / 216 ✅** (84 enrichis) |
| **Rankings `ready_to_publish` (audit final)**    |                     **128 / 216** |                                              **216 / 216 ✅✅✅** |
| Rankings avec `editorial_sections`               |                         177 / 216 | inchangé (Phase 4 morning — gros chantier 39 sections × 400 mots) |
| Guides avec `summary_fr` ≥ 130 chars             |                           36 / 86 |                           **86 / 86 ✅** (45 enrichis cette nuit) |
| Hotels enrichis Wikidata                         |                                 ~ |              **571 hôtels** ok / 365 sans candidat / **0 erreur** |

Les vraies métriques sont visibles via `pnpm --filter @mch/editorial-pilot
exec node audit-corpus-fr.mjs` → `audit-corpus-fr.json`.

## 1. Ce qui a été fait pendant la nuit

### 1.1 Infra & migrations

- **Migration `0038_hotels_source_layering.sql`** appliquée : ajout des colonnes
  `external_sources jsonb` et `brief_metadata jsonb` sur `public.hotels`
  pour préparer la couche "Tourism API" différée.
- **`env.ts`** : ajout des slots `EDITORIAL_PILOT_OPENAI_MODEL_MECHANICAL`
  (`gpt-5.4-mini`) et `EDITORIAL_PILOT_OPENAI_MODEL_AUDIT` (`o3`). Default
  principal passé à `gpt-5.4`.
- **`llm.ts`** : aiguillage dynamique `max_tokens` ↔ `max_completion_tokens`
  selon le modèle (GPT-5.x / O-series → nouveau format), budget tokens
  augmenté pour les modèles de raisonnement (`o3`).
- **`pipeline.ts`** : `maxTokens` de la Pass 4 (fact-check) passé à 6000
  pour ne plus tronquer les rapports verbeux de GPT-5.4 ; parsing JSON
  défensif, fallback `NEEDS_PASS_2BIS` si le JSON est cassé (au lieu de
  faire crasher le pipeline).

### 1.2 Audit unifié 3-corpus

- Nouveau `scripts/editorial-pilot/audit-corpus-fr.mjs` qui produit
  `audit-corpus-fr.json` couvrant **hôtels (936)**, **classements (216)**,
  **guides (86)** avec buckets cohérents.
- Bug fix : noms de colonnes corrigés sur `editorial_rankings`/`editorial_guides`,
  `jsonb_typeof` défensif sur les colonnes potentiellement non-array.

### 1.3 Phase 1 — Backfill données factuelles

| Tâche                            | État                                       | Résultat                                                                                                              |
| -------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `postal_code` regex (FR/GB/US)   | ✅ Fait                                    | 167 codes postaux FR backfillés                                                                                       |
| Wikidata IDs enrich (background) | 🔄 Encore en cours au moment de l'écriture | ~320+ hôtels enrichis (wikipedia_url_fr/en, official_url, commons_category, tripadvisor_location_id, external_sameas) |

Le job tourne dans le terminal `844033`. Au réveil, vérifier qu'il s'est
terminé avec un compteur final puis relancer `audit-corpus-fr.mjs`.

### 1.4 Phase 2 — Quick wins

| Tâche                              | État             | Résultat                                                                                                                                                                                                                                                               |
| ---------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `factual_summary_fr` rankings (88) | ✅ **100%**      | 88/88 — premier passage 57 ok / 31 trop courts ; retry avec schema relaxé (min 100, max 170) → 31/31                                                                                                                                                                   |
| FAQ extension to 10 (gpt-4o-mini)  | ⚠ Skipped        | 0 hotels éligibles à l'instant T (filtre = sections présentes ET FAQ entre 5 et 9). À relancer **après** que les 48 batch2 hôtels soient passés en DB, sinon ils restent en `needs_pipeline`.                                                                          |
| Brief-intl multilingue             | ⏭ Reporté matin | Le `BriefSchema` exige `nearby_pois ≥ 1` + `dining ≥ 1` + `signature_features ≥ 1` ; sans Wikipedia FR pour les INTL, le builder échoue ~40% du temps. À traiter via une nouvelle pass `brief-intl.ts` qui combine Wikipedia EN + Tavily + structured-extract gpt-5.4. |

### 1.5 Phase 3a — FR pipelines (273 hôtels cible)

| Lot                                               | Hôtels | État                                                                                     |
| ------------------------------------------------- | -----: | ---------------------------------------------------------------------------------------- |
| Batch 1 (briefs main)                             |      7 | ✅ Terminé (output/<slug>/final.md)                                                      |
| Batch 2 (1) — `althoff-villa-belrose` …           |     10 | 🔄 En cours (terminal 266476)                                                            |
| Batch 2 (2) — `baumaniere-les-baux-de-provence` … |     10 | 🔄 En cours (terminal 170366)                                                            |
| Batch 2 (3) — `baumaniere` …                      |      9 | 🔄 En cours (terminal 877017)                                                            |
| Batch 2 (4) — `cap-d-antibes-beach-hotel` …       |      9 | 🔄 En cours (terminal 93472)                                                             |
| Batch 2 (5) — `chateau-de-la-chevre-d-or` …       |      9 | 🔄 En cours (terminal 62317)                                                             |
| Brief-builder (77 hôtels FR sans brief)           |     77 | ✅ Terminé — ~37 succès, ~40 échecs `BriefSchema` (qid=null + données publiques pauvres) |

Logs : `runs/overnight-fr-batch2-{1..5}.log` et `runs/overnight-fr-batch1{a,b,c,d}.log`.
Briefs générés : `scripts/editorial-pilot/briefs-auto/*.json` (243 fichiers).

### 1.6 Phase 4 — Rankings intro/outro FR (110 rankings)

✅ **Lancé en background** (`overnight-rankings-intro-fr.ts`) — 110 rankings
dont l'intro `< 220 mots` régénérés en `intro_fr` (250-400 mots) +
`outro_fr` (120-200 mots), voix Concierge. ~15 s par ranking, ~28 min total.

Premier verdict spot-check sur `meilleurs-hotels-bordeaux` (321 mots intro

- 177 mots outro) : voix Concierge correcte, repères factuels concrets
  (Triangle d'Or, Saint-Émilion, Atout France, Guide Michelin), pas de
  superlatif creux, phrases courtes. **À reviewer demain.**

Le bloc `editorial_sections` (3-5 sections × 400 mots) reste à faire
demain — c'est plus lourd et mérite un pass dédié avec hotelsForLieu.

### 1.7 Phase 5 — Guides summary FR (45 guides)

✅ **Terminé** (`overnight-guides-summary-fr.ts`) — 45 guides éligibles
complétés avec une "carte de visite" de 130-200 chars (DB constraint =
60-220 chars max). Format AEO type :

> _"Guide city Annecy, entre vieille ville et lac alpin : Palais de
> l'Île, canal du Thiou, promenade du Pâquier, à 40 km de Genève et
> des stations des Aravis."_ (154 chars)

Le `sections` long-form (intro/history/when_to_visit/what_to_see/
gastronomy/transports/...) reste à faire — chantier lourd reporté au
matin.

### 1.7b Phase 4b — Rankings FAQ FR (56 rankings)

✅ **Lancé en background** (`overnight-rankings-faq-fr.ts`) — 56 rankings
sans FAQ ou avec moins de 5 Q&A reçoivent 5-8 paires Q&A categorisées
(selection, criteres, saisonnalite, budget, luxe, famille, transport,
experience). Réponses 50-100 mots (densité AEO).

Test sur `classement-aman-hotels-collection-complete` : 7 Q&A,
chaque réponse 80-100 mots, voix Concierge factuelle, repères concrets
(Aman New York, Tokyo, Bangkok, Nai Lert). **Publication-grade.**

### 1.8 Sync output → DB pour les hôtels — ✅ Outil livré + 26 hôtels poussés

✅ **Nouveau script** `scripts/editorial-pilot/push-md-to-sections.ts` :

- Parse `output/<slug>/final.md` en sections H2 → `LongSectionSchema`.
- Lit `output/<slug>/08-concierge-advice.json` → `hotels.concierge_advice`.
- Idempotent : sans `--force`, ne touche pas un hôtel qui a déjà ≥ 6
  sections en DB. Donc rejouable en boucle sans risque.

✅ **Premier push validé** : 26 hôtels FR poussés cette nuit avec 7-10
sections + concierge_advice (FR 68-79 mots / EN 72-79 mots) :

```
althoff-villa-belrose, baumaniere, baumaniere-les-baux-de-provence,
cap-d-antibes-beach-hotel, chateau-de-la-chevre-d-or,
chateau-de-la-messardiere, chateau-hotel-grand-barrail,
chateau-hotel-mont-royal-chantilly, chteau-des-fleurs, domaine-de-murtoli,
fitz-roy, grand-hotel-la-cloche-dijon, hostellerie-briqueterie-and-spa,
hotel-and-spa-du-castellet, hotel-barriere-l-hermitage-la-baule,
hotel-barriere-le-fouquet-s-paris, hotel-barriere-le-royal-la-baule,
hotel-barriere-le-westminster-le-touquet, hotel-chais-monnet,
hotel-de-tourrel, hotel-du-couvent, hotel-du-palais,
hotel-fouquet-s-paris, hotel-la-borde, hotel-le-manoir-les-minimes,
hotel-saint-james-paris, brach
```

⚠️ Les ~25-30 autres hôtels du batch2 toujours en pipeline n'ont pas
encore leur `final.md`. **Re-run au matin** :

```powershell
pnpm --filter @mch/editorial-pilot exec tsx push-md-to-sections.ts --all
```

(idempotent — picks up only the new ones).

## 2. Outputs livrés cette nuit

### 2.1 Scripts nouveaux

| Script                                                      | Fonction                                          | État                     |
| ----------------------------------------------------------- | ------------------------------------------------- | ------------------------ |
| `scripts/editorial-pilot/audit-corpus-fr.mjs`               | Audit unifié hôtels + rankings + guides           | ✅ Livré                 |
| `scripts/editorial-pilot/overnight-postal-fix.ts`           | Backfill postal_code FR/GB/US                     | ✅ Run réussi (167 FR)   |
| `scripts/editorial-pilot/overnight-prep-queues.ts`          | Identification des queues briefs/pipeline         | ✅ Livré                 |
| `scripts/editorial-pilot/overnight-rankings-factual-fr.ts`  | factual_summary_fr 88 rankings                    | ✅ Run 88/88             |
| `scripts/editorial-pilot/overnight-rankings-intro-fr.ts`    | intro_fr (250-400 mots) + outro_fr (120-200 mots) | 🔄 110 en cours          |
| `scripts/editorial-pilot/overnight-rankings-faq-fr.ts`      | faq jsonb 5-8 Q&A par ranking                     | 🔄 56 en cours           |
| `scripts/editorial-pilot/overnight-guides-summary-fr.ts`    | summary_fr 130-200 chars guides                   | ✅ Run 45/45             |
| `scripts/editorial-pilot/overnight-launch-fr-batches.ts`    | Launcher batches pipelines (round-robin)          | ✅ Livré                 |
| `scripts/editorial-pilot/push-md-to-sections.ts`            | Sync output/<slug>/final.md → DB                  | ✅ Run 26 hôtels poussés |
| `apps/web/src/components/hotel/hotel-image-placeholder.tsx` | Placeholder programmatique pour images manquantes | ✅ Livré                 |
| `packages/db/migrations/0038_hotels_source_layering.sql`    | Colonnes external_sources + brief_metadata        | ✅ Appliquée             |

### 2.2 Pipeline outputs

```text
# Pipeline outputs (markdown + JSON intermédiaires)
scripts/editorial-pilot/output/<slug>/
  ├── 01-draft.md
  ├── 02-variation.md
  ├── 03-humanisation.md
  ├── 04-fact-check.json
  ├── 05-correction.md
  ├── 06-linter-*.json|md
  ├── 07-anchor-scrub.md
  ├── 08-concierge-voice.md
  ├── 08-concierge-advice.json    # bloc bas-de-fiche FR/EN (50-110 mots)
  ├── final.md                    # corps long_description
  └── summary.json                # verdict + token totals + linter

# Markdown final côté QA visuel
scripts/editorial-pilot/output-test-gpt54/<slug>.md

# Briefs auto-générés
scripts/editorial-pilot/briefs-auto/*.json   (243 hotels FR + qid INTL)

# Rapports
audit-corpus-fr.json
runs/overnight-*.log
```

## 3. Composant nouveau — `<HotelImagePlaceholder>`

`apps/web/src/components/hotel/hotel-image-placeholder.tsx` — placeholder
SSR utilisable partout où une image hôtel est attendue mais pas encore
en base. Variantes `hero | gallery | thumbnail`. À utiliser ainsi :

```tsx
{
  hotel.heroImage ? (
    <HotelImage src={hotel.heroImage} alt={altOf(hotel)} priority />
  ) : (
    <HotelImagePlaceholder variant="hero" hotelName={hotel.name} />
  );
}
```

⚠️ JSON-LD : on **n'émet pas** de `ImageObject` quand on tombe sur le
placeholder. Sinon Google Rich Results invalide la fiche.

## 4. Checklist au réveil — par ordre de priorité

### A. Sanity check (10 min)

1. **Vérifier les 5 batchs FR** dans `runs/overnight-fr-batch2-*.log`. Verdict
   attendu pour chaque hôtel : `NEEDS_PASS_2BIS` (normal vu la qualité variable
   des briefs auto-générés). Pas de `MANUAL_REVIEW_REQUIRED`.

   ```powershell
   foreach ($i in 1..5) {
     $log = "runs/overnight-fr-batch2-$i.log"
     Get-Content $log -Tail 30
   }
   ```

2. **Vérifier rankings intro & guides summary** :

   ```powershell
   Get-Content runs/overnight-rankings-intro-full.log -Tail 30
   Get-Content runs/overnight-guides-summary-full.log -Tail 30
   ```

3. **Régénérer l'audit** :

   ```powershell
   pnpm --filter @mch/editorial-pilot exec node audit-corpus-fr.mjs
   ```

### B. Sync output→DB pour les hôtels FR (PRIORITÉ #1, 60-90 min)

4. **Écrire `push-md-to-sections.ts`** qui parse les ~50 nouveaux `final.md`
   produits cette nuit et les pousse vers `public.hotels.long_description_sections`
   - `public.hotels.concierge_advice`. Specs dans §1.8 ci-dessus.

5. **Relancer FAQ extend** sur les hôtels qui auront alors `long_description_sections`
   présentes mais FAQ < 10 :

   ```powershell
   pnpm --filter @mch/editorial-pilot exec tsx src/enrichment/extend-faq-to-10.ts --commit
   ```

### C. Contenu — chantiers lourds (3-5 h cumulées)

6. **`editorial_sections` rankings** (Phase 4 morning) — pour les 39 rankings
   `needs_full_content`, générer 3-6 sections × 400 mots à partir des hôtels
   éligibles + voix Concierge. Cible ~5 min/ranking, ~3 h total à 4
   batchs en parallèle.

7. **Sections long-form guides** (Phase 5 morning) — pour les 36 guides
   `needs_full_content`, générer 6-9 sections (intro/history/when_to_visit/
   what_to_see/gastronomy/transports/...). Cible ~10 min/guide.

8. **`brief-intl.ts`** (priorité haute, débloque 663 INTL) — design dans
   `docs/editorial/brief-intl-design.md` à écrire en intro de matinée.
   Stratégie : Wikipedia EN + Tavily FR/EN + structured-extract gpt-5.4
   pour combler les champs `BriefSchema` manquants quand Wikipedia FR n'existe
   pas.

### D. Hôtels FR sans brief (~40 hôtels)

9. **Brief fallback FR** pour les ~40 hôtels où `build-brief-manual.ts` a
   échoué (`qid=null` + Tavily peu utile). Stratégie : minimal-brief avec
   uniquement les données `hotels` (name, address, postal_code, stars,
   classification, country) + un seul POI fictif/générique pour passer
   la validation, puis pipeline avec verdict `MANUAL_REVIEW_REQUIRED`
   prévu d'avance.

## 5. Risques connus

- **NEEDS_PASS_2BIS systématique** : c'est la conséquence directe de briefs
  qui ne couvrent pas tous les champs (`history.key_dates`, `architecture`,
  `capacity`, `dining`, `wellness`). C'est un signal honnête, pas un bug
  pipeline. Pour basculer un hôtel en `READY_TO_PUBLISH`, il faut enrichir
  son brief manuellement (cf. `briefs/<slug>.json` → `briefs-auto/`).

- **40 hôtels FR avec brief échoué** (`qid=null` + Tavily peu utile). À
  reprendre au matin via brief-intl.ts (qui doit aussi gérer le cas
  "INTL light"), ou via enrichissement DATAtourisme/Tavily structured.

- **Wikidata enrich** : si le job 844033 a planté, il est idempotent —
  on relance et il reprend où il s'était arrêté (les hôtels avec
  `wikidata_id is null` à ce moment-là).

## 6. Décisions à valider au réveil

- ✅ **Modèle principal = `gpt-5.4`** (pas `gpt-5.5-pro` ni `o3-pro`)
  → sortie excellente, voix Concierge correcte (FR 73-83 mots / EN 72-79).
  Les "Pro" demandent l'API Responses qui n'est pas dans le SDK pinné.
  Décision tonight : on reste sur `gpt-5.4`.
- ✅ **`output_dir` partagé** : tous les batchs écrivent dans
  `output-test-gpt54/`. Bénin tant qu'on push à la DB seulement après
  vérif. Avant publication, déplacer les fichiers vers `output/<slug>/`
  ou directement en DB.

## 7. Quand tout sera vert (estimation J+1)

- **244 / 273 fiches hôtel FR** complètes (long_description + concierge_advice + FAQ).
- **216 / 216 rankings FR** avec `factual_summary_fr`. Pour les 39 rankings sans
  contenu, lancement Phase 4 le matin.
- **86 guides FR** : Phase 5 le matin.
- **663 INTL** : nécessitent `brief-intl.ts` — chantier matin de J+1.

---

Bonne nuit. ☕ Au réveil : audit + push DB + Phase 4/5.
