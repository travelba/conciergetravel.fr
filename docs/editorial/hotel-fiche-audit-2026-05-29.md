# Audit éditorial fiches hôtels — 2026-05-29

Périmètre : **2219 fiches** (`2192` publiées, `27` brouillons). Photos et vidéos **exclues**. Cible : excellence SEO / GEO / agentique (palier **T3** — voir `scripts/editorial-pilot/src/hotels/hotel-fiche-gates.ts`).

Artefacts générés :

- JSON détaillé : `scripts/editorial-pilot/runs/hotel-fiche-audit-2026-05-29.json`
- Backlog CSV : `scripts/editorial-pilot/runs/hotel-fiche-backlog-2026-05-29.csv`
- Synthèse console : `scripts/editorial-pilot/runs/hotel-fiche-audit-summary-2026-05-29.txt`

Commande pour rejouer l'audit :

```bash
pnpm --filter @mch/editorial-pilot audit:hotel-fiches
```

---

## TL;DR

| Indicateur                      | Valeur   |
| ------------------------------- | -------- |
| Fiches **complete** T3 (≥ 95 %) | **0**    |
| Fiches **partial** (70–94 %)    | **91**   |
| Fiches **gap** (< 70 %)         | **2101** |
| Brouillons vides                | **27**   |
| Indexables (editorial ou photo) | **2193** |
| Non indexables                  | **26**   |

Le mass-publish Phase 1 a rendu le catalogue **publiable et indexable** sur le texte minimal FR, mais **aucune fiche** ne atteint encore le palier T3 « excellence éditoriale ». Le chantier est massif et structuré par blocs.

---

## Paliers de complétude

| Palier | Définition                                                                                                      | État catalogue                 |
| ------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **T0** | `publish-eligible-drafts.ts` (description FR/EN ≥ 600 car., FAQ ≥ 10, etc.)                                     | ~99 % des publiées passent     |
| **T1** | `indexability.ts` (editorial FR ou photo-rich)                                                                  | 2193 / 2219 indexables         |
| **T2** | Enveloppes générateurs (meta_desc 140–170, factual 110–165, advice 50–110 mots)                                 | Partiel — voir gaps ci-dessous |
| **T3** | CDC texte complet sans photos (long-form ≥ 3 sections + 600 mots, FAQ canoniques, policies réelles, blocs GEO…) | **0 complete**, 91 partial     |

---

## Top gaps (fiches concernées / 2219)

| Priorité | Champ / bloc                                                         | Fiches    | Pipeline de remédiation                 |
| -------- | -------------------------------------------------------------------- | --------- | --------------------------------------- |
| P1       | FAQ 5 `featured` + tips Concierge                                    | 2219      | `run-humanizer-faq.ts`                  |
| P1       | FAQ réponses 50–100 mots                                             | 2219      | `run-faq-canonical.ts`                  |
| P1       | `policies` (null ou synthétiques)                                    | 2219      | Tavily / Google Places + migration 0055 |
| P1       | FAQ 10 questions **canoniques** CDC                                  | 2219      | `run-faq-canonical.ts`                  |
| P1       | `long_description_sections` (< 3 ou < 600 mots)                      | 1585      | pipeline 8-pass / extend long-form      |
| P1       | `meta_desc_en` hors bande 140–170                                    | 1405      | `run-hotel-meta-desc.ts`                |
| P1       | `meta_desc_fr` hors bande 140–170                                    | 1340      | `run-hotel-meta-desc.ts`                |
| P2       | `official_url` / `wikidata_id`                                       | 1591      | `enrich-wikidata-ids.ts`                |
| P2       | `points_of_interest` (< 3)                                           | 1978      | `pois:sync`                             |
| P2       | `highlights` (< 3)                                                   | 2130      | enrichment éditorial                    |
| P2       | `transports`                                                         | 2219      | enrichment pipeline                     |
| P2       | `description_en` (< 600 car.)                                        | 203       | `run-hotel-description-extend.ts`       |
| P2       | `concierge_advice` hors 50–110 mots (runtime)                        | 28        | `run-hotel-concierge-advice.ts`         |
| P3       | `amenities`, `signature_experiences`, `number_of_rooms`, `opened_at` | 2113–2219 | enrichment / Wikidata                   |

---

## Backlog production recommandé

Ordre d'exécution pour maximiser SEO/GEO/agentique par euro LLM :

1. **27 brouillons quasi vides** — seed Tavily → pipelines T0 → publish.
2. **FAQ canonique + featured + tips** — `run-faq-canonical.ts` puis `run-humanizer-faq.ts` sur les 2192 publiées (impact JSON-LD + TopConciergeFaq + GEO).
3. **Meta descriptions FR/EN** — `run-hotel-meta-desc.ts` (~1340 FR + ~1405 EN).
4. **Long-form** — `long_description_sections` ≥ 3 et ≥ 600 mots (~1585 fiches).
5. **Parité EN** — descriptions + factual + advice EN (~203 description_en).
6. **Policies réelles** — remplacer NULL et `_synthetic: true`.
7. **Blocs GEO** — POI, transports, highlights, affiliations vérifiées.
8. **Chambres** — table `hotel_rooms` vide (hors scope texte ; ADR-0009).

---

## Fiches les plus proches du complet (partial, top 5)

| Slug                                     | Score T3 |
| ---------------------------------------- | -------- |
| `grand-hotel-cap-ferrat`                 | 78 %     |
| `hotel-de-crillon-a-rosewood-hotel`      | 78 %     |
| `mandarin-oriental-paris`                | 78 %     |
| `5-terres-hotel-spa-mgallery-by-sofitel` | 77 %     |
| `auberge-des-templiers`                  | 77 %     |

Ces 91 fiches « partial » sont les candidates prioritaires pour passer le seuil 95 % en combinant FAQ canonique + policies + blocs GEO manquants.

---

## Répartition par `luxury_tier` (statut gap)

| Tier                  | Gap / total |
| --------------------- | ----------- |
| `relais_chateaux`     | 434 / 435   |
| `(null)`              | 162 / 238   |
| `self_5_star`         | 220 / 220   |
| `small_luxury_hotels` | 217 / 217   |
| `world_50_best`       | 127 / 127   |

Tous les tiers mass-publish sont homogènement en **gap** T3 : le publish flip n'a pas discriminant par marque.

---

## Références

- Gates : [`scripts/editorial-pilot/src/hotels/hotel-fiche-gates.ts`](../../scripts/editorial-pilot/src/hotels/hotel-fiche-gates.ts)
- CLI : [`scripts/editorial-pilot/src/hotels/audit-hotel-fiche.ts`](../../scripts/editorial-pilot/src/hotels/audit-hotel-fiche.ts)
- Canvas exécutif : `.cursor/projects/.../canvases/hotel-fiche-audit-2026-05-29.canvas.tsx`
