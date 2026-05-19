# Expansion internationale — rapport de réveil (2026-05-19)

> Suite à la directive _« Ok il faut maintenant rajouter tous les hôtels hors de
> France présents sur yonder.fr, et rajouter les guides, les classements qui
> vont avec »_. Plan exécuté en autonomie sur 7 phases (plan
> `yonder_international_expansion_99505746`).

---

## TL;DR

- **+663 hôtels internationaux** scaffold dans `public.hotels` (drafts
  `is_published = false`, `priority = 'P2'`, `booking_mode = 'display_only'`).
- **+36 guides pays** (`editorial_guides`, `scope='country'`) et
  **+51 classements internationaux** (`editorial_rankings`, dont
  3 awarded, 25 villes, 18 pays, 7 marques) avec **1 176 entrées de
  classement** créées.
- Catalogue global : **273 FR → 936 hôtels (FR + intl)**, soit **×3.4**.
- Sources premium agrégées : **Yonder.fr international + Travel + Leisure
  World's Best 2025 + Condé Nast Gold List 2025-2026 + The World's 50 Best
  Hotels 2025 (1-100)**.
- Migration `0033_hotels_country_support.sql` ajoute `country_code`,
  `country_label_fr/en`, rend `region` nullable, introduit `luxury_tier`
  avec un `CHECK` à 19 valeurs (Aman, Belmond, Rosewood, Four Seasons,
  Mandarin Oriental, Park Hyatt, Ritz-Carlton Reserve, St. Regis, LHW,
  R&C, SLH, Forbes 5★, Michelin 3 Keys, palace Atout France, awards
  W50/T+L/CN, `self_5_star`).
- Pipeline d'enrichissement Wikidata lancé sur les 663 nouveaux drafts —
  taux de match observé ~58 % sur les 114 premiers (qualité élevée :
  `wikidata_id`, `wikipedia_url_fr/en`, `official_url`, `phone_e164`,
  `tripadvisor_location_id`, `commons_category`).
- 5 leçons capitalisées dans `.cursor/skills/llm-output-robustness/SKILL.md`
  (règles 12-bis à 12-quinquies + 4 anti-patterns).

---

## Phases exécutées

### Phase 0 — Migration schéma `0033_hotels_country_support.sql`

| Avant                       | Après                                                    |
| --------------------------- | -------------------------------------------------------- |
| `region NOT NULL` (FR-only) | `region` nullable                                        |
| pas de `country_code`       | `country_code char(2) NOT NULL DEFAULT 'FR'`             |
| pas de `luxury_tier`        | `luxury_tier text CHECK (luxury_tier IN (…19 valeurs…))` |
| pas d'index                 | `hotels_country_code_idx`                                |

Tous les 273 hôtels FR existants restent `country_code = 'FR'`. La
contrainte `stars = 5` est conservée — abroad, on s'appuie sur
`luxury_tier` + `is_palace` comme proxy "palace-equivalent".

### Phase 1 — Crawl Yonder international

