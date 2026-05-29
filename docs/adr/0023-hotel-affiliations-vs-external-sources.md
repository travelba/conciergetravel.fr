# ADR 0023 — `hotels.affiliations` séparé de `hotels.external_sources`

- Status: accepted
- Date: 2026-05-28
- Refs:
  - Migrations `0038_hotels_source_layering.sql`,
    `0062_hotels_affiliations_column.sql`,
    `0063_hotels_affiliations_complete_backfill.sql`
  - Schéma Zod : [`packages/db/src/schema/affiliations.ts`](../../packages/db/src/schema/affiliations.ts)
  - Audit source : [`canvases/audit-luxury-tier-vs-labels.canvas.tsx`](../../canvases/audit-luxury-tier-vs-labels.canvas.tsx)
  - Rules : [`seo-geo`](../../.cursor/rules/seo-geo.mdc), [`hotel-detail-page`](../../.cursor/rules/hotel-detail-page.mdc), [`architecture-layers`](../../.cursor/rules/architecture-layers.mdc)
  - Skills : `content-modeling`, `supabase-postgres-rls`, `structured-data-schema-org`

## Décision

La table `public.hotels` reçoit une nouvelle colonne `affiliations jsonb`
qui stocke les liens **du hôtel vers une entité tierce qui confère son
positionnement** — marque opérationnelle, label/consortium, classement
annuel, guide curatorial. La colonne `external_sources` (migration 0038)
**revient à sa sémantique d'origine** : provenance de faits éditoriaux
injectés dans le brief LLM (`{field, value, source, confidence,
collected_at}`).

Forme canonique de chaque entrée `affiliations[]` (validation Zod via
[`HotelAffiliationSchema`](../../packages/db/src/schema/affiliations.ts)) :

```json
{
  "kind": "brand" | "label" | "ranking" | "guide",
  "source": "snake_case_slug",
  "display_name": "Texte UI / JSON-LD award.name",
  "verified": true,
  "since_year": 2018,
  "source_url": "https://...",
  "facet_slug": "kebab-case-slug",
  "scraped_at": "2026-05-28T...Z",
  "metadata": { ... }
}
```

Quatre `kind` ont des règles d'usage différentes :

| `kind`    | Cardinalité par hôtel | Exemples                                                                                                                         | Conséquence UI / SEO                                                        |
| --------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `brand`   | ≤ 1                   | Aman, Four Seasons, Oetker Collection, Dorchester Collection, Cheval Blanc, Grecotel                                             | `/marque/[facet_slug]`, `luxury_tier` mirroré, `Hotel.brand` JSON-LD        |
| `label`   | N                     | Relais & Châteaux, Atout France Palaces, Forbes Five-Star, Leading Hotels of the World, Small Luxury Hotels, Michelin Three Keys | `/label/[facet_slug]` (à venir), `Hotel.award[]` JSON-LD, badges fiche EEAT |
| `ranking` | N                     | Travel + Leisure World's Best, Condé Nast Gold List, World's 50 Best Hotels                                                      | Badges visuels avec année, mention dans `Hotel.award[]`, blocs éditoriaux   |
| `guide`   | N                     | Tablet Hotels (à venir), Mr & Mrs Smith (à venir)                                                                                | Mention sobre, pas de facet dédié                                           |

## Contexte

L'audit du 2026-05-28
([`canvases/audit-luxury-tier-vs-labels.canvas.tsx`](../../canvases/audit-luxury-tier-vs-labels.canvas.tsx))
a révélé deux sémantiques superposées sur la colonne `external_sources`
(migration 0038) :

1. **Sémantique originale (0038)** — provenance des faits éditoriaux. Une
   entrée par fait injecté dans le brief LLM (`{field: 'rooms_count',
value, source: 'wikidata', confidence, collected_at, deprecated_by}`).
   **0 entrées en production** au moment de l'audit ; la sémantique
   n'avait jamais été activée par un pipeline d'enrichissement.

