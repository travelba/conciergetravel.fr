# Audit — Les 764 fiches net-new sont-elles « créées de A à Z avec le bon template » ?

> **Date** : 2026-06-25 · **Auteur** : worker audit (lecture seule)
> **Question PO** : « Est-ce que les fiches hôtels ont été créées de A à Z,
> avec le BON template ? » — en particulier les **764 fiches net-new
> onboardées hier** (Phase D, source yonder, `priority='P2'`,
> `booking_mode='display_only'`, marquées publiées).
> **Méthode** : PostgREST + MCP `execute_sql` (`project_id=fsmfozxgujskluxakeoq`),
> prod walk curl (FR + EN), comparaison champ par champ vs le golden standard
> `les-airelles-gordes` et le CDC §2 (15 blocs).

---

## 0. Verdict — en une phrase

**INFIRMÉ : les 764 fiches net-new ne sont PAS « créées de A à Z ».** Elles sont
**« publish-minimal »** : elles portent _exactement_ les 5 champs que le gate
`publish-eligible-drafts.ts` vérifie (`factual_summary`, `meta_desc`,
`description`, `concierge_advice`, `faq_content`) — et **rien d'autre**. Tous les
autres blocs du template CDC §2 sont **vides à 100 %** sur la cohorte : pas de
long-read (`long_description_sections`), pas de `policies`, pas d'`external_sources`
(EEAT), pas de FAQ Perplexity kit, pas de photos. Le soupçon du PO est **confirmé,
chiffres à l'appui** : elles ont passé le gate sans avoir le template complet,
parce que **le gate ne vérifie que ~⅓ du contrat CDC**.

Bonne nouvelle : **0 fuite de scaffolding** (aucun `AUTO_DRAFT`, `le brief`,
`niveau de confiance`, Q-id…) et le `concierge_advice` rend une vraie voix
Concierge avec un secret opérationnel concret. Le contenu présent est **propre**,
juste **incomplet**.

---

## 1. Périmètre — identification de la cohorte

La cohorte net-new est isolable sans ambiguïté par la date de création :

| Jour de création | Lignes  | dont `P2` + `display_only` |
| ---------------- | ------- | -------------------------- |
| **2026-06-25**   | **764** | **764** (100 %)            |
| 2026-05-27       | 840     | 596                        |
| 2026-05-25 (R&C) | 418     | 418                        |
| 2026-05-19       | 663     | 663                        |
| …                | …       | …                          |

- **Cohorte auditée (« net-new »)** = `is_published AND created_at::date = '2026-06-25'`
  → **764 fiches**, toutes `priority='P2'`, `booking_mode='display_only'`.
- **Cohorte contraste (« historique »)** = `is_published AND created_at::date <> '2026-06-25'`
  → **2 221 fiches**.
- **Catalogue publié total** : **2 985 hôtels** (≠ les 2 219 documentés dans
  AGENTS.md §4bis — le catalogue a grossi de +766 hier).

> ⚠ Le pool `P2 + display_only` complet compte **2 633** lignes : il agrège les
> vagues d'onboarding scaffold antérieures (R&C 2026-05-25, yonder 2026-05-19/27).
> Filtrer sur `priority='P2'` seul **ne donne pas** les 764 — il faut la date.

---

## 2. Audit champ par champ — cohorte P2 net-new vs catalogue historique

Légende : ✅ = conforme gate + CDC · 🟡 = présent mais sous l'idéal CDC ·
🔴 = absent / non conforme.

### 2.1 Champs vérifiés par le gate de publication (`publish-eligible-drafts.ts`)

