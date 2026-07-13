# ADR 0033 — Isolation schéma PostgreSQL `v2`

- Status: accepted
- Date: 2026-07-07
- Refs:
  - CDC v2 : [`docs/cdc/cahier-des-charges-v2-booking-like.md`](../cdc/cahier-des-charges-v2-booking-like.md) §5, décision Q44
  - Skill Supabase : [`.cursor/skills/supabase-postgres-rls/SKILL.md`](../../.cursor/skills/supabase-postgres-rls/SKILL.md)
  - Freeze v1 : [`.cursor/rules/v2-migration-freeze.mdc`](../../.cursor/rules/v2-migration-freeze.mdc)
  - ADR stack : [`0001-stack.md`](0001-stack.md)

## Décision

Tous les **nouveaux objets SQL** créés pour la refonte v2 (tables, vues
matérialisées, vues read-model, fonctions, types) vivent dans le schéma
PostgreSQL dédié **`v2`**, au sein du **même projet Supabase** que v1
(project ref `fsmfozxgujskluxakeoq`, région `eu-west`).

Les objets existants du schéma **`public`** (2 929 hôtels, pipelines
éditoriaux, Auth, RLS historique) **ne sont pas renommés ni déplacés**.

## Contexte

Décision Q44 (2026-07-07) : conserver **un monorepo + une base Supabase**
— pas de nouveau repo ni de fork de données. Raisons :

1. **Pipelines éditoriaux** (Q17) continuent d'écrire dans `public.hotels`
   pendant la construction de v2.
2. **Supabase Auth** — comptes clients existants ; pas de migration identité.
3. **Packages partagés** (`@mch/domain`, `@mch/integrations`, `@mch/seo`)
   sans divergence de schéma entre branches.
4. **Coût ops** — une facture, un backup, un pooler.

L'isolation v1/v2 se fait par :

- **Projet Vercel dédié** `apps/web-v2` (Q14) — pas par une seconde base.
- **Gel code v1** `apps/web` (Q16) — rule `v2-migration-freeze`.
- **Schéma SQL `v2`** — frontière nette pour read-models et tables métier v2.

## Périmètre schéma `v2`

### Inclus (exemples Phase 1+)

| Objet                            | Type             | Rôle                              |
| -------------------------------- | ---------------- | --------------------------------- |
| `v2.hotel_card_v2`               | view / mat. view | Projection carte SRP              |
| `v2.hotel_detail_v2`             | view / mat. view | Projection fiche                  |
| `v2.hotel_keywords_v2`           | table            | Mots-clés DFS par hôtel           |
| `v2.destination_keywords_v2`     | table            | Seeds destination                 |
| `v2.member_program_config`       | table            | Config niveaux Base/Gold/Platinum |
| `v2.search_facet_counts`         | mat. view        | Facettes Algolia / SQL            |
| `v2.refresh_hotel_read_models()` | function         | Refresh concurrent-safe           |

Nommage : suffixe `_v2` sur les projections read-model (CDC §5).

### Exclus (restent `public`)

- `hotels`, `rooms`, `editorial_rankings`, `editorial_guides`, `itineraries`,
  `places`, `gallery_images`, tables Auth, RLS existantes.
- Migrations historiques `packages/db/migrations/00xx_*.sql` — **forward-only,
  jamais modifiées**.

### Lecture croisée

Les vues `v2.*` **SELECT** depuis `public.*` — sens unique recommandé :

```
public.hotels  ──READ──▶  v2.hotel_detail_v2  ──▶  apps/web-v2 BFF
```

Éviter les triggers `public` ← `v2` sauf invalidation cache explicite
(documentée).

## Migrations

- Fichiers : `packages/db/migrations/00xx_v2_<description>.sql`.
- Chaque migration :
  1. `CREATE SCHEMA IF NOT EXISTS v2;`
  2. `GRANT USAGE ON SCHEMA v2 TO authenticated, service_role;`
  3. Objet + commentaire `COMMENT ON … IS 'v2 read-model — ADR-0033';`
  4. RLS sur toute table `v2` exposée PostgREST (pas seulement les vues).
- **Dry-run** obligatoire sur branche Supabase (Q8) avant merge `main`.
- Vues read-only en prod directe ; **nouvelle table** = dry-run + validation PO.

Exemple en-tête :

```sql
-- Migration: 0080_v2_schema_bootstrap.sql
-- ADR-0033 — bootstrap schema v2 read-models

CREATE SCHEMA IF NOT EXISTS v2;

CREATE OR REPLACE VIEW v2.hotel_card_v2 AS
SELECT
  h.id,
  h.slug,
  h.name_fr,
  h.luxury_tier,
  h.city,
  h.country_code
  -- …
FROM public.hotels h
WHERE h.is_published = true;
```

## PostgREST / Supabase client

- Requêtes v2 : `.schema('v2')` explicite dans `packages/db` readers.
- **Interdit** : mélanger `public` et `v2` dans un même query builder sans
  alias — deux readers distincts (`getHotelCardV2`, `getHotelDetailV2`).
- Types générés : étendre `database.types.ts` avec section `v2` après
  `supabase gen types`.

## RLS

- Tables `v2` user-facing : policies mirror `public` (published-only pour
  anon, service_role pour pipelines).
- Read-models sans colonne sensible : `GRANT SELECT` à `anon` + `authenticated`
  via view, RLS sur table source `public`.

## Conséquences

### Positives

- Zero migration de données catalogue ; pipelines v1 intacts.
- Rollback v2 = désactiver projet Vercel v2 + drop schema `v2` (sans toucher
  `public`).
- Revue PR claire : tout fichier `migrations/*v2*` → revue schema isolation.

### Négatives

- Deux namespaces à documenter ; risque de requête oubliant `.schema('v2')`.
- Refresh mat. views : charge CPU supplémentaire — planifier cron QStash /
  hook Payload → `v2.refresh_*`.

### Non-goals

- Pas de second projet Supabase.
- Pas de duplication des tables `hotels` dans `v2` (sauf cache éphémère
  explicitement ADR).

## Validation

- [ ] `CREATE SCHEMA v2` appliqué sur branche Supabase
- [ ] Reader `packages/db/src/v2/` avec tests MSW / SQL snapshot
- [ ] `get_advisors` Supabase : zero warning RLS sur objets `v2`
- [ ] Aucune migration v2 n'écrit dans `public` sans ADR dédié

## Plan de rollback

1. Re-pointage DNS vers projet Vercel v1 (Q14).
2. Optionnel : `DROP SCHEMA v2 CASCADE;` après export si tables métier v2
   créées — **jamais** exécuter sur prod sans snapshot PO.

## Références croisées

- Q44 rationale : CDC §4 Technique
- Algolia index v2 : skill [`search-engineering`](../../.cursor/skills/search-engineering/SKILL.md)
- Read-models latence < 200 ms p95 : CDC §5
