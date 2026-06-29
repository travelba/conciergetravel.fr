# Grand audit fiches hôtel — MyConciergeHotel.com

**Date** : 2026-06-29
**Périmètre** : les **2 984 fiches hôtel publiées** (`hotels.is_published = true`).
**Mode** : lecture seule (aucune écriture DB, aucun commit). Phase éditoriale —
booking **gelé** (Phase 6), donc le booking / `Offer` n'est PAS évalué.
**Méthode** : agrégation côté script sur l'API PostgREST service-role (le MCP
Supabase répond `Unauthorized`, le pg direct est IPv6-only → injoignable sur ce
poste ; PostgREST en pagination 400 lignes × colonnes ciblées). Gate de fuite =
copie verbatim de `scripts/editorial-pilot/src/enrichment/scaffolding-gate.ts`
(`hasLeak`). JSON-LD vérifié par `curl` sur 3 fiches prod. Données brutes :
`scripts/editorial-pilot/runs/grand-audit-2026-06-29.json`.

> ⚠ **Audit metric ≠ production validator** (AGENTS.md §4bis). Pour chaque champ
> texte deux seuils coexistent : (a) l'**enveloppe de production** (Zod) qui gate
> réellement le publish, et (b) l'**idéal CDC** (aspirationnel). On cite les deux
> séparément pour ne PAS sur-compter le travail. Ex. `factual_summary` :
> enveloppe prod [110, 165] (bloquante) vs idéal CDC [130, 150] (cible).

---

## 0. TL;DR chiffré

Le **socle écrit est quasi parfait** (FAQ, factual_summary, meta_desc,
description, sections long-read, concierge_advice, i18n, anti-fuite = 99-100 %).
Les vrais gaps sont **visuels et signaux d'autorité** : photos (volume CDC + 10
catégories), avis Google manquants sur ~27 % du catalogue, et EEAT/external_sources.

| #     | Dimension                                            | Conforme / 2984 | %          | Seuil                     |
| ----- | ---------------------------------------------------- | --------------- | ---------- | ------------------------- |
| Écrit | factual_summary FR/EN — **enveloppe prod [110,165]** | 2984 / 2984     | **100 %**  | bloquant ✅               |
| Écrit | meta_desc FR/EN [140,170]                            | 2980 / 2984     | 99.9 %     | SEO (4 = fixtures golden) |
| Écrit | description FR/EN non-null                           | 2984 / 2984     | 100 %      | bloquant ✅               |
| Écrit | long_description_sections ≥ 6                        | 2984 / 2984     | 100 %      | ✅                        |
| Écrit | FAQ promote ≥ 10                                     | 2984 / 2984     | 100 %      | bloquant ✅               |
| Écrit | concierge_advice FR (hard rule P0)                   | 2983 / 2984     | 99.97 %    | bloquant                  |
| Écrit | **fuites scaffolding (desc + sections + concierge)** | 0 fuite         | **100 %**  | P0 ✅                     |
| i18n  | name_en + slug_en (intégrité hreflang)               | 2984 / 2984     | 100 %      | ✅                        |
| EEAT  | external_sources ≥ 1                                 | 2834 / 2984     | 95.0 %     | qualité                   |
| GEO   | geo_qa présent                                       | 2845 / 2984     | 95.3 %     | qualité                   |
| Avis  | AggregateRating réel (Google)                        | 2172 / 2984     | **72.8 %** | EEAT/SEO                  |
| Photo | ≥ 10 photos                                          | 2778 / 2984     | 93.1 %     | Phase 2                   |
| Photo | **≥ 30 photos (CDC §2.2)**                           | 5 / 2984        | **0.2 %**  | idéal CDC                 |
| Photo | **couverture 10 catégories**                         | 1 / 2984        | **0.03 %** | idéal CDC                 |

JSON-LD prod (3 fiches) : `Hotel` + `BreadcrumbList` + `FAQPage` présents,
`AggregateRating.bestRating: 5` (jamais 10), **0 `Offer` émis** → gel Phase 6
respecté. ✅

---

## 1. Audit par dimension

### 1. Photos — le chantier n°1 (Phase 2)