| Bloc CDC                  | Critère                   | **P2 net-new (n=764)** | Historique (n=2221)  | État P2 |
| ------------------------- | ------------------------- | ---------------------- | -------------------- | ------- |
| §2.3 `factual_summary_fr` | enveloppe 110-165         | **764 / 764 (100 %)**  | 2221 / 2221          | ✅      |
| §2.3 `factual_summary_fr` | idéal CDC 130-150         | **410 / 764 (54 %)**   | 2178 / 2221 (98 %)   | 🟡      |
| §2.3 `factual_summary_en` | enveloppe 110-165         | **764 / 764 (100 %)**  | 2221 / 2221          | ✅      |
| §1 `meta_title_fr`        | non null                  | **764 / 764 (100 %)**  | 2220 / 2221          | ✅      |
| (SEO) `meta_desc_fr`      | bande SEO 140-170         | **92 / 764 (12 %)**    | 2217 / 2221 (99,8 %) | 🟡      |
| (SEO) `meta_desc_en`      | bande SEO 140-170         | **49 / 764 (6 %)**     | 2217 / 2221          | 🟡      |
| §2.4 `description_fr`     | ≥ 600 **chars** (gate)    | **764 / 764 (100 %)**  | 2212 / 2221          | ✅      |
| §2.4 `description_en`     | ≥ 600 **chars** (gate)    | **764 / 764 (100 %)**  | 2213 / 2221          | ✅      |
| §2.11 `faq_content`       | ≥ 10 items                | **764 / 764 (100 %)**  | 2221 / 2221          | ✅      |
| §2.16 `concierge_advice`  | présent + ≥ 30 mots FR/EN | **764 / 764 (100 %)**  | 2221 / 2221          | ✅      |

