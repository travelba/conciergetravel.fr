# Plan d'enrichissement profond des fiches hôtels — anti-scaffolding

- **Statut** : VALIDÉ (décisions D-1→D-6 tranchées le 2026-06-04, cf. §9). Exécution : pilote en attente de GO final.
- **Date** : 2026-06-04
- **Owner** : Éditorial / Agent (délégation PO).
- **Surface** : `scripts/editorial-pilot/src/enrichment/**`, `public.hotels.long_description_sections` + `signature_experiences`, audit CDC.
- **Skills** : `content-enrichment-pipeline`, `concierge-voice-pipeline`, `llm-output-robustness`, `structured-data-schema-org`, `seo-technical`, `geo-llm-optimization`.
- **Related** : passe de de-scaffolding (`scripts/editorial-pilot/src/hotels/descaffold-sections.ts`), audit CDC (`audit-hotel-fiche-cdc.ts`), golden template (`les-airelles-gordes`).

> Ce doc est le **plan à valider**. Aucune écriture base liée à l'enrichissement profond
> n'est lancée avant ton GO. La passe de de-scaffolding (correctif léger, déjà validée) tourne
> en parallèle et n'est pas concernée par cette validation.

---

## 1. Contexte & diagnostic

### 1.1 Le symptôme

~81 % du catalogue publié (≈ 1 795 fiches) a laissé fuiter en production le **méta-commentaire
de brief éditorial** dans la prose rendue : « le brief ne documente pas… », `` `AUTO_DRAFT` ``,
« niveau de confiance `low` », identifiants Wikidata (`Q111874352`), « selon les sources
publiques », « reste à vérifier ». C'est une régression **EEAT / SEO / GEO** : Google et les LLM
ingèrent ce bruit, et la fiche perd toute crédibilité de source.

### 1.2 La cause racine

Le pipeline d'enrichissement **idéal** (skill `content-enrichment-pipeline`) est :

```
DATAtourisme → Wikidata → Wikipedia → Tavily → llmExtract → brief (sentinelles AUTO_DRAFT)
                                                                   ↓
                                              génération LLM → DÉGRADE EN SILENCE sur sentinelle
```

Le générateur en place (`enrich-hotel-content.ts`) a **deux faiblesses jumelles** :

1. **Matière trop pauvre** — il ne reçoit que le _brief existant_ + quelques champs structurés
   (`highlights`, `restaurant_info`, `spa_info`). Quand le brief est plein de sentinelles
   `AUTO_DRAFT` (faits jamais allés chercher), il n'a rien de réel à écrire.
2. **Dégradation bavarde** — au lieu d'**omettre** la phrase quand un fait manque, il a **narré
   le trou** (« le brief ne fournit pas… », « Wikidata ne documente pas… »). La sentinelle, censée
   être un signal interne (Rule 2 du skill), a traversé jusqu'à la prose publiée.

> **Conclusion** : on ne « nettoie » pas durablement un trou — on le **comble avec un fait sourcé**,
> ou on l'**omet en silence**. Le de-scaffolding (correctif chirurgical) gère la prose où le fait
> réel coexiste avec le méta. L'enrichissement profond gère les sections **génuinement vides de
> faits** (les `emptied` / pure-scaffolding).

---

## 2. Décision / stratégie

### 2.1 Deux vitesses (économie)

| Voie                                       | Cible                                                            | Coût                                  | Statut                |
| ------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------- | --------------------- |
| **De-scaffolding** (léger, LLM correction) | Fiches dont la prose porte des faits réels + méta mélangé        | ~flagship, ~chunk                     | **En cours** (validé) |
| **Enrichissement profond** (ce plan)       | Sections résiduelles vides de faits (`emptied`/pure-scaffolding) | fetch multi-sources + regen 2100 mots | **À valider**         |

