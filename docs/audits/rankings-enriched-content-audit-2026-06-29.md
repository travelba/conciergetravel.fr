# Audit — contenu enrichi des classements éditoriaux (FR + EN), image & « ressort bien »

**Date** : 2026-06-29
**Périmètre** : les **863 `editorial_rankings` publiés** (`is_published = true`) +
leurs **7 579 `editorial_ranking_entries`**.
**Mode** : lecture seule — aucune écriture DB, aucun code touché. Seul livrable : ce `.md`.
**Questions PO** : (1) le contenu enrichi de chaque classement est-il **complet et de
qualité en FR ET EN** ? (2) **« est-ce qu'on ressort bien »** (SEO/GEO) ? + (3) focus
explicite sur le **contenu image** des classements (extraits d'image d'hôtel dans les
listes + `og:image` du classement).

**Sources** (toutes chiffrées sur données réelles, sauf mention « estimé ») :

- **PostgREST** (count=exact + projections paginées) — la lib `pg` ne se connecte pas sur
  cette machine Windows et le MCP Supabase `execute_sql` est Unauthorized ; toutes les
  mesures DB viennent du REST (`NEXT_PUBLIC_SUPABASE_URL` + service-role).
- **Live `curl`** sur 4 pages classement (Rome FR+EN, hotel-de-luxe-rome EN, palaces-paris-8 FR).
- **Google Search Console** (MCP `project-0-conciergetravel.fr-gsc`, propriété
  `sc-domain:myconciergehotel.com`, fenêtre 28 j 2026-05-30 → 2026-06-27, latence ~2-3 j) — **opérationnel**.
- **Code** : `apps/web/src/app/[locale]/classement/[slug]/page.tsx` (render + JSON-LD + og),
  `apps/web/src/server/rankings/get-ranking-by-slug.ts` (reader).
- **À lire avant** : `docs/audits/en-seo-geo-audit-2026-06-29.md`,
  `.cursor/skills/editorial-rankings-matrix/SKILL.md`,
  `.cursor/skills/keyword-grounding-dataforseo/SKILL.md`.

---

## 0. Résumé exécutif

1. **Le socle FR est quasi parfait ; l'EN est une coquille à moitié vide.** Sur les
   863 classements publiés, FR = long-reads complets (intro médiane **5 481 c**,
   sections 4-8, FAQ médiane 12, justifications médiane 936 c, 0 trou). Mais côté EN :
   **795/863 (92 %) rendent une `intro_en` STUB d'une phrase** (<200 c, médiane 129 c)
   au lieu du long-read — c'est le **P0** de cet audit. Seuls **68 (7,9 %)** portent une
   vraie intro EN long-read (les city-heads remédiés cette session).