| Métrique                        | Conforme     | %          | Nature                                        |
| ------------------------------- | ------------ | ---------- | --------------------------------------------- |
| ≥ 1 photo                       | 2962 / 2984  | 99.3 %     | —                                             |
| ≥ 10 photos                     | 2778 / 2984  | 93.1 %     | Phase 2 (gate prod actuel = chemin éditorial) |
| **≥ 30 photos (CDC §2.2)**      | **5 / 2984** | **0.2 %**  | idéal CDC                                     |
| **10 catégories couvertes**     | **1 / 2984** | **0.03 %** | idéal CDC                                     |
| alt FR+EN sur toutes les photos | 2947 / 2984  | 98.8 %     | hard rule 16                                  |
| caption FR+EN                   | 2947 / 2984  | 98.8 %     | JSON-LD ImageObject                           |
| width/height présents           | 2955 / 2984  | 99.0 %     | anti-CLS                                      |
| hero_image                      | 2962 / 2984  | 99.3 %     | —                                             |

- **0 photo (22 fiches)** : `armancette`, `casa-labia`, `chalet-martin`,
  `cote-sable`, `domaine-ulysia`, `hotel-amour`, `la-cheneaudiere`, `la-mirande`,
  `la-villa`, `le-chateau-richeux`, `le-hameau-des-pesquiers`, `les-hautes-mers`,
  `maison-zugno`, `mama-shelter`, `mandarin-oriental`, `palais-leonia`,
  `six-senses-bangkok`, `son-bunyola`, `the-notary`, `the-silo`, `torel-palace`,
  `villa-moon`. (= les 22 mêmes pour `hero_image` manquant.)
- **< 10 photos : 206 fiches** (dont les 22 à zéro). Échantillon :
  `21-foch`, `adriatik-hotel`, `anantara-maia-seychelles-villas`, `armancette`,
  `auberge-de-cassagne`, `babuino-181`, `bastide-les-vallats`, `brach-madrid`,
  `capella-kuala-lumpur`, `casa-chable`, `chalet-*` (série chalets).
- **alt FR/EN manquant (15 fiches)** : `four-seasons-hotel-prague`,
  `four-seasons-one-dalton-street`, `gleneagles`, `hyatt-regency-sha-tin`,
  `la-residencia-a-belmond-hotel-mallorca`, `mandarin-oriental-barcelona`,
  `montage-los-cabos`, `the-peninsula-hong-kong`, `the-peninsula-istanbul`,
  `the-pierre`, `upper-house-hong-kong`, … (paradoxe : grandes marques, galeries
  récemment append-ées sans repasser la Vision).
- **Verdict** : `≥ 30 / 10 catégories` est l'**idéal CDC** (parité Gordes),
  pas le gate de publish actuel (chemin éditoriale, AGENTS Phase 1). Seul
  `les-airelles-gordes` (30 photos, 11 catégories) atteint la cible. C'est LE
  gisement Phase 2.

### 2. FAQ — quasi parfait

| Métrique                       | Conforme    | %      |
| ------------------------------ | ----------- | ------ |
| FAQ promote ≥ 10 (hard rule 2) | 2984 / 2984 | 100 %  |
| faq_content_kit ≥ 40           | 2980 / 2984 | 99.9 % |
| concierge_questions ≥ 20       | 2980 / 2984 | 99.9 % |

- **4 fiches sans kit Perplexity** (`faq_content_kit=0` ET `concierge_questions=0`) :
  `pikaia-lodge`, `prince-s-palace`, `quisisana-resort`, `singita-pamushana`.
  Elles ont la FAQ promote (10) mais pas les deux tiers étendus.
- Couverture PAA (`dfs_paa_coverage`) : non stockée en colonne dédiée sur
  `hotels` (le gate vit dans le runlog du pipeline) → non mesurable par cet
  audit DB. À tracer sur un futur run `faq:perplexity:batch`.

### 3. factual_summary FR/EN

| Bande                                    | FR                      | EN                      |
| ---------------------------------------- | ----------------------- | ----------------------- |
| **Enveloppe prod [110,165]** (bloquante) | 2984 / 2984 (**100 %**) | 2984 / 2984 (**100 %**) |
| Idéal CDC [130,150] (aspirationnel)      | 2924 / 2984 (98.0 %)    | 2904 / 2984 (97.3 %)    |
| Hors enveloppe                           | **0**                   | **0**                   |

- **0 fiche hors enveloppe de production** → aucun blocage. Les 60 FR / 80 EN
  hors idéal CDC sont dans [110,130) (sources minces — Belmond, Ritz-Carlton APAC).
  ROI d'une passe LLM supplémentaire ≈ nul (auto-censure du modèle).

