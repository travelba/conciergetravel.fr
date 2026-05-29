# Audit CDC exhaustif fiches hôtels — 2026-05-29

Périmètre : **2219 fiches** (`2218` publiées, `1` brouillon). Couvre **100 % du CDC v3.0 §2** (16 blocs), plus SEO, GEO/AEO, FAQ, maillage EEAT, prérequis JSON-LD, surfaces agentiques et photos (Phase 1 + cible CDC).

Artefacts :

- JSON : `scripts/editorial-pilot/runs/hotel-fiche-cdc-audit-2026-05-29.json`
- CSV backlog : `scripts/editorial-pilot/runs/hotel-fiche-cdc-backlog-2026-05-29.csv`
- Synthèse : `scripts/editorial-pilot/runs/hotel-fiche-cdc-summary-2026-05-29.txt`

Commande :

```bash
pnpm --filter @mch/editorial-pilot audit:hotel-fiches-cdc
pnpm --filter @mch/editorial-pilot audit:hotel-fiches-cdc:published
pnpm --filter @mch/editorial-pilot audit:hotel-fiches-cdc -- --slug=rosewood-hong-kong
```

Implémentation : `scripts/editorial-pilot/src/hotels/hotel-fiche-cdc-gates.ts` + `audit-hotel-fiche-cdc.ts`.

---

## TL;DR

| Indicateur                                         | Valeur          |
| -------------------------------------------------- | --------------- |
| Fiches **CDC complete** (score_cdc ≥ 95 %)         | **0**           |
| Fiches **CDC partial** (70–94 %)                   | **0**           |
| Fiches **CDC gap** (< 70 %)                        | **2218**        |
| Score **global moyen** (8 dimensions, publiées)    | **48 %**        |
| Score **CDC cible** moyen                          | **36 %**        |
| Score **Phase 1** moyen (atteignable sans Phase 6) | **44 %**        |
| Indexables (T1)                                    | **2219 / 2219** |

Le mass-publish Phase 1 garantit l’**indexabilité éditoriale**, mais **aucune fiche** n’atteint la conformité CDC cible. L’écart principal : photos (30 + 10 catégories), chambres (`hotel_rooms`), équipements (≥ 80), FAQ featured/tips, policies réelles, maillage EEAT.

**Bloc 8 (Amadeus / Offer JSON-LD)** : Phase 6 gelée (`AGENTS.md §4ter`) — exclue des scores.

---

## Dimensions auditées

| Dimension                 | Score moyen (publiées) | Critères clés                                                 |
| ------------------------- | ---------------------: | ------------------------------------------------------------- |
| **CDC cible**             |                   36 % | 16 blocs §2, hard rules Payload                               |
| **CDC Phase 1**           |                   44 % | Seuils photo 10 + catégories 10/10, texte minimal             |
| **SEO**                   |                   65 % | meta title/desc, indexabilité, publish gate, hreflang meta    |
| **GEO / AEO**             |                   67 % | factual format, FAQ densité 50–100 mots, Conseil du Concierge |
| **FAQ**                   |                   50 % | 10–15 Q, 10 canoniques, 5 featured                            |
| **Maillage / EEAT**       |                   34 % | official_url, Wikidata, Wikipedia, sameAs, guide ville        |
| **Photos**                |                   43 % | hero, galerie, alt enrichi, catégories, hotlinks              |
| **JSON-LD prereqs**       |                   57 % | FAQPage, ImageObject, Place, AggregateRating                  |
| **Agentique**             |                   43 % | hero + galerie + factual pour MCP / llms corpus               |
| **T3 éditorial** (hérité) |                   48 % | Palier excellence texte sans photos                           |

---

## Blocs CDC §2 — taux d’échec (publiées)

| Bloc  | Libellé                | Fiches en échec |
| ----- | ---------------------- | --------------: |
| 01    | En-tête identité       |            2219 |
| 02    | Galerie média          |            2219 |
| 05    | Chambres / sous-pages  |            2219 |
| 06    | Équipements & services |            2219 |
| 07    | Localisation & accès   |            2219 |
| 09    | Politiques             |            2219 |
| 10    | Avis clients           |            2219 |
| 11    | FAQ structurée         |            2219 |
| 14    | MICE / groupes         |            2219 |
| 04    | Description longue     |            2218 |
| 15    | Footer NAP             |            2218 |
| 12    | Guide local (teaser)   |            1852 |
| SEO   | Meta + indexabilité    |            1638 |
| Agent | Surfaces MCP           |            1892 |
| 03    | Résumé factuel         |             993 |
| 13    | Réassurance            |             394 |
| 16    | Conseil du Concierge   |              28 |