2. **Parité EN partielle au-delà de l'intro** : **272/863 (31,5 %)** classements ont ≥1
   `editorial_section` sans EN (`title_en`/`body_en` vide → fallback FR à l'écran), et
   **2 912/7 579 entrées (38 %)** ont une `justification_en` réduite à une phrase générique
   (<130 c) alors que le FR fait ~1 000 c — **274 classements 100 % stub-EN**, dont des
   têtes à fort volume (`hotel-de-luxe-rome`, `meilleurs-hotels-dubai`, `…-japon`, `…-london`).
3. **Verdict image = excellent et sans trou.** Les **863 classements ont `hero_image = NULL`**
   mais l'`og:image` se dérive du hero du **#1 hôtel** : **0/862** classement ne tombe sur
   le brand-card par défaut → **og:image = un vrai JPEG Cloudinary 1200×630** sur 100 % du
   parc (vérifié live). Les vignettes d'hôtel des listes s'affichent (12 sur Rome). **Seul
   bémol image** : l'`alt` des vignettes de liste = **le nom de l'hôtel seul** (« Hotel
   Hassler ») — non enrichi ville/mot-clé (Hard Rule 16) ; le podium top-3, lui, est enrichi
   (« Hotel Hassler, Rome »).
4. **On-page « ressort bien » = techniquement sain partout** : title (multi-pattern EN
   appliqué cette session, live « Best Hotels in Rome 2026: Luxury & 5-Star Picks »), meta,
   canonical self-référent, **hreflang `fr-FR`/`en`/`x-default` réciproques**, JSON-LD
   `ItemList` + `FAQPage` + `Article` + **`Speakable` (confirmé présent live)**. La déferral
   `slug_en` (URL EN garde le slug FR) **ne crée pas de duplicate** : canonical + hreflang OK.
5. **Mais on ne convertit pas (autorité, pas contenu).** GSC 28 j : ~38 pages classement
   avec impressions, **~682 impressions / 4 clics** au total. La tête volume EN
   `meilleurs-hotels-rome` = **105 impr, pos 40,1, 1 clic** ; « best hotels in rome » toujours
   **pos 44,4** (0 clic). Aucun mouvement post-title (l'autorité de domaine est le facteur
   bloquant, conformément à l'audit EN). Top performer = l'`awarded` `palaces-de-france-2026`
   (130 impr, pos 7,8, 2 clics).

**Top gaps priorisés** : **P0** = 795 `intro_en` stub → long-read ; **P1** = 272 sections EN +
274/339 justifications EN stub ; **P2** = 14 `meta_title` null + 13 FAQ<10 (même cohorte de
têtes récentes) + alt enrichi des vignettes de liste + 1 classement sous le plancher (2 entrées).

---

## 1. Axe A — Complétude de l'enrichissement éditorial (FR + EN)

Base = 863 classements publiés. Tous les counts ci-dessous sont des **counts PostgREST réels**
(`count=exact`) ou des distributions calculées sur projection paginée complète.

### 1.1 Champs scalaires (couverture brute)

| Champ                             | Présent (non-null) | Trou                           | Verdict                                           |
| --------------------------------- | ------------------ | ------------------------------ | ------------------------------------------------- | --------------------------------- |
| `intro_fr`                        | 863/863 (100 %)    | 0                              | ✅ médiane 5 481 c (3 rows < 800 c)               |
| `intro_en`                        | 863/863 non-null   | **795 sont des STUB < 200 c**  | 🔴 **P0** — voir §1.2                             |
| `title_en`                        | 863/863 (100 %)    | 0                              | ✅                                                |
| `factual_summary_fr`              | 863/863 (100 %)    | 0                              | ✅                                                |
| `factual_summary_en`              | 863/863 (100 %)    | 0                              | ✅                                                |
| `meta_desc_fr` / `meta_desc_en`   | 863/863 (100 %)    | 0                              | ✅                                                |
| `meta_title_fr` / `meta_title_en` | 849/863 (98,4 %)   | **14 null (les deux locales)** | 🟡 P2 — fallback `title                           | brand` (valide mais sous-optimal) |
| `outro_fr`                        | 863/863 (100 %)    | 0                              | ✅                                                |
| `outro_en`                        | 849/863            | 14 null (même cohorte)         | 🟡 P2                                             |
| `hero_image`                      | **0/863**          | 863                            | ⚠ par design — og dérivé du #1 hôtel (voir Axe B) |

> **`dfs_paa_coverage` n'est PAS persisté** : la colonne n'existe pas sur `editorial_rankings`
> (erreur PostgREST `42703`). La couverture PAA DataForSEO est une métrique de **runlog**
> uniquement (cf. skill `editorial-rankings-matrix` §Resume run 2026-06-26 : « PAA coverage
> reads LOW but is noise-dominated »). Impossible de produire une distribution par-tête ici.

### 1.2 `intro_en` — LE trou P0 de parité EN

| Bande `intro_en`                 | Nb classements | %          |
| -------------------------------- | -------------- | ---------- |
| **stub < 200 c** (médiane 129 c) | **795**        | **92,1 %** |
| 200–800 c                        | 0              | 0 %        |
| long-read ≥ 800 c                | 68             | 7,9 %      |

`intro_fr` médiane = **5 481 c** ; `intro_en` médiane = **129 c**. Le render
(`page.tsx` : `intro = pickByLocale(locale, intro_fr, intro_en ?? intro_fr)`) sert l'`intro_en`
**non-null** → sur `/en/classement/*` les 795 pages affichent **une seule phrase** sous
« Our methodology » au lieu du long-read FR. Les 68 OK = les city-heads traités cette session
(CT1 + luxe + chaînes), cf. `en-seo-geo-audit-2026-06-29.md` §8.

15 pires (`intro_en` la plus courte, `intro_fr` complète à côté) :
`meilleurs-hotels-spa-royaume-uni` (75 c / 5 715 c), `…-romantiques-centre-val-de-loire`,
`…-spa-bretagne`, `…-rooftop-provence`, `…-charme-sud-ouest`, `…-romantiques-bourgogne`,
`…-gastronomie-rome`, `…-design-cannes`, `…-gastronomie-reims`, `…-gastronomie-colmar`,
`meilleurs-5-etoiles-lyon`, `…-gastronomie-paris-8`, `…-piscine-centre-val-de-loire`,
`…-gastronomie-cote-atlantique`, `meilleurs-hotels-vue-mer-france`.

### 1.3 `editorial_sections` — count OK, parité EN partielle

| Métrique                                                        | Valeur                                              |
| --------------------------------------------------------------- | --------------------------------------------------- |
| sections/classement                                             | min **4** · médiane **6** · max **8** · moy **6,5** |
| classements < 3 sections                                        | **0** ✅                                            |
| classements avec ≥1 section sans EN (`title_en`/`body_en` vide) | **272 / 863 (31,5 %)** 🟡 **P1**                    |

Le count structurel est sain (jamais sous le plancher de 3). La dette est la **traduction
EN** : ~1/3 du parc a au moins une section qui retombe en FR sur `/en` via
`section.body_en || section.body_fr`.

### 1.4 `faq` — count OK, peu de trous EN

| Métrique                                                         | Valeur                                                 |
| ---------------------------------------------------------------- | ------------------------------------------------------ |
| FAQ/classement                                                   | min **7** · médiane **12** · max **19** · moy **12,4** |
| classements à 0 FAQ                                              | **0** ✅                                               |
| classements < 10 FAQ                                             | **13** 🟡 P2                                           |
| classements avec ≥1 FAQ sans EN (`question_en`/`answer_en` vide) | **40 / 863 (4,6 %)** 🟡 P2                             |

Les 13 < 10 FAQ = cohorte de têtes récentes / classements curatés (voir §1.6).

### 1.5 `editorial_ranking_entries` — justifications & comptes

7 579 entrées sur classements publiés.

| Métrique                                    | FR        | EN                                 |
| ------------------------------------------- | --------- | ---------------------------------- |
| justification null                          | **0** ✅  | **0** ✅                           |
| justification < 40 c (plancher CHECK)       | 0 ✅      | 0 ✅                               |
| justification > 1 200 c (plafond CHECK)     | 0 ✅      | 0 ✅                               |
| médiane longueur                            | **936 c** | **812 c**                          |
| **justification < 130 c (STUB une phrase)** | n/a       | **2 912 / 7 579 (38 %)** 🟡 **P1** |

La distribution EN est **bimodale** : ~62 % de justifications riches (~900 c) + **38 % de
stubs d'une phrase** (~100-128 c). Échantillon live confirmé (`hotel-de-luxe-rome` #1) :
FR 973 c (« occupe le sommet de la Piazza di Spagna, au-dessus de l'escalier de la Trinité… »)
vs EN **116 c** (« A Roman grand hotel with a landmark setting above the Spanish Steps… »).

- **274 classements** ont **100 %** de leurs entrées en stub-EN — dont des têtes volume :
  `top-relais-chateaux-monde` (40 entrées), `meilleurs-hotels-rome`, `hotel-de-luxe-rome`,
  `hotel-de-luxe-venise`, `hotel-de-luxe-maldives`, `hotel-de-luxe-hong-kong`,
  `meilleurs-hotels-dubai`, `meilleurs-hotels-japon`, `meilleurs-hotels-espagne`,
  `meilleurs-hotels-maroc`, `meilleurs-5-etoiles-italie`, `meilleurs-hotels-design-france`…
- **339 classements** ont ≥ 50 % d'entrées stub-EN.
- `badge_en` null sur 419 entrées (badge décoratif optionnel — non bloquant).

**Compte d'entrées par classement** : min **2** · médiane **8** · max **99** · moy **8,8**.

| Seuil                                           | Nb classements                                              |
| ----------------------------------------------- | ----------------------------------------------------------- |
| **< 3 entrées (sous le plancher MIN_ELIGIBLE)** | **1** → `meilleurs-hotels-piscine-venise` (2 entrées) 🟡 P2 |
| < 5 entrées (thin)                              | 144                                                         |
| exactement 3 ou 4 entrées                       | 143                                                         |

### 1.6 Cohorte « têtes récentes / curatés » sous-équipée (14 rows)

Les **14 classements à `meta_title_*` null** recouvrent quasi exactement les **13 à FAQ < 10** —
c'est un même lot généré par un pipeline plus léger :
`meilleurs-hotels-london` ⚠ (city-head EN à fort volume — 7 FAQ, pas de meta_title),
`meilleurs-hotels-boston`, `…-brisbane`, `…-inde`, `…-australie`, `…-fes`, `…-tchequie`,
`…-playa-del-carmen`, + curatés `classement-conde-nast-gold-list-2026`,
`classement-leading-hotels-of-the-world-selection`,
`classement-small-luxury-hotels-of-the-world-selection`,
`classement-ritz-carlton-reserve-hotels`, `classement-worlds-50-best-hotels-2025`,
`classement-travel-leisure-worlds-best-2025`.

---

## 2. Axe B — Contenu IMAGE des classements (focus PO)

### 2.1 `og:image` — couverture intégrale via le #1 hôtel

- **`hero_image` = NULL sur les 863 classements** : aucun classement ne porte sa propre image
  de couverture éditoriale. L'`og:image` est donc dérivé par `resolveRankingHeroPublicId()`
  du **hero du #1 hôtel** (puis #2, #3…), avec fallback ultime sur le brand-card `/og/default.jpg`.
- **0/862** classement (avec entrée rank 1) ne tombe sur le fallback : **le #1 hôtel porte
  toujours un `hero_image`** → l'`og:image` est **systématiquement un vrai JPEG Cloudinary
  1200×630** (`f_jpg,q_auto,c_fill,g_auto,w_1200,h_630`), jamais le brand-card générique.
- Live confirmé sur les 4 pages : `og:image` présent, `og:image:width=1200`, `og:image:alt`
  = le titre du classement, `twitter:card = summary_large_image`.

### 2.2 Vignettes d'hôtel dans la liste (« extraits d'image »)

- Le render émet une vignette `<img>` par entrée (`.cr-photo`, `w_680,h_510`) **+ un podium
  top-3** (`rk-podium`, feature 1280×800 / tiles 680×510). Sur Rome : **12 vignettes de liste +
  3 podium** rendues. Self-élision propre quand `hotel_hero_image` est null (placeholder span).
- **`ItemList` JSON-LD** : chaque item porte `image` (Cloudinary 1200×800) + `GeoCoordinates`
  quand lat/long présents → carrousel rich-result avec vignette + pin.

### 2.3 ⚠ `alt` des vignettes de liste — non enrichi (Hard Rule 16)

| Surface                          | `alt` émis                                | Conforme Hard Rule 16 ?          |
| -------------------------------- | ----------------------------------------- | -------------------------------- |
| Podium top-3 (`rk-podium`)       | **« Hotel Hassler, Rome »** (nom + ville) | ✅                               |
| Vignettes de liste (`.cr-photo`) | **« Hotel Hassler »** (nom seul)          | 🟡 **non** — ni ville ni mot-clé |

Code : la liste fait `alt={name}` (`page.tsx` l.833) alors que le podium fait
`alt = ${podiumName}, ${city}` (l.608-612). **Seul gap image** de l'audit : harmoniser l'`alt`
de liste sur le pattern enrichi du podium (nom + ville). Aucune image manquante, aucun
`og:image` placeholder.

---

## 3. Axe C — « Ressort bien » (signaux SEO/GEO)

### 3.1 On-page — sain sur tout l'échantillon (live `curl`)

| Signal                                 | Rome EN                                                | Rome FR          | hotel-de-luxe-rome EN | palaces-paris-8 FR |
| -------------------------------------- | ------------------------------------------------------ | ---------------- | --------------------- | ------------------ |
| `<title>` multi-pattern                | ✅ « Best Hotels in Rome 2026: Luxury & 5-Star Picks » | ✅               | ✅                    | ✅                 |
| `meta description`                     | ✅                                                     | ✅               | ✅                    | ✅                 |
| `canonical` self-référent              | ✅ /en/…                                               | ✅ /classement/… | ✅                    | ✅                 |
| `hreflang` réciproques                 | ✅ `fr-FR`+`en`+`x-default` (3)                        | ✅               | ✅                    | ✅                 |
| JSON-LD `ItemList`                     | ✅                                                     | ✅               | ✅                    | ✅                 |
| JSON-LD `FAQPage`                      | ✅                                                     | ✅               | ✅                    | ✅                 |
| JSON-LD `Article`                      | ✅                                                     | ✅               | ✅                    | ✅                 |
| **`Speakable`** (ajouté cette session) | ✅ présent                                             | ✅               | ✅                    | ✅                 |

`Speakable` confirmé présent dans le JSON-LD `Article`
(`speakableSelectors: ['.rk-page-head h1', '[data-aeo="factual-summary"]', '#tldr', '#faq']`).

**`slug_en` déferral** : l'URL EN garde le slug FR (`/en/classement/meilleurs-hotels-rome`).
Pas de duplicate — `canonical` self-référent + `hreflang` réciproques corrects. Conforme à la
note de l'audit EN (G1/CT2 différé, non bloquant).

### 3.2 GSC 28 j (2026-05-30 → 2026-06-27) — on apparaît, on ne convertit pas

~38 pages classement avec impressions ; **~682 impressions / 4 clics** au total.

| Page classement                                |    Impr | Clics | Position |
| ---------------------------------------------- | ------: | ----: | -------: |
| `palaces-de-france-2026` (awarded)             | **130** |     2 |  **7,8** |
| `meilleurs-palaces-paris`                      |      57 |     0 |     18,1 |
| `meilleurs-hotels-famille-france`              |      38 |     0 |     10,8 |
| `meilleurs-palaces-courchevel`                 |      35 |     0 |     12,9 |
| `/en/…bord-de-mer-cote-atlantique`             |      32 |     0 |     15,7 |
| `/en/…palaces-paris-8`                         |      31 |     0 |     14,1 |
| `/en/…kids-friendly-paris-16`                  |      28 |     0 |     17,3 |
| `/en/…charme-bretagne`                         |      22 |     0 |     26,2 |
| `/en/…romantiques-saint-tropez`                |      21 |     0 |     12,1 |
| `/en/…famille-luberon`                         |      20 |     0 |     12,7 |
| **`/en/…meilleurs-hotels-rome`** (tête volume) | **105** |     1 | **40,1** |

### 3.3 SERP EN « best hotels in rome » — toujours page 4-5

Le cluster Rome (notre seul vrai gisement volume EN) reste **pos 43-50, 0 clic** :
`best hotels in rome` **pos 44,4** (22 impr), `best hotels rome` 43,2, `best hotel in rome`
46,5, `top hotels rome` 39,8, `best rome hotels` 44,5. **Aucun mouvement** depuis l'audit EN
(le title multi-pattern vient d'être appliqué ; le facteur bloquant est l'**autorité/maillage**,
pas l'on-page ni le contenu — `best hotels in rome` KD=7). GEO : `FAQPage` + `Speakable` émis,
mais `llms.txt` reste FR-only sur les classements (angle mort LLM EN, cf. audit EN §4).

---

## 4. Liste priorisée des gaps + pipeline de correction

| Prio   | Gap                                                                                                  | Volume                                    | Pipeline de correction (chemin exact)                                                                                                                                                                                                                               |
| ------ | ---------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0** | `intro_en` STUB une phrase au lieu du long-read                                                      | **795 / 863 (92 %)**                      | `scripts/editorial-pilot/src/rankings/translate-rankings-intro-factual-en.ts --force` (réécrit le stub ≥ 80 c en long-read en-GB fidèle au FR grounded ; `hasLeak()=0`). Déjà éprouvé sur les 6 luxe-heads cette session — généraliser au reste du parc par vagues. |
| **P1** | `justification_en` stub (< 130 c)                                                                    | **2 912 entrées / 274 classements 100 %** | `scripts/editorial-pilot/src/rankings/enrich-ranking-justifications.ts --min-en=130` (pour les entrées FR concrètes + EN stub ; le mode `--generic-only` ne les cible pas — cf. skill matrix). Grounded sur la row hôtel, `hasLeak()`-gaté, PostgREST-only.         |
| **P1** | `editorial_sections` ≥1 sans EN (`title_en`/`body_en`)                                               | **272 / 863 (31,5 %)**                    | `scripts/editorial-pilot/src/rankings/enrich-ranking-sections-only.ts` (régénère/complète les sections bilingues sans détruire entrées ni FAQ) ou un pass de traduction EN dédié des sections.                                                                      |
| **P2** | FAQ ≥1 sans EN                                                                                       | 40 / 863 (4,6 %)                          | `scripts/editorial-pilot/src/rankings/enrich-ranking-faq-en-grounded.ts` (parité EN + grounding DataForSEO + gate couverture PAA `evaluatePaaCoverage`).                                                                                                            |
| **P2** | Cohorte 14 têtes : `meta_title_*` null + `outro_en` null + FAQ < 10 (dont `meilleurs-hotels-london`) | 14 rows                                   | `run-ranking-meta-desc.ts` / `meta-desc-generator.ts` (meta) + `enrich-ranking-faq-en-grounded.ts` (FAQ → ≥ 10/12) — re-générer ce lot via `run-rankings-v2-bulk.ts --only-file=` sur ces 14 slugs.                                                                 |
| **P2** | `alt` des vignettes de liste = nom seul (Hard Rule 16)                                               | toutes les listes                         | Code `apps/web/src/app/[locale]/classement/[slug]/page.tsx` l.833 : aligner `alt={name}` sur le pattern podium `${name}, ${city}` (changement render, hors-DB).                                                                                                     |
| **P2** | 1 classement sous le plancher (2 entrées)                                                            | `meilleurs-hotels-piscine-venise`         | dépublier OU regénérer via `run-rankings-v2-bulk.ts` quand l'éligibilité ≥ 3 (ratchet).                                                                                                                                                                             |
| **P2** | tête `intro_fr` < 800 c                                                                              | 3 rows                                    | balayage manuel / `enrich-ranking-sections-only.ts`.                                                                                                                                                                                                                |

**Note grounding (règle PO DataForSEO)** : `dfs_paa_coverage` n'étant pas persisté en colonne,
toute régénération FAQ/sections doit passer par les runners **grounded** (`enrich-ranking-faq-en-grounded.ts`,
`enrich-ranking-faq-grounded.ts`) qui chargent `groundKeywords(locale)` + appliquent
`evaluatePaaCoverage` post-génération (cf. `.cursor/rules/dataforseo-content-grounding.mdc`).

---

## 5. Verdicts synthétiques

- **Complétude FR** : ✅ **excellente** (intro long-read, 4-8 sections, 12 FAQ, justifications
  936 c, factual_summary 100 %, 0 trou structurel — 1 seul classement sous le plancher d'entrées).
- **Parité EN** : 🔴 **insuffisante** — l'EN a les scalaires (title/meta/factual_summary 100 %)
  mais **le corps long-read EN manque massivement** : intro 92 % stub, 31,5 % de sections sans
  EN, 38 % de justifications EN en une phrase. C'est le chantier n°1.
- **Image** : ✅ **très bon** — `og:image` réel 1200×630 sur 100 % du parc, vignettes + podium
  - `ItemList.image` rendus, **un seul bémol** : alt de liste non enrichi (nom seul).
- **« Ressort bien »** : 🟡 on-page **irréprochable** (title multi-pattern, hreflang réciproques,
  `ItemList`+`FAQPage`+`Article`+`Speakable`), mais **conversion nulle** faute d'autorité —
  Rome volume bloqué pos 40-44, 4 clics sur tout le parc classement / 28 j. Le contenu n'est
  pas le frein ; l'autorité + le maillage le sont (cf. `en-seo-geo-audit-2026-06-29.md`).

---

_Audit lecture seule — chiffres ancrés sur counts PostgREST réels (863 classements / 7 579
entrées), 4 walks live `curl`, et GSC 28 j. Estimations explicitement labellisées._