### 4. meta_desc FR/EN [140,170]

- **2980 / 2984 (99.9 %)** dans la bande SEO, FR et EN.
- **4 échecs = `cheval-blanc-paris`, `le-bristol-paris`, `les-airelles-courchevel`,
  `shangri-la-paris`** : ce sont des **fiches « golden fixture »** rendues depuis
  un fixture codé en dur (`patch-kit-golden-row.ts`), pas depuis la ligne DB. La
  page live est correcte ; la colonne DB est nulle. **Faux positif** — ne pas
  régénérer.

### 5. description_fr/en

| Métrique                     | FR                   | EN                   |
| ---------------------------- | -------------------- | -------------------- |
| non-null                     | 2984 / 2984 (100 %)  | 2984 / 2984 (100 %)  |
| ≥ 600 chars (idéal CDC §2.4) | 2975 / 2984 (99.7 %) | 2976 / 2984 (99.7 %) |
| **fuites `hasLeak`**         | **0**                | **0**                |
| parité EN (présence)         | —                    | 100 %                |

- Aucune fuite scaffolding (résultat des vagues 11-14 de remédiation). ~9 fiches
  FR / 8 EN sous 600 chars (outliers iconiques, ex. Cap-Eden-Roc).

### 6. long_description_sections

| Métrique                                  | Conforme    | %      |
| ----------------------------------------- | ----------- | ------ |
| ≥ 6 sections                              | 2984 / 2984 | 100 %  |
| ≥ 3 sections (plancher indexabilité)      | 2984 / 2984 | 100 %  |
| parité EN (title_en + body_en sur toutes) | 2950 / 2984 | 98.9 % |
| fuites scaffolding                        | 0           | 100 %  |

- **34 fiches** avec ≥ 1 section EN en fallback FR : `1898-the-post`, `717-hotel`,
  `au-chamois-d-or`, `chateau-de-montcaud`, `chenot-palace-weggis`,
  `delaire-graff-estate`, `le-clarence`, `nobu-hotel-marbella`, `nobu-ryokan`,
  `sofitel-marseille-vieux-port`, … (résidu « hard » : sources FR limites que le
  gate refuse de traduire ; le fallback FR rend quand même).

### 7. concierge_advice (hard rule P0, bloc 16)

| Métrique   | Conforme    | %       |
| ---------- | ----------- | ------- |
| FR présent | 2983 / 2984 | 99.97 % |
| EN présent | 2965 / 2984 | 99.4 %  |
| fuites     | 0           | 100 %   |

- **1 fiche sans concierge_advice du tout** : `macakizi` (TR). **Violation hard
  rule P0** → à régénérer en priorité (rapide).
- **18 fiches FR-only** (EN manquant) : `balthazar-hotel-spa`,
  `cheval-blanc-courchevel`, `hotel-du-palais-biarritz`, `hotel-the-peninsula-paris`,
  `lapogee-courchevel`, `le-meurice`, `les-airelles-saint-tropez`, … (grandes
  fiches FR — paradoxe de visibilité).

### 8. policies

| Métrique         | Conforme    | %      |
| ---------------- | ----------- | ------ |
| présent          | 2978 / 2984 | 99.8 % |
| non `_synthetic` | 2975 / 2984 | 99.7 % |

- **6 sans policies** : `akelarre-restaurant-hotel`, `aman-i-khas`,
  `and-beyond-punakha-river-lodge`, `ayurveda-parkschlosschen`, `casa-electra`,
  `hotel-goldener-hirsch-a-luxury-collection-hotel`.
- **3 `_synthetic: true`** (defaults non sourcés) : `andbeyond-phinda-private-game-reserve-lodges`,
  `conrad-los-angeles`, `pullman-dubai-jumeirah-lakes-towers`.

### 9. external_sources (EEAT)

| Métrique                       | Conforme    | %          |
| ------------------------------ | ----------- | ---------- |
| ≥ 1 source                     | 2834 / 2984 | 95.0 %     |
| ≥ 5 sources (provenance riche) | 520 / 2984  | **17.4 %** |

- **150 fiches sans aucune provenance** (`eeat_0`). Échantillon : `25hours-piazza-san-paolino`,
  `andaz-fifth-avenue`, `bulgari-hotel-beijing`, `capella-ho-chi-minh-city`,
  `castello-di-casole`, `casa-labia`, `casa-electra`, série `chalet-*`,
  `chateau-de-*`. Ce sont des lignes sans identifiant Wikidata résolu.