2. **Sémantique opportuniste** — trace de scaffold marque / label, née
   de la migration 0059 (chain XLSX scaffolding). Une entrée par
   affiliation (`{source: 'luxury_chain_xlsx', chain_facet_slug,
chain_display_name}` ou `{source: 'relais_chateaux', metadata, ...}`).
   **1472 entrées en production** (976 xlsx + 470 R&C + 26 Grecotel).

Les deux usages sont structurellement incompatibles :

- (1) décrit _des faits_ (cardinalité = un par `field`).
- (2) décrit _des identités tierces_ (cardinalité = un par affiliation,
  cumulatif pour les labels).

Par ailleurs, **44 % du catalogue** (979 / 2 219 hôtels) avait son
affiliation primaire stockée dans `luxury_tier` (colonne single-value).
Pour des hôtels multi-affiliés (Le Bristol = Oetker + Palace Atout
France + Forbes Five-Star + Travel+Leisure), une seule des dimensions
était reflétée. La requête JSON-LD `Hotel.award[]` était donc structurellement
sous-spécifiée.

## Alternatives considérées

**Alternative A — Garder `external_sources`, y ajouter un champ
`kind`.** Rejetée. Ferait collisionner les deux sémantiques sur la même
colonne ; le `kind` discriminerait entre fait et affiliation, mais
n'aiderait pas la requête JSON-LD `Hotel.award[]` (qui devrait filtrer
par `kind != 'fact'`). Pollue aussi les pipelines d'enrichissement de
faits (Wikidata, Tavily) avec un champ qu'ils n'utilisent pas.

**Alternative B — Migrer toutes les affiliations dans une colonne
`luxury_tier_array text[]`.** Rejetée. Les labels ont des métadonnées
riches (`since_year`, `source_url`, `display_name`) qu'un simple tableau
de texte ne peut pas porter. La normalisation en table relationnelle
distincte (`hotel_affiliations`) a été aussi rejetée — surcoût de joins
sur chaque lecture sans bénéfice net vs JSONB.

**Alternative C — Une seule colonne `affiliations jsonb`, avec les
provenance de faits aussi dedans.** Rejetée. Confond deux concepts qui
ont des lifecycles différents : les faits sont collectés par batch
d'enrichissement (Wikidata mensuel, Tavily annuel), les affiliations
sont stables sur 5-10 ans (un label rejoint en 2018 reste). Mélanger
les deux complique les hooks `revalidateTag` et les vue admin Payload.

## Conséquences

### Positives

- **JSON-LD `Hotel.award[]`** : `packages/seo/jsonld/hotel.ts` lit
  `affiliations.filter(a => a.kind in ['label', 'ranking'] && a.verified)`
  pour émettre un `award` par certification. Le multi-affiliated case
  (Bristol, Meurice, Mamounia) émet enfin tous ses awards.
- **Facets `/marque/[brandSlug]` et `/label/[labelSlug]`** : la première
  existe déjà ; la seconde est planifiée Phase 4. Les deux lisent depuis
  `affiliations` filtrée par `kind`. Plus de risque de doublon de slugs.
- **Pipelines d'ingestion** :
  [`fetch-atout-france-palaces.ts`](../../scripts/editorial-pilot/src/global-sources/),
  `fetch-forbes-5-star.ts`, `fetch-michelin-keys.ts`,
  `fetch-leading-hotels.ts`, `fetch-slh.ts` (à venir) écrivent dans
  `affiliations` avec leur `kind` propre. Les multi-affiliations s'accumulent
  proprement.
- **Voix éditoriale `<ConciergeAdvice>`** et blocs `TrustSignals` lisent
  `affiliations.kind = 'label' && verified` pour leurs badges. Plus de
  fallback ad-hoc sur `luxury_tier`.