On ne ré-enrichit **pas** les fiches déjà nettoyées proprement (ce serait cher et écraserait du
bon contenu). L'enrichissement profond cible **uniquement le résidu**.

### 2.2 Invariant anti-fuite (non négociable)

Tout contenu **régénéré** doit franchir un **gate anti-scaffolding partagé** avant écriture :
réutilisation du détecteur `LEAK_MARKERS` de `descaffold-sections.ts` (extrait dans un module
partagé). Si un seul marqueur survit → **rejet + retry**, puis si échec persistant → on **n'écrit
pas** (on garde le slot vide, on flague). « Né propre » plutôt que « nettoyé après coup ».

### 2.3 Gate EEAT (Rule 9 du skill)

Une section n'est régénérée que si le brief enrichi a pincé **≥ 2 `anchor_facts`** (faits avec
`evidence_quote` sourcé) pour cette section. Sinon : pas d'écriture (on préfère un slot vide
honnête à de la prose brodée). Provenance (`sourceUri` + `sourceLabel`) persistée sur chaque fait.

---

## 3. Périmètre (Phase 0)

**Phase 0 — Cibler.** À la fin du de-scaffolding → re-audit CDC → extraction de la **file
d'enrichissement** : les fiches qui gardent ≥ 1 section pure-scaffolding (bucket `emptied` /
`PARTIAL`).

Projection (au moment de la rédaction, de-scaffold à ~48 %) : **~500 fiches** (~29 % de PARTIAL
observé). Chiffre exact livré par le re-audit.

Sous-segmentation pour les vagues : Palaces FR d'abord → 5★ FR → international, par densité de
trafic. Les sections typiquement vides : `histoire`, `architecture-design`, `bien-etre-spa`,
`service-equipe`, parfois `l-experience-a-demeure`.

---

## 4. Phases détaillées

### Phase 1 — Briefs réels (fetch multi-sources)

Pour chaque fiche de la file, (re)construire un brief **factuel** via les blocs **déjà existants** :