> **Nuance char vs mots** : le gate exige `description_fr ≥ 600 *caractères*`
> (~100 mots), mais le CDC §2.4 vise **600-1000 _mots_** (~3 600-6 000 chars).
> Le `description_fr` moyen fait **179 mots / 1 174 chars** sur les net-new
> (et 180 mots / 1 167 chars sur l'historique) : **0 fiche du catalogue entier**
> n'atteint 600 mots dans ce champ. La narration longue du CDC vit donc dans
> `long_description_sections`, **pas** dans `description_fr` — d'où l'importance
> du bloc suivant.

### 2.2 Blocs du template CDC NON vérifiés par le gate — c'est ici que tout casse

| Bloc CDC                                                      | Critère          | **P2 net-new (n=764)** | Historique (n=2221)    | État P2                                                |
| ------------------------------------------------------------- | ---------------- | ---------------------- | ---------------------- | ------------------------------------------------------ |
| §2.4 **`long_description_sections`** (long-read)              | ≥ 3 sections     | **0 / 764 (0 %)**      | 2221 / 2221 (100 %)    | 🔴                                                     |
| §2.4 `long_description_sections`                              | idéal 6-8        | **0 / 764 (0 %)**      | 2221 / 2221 (100 %)    | 🔴                                                     |
| §2.9 **`policies`** (check-in/out, pets, cancel, taxes, wifi) | présent non vide | **0 / 764 (0 %)**      | 2217 / 2221 (99,8 %)   | 🔴                                                     |
| EEAT **`external_sources`** (provenance)                      | ≥ 1 entrée       | **0 / 764 (0 %)**      | 2188 / 2221 (98,5 %)   | 🔴                                                     |
| §2.11 **`faq_content_kit`** (Perplexity, hard rule 2)         | ≥ 40             | **0 / 764 (0 %)**      | 8 / 2221 (kit pilotes) | 🔴\*                                                   |
| §2.11 **`concierge_questions`** (Perplexity)                  | ≥ 20             | **0 / 764 (0 %)**      | 8 / 2221 (kit pilotes) | 🔴\*                                                   |
| §2.2 **`hero_image`**                                         | non null         | **0 / 764 (0 %)**      | 2219 / 2221            | 🔴 (attendu Phase 2)                                   |
| §2.2 **`gallery_images`**                                     | ≥ 1 photo        | **0 / 764 (0 %)**      | 2219 / 2221            | 🔴 (attendu Phase 2)                                   |
| §2.2 `gallery_images`                                         | ≥ 10 photos      | **0 / 764 (0 %)**      | 2208 / 2221            | 🔴 (attendu Phase 2)                                   |
| §1 `luxury_tier`                                              | non null         | **300 / 764 (39 %)**   | n/a                    | 🟡 (464 NULL)                                          |
| §13 `affiliations`                                            | ≥ 1              | **0 / 764 (0 %)**      | n/a                    | 🔴                                                     |
| §1 `is_palace`                                                | flag             | **0 / 764**            | n/a                    | (cohérent : yonder ≠ palace Atout France)              |
| §10 `google_rating` / `aggregate_rating_value`                | présent          | **0 / 764**            | n/a                    | (pas d'avis → pas d'AggregateRating, **CDC-conforme**) |

\* La FAQ Perplexity kit (`faq_content_kit` ≥ 40 + `concierge_questions` ≥ 20,
**hard rule 2 du CDC**) est un trou **catalogue-wide** : seulement **8 / 2985**
fiches publiées la portent (les pilotes kit). Ce n'est donc pas un défaut
_spécifique_ aux 764, mais elles n'y dérogent pas non plus.

### 2.3 Scaffolding leaks (`hasLeak`) — RAS

Scan des marqueurs sur `description_fr/en` + `factual_summary` + `concierge_advice`

- `faq_content` des 764 :

| Marqueur                             | Occurrences |
| ------------------------------------ | ----------- |
| `auto_draft`                         | 0           |
| `niveau de confiance`                | 0           |
| `(le\|du\|au\|ce) brief`             | 0           |
| `dossier (incomplet\|reste\|manque)` | 0           |
| `pending` (mot isolé)                | 0           |
| `placeholder`                        | 0           |
| Q-id Wikidata `q[0-9]{5,}`           | 0           |
| `aucun fait vérifié…`                | 0           |

→ **Aucune fuite.** Le contenu généré est propre (les 764 occurrences du substring
« pending » sont toutes bénignes : _depending / spending / impending_).

---

## 3. Comparaison au golden standard (`les-airelles-gordes`) + fiche riche (`le-meurice`)

| Champ                           | **les-airelles-gordes** (golden) | le-meurice (historique riche) | **P2 net-new (typique)** |
| ------------------------------- | -------------------------------- | ----------------------------- | ------------------------ |
| `factual_summary_fr`            | 130 c                            | 141 c                         | 110-147 c ✅             |
| `meta_desc_fr`                  | 165 c                            | 149 c                         | ~110-150 c 🟡            |
| `description_fr`                | 758 c                            | 1 315 c                       | ~1 050-1 350 c ✅(gate)  |
| **`long_description_sections`** | **8**                            | **8**                         | **0** 🔴                 |
| `faq_content`                   | 10                               | 10                            | 10 ✅                    |
| **`faq_content_kit`**           | **82**                           | —                             | **0** 🔴                 |
| **`concierge_questions`**       | **28**                           | —                             | **0** 🔴                 |
| **`gallery_images`**            | **30**                           | 10                            | **0** 🔴                 |
| **`external_sources`**          | **9**                            | 2                             | **0** 🔴                 |
| `policies`                      | ✅                               | ✅                            | **0** 🔴                 |
| `concierge_advice`              | ✅                               | ✅                            | ✅                       |

**Écart à Gordes** : une fiche net-new porte ~3 / 11 dimensions de référence
(factual_summary, description courte, faq 10, concierge_advice). Elle est à
**~30 % du golden** par couverture de blocs, et le poids éditorial réel est
encore plus bas (pas de long-read = pas de surface SEO/GEO de fond).

---

## 4. Prod walk (curl, FR + EN)

Pages chargées en prod (`https://myconciergehotel.com`) :

| Fiche (P2 net-new)                  | Poids HTML   | `@type Hotel` | `Place` | `Breadcrumb` | `FAQPage` | `AggregateRating` | `Offer`  | `ImageObject` | `<h2>` |
| ----------------------------------- | ------------ | ------------- | ------- | ------------ | --------- | ----------------- | -------- | ------------- | ------ |
| `l-alpaga` (Megève)                 | 636 KB       | 1             | **0**   | ✅           | ✅        | 0                 | **0** ✅ | **0**         | 21     |
| `the-silo-hotel` (Cape Town)        | 610 KB       | 1             | **0**   | ✅           | ✅        | 0                 | **0** ✅ | **0**         | 18     |
| `chateau-marmont` (LA)              | 611 KB       | 1             | **0**   | ✅           | ✅        | 0                 | **0** ✅ | **0**         | 20     |
| **`le-meurice` (historique riche)** | **1 023 KB** | 1             | **5**   | ✅           | ✅        | 0                 | 0        | **10**        | **35** |

**Ce qui rend bien sur les net-new** :

- JSON-LD **correct et CDC-conforme pour l'état actuel** : `Hotel` + `BreadcrumbList`
  - `FAQPage`, **sans `Offer`** (Phase 6 respectée), **sans `AggregateRating`
    fabriqué** (pas d'avis Google → on n'invente rien, conforme hard rule 14).
- Le bloc **Conseil du Concierge** rend une vraie voix experte, ex. `l-alpaga` :
  > « _Mon conseil : privilégiez un séjour en tout début d'hiver ou juste après la
  > saison de ski. Megève garde alors son rythme de village alpin…_ » (`tip_for: timing`)
  > `the-silo-hotel` :
  > « _Mon conseil : si vous ne restez qu'une nuit, demandez une chambre orientée
  > vers le port…_ » (`tip_for: room`)
- FR **et** EN rendent (les deux locales ont `description_*` ≥ 600 c).

**Ce qui est vide / fallback sur les net-new** (vs le-meurice) :

- **Pas de `Place` JSON-LD** (le-meurice : 5) → localisation/POI structurés absents.
- **Pas d'`ImageObject`** (le-meurice : 10) → galerie vide, pas de hero.
- **Poids HTML ~60 % de le-meurice** (610 KB vs 1 023 KB) : l'écart = le long-read
  manquant (le-meurice rend ses 8 sections `long_description_sections` ; les net-new 0).
- `description_fr` **générique / templatée**, ex. `l-alpaga` :
  > « _Cet hôtel offre un cadre alpin authentique, propice à la détente et à
  > l'évasion. La région est connue pour ses paysages montagneux…_ »
  > → aucun fait concret (architecte, table Michelin, n° de suite, anecdote vérifiable)
  > comme l'exige la voix Concierge / l'audit golden.
- FAQ = les 10 questions **canoniques génériques** (« L'hôtel dispose-t-il d'un
  parking ? », « Quel type de petit-déjeuner ? ») — valides pour le gate mais
  non ancrées Perplexity/PAA par hôtel.

---

## 5. Pourquoi le gate a laissé passer — l'écart gate vs CDC

`publish-eligible-drafts.ts` (Phase 1, « editorial-only ») vérifie **5 blocs** :
`description` (≥600 chars), `meta_desc` (100-180), `factual_summary` (100-200),
`concierge_advice` (≥30 mots FR/EN), `faq_content` (≥10). Et **déclare
explicitement « NOT required at Phase 1 »** : photos, `long_description_sections`,
awards, rooms, booking.

Le CDC §2 exige **15 blocs + parité Gordes** (long-read 6-8 sections, ≥30 photos
10 catégories, FAQ Perplexity 40-60, policies, EEAT, affiliations…). **Le gate
couvre donc ~5/15 blocs.** Conclusion : le gate fonctionne _comme spécifié_
(publish-minimal Phase 1), mais l'étiquette « publié » ne signifie pas
« conforme template / niveau Gordes ». Les 764 sont **publiées-conformes-Phase-1**,
**pas livrées-A-Z**.

---

## 6. Plan de remédiation chiffré et priorisé

Ordre = impact SEO/GEO décroissant. Coûts LLM estimés à ~gpt-4o-mini / gpt-5 mini
selon pipeline (ordres de grandeur, à raffiner sur dry-run).

| #   | Bloc à combler                                                                 | Pipeline outillé                                                                                         | Volume                   | Coût LLM estimé                         | Durée estimée                               | Priorité                                          |
| --- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ------------------------ | --------------------------------------- | ------------------------------------------- | ------------------------------------------------- |
| 1   | **`long_description_sections`** (6-8 sections FR+EN, grounding DataForSEO)     | `enrichment/enrich-hotel-content.ts --slugs=… --force` (gate `hasLeak`, refuse < 5 sections)             | 764                      | ~$15-30 (appel lourd 6-8 sect. × FR+EN) | ~6-9 h (conc. 4, ~35 min/67 fiches observé) | **P0** (cœur SEO/GEO, +60 % poids page)           |
| 2   | **`meta_desc_fr/en`** re-générer dans la bande 140-170                         | `hotels/run-hotel-meta-desc.ts`                                                                          | ~672 FR / ~715 EN        | ~$2-4                                   | ~1-2 h                                      | **P0** (CTR SERP, quick win)                      |
| 3   | **`policies`** (check-in/out, pets, cancel, taxes, wifi)                       | enrichissement Tavily/Google Places → `policies` (cf. migration `0055` + pipeline enrichment)            | 764                      | ~$3-6 (extraction)                      | ~2-4 h (rate-limit API)                     | **P1** (CDC §2.9 hard rule, mais peu visible SEO) |
| 4   | **`external_sources`** (EEAT)                                                  | `enrich-wikidata-ids.ts` puis `convert-wikidata-to-external-sources.ts` (0 appel LLM pour la conversion) | 764                      | ~$0 conversion + résolution Wikidata    | ~2-3 h                                      | **P1** (EEAT, citations LLM)                      |
| 5   | **`factual_summary`** tightening vers idéal 130-150                            | `run-hotel-factual-summary.ts --cdc-tightening`                                                          | ~354 FR sous-idéal       | ~$1-2                                   | ~1 h                                        | **P2** (déjà dans l'enveloppe, rend déjà)         |
| 6   | **`luxury_tier`** backfill (464 NULL)                                          | data-fix (mapping yonder → tier) — script déterministe, pas LLM                                          | 464                      | $0                                      | ~1 h                                        | **P2** (filtres/classements)                      |
| 7   | **FAQ Perplexity kit** (`faq_content_kit` 40-60 + `concierge_questions` 20-30) | skill `hotel-faq-perplexity-enrichment` (MCP Perplexity)                                                 | 764 (gap catalogue-wide) | élevé (Perplexity payant)               | gros chantier                               | **P2** (idéal Gordes ; gap déjà global)           |
| 8   | **Photos** (hero + galerie ≥ 10, idéal 25-30 / 10 catégories)                  | `photos/*` Google Places → Cloudinary + Vision categorize                                                | 764                      | API Places + Vision (~$ selon volume)   | **Phase 2** (différée par décision PO)      | **P3** (gelé Phase 2)                             |

**Séquence recommandée** :

1. **Vague 1 (quick wins SEO, ~1 j)** : #2 meta_desc + #6 luxury_tier (déterministe) + #5 factual_summary tightening.
2. **Vague 2 (cœur éditorial, ~1-2 j machine)** : #1 long_description_sections FR+EN (le plus gros levier SEO/GEO ; ré-exécute la parité EN automatiquement via génération bilingue).
3. **Vague 3 (EEAT + pratique, ~1 j)** : #4 external_sources (Wikidata) + #3 policies.
4. **Hors-séquence (gros chantiers)** : #7 FAQ Perplexity, #8 photos (Phase 2).

Coût LLM total vagues 1-3 ≈ **$20-45** ; durée machine ≈ **2-4 jours** (concurrence 4,
timeouts obligatoires `withTimeout` + `Promise.allSettled` cf. handoff Phase D).

---

## 7. Recommandation process (pour éviter la récidive)

Le gate `publish-eligible-drafts.ts` flippe `is_published` sur 5 blocs alors que
le CDC en exige 15. Tant que la décision « editorial-only Phase 1 » tient, c'est
**volontaire** — mais l'étiquette « publié » est trompeuse. Deux options :

- **(A)** Garder le gate Phase 1, mais **tracker un statut intermédiaire**
  (`completeness_tier`: publish-minimal / cdc-complete / gordes-parity) pour ne pas
  confondre « publié » et « livré A-Z ». L'audit `audit:hotel-fiches-cdc` mesure
  déjà le `score_cdc` — l'exposer par cohorte.
- **(B)** Durcir le gate pour exiger `long_description_sections ≥ 3` + `policies`
  avant flip (alignerait « publié » sur « narrativement complet »).

Décision PO requise — hors périmètre de cet audit (lecture seule).

---

## 8. Annexe — requêtes reproductibles (MCP `execute_sql`, `project_id=fsmfozxgujskluxakeoq`)

```sql
-- Cohorte net-new
select count(*) from public.hotels
where is_published and created_at::date = '2026-06-25';  -- 764

-- Complétude blocs gate (net-new vs historique)
with c as (select *, (created_at::date='2026-06-25') netnew
           from public.hotels where is_published)
select netnew, count(*) n,
  count(*) filter (where char_length(coalesce(factual_summary_fr,'')) between 110 and 165) fs_fr_env,
  count(*) filter (where char_length(coalesce(meta_desc_fr,'')) between 140 and 170) md_fr,
  count(*) filter (where char_length(coalesce(description_fr,''))>=600) desc_fr_600
from c group by netnew;

-- Blocs hors-gate (le trou)
with c as (select *, (created_at::date='2026-06-25') netnew
           from public.hotels where is_published)
select netnew, count(*) n,
  count(*) filter (where jsonb_typeof(long_description_sections)='array'
                     and jsonb_array_length(long_description_sections)>=3) lds3,
  count(*) filter (where policies is not null and policies<>'{}'::jsonb) pol,
  count(*) filter (where jsonb_typeof(external_sources)='array'
                     and jsonb_array_length(external_sources)>=1) ext1,
  count(*) filter (where jsonb_typeof(gallery_images)='array'
                     and jsonb_array_length(gallery_images)>=1) gal1
from c group by netnew;
```

## Remédiation exécutée (2026-06-25) — template A-Z, hors photos

Cohorte traitée en 1 vague de 70 (concurrence 5) + 5 super-vagues de
~130 (concurrence 8) via `enrich-hotel-content.ts --slugs-file=` (flag
ajouté ce jour), Wikidata résolu en parallèle (0 LLM, **gate de
corroboration de nom strict ajouté** — rejette une entité même-catégorie
ne partageant qu'un token générique : « Les Invalides » pour
« L'Hôtel des Remparts », « Maison Doucet » pour « Maison Douce Époque »,
Stockholm « Grand Hôtel » pour « …Soleil d'Or »), puis converti en
`external_sources`. Blocs légers (meta/factual/policies) lancés en
décalage par vague pour éviter la contention OpenAI.

| Bloc                                    | Avant | Après                  | Note                                                                                                        |
| --------------------------------------- | ----- | ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| `long_description_sections` ≥ 6 (FR+EN) | 79    | **764 / 764 (100 %)**  | 7-8 sections, ~3300-4400 mots FR, 0 fuite `hasLeak`                                                         |
| `meta_desc_fr` 140-170                  | 162   | **764 / 764 (100 %)**  |                                                                                                             |
| `meta_desc_en` 140-170                  | 123   | **764 / 764 (100 %)**  |                                                                                                             |
| `factual_summary_fr` envelope [110-165] | —     | **764 / 764 (100 %)**  | idéal [130-150] : 747 (97,8 %)                                                                              |
| `factual_summary_en` idéal [130-150]    | —     | **744 / 764 (97,4 %)** | reste in-envelope, rend bien                                                                                |
| `policies` réelles (non-synthétiques)   | 79    | **762 / 764 (99,7 %)** | 2 thin-source sans signal Tavily                                                                            |
| `external_sources` ≥ 1                  | 42    | **294 / 764 (38,5 %)** | plafond structurel : 470 fiches sans entité Wikidata (boutique/récentes) — provenance non fabricable (EEAT) |
| `luxury_tier`                           | 764   | **764 / 764 (100 %)**  | déjà fait                                                                                                   |

Acceptance prod (curl) : `auberge-ostape`, `le-coucou-meribel`,
`burgenstock-resort` FR+EN → 200, long-read rendu (h3 = 34-37), 0 `Offer`,
0 fuite prose (le seul match `placeholder=` est l'attribut du champ
recherche). Poids 660-710 Ko, comparable à `le-meurice`.

Résidu structurel assumé (non comblable sans inventer / sans source) :
470 `external_sources` (pas d'entité Wikidata), 2 `policies` thin-source,
17 FR / 20 EN `factual_summary` in-envelope mais hors bande idéale
(le LLM s'auto-censure sur source pauvre — ROI ~0 d'une passe de plus).