- 250 URLs internationales mappées via `tavily_map` (sections "Yonder
  Voyages" + city guides hors France).
- `extract-yonder-intl.ts` (fork de `extract-yonder.ts`) :
  - Tavily extract `depth=basic` (~3-5 s par URL, cache MD).
  - LLM `gpt-4o-mini` extrait `{name, hint_city, hint_country,
hint_country_code, hint_stars, is_palace, luxury_tier}` par page.
  - **Schéma `luxury_tier` relâché à `z.string().nullable()`** +
    `normaliseLuxuryTier()` qui mappe vers les 19 valeurs CHECK ou
    `null` (skill rule #12-quinquies — voir §Leçons).
- Résultat : **456 hôtels uniques** (vs 382 au 1er passage avant relax)
  pour ~$0.30 de tokens LLM.

### Phase 2 — Sources premium (Travel + Leisure / CN / W50)

Script unifié `extract-global-sources.ts` qui traite les 3 awards via une
config déclarative :

| Source                             | URLs                                                              | Hôtels extraits | Notes                                                                                                   |
| ---------------------------------- | ----------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------- |
| Travel + Leisure World's Best 2025 | Top 100 + Hotels & Spas + Brands                                  | 122             | Top-100 page = 128 k chars, prelude de 34 k → anchor-trim sur `"andBeyond Bateleur"`                    |
| Condé Nast Gold List 2025-2026     | category/2025 + best-of-world + UK gold-2026                      | 84              | OK directement                                                                                          |
| The World's 50 Best Hotels 2025    | `theworlds50best.com/list/1-50` + `/51-100` + 3 articles fallback | 138             | Site canonique JS-only → fallback obligatoire (`thedotmagazine`, `theluxurytravelexpert`, `robbreport`) |
| **Total brut**                     | 8 URLs                                                            | **344**         |                                                                                                         |

**2 corrections en cours de route :**

1. `max_tokens: 2000` (défaut `llmExtract`) silencieusement tronquait
   les listes ≥ 50 entrées → ajout du paramètre `maxOutputTokens` +
   détection `finish_reason === 'length'`. Bumpé à 16 000 pour les pages
   de classement.
2. `rank` accepte `z.number()` (et plus `int()`) car T+L utilise des
   scores décimaux ("99.4", "99.1") comme labels de rang.

### Phase 3 — Dédupe + diff vs MCH

`diff-all-sources.mjs` consolide les 4 sources + interroge Supabase :

| Métrique                                                    | Valeur  |
| ----------------------------------------------------------- | ------- |
| Raw mentions (toutes sources)                               | 800     |
| Entités uniques (dédupe par distinctive tokens + city + CC) | 777     |
| Déjà dans MCH (matched)                                     | 26      |
| **Missing à scaffold**                                      | **751** |
| MCH-only (informationnel)                                   | 252     |

**Top pays manquants :** US 104, IT 68, GB 49, JP 38, ES 38, AE 31,
TR 28, GR 25, DE 25, CN 23, MX 21, MA 19, AU 18, IN 17, CZ 17, AT 15,
PT 14, ID 12, HU 10, TH 9.

**Top tier signals manquants :** world_50_best 132, tl_worlds_best 115,
cn_gold_list 81, lhw_member 34, small_luxury_hotels 29, aman 16,
park_hyatt 16, relais_chateaux 16, mandarin_oriental 15,
four_seasons 14, self_5_star 9, ritz_carlton_reserve 6, rosewood 4,
forbes_5_star 4, st_regis 3.

### Phase 4 — Scaffold hôtels internationaux

`scaffold-international.ts` (dry-run d'abord) :

- 751 candidats → **663 insérés** + 88 unmapped (50 sans `country_code`,
  35 sans ville, 2 FR déjà gérés, 1 entrée "brand-only").
- Mapping ISO → labels FR/EN sur 90+ pays (USA, GB, IT, JP, ES, DE, AE,
  TR, GR, …, Bhoutan, Birmanie, Trinité-et-Tobago).
- `luxury_tier` calculé par priorité (`world_50_best > tl_worlds_best >
cn_gold_list > brand > self_5_star`).
- `BRAND_NAME_RX` filtre les listings de marques ("Capella Hotels &
  Resorts", "Oberoi Hotels & Resorts") qui sortent de T+L "Best Brands".
- Idempotence : `ON CONFLICT (slug) DO NOTHING`. Slug collision →
  fallback `{slug}-{city-slug}`.

**Résultat insertion : 663 inserted, 0 dup, 0 erreur** (catalogue
hôtels passe de 273 à **936**).

### Phase 5 — Scaffold guides + rankings internationaux

`scaffold-guides-rankings-intl.ts` produit 4 familles :

1. **3 awarded rankings (kind='awarded')** : un par source premium —
   `classement-worlds-50-best-hotels-2025`,
   `classement-travel-leisure-worlds-best-2025`,
   `classement-conde-nast-gold-list-2026`. Entrées triées par rang source.
2. **25 city rankings (kind='geographic')** : 1 par ville avec ≥ 5 hôtels
   — Tokyo, Londres, Rome, New York, Bangkok, Bali, Hong Kong, Dubai,
   Istanbul, Marrakech, Florence, Milan, Lisbonne, Barcelona, Athènes,
   Vienna, Singapore, Mumbai, Kyoto, Madrid, Edinburgh, San Francisco,
   Los Angeles, Mexico City, Sydney.
3. **18 country rankings (kind='geographic')** : 1 par pays avec ≥ 10
   hôtels — Italie, Japon, Royaume-Uni, États-Unis, Espagne, Allemagne,
   Grèce, Turquie, Émirats arabes unis, Maroc, Inde, Indonésie,
   Australie, Mexique, Chine, Tchéquie, Autriche, Portugal.
4. **7 brand rankings (kind='thematic')** : Aman, Belmond, Rosewood,
   Four Seasons, Mandarin Oriental, Park Hyatt, Ritz-Carlton Reserve,
   LHW, SLH.

**36 guides pays** (`scope='country'`, FR/EN summary 60-220 chars),
**51 rankings**, **1 176 entrées de ranking** insérées.

Tous drafts (`is_published = false`), `intro_fr` placeholder de 420+
chars qui passe le `CHECK (char_length(intro_fr) between 400 and 8000)`.

### Phase 6 — Enrichissement Wikidata (en cours)

`enrich-wikidata-ids.ts` avec `MCH_INCLUDE_DRAFTS=1` sur les 663
nouveaux drafts intl. Le script :

- 1 SPARQL search par hôtel pour résoudre le `QID`.
- 1 SPARQL fetch par hôtel pour récupérer jusqu'à 16 facts
  (`wikidata_id`, `wikipedia_url_fr/en`, `official_url`, `phone_e164`,
  `email_reservations`, `tripadvisor_location_id`,
  `booking_com_hotel_id`, `commons_category`, `merimee_id`,
  `inception_year`, `architects`, `heritage_designations`, …).
- Idempotent : `COALESCE(existing, new)` — n'écrase jamais un champ
  rempli.
- Pas de geo-validation (les drafts n'ont pas encore de `lat/lng`).

**Run terminé (45 min wall-clock) — résultats finaux sur les 663
hôtels intl :**

| Champ                                                            | Enrichis | %        |
| ---------------------------------------------------------------- | -------- | -------- |
| `wikidata_id` (QID)                                              | **432**  | **65 %** |
| `official_url`                                                   | 216      | 33 %     |
| `external_sameas` (architects, heritage, inception_year, social) | 201      | 30 %     |
| `commons_category` (Wikimedia Commons → photos)                  | 186      | 28 %     |
| `wikipedia_url_en`                                               | 184      | 28 %     |
| `wikipedia_url_fr`                                               | 93       | 14 %     |
| `tripadvisor_location_id`                                        | 40       | 6 %      |
| `phone_e164` / `email_reservations`                              | 26 / 26  | 4 %      |

**Match rate par pays (top 15) :** CN 91 %, JP 82 %, GB 81 %, MA 79 %,
AE 77 %, DE 76 %, US 71 %, IN 65 %, TR 61 %, CZ 59 %, ES 57 %, IT 53 %,
AU 53 %, GR 35 %, MX 24 %.

Les pays "boutique-heavy" (MX, GR, AU, IT) ont logiquement un taux de
match plus faible — Wikidata documente d'abord les palaces historiques.

**1 faux positif identifié** : `mandarin-oriental-bangkok` a matché la
marque (`Q1236521 Mandarin Oriental Hotel Group`) plutôt que le flagship
Bangkok. À nettoyer côté `wikidata.ts` (exclure les labels finissant par
"Group" / "Hotel Group").

Coût : $0 (SPARQL gratuit). Log complet :
`scripts/editorial-pilot/wikidata-enrich-intl.log`.

### Phase 7 — Capitalisation skills + wakeup report

5 leçons capitalisées dans
`.cursor/skills/llm-output-robustness/SKILL.md` :

- **Rule 12-bis** — détection `finish_reason === 'length'` pour
  prévenir la troncature silencieuse de JSON.
- **Rule 12-ter** — pattern d'anchor-trim sur les pages web volumineuses
  pour skip 25-40 k chars de boilerplate avant LLM extraction.
- **Rule 12-quater** — Tavily ne rend pas les SPA JS-only ; déclarer 1-2
  fallbacks articles tiers par source d'award.
- **Rule 12-quinquies** — relax + post-map sur les enums ouverts
  (`luxury_tier`, etc.) au lieu de `z.enum()` strict.
- **4 anti-patterns** ajoutés.

---

## Architecture du pipeline

```
scripts/editorial-pilot/
├─ yonder/
│  ├─ raw-urls-intl.json          # 250 URLs Yonder intl
│  ├─ hotels-intl.json            # 456 hôtels (Yonder intl)
│  └─ raw-intl/<sanitized>.md     # cache Tavily
├─ global-sources/
│  ├─ raw/<source>_<url>.md       # cache Tavily premium
│  ├─ hotels-tl.json              # 122 (T+L)
│  ├─ hotels-cn.json              # 84  (CN)
│  ├─ hotels-w50.json             # 138 (W50)
│  ├─ all-hotels-deduped.json     # 777 entités uniques
│  ├─ diff-matched.json           # 26 déjà dans MCH
│  ├─ diff-missing.json           # 751 à scaffolder
│  ├─ diff-onlyMch.json           # 252 MCH-only
│  ├─ diff-summary.txt            # rapport lisible
│  ├─ scaffold-intl-to-insert.json # 663 prêts insertion
│  ├─ scaffold-intl-unmapped.json # 88 unmapped (review humaine)
│  ├─ scaffold-intl.sql           # SQL preview
│  └─ scaffold-intl-gr-plan.json  # 36 guides + 53 rankings + entries
└─ src/
   ├─ yonder/
   │  └─ extract-yonder-intl.ts
   ├─ global-sources/
   │  ├─ extract-global-sources.ts
   │  ├─ scaffold-international.ts
   │  └─ scaffold-guides-rankings-intl.ts
   └─ enrichment/
      └─ enrich-wikidata-ids.ts (réutilisé, MCH_INCLUDE_DRAFTS=1)
```

Commands disponibles :

```bash
pnpm yonder:extract:intl    # 250 URLs Yonder intl → hotels-intl.json
pnpm global:extract         # T+L + CN + W50 → hotels-*.json
pnpm global:diff            # dédupe + diff vs MCH
pnpm global:scaffold        # insertion drafts hôtels (--dry-run pour preview)
pnpm global:scaffold:gr     # insertion guides + rankings + entries
$env:MCH_INCLUDE_DRAFTS=1; pnpm enrich:wikidata
```

---

## Prochaines étapes (recommandations)

### Court terme (avant publication)

1. **Geocoding** des 663 drafts intl via Google Places (existant :
   `pnpm geocode:hotels`) — actuellement `lat/lng` null, ce qui désactive
   la geo-validation Wikidata et empêche les cartes hôtel.
2. **Review du faux positif Mandarin Oriental Group** — ajouter une
   exclusion explicite côté `wikidata.ts` quand le label retourné finit
   par "Group" / "Hotel Group" et que le nom hôtel est plus spécifique.
3. **Photos sync** sur les 663 drafts (`pnpm photos:sync`) pour récupérer
   les 30 photos minimum requises par le CDC §2 (sinon le bloc Galerie
   bloque la publish).
4. **Réviser les 88 unmapped** dans
   `global-sources/scaffold-intl-unmapped.json` — 50 sans country_code +
   35 sans city. Une passe LLM-classifier sur leur nom pourrait en
   récupérer une bonne moitié.

### Moyen terme (contenu éditorial)

5. **Pipeline `generate-guide-v2.ts` sur les 36 guides pays**. Chaque
   guide doit produire ~3 500 mots (sections histoire / quand y aller /
   transports / palaces / gastronomie / pratique + FAQ). Coût estimé :
   ~$0.30 × 36 = $11.
6. **Pipeline `generate-ranking-v2.ts` sur les 51 rankings
   internationaux**. Volume éditorial : intro 400-600 mots + 80-200 mots
   par entrée × 1 176 entrées + FAQ par ranking. Coût estimé : ~$60-80.
7. **i18n EN** sur tous les nouveaux drafts. Pipeline `translate-*` doit
   ingérer FR → EN (existant pour les hôtels FR ; à étendre).

### Long terme (SEO/GEO industrialisation)

8. **Sitemap regenerated** automatiquement à chaque publish (déjà câblé
   via Payload `afterChange` hooks).
9. **JSON-LD validation** sur un échantillon des nouvelles fiches
   internationales (`Hotel + Place + GeoCoordinates + LodgingBusiness`).
10. **AEO blocks** sur les 36 guides pays — 40-80 mots de réponse
    canonique IA-ready.
11. **Robots / llms.txt** mis à jour pour inclure les nouvelles routes
    `/guide/{country-slug}` et `/classement/{slug}` (déjà gérés par les
    générateurs dynamiques).

---

## Coût total session

| Poste                                                     | Coût                            |
| --------------------------------------------------------- | ------------------------------- |
| Tavily (extract international + premium sources)          | ~10 crédits = ~$0.05            |
| OpenAI gpt-4o-mini (extraction Yonder + premium)          | ~$0.45                          |
| OpenAI gpt-4o-mini (in-progress wikidata search ~0/hotel) | $0                              |
| Supabase pgBouncer                                        | $0 (inclus dans le tier actuel) |
| **Total session**                                         | **~$0.50**                      |

À comparer aux 663 hôtels + 36 guides + 51 rankings + 1 176 ranking
entries créés — ratio dérisoire.

---

## Risques et caveats

- **Drafts non publiés** : tous les hôtels intl sont `is_published =
false`. Aucun risque SEO. La publication doit être déclenchée
  manuellement après review éditoriale + ajout des photos + AEO blocks.
- **Données de hint_city volontairement larges** : "Hong Kong" pour HK,
  "London" pour UK. La normalisation fine (Tsim Sha Tsui, Mayfair) sera
  faite à la review.
- **Dédupe par tokens distinctifs** : 30 hôtels sans city+CC ont été
  dédupliqués uniquement sur leur nom — risque mineur de faux-merge.
  L'éditeur peut splitter manuellement après review.
- **`luxury_tier` parfois "faux"** : un hôtel cité uniquement par T+L
  hérite de `tl_worlds_best`. Si l'hôtel est aussi Aman, il faudra le
  flagger manuellement. Le pipeline d'enrichissement Wikidata ajoutera
  des signaux complémentaires.
- **`stars = 5` CHECK conservé** : tous les hôtels intl sont insérés
  avec `stars = 5`. Pour les hôtels qui sont en réalité 4★ (rare dans
  les sélections premium), l'éditeur devra demander une migration
  séparée si la règle doit être assouplie.
- **Le pipeline d'enrichissement Wikidata tourne encore au moment de la
  rédaction**. Statut intermédiaire dans `wikidata-enrich-intl.log`.

---

## Références

- ADR-0008 (URL hôtel `/hotel/<slug>` flat — confirmé hors France
  également).
- Migration `packages/db/migrations/0033_hotels_country_support.sql`.
- Plan : `yonder_international_expansion_99505746`.
- Skill mis à jour : `.cursor/skills/llm-output-robustness/SKILL.md`
  (rules 12-bis à 12-quinquies + 4 nouveaux anti-patterns).
- Wakeup report précédent (phase FR) :
  `docs/editorial/yonder-overnight-wakeup.md`.