| Étape                                                                       | Module                                                                                                                                         | Apport                                  |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Structure (adresse, GPS, étoiles, Palace, URL off.)                         | `datatourisme.ts`                                                                                                                              | Système de référence FR                 |
| Encyclopédique (inception, architecte, propriétaire, MERIMÉE, IDs externes) | `wikidata.ts` (SPARQL, User-Agent)                                                                                                             | Faits datés                             |
| Narratif (lead, 1re phrase d'histoire)                                      | `wikipedia.ts`                                                                                                                                 | Ancrage récit                           |
| Dining / wellness / capacité / awards                                       | `tavily-client.ts` (Search→Extract) + extracteurs typés (`dining-extractor`, `wellness-extractor`, `capacity-extractor`, `services-extractor`) | Faits opérationnels                     |
| Extraction typée                                                            | `llm-extract.ts` (`gpt-4o-mini`, temp 0, `evidence_quote`)                                                                                     | Anti-hallucination                      |
| Assemblage                                                                  | `brief-builder.ts` (`buildBriefFromSources`)                                                                                                   | Sentinelles `AUTO_DRAFT` pour les trous |

Garde-fous skill : pré-flight URL (Rule 5 ter — refuser brand-homepage), domaines Tavily bloqués
(Rule 5 bis — `hyatt.com`/`starwood` → fallback éditorial tiers), cache disque idempotent (Rule 8).

**Livrable Phase 1** : brief enrichi persistant (ou cache) + rapport « faits trouvés par section /
sentinelles restantes » par fiche.

### Phase 2 — Régénération durcie des sections

Adapter `enrich-hotel-content.ts` (ou un runner dérivé `enrich-residual-sections.ts`) :

- **Entrée** : brief enrichi Phase 1 (pas seulement le brief legacy).
- **Prompt durci** : interdiction explicite de mentionner brief / Wikidata / `AUTO_DRAFT` /
  niveaux de confiance / `pending` / « non vérifié » / « selon les sources ». Sur sentinelle →
  **omettre la phrase**, jamais la narrer.
- **Gate anti-fuite post-génération** (`LEAK_MARKERS` partagé) → rejet + retry (max 2), sinon skip.
- **Gate EEAT** (`anchor_facts ≥ 2` par section) → sinon section non régénérée (slot vide gardé).
- **Régénération ciblée** : ne régénère que les sections vides ; **préserve** les sections déjà
  riches/nettoyées de la fiche (pas d'overwrite global aveugle — diffère du comportement actuel
  qui réécrit tout le tableau).

> Décision ouverte D-2 (voir §10) : régénération **par-section** (préserve l'existant) vs
> **fiche entière** (plus simple, mais réécrit le bon contenu). Recommandation : par-section.

### Phase 3 — Voix Concierge + bilingue

- Pass humanizer (`run-humanizer.ts`) + shortener ≤ 25 mots (`run-shorten-sections.ts`) sur les
  sections nouvellement écrites.
- EN : `translate-hotels-en.ts` une fois le FR figé.
- Re-appliquer le gate anti-fuite après chaque transformation (une réécriture ne doit pas
  réintroduire de marqueur).

### Phase 4 — Provenance, contrôle, acceptation

- `external_sources` / provenance par fait (Rule 7).
- Re-audit CDC (`audit:hotel-fiches-cdc` + `report:hotel-fiches-cdc`) → 0 fuite résiduelle attendu
  sur les fiches traitées.
- Audit FR-residuals (Rule 12) sur les nouveaux `_fr`.
- Marche utilisateur (skill `user-acceptance-loop`) sur 3-4 fiches enrichies avant de déclarer la
  vague « live ».

---

## 5. Vagues & coût (indicatif)

| Vague  | Segment                           | Volume est. | Coût est. (fetch + regen) |
| ------ | --------------------------------- | ----------- | ------------------------- |
| Pilote | mix Palaces/5★/intl représentatif | 12          | quelques €                |
| V1     | Palaces FR résiduels              | ~80         | ~$ + crédits Tavily       |
| V2     | 5★ FR résiduels                   | ~200        | $$                        |
| V3     | International résiduel            | reste       | $$                        |

Coût dominé par : Tavily (Search advanced = 2 crédits, Extract advanced) + génération flagship
(~2100 mots FR/fiche). Chiffrage précis après le pilote (mesure réelle tokens + crédits/fiche).

Tous les runners : **idempotents**, runlog JSONL (reprise), concurrency bornée (Tavily/Overpass
≤ 2, génération ≤ 4-5).

---

## 6. Validation & acceptation

Une fiche est « enrichie OK » si :

1. **0 marqueur** `LEAK_MARKERS` (gate automatique).
2. Sections régénérées portent des **faits sourcés** (`anchor_facts ≥ 2`) ou sont restées vides
   (pas de broderie).
3. `body_fr ≥ 300` mots/section, phrases ≤ 25 mots, voix Concierge.
4. CDC re-audit : dimensions `golden`/`structure`/EEAT au vert sur la fiche.
5. Marche utilisateur OK (rendu prod, hreflang, JSON-LD).

---

## 7. Risques & mitigations

| Risque                                               | Mitigation                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------------ |
| Tavily renvoie peu/pas de faits (petits hôtels intl) | Gate EEAT `anchor_facts ≥ 2` → on n'écrit pas, slot reste vide (honnête) |
| Réintroduction de fuite par la regen                 | Gate `LEAK_MARKERS` partagé à chaque écriture + après humanizer          |
| Overwrite de bon contenu                             | Régénération **par-section** (D-2), jamais de wipe global                |
| Coût Tavily/flagship                                 | Pilote chiffré d'abord, vagues segmentées, cache disque                  |
| Hallucination de faits                               | `llmExtract` temp 0 + `evidence_quote` + provenance obligatoire          |
| Domaines Tavily bloqués (`hyatt`/`starwood`)         | Fallback éditorial tiers (Rule 5 bis)                                    |

---

## 8. Idempotence & reprise

- Brief : cache disque `.cache/` (Rule 8) — re-fetch ≈ gratuit.
- Regen : runlog `out/enrich-residual-runlog-YYYY-MM-DD.jsonl`, skip des fiches déjà OK.
- DB : `--force` requis pour réécrire une fiche déjà enrichie.

---

## 9. Décisions validées (2026-06-04)

- **D-1** ✅ — Périmètre : enrichissement **profond uniquement sur le résidu** (~500 fiches), pas
  sur les fiches déjà nettoyées.
- **D-2** ✅ — Granularité regen : **par-section** (préserve l'existant). **Tavily mobilisé en
  profondeur** (Search advanced + Extract advanced + fallback éditorial tiers) pour aller chercher
  le fait réel de chaque section vide plutôt que d'omettre par défaut.
- **D-3** ✅ — Gate EEAT strict (`anchor_facts ≥ 2`, sinon slot vide gardé). **Tavily en
  profondeur** pour maximiser le nombre de faits sourcés pincés avant de conclure « pas assez de
  matière » : on ne laisse un slot vide qu'après une vraie recherche multi-requêtes.
- **D-4** ✅ — Ordre des vagues : Palaces FR → 5★ FR → international.
- **D-5** ✅ — Démarrage : pilote 12 fiches pour chiffrer/prouver, puis GO vague par vague.
  _(Exécution du pilote en attente du GO final du PO — premier poste de dépense.)_
- **D-6** ✅ — Un **ADR formel `0029`** est créé en plus de ce runbook (décision « générateur
  durci = chemin canonique anti-fuite » + stratégie deux vitesses), ce runbook restant le doc
  d'exécution. Cf. `docs/adr/0029-deep-content-enrichment-anti-scaffolding.md`.

### Implication Tavily « en profondeur » (D-2 + D-3)

Stratégie de recherche renforcée par section vide, par-dessus le pattern Search→Extract (Rule 5) :

1. **Requêtes multiples ciblées** par dimension : p.ex. histoire → `"{hotel} {ville} histoire
ouverture année architecte"` ; gastronomie → `"{hotel} restaurant chef étoile Michelin carte"` ;
   spa → `"{hotel} spa soins marque cabines piscine"`.
2. **Extract advanced** sur les 2-3 meilleurs résultats par requête, `chunksPerSource: 3`.
3. **Fallback éditorial tiers** systématique si l'officiel échoue/maigre (Rule 5 bis) :
   `tablethotels.com`, `cntraveler.com`, `travelandleisure.com`, `forbes.com`, `robbreport.com`.
4. **Budget borné** : cap de requêtes/fiche (chiffré au pilote) + cache disque idempotent pour ne
   jamais re-payer une recherche identique.
5. Tous les faits passent par `llmExtract` (temp 0, `evidence_quote`) → provenance obligatoire.

---

## 10. Références

- Skill : `.cursor/skills/content-enrichment-pipeline/SKILL.md` (Rules 1-14).
- Blocs existants : `scripts/editorial-pilot/src/enrichment/{brief-builder,datatourisme,wikidata,wikipedia,tavily-client,llm-extract,dining-extractor,wellness-extractor,capacity-extractor,services-extractor}.ts`.
- Générateur actuel : `scripts/editorial-pilot/src/enrichment/enrich-hotel-content.ts`.
- De-scaffolding (gate `LEAK_MARKERS` à extraire/partager) : `scripts/editorial-pilot/src/hotels/descaffold-sections.ts`.
- Audit CDC : `scripts/editorial-pilot/src/hotels/{audit-hotel-fiche-cdc,report-hotel-fiche-cdc}.ts`.
- Golden template de référence : fiche `les-airelles-gordes`.