---

## Top gaps catalogue (priorisation chantier)

| P   | Gap                                                         |     Fiches | Pipeline                                    |
| --- | ----------------------------------------------------------- | ---------: | ------------------------------------------- |
| P0  | `amenities` (< 80 attrs CDC ; vide = placeholder UI)        |      ~2219 | enrichment amenities + taxonomy             |
| P0  | `gallery_images` (< 30 CDC ; catégories 10/10)              |      ~2219 | `photos:sync` + `categorize-with-vision.ts` |
| P0  | `policies` (synthétiques `_synthetic: true`)                |      ~2219 | Google Places / Tavily                      |
| P0  | `hotel_rooms` (0 ligne → « Room catalog coming soon »)      |       2219 | seed chambres + ADR-0009                    |
| P1  | `long_description_sections` (< 3 sections / < 600 mots)     |      ~1585 | pipeline 8-pass                             |
| P1  | `hero_image` absent                                         |      ~1892 | photos Phase 2                              |
| P1  | FAQ **featured** (5) + **tips Concierge**                   |       2219 | `run-humanizer-faq.ts`                      |
| P1  | FAQ réponses hors bande 50–100 mots                         |       2219 | `run-faq-canonical.ts`                      |
| P2  | `transports`, `google_rating`, `hero_video`, `virtual_tour` |       2219 | enrichment / Phase 2 média                  |
| P2  | `official_url` / `wikidata_id` / guide ville                |  1591–1852 | Wikidata + guides éditoriaux                |
| P2  | `meta_desc` FR/EN hors 140–170                              | ~1340–1405 | `run-hotel-meta-desc.ts`                    |
| P3  | Préfixe « Mon conseil : » / « My tip: »                     |        ~28 | `run-hotel-concierge-advice.ts`             |

---

## Exemple : Rosewood Hong Kong

Fiche publiée, indexable T1, mais **score_cdc ~36 %** :

- Placeholders live : highlights, amenities, room catalog
- 13 photos, 1 seule catégorie (`room`) — échec 10 catégories
- 0 `hotel_rooms`, policies synthétiques
- FAQ 10 canoniques mais sans featured/tips/densité GEO

Commande diagnostic :

```bash
pnpm --filter @mch/editorial-pilot audit:hotel-fiches-cdc -- --slug=rosewood-hong-kong
```

---

## Backlog production recommandé (ordre ROI)

1. **FAQ canonique complète** — featured + tips + 50–100 mots (impact FAQPage + GEO immédiat).
2. **Policies réelles** — remplacer NULL / `_synthetic`.
3. **Long-form** — sections ≥ 3, 600–1000 mots.
4. **Meta descriptions** FR/EN bande SEO.
5. **POI + transports + GPS** — bloc 7 + Place JSON-LD.
6. **Photos Phase 1** — hero + 10 photos + 10 catégories + alt enrichi.
7. **Catalogue chambres** — `hotel_rooms` + sous-pages indexables ADR-0009.
8. **Amenities** — montée progressive vers 80 attributs.
9. **Maillage EEAT** — Wikidata, official_url, guides ville publiés.
10. **Média CDC cible** — 30 photos, vidéo, 360° (Phase 2).
11. **Phase 6** — booking Amadeus + Offer JSON-LD (dernier brick).

---

## Relation avec l’audit T3

| Audit             | Commande                 | Focus                                                      |
| ----------------- | ------------------------ | ---------------------------------------------------------- |
| T3 éditorial      | `audit:hotel-fiches`     | Texte SEO/GEO sans photos                                  |
| **CDC exhaustif** | `audit:hotel-fiches-cdc` | 16 blocs + SEO + GEO + agent + maillage + JSON-LD + photos |

Les deux audits partagent `hotel-fiche-gates.ts` pour T0/T1/T3 ; le CDC ajoute ~70 contrôles supplémentaires dans `hotel-fiche-cdc-gates.ts`.