- Le gros gap qualitatif : seules 17.4 % ont une provenance riche (≥ 5 entrées).

### 10. geo_qa (GEO/AEO)

- **2845 / 2984 (95.3 %)** ont un bloc geo_qa. **139 manquants** (`geo_missing`).
  Échantillon : `21-foch`, `anantara-ho-tram-resort`, `anantara-phuket-suites-and-villas`,
  `banyan-tree-ringha`, série `chalet-*`, `casa-da-calcada`, `casa-de-peonia`.

### 11. Avis Google / AggregateRating — gros gap EEAT/SEO

| Métrique                                           | Conforme       | %          |
| -------------------------------------------------- | -------------- | ---------- |
| Note Google réelle (`google_rating` + `reviews>0`) | 2172 / 2984    | 72.8 %     |
| Note éditoriale (`aggregate_rating_value`)         | 0 / 2984       | 0 %        |
| **Aucune note**                                    | **812 / 2984** | **27.2 %** |

- **812 fiches sans aucune note** → pas d'`AggregateRating` JSON-LD, pas d'étoile
  Rich Result. Échantillon : `1898-the-post`, `21c-museum-hotel-chicago`,
  `al-wathba-a-luxury-collection-desert`, `aman-rosa-alpina`,
  `anantara-maia-seychelles-villas`, `anantara-palais-hansen`, … et — notable —
  **`le-meurice`** (phare Paris, `google_rating = null`).
- Hard rule 11/13 respectée : `bestRating: 5` partout, jamais 10 (vérifié prod).

### 12. hreflang / i18n

- **name_en : 2984 / 2984 (100 %)**, **slug_en : 2984 / 2984 (100 %)**,
  meta_title FR+EN : 2983 / 2984. Intégrité hreflang FR↔EN = saine au niveau
  identité. (Les gaps de parité de _contenu_ EN sont en §6/§7, pas ici.)

### 13. JSON-LD (vérif prod `curl`)

Échantillon `le-bristol-paris`, `le-meurice`, `les-airelles-gordes` :

| Nœud                                        | bristol | meurice         | gordes |
| ------------------------------------------- | ------- | --------------- | ------ |
| `Hotel`                                     | ✅      | ✅              | ✅     |
| `BreadcrumbList`                            | ✅      | ✅              | ✅     |
| `FAQPage`                                   | ✅      | ✅              | ✅     |
| `Place` (City/TouristAttraction sous-types) | ✅      | ✅ (`Place`)    | ✅     |
| `AggregateRating` `bestRating:5`            | ✅      | — (pas de note) | ✅     |
| **`Offer`**                                 | **0**   | **0**           | **0**  |

- Gel Phase 6 **respecté** : aucun `Offer` émis. `bestRating` toujours 5.
- ⚠ `le-meurice` (et `le-bristol`) émettent des nœuds `Event` (marchés/expos POI)
  signalés **invalides** par GSC (`organizer`/`image`/`offers` manquants) — cf.
  audit GSC §5.8. Hygiène rich-results à corriger.

### 14. Indexation (croisement audit GSC 2026-06-29)