- **`luxury_tier`** reste un signal **single-value** : la marque
  primaire (`oetker_collection`, `grecotel`) OU le label primaire
  historique (`relais_chateaux`, `world_50_best` pour les hôtels sans
  marque), ou `self_5_star` pour les indépendants. Il sera resserré aux
  vraies marques Phase 4 (Option B) en migration séparée.
- **`external_sources`** redevient utilisable par les pipelines Tavily
  - Wikidata pour leur usage prévu — la prochaine vague d'enrichissement
    factuel.

### Neutres

- Migration **backfill** : 1466 hôtels ont reçu une entrée
  `affiliations` dérivée d'`external_sources` (migration 0062), 332 hôtels
  supplémentaires ont reçu une entrée dérivée de leur `luxury_tier`
  (migration 0063). Total : **1798 hôtels** avec ≥ 1 affiliation
  (`brand` 846, `label` 754, `ranking` 271). Coût migration : ~ 5 s
  d'`UPDATE` sur 2 219 lignes.
- Le pattern `external_sources` étant encore référencé par plusieurs
  scaffolds (`scaffold-relais-chateaux.ts`, `scaffold-by-chain.ts`),
  ces scripts doivent être mis à jour si ré-exécutés. Le scaffold
  Grecotel a déjà été migré dans cette PR.

### Négatives

- **Dette résiduelle Phase 4 (Option B)** : `luxury_tier` héberge encore
  des labels (`relais_chateaux` 435 lignes, `world_50_best` 127, etc.).
  Un futur ADR migrera ces 979 lignes vers `luxury_tier = NULL` (ou la
  marque primaire si connue) + entrée `affiliations` correspondante.
  Le `CHECK` `hotels_luxury_tier_check` sera resserré aux vraies marques
  uniquement. C'est documenté comme Option B dans le canvas audit ;
  estimation 5-7 j d'effort.
- Deux colonnes JSONB sur `public.hotels` au lieu d'une — la lisibilité
  baisse marginalement côté Payload admin (deux UI fields à maintenir).
  Compensé par des `Type Override` Payload qui restituent les deux
  comme rich-text editors séparés.

## Migration plan

| Étape | Date       | Migration                                                   | Impact                                                                          |
| ----- | ---------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1     | 2026-05-28 | `0062_hotels_affiliations_column.sql`                       | Ajoute la colonne + GIN index + backfill depuis `external_sources` (1466 rows)  |
| 2     | 2026-05-28 | `0063_hotels_affiliations_complete_backfill.sql`            | Fix SLH `kind=brand` → `label` (199 rows) + backfill depuis `luxury_tier` (332) |
| 3     | Phase 1.5  | Pipelines `fetch-{atout-france,forbes,michelin,lhw,slh}.ts` | Ingest les affiliations publiques manquantes (~ 2 000 entrées nouvelles)        |
| 4     | Phase 4    | ADR-00XX + migration : `luxury_tier` purgé des labels       | Resserre le CHECK aux marques ; route `/label/[labelSlug]`                      |

## Références

- Audit complet et chiffres : [`canvases/audit-luxury-tier-vs-labels.canvas.tsx`](../../canvases/audit-luxury-tier-vs-labels.canvas.tsx)
- Schéma Zod : [`packages/db/src/schema/affiliations.ts`](../../packages/db/src/schema/affiliations.ts)
- Tests : [`packages/db/src/schema/affiliations.test.ts`](../../packages/db/src/schema/affiliations.test.ts)
- Migrations SQL : [`packages/db/migrations/0062_*.sql`](../../packages/db/migrations/0062_hotels_affiliations_column.sql) + [`0063_*.sql`](../../packages/db/migrations/0063_hotels_affiliations_complete_backfill.sql)
- Skills : `content-modeling`, `supabase-postgres-rls`, `structured-data-schema-org`
- Rules : `seo-geo` §JSON-LD, `hotel-detail-page` §Bloc 13 (TrustSignals), `architecture-layers` §Cross-cutting collections