- Référentiel soumis = **8 202 URLs** ; **191 pages** reçoivent des impressions
  (plancher d'indexation) → couverture globale **≈ 2.3 %**.
- Fiches hôtel : **95 / 2 984 indexées (3.2 %)**. Même `le-meurice` est
  _Discovered – currently not indexed_ ; `jumeirah-al-naseem` est _URL unknown_.
- **Le contenu n'est PAS le bloqueur d'indexation** (robots/canonical/fetch
  sains) : le goulot est **budget de crawl + autorité**. → Le chantier
  éditorial améliore la _qualité_ des pages indexées, mais l'indexation de masse
  dépend du **maillage interne + netlinking** (hors périmètre fiche).

---

## 2. Fiches en détail (exemples)

### ⭐ Excellente — `les-airelles-gordes` (FR, 5★) — modèle universel

30 photos / **11 catégories** (seule du catalogue), hero ✅, faq 10 + kit 82 +
cq 28, fs FR 130 / EN 135 (idéal CDC), md 165/161, desc FR 758 / EN 731,
8 sections bilingues, concierge FR+EN, geo_qa 3, EEAT 9, Google 4.6 (951 avis).
**Diagnostic** : conforme parité Gordes. Rien à redire. C'est la cible.

### 🟡 Moyenne — `le-meurice` (FR, 5★) — fort écrit, signaux manquants

faq 15 + kit 52 + cq 25, fs FR 141 / EN 134, md 149/142, desc FR 1315 / EN 1298,
8 sections bilingues. **Pas bien** : seulement **10 photos / 5 catégories**,
**concierge_advice EN manquant**, **EEAT faible (2 sources)**, **aucune note
Google** (`google_rating = null`) → pas d'`AggregateRating`. **Manquant** : photos
(volume + catégories), avis Google, concierge EN. Paradoxe : phare Paris mais
_Discovered – not indexed_ (GSC).

### 🟡 Moyenne — `25hours-hotel-dubai-one-central` (AE, 5★) — écrit complet, photos courtes

faq 15 + kit 48 + cq 25, fs FR 146 / EN 132, md 167/166, desc FR 991 / EN 840,
10 sections bilingues, concierge FR+EN, geo_qa 3, EEAT 8, Google 4.6 (8436 avis).
**Pas bien** : **12 photos / 8 catégories** (< 10 cats), md_fr 167 (haut de bande).
**Manquant** : 18 photos + 2 catégories pour la cible CDC. Sinon très solide.

### 🔴 Faible — `casa-labia` (ZA, 5★) — écrit OK, zéro visuel + zéro EEAT

Écrit complet (fs 134/133, desc FR 1163 / EN 1039, 7 sections bilingues, faq
15+45+25, concierge FR+EN). **Pas bien** : **0 photo**, **0 hero**, **0
external_sources**, **aucune note Google**. **Manquant** : toute la couche
visuelle + provenance + avis. Fiche « invisible » malgré un bon texte.

### 🔴 Faible — `macakizi` (TR, 5★) — viole la hard rule P0

faq 15+52+26, fs 140/135, desc FR 1147 / EN 1010, 10 sections bilingues, Google
4.3 (1209 avis), 10 photos. **Pas bien** : **concierge_advice ABSENT (FR+EN)** =
**violation hard rule 11 / bloc 16 (P0)**. EEAT mince (1). **Manquant** : le bloc
Conseil du Concierge — à générer en priorité (rapide, 1 fiche).

### 🔴 Faible (FAQ) — `pikaia-lodge` (EC, 5★)

Écrit principal OK (desc, sections, fs, concierge, Google 4.8), mais
**faq_content_kit = 0 ET concierge_questions = 0** : seule la FAQ promote (10) est
là. **Manquant** : le kit Perplexity (40-60) + concierge_questions (20-30).

---

## 3. GRAND PLAN de remédiation (priorisé ROI)

Priorité PO : **contenu écrit d'abord, photos ensuite, booking jamais (gelé)**.
Le socle écrit étant à 99-100 %, le ROI bascule sur **les petits trous écrits
restants (effort quasi nul)** puis **avis + EEAT** (impact SEO/EEAT fort) puis
**photos** (le gros volume Phase 2).

### Vague A — Quick wins écrits (effort < 1 h, impact correctif P0)

| #   | Chantier                                     | Volume                                                                         | Pipeline exact                                                                                                                                    | Dépendance                            |
| --- | -------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| A1  | **concierge_advice manquant** (P0 hard rule) | 1 (`macakizi`)                                                                 | `concierge:humanize:faq` n'est pas le bon — utiliser le générateur concierge_advice (`src/hotels/run-hotel-concierge-advice.ts --slugs=macakizi`) | —                                     |
| A2  | concierge_advice **EN** manquant             | 18                                                                             | script de traduction concierge EN (`src/hotels/translate-*-en` famille) ou régénération bilingue ciblée `--slugs=`                                | —                                     |
| A3  | **FAQ kit + concierge_questions** absents    | 4 (`pikaia-lodge`, `prince-s-palace`, `quisisana-resort`, `singita-pamushana`) | `pnpm --filter @mch/editorial-pilot faq:perplexity:batch -- --slugs=pikaia-lodge,prince-s-palace,quisisana-resort,singita-pamushana`              | Perplexity MCP + DataForSEO grounding |
| A4  | policies manquantes                          | 6                                                                              | `pnpm --filter @mch/editorial-pilot enrich:policies -- --slugs=akelarre-restaurant-hotel,aman-i-khas,…`                                           | Tavily/Google Places                  |

### Vague B — Parité EN + GEO (effort modéré, impact SEO EN/AEO)

| #   | Chantier                            | Volume        | Pipeline exact                                                                          | Dépendance                                                 |
| --- | ----------------------------------- | ------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| B1  | sections EN en fallback FR          | 34            | `src/hotels/translate-sections-en.ts --all` (gate `hasLeak`, salvage par phrase)        | —                                                          |
| B2  | geo_qa manquant                     | 139           | `src/hotels/run-hotel-geo-qa.ts --slugs=…` (requiert PAA DataForSEO ; skip si zéro PAA) | DataForSEO grounding                                       |
| B3  | factual_summary idéal CDC [130,150] | 60 FR / 80 EN | `run-hotel-factual-summary.ts --cdc-tightening`                                         | **ROI faible** (sources minces, auto-censure) — différable |

### Vague C — Autorité / EEAT (effort modéré, impact EEAT/SEO fort)

| #   | Chantier                                | Volume                     | Pipeline exact                                                                                                         | Dépendance                |
| --- | --------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| C1  | **avis Google manquants**               | **812**                    | `pnpm --filter @mch/editorial-pilot reviews:sync -- --slugs=…` (priorité fiches phares : `le-meurice`, Aman, Anantara) | Google Places API (quota) |
| C2  | external_sources absentes               | 150                        | `enrich:wikidata` puis `src/enrichment/convert-wikidata-to-external-sources.ts --slugs=…`                              | résolution Wikidata       |
| C3  | external_sources < 5 (provenance riche) | 2464                       | idem C2 sur le reste après C2                                                                                          | —                         |
| C4  | hygiène JSON-LD `Event` invalide        | fiches à `upcoming_events` | compléter `image/organizer` ou retirer le bloc Event (cf. audit GSC §5.8)                                              | —                         |

### Vague D — Photos (Phase 2, gros volume, impact visuel + CDC)

| #   | Chantier                                        | Volume      | Pipeline exact                                                          | Dépendance                                                |
| --- | ----------------------------------------------- | ----------- | ----------------------------------------------------------------------- | --------------------------------------------------------- |
| D1  | **0 photo** (P1 — fiche sans visuel)            | 22          | `src/photos/run-zero-photo-backfill.ts` puis `photos:categorize`        | Google Places / press-kit                                 |
| D2  | < 10 photos                                     | 206         | `photos:sync` (append Google Places) + `photos:categorize`              | Places quota                                              |
| D3  | alt/caption FR+EN manquants                     | 15          | `photos:categorize` (Vision) sur ces slugs                              | OpenAI Vision                                             |
| D4  | **≥ 30 photos / 10 catégories (parité Gordes)** | 2978 / 2983 | sourcing officiel + `resource-*-gallery-batch` (kit) → vagues catalogue | **chantier Phase 2 majeur** — sourcing press-kit officiel |

### Hors périmètre fiche (rappel audit GSC — le vrai levier d'indexation)

L'audit GSC montre que **96.8 % des fiches ne sont pas indexées** malgré un
contenu sain → le blocage est **autorité + budget de crawl**, pas la fiche.
Leviers complémentaires (densifier le maillage interne hôtel↔ville↔classement,
réparer `guides.xml`, corriger `<lastmod>`, netlinking) — voir
`docs/audits/gsc-indexation-2026-06-29.md` §5. Sans cela, la remédiation fiche
améliore la _qualité_ mais pas la _couverture_.

---

## 4. Annexe — méthode & limites

- Script audit : `scripts/editorial-pilot/tmp-grand-audit.mjs` (read-only,
  PostgREST service-role, pagination 400, colonnes ciblées). Sortie JSON :
  `runs/grand-audit-2026-06-29.json` (compteurs + échantillons de 25 slugs/gap).
- **Faux positifs connus** : les 4 fiches « golden fixture »
  (`cheval-blanc-paris`, `le-bristol-paris`, `les-airelles-courchevel`,
  `shangri-la-paris`) rendent depuis un fixture codé, pas depuis la ligne DB →
  leurs colonnes meta_desc nulles ne reflètent pas la page live.
- **Non mesuré par cet audit** : couverture PAA (`dfs_paa_coverage` non stocké en
  colonne), questions FAQ canoniques (détection sémantique non triviale),
  accessibilité/perf (gates séparés), correspondance photo/sujet pixel-level
  (`audit:photo-subject`).
- Booking / `Offer` : hors périmètre (Phase 6 gelée) — vérifié uniquement
  l'**absence** d'`Offer` (gel respecté).
