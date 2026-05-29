-- 0062 — Add `hotels.affiliations jsonb` + backfill from misused `external_sources`.
--
-- Context (audit 2026-05-28, `canvases/audit-luxury-tier-vs-labels.canvas.tsx`)
-- ----------------------------------------------------------------------------
-- The audit on the 2199 published + 26 draft hotels revealed two
-- superposed semantics in `external_sources` (jsonb, migration 0038):
--
--   (a) the **original** intended semantics — provenance records for
--       editorial facts: `{ field, value, source, confidence, collected_at }`.
--       In production this shape is **unused** (0 entries).
--
--   (b) the **opportunistic** usage that grew organically since migration
--       0059 — scaffold traces for chain / label inserts:
--       `{ source: 'luxury_chain_xlsx', chain_facet_slug, chain_display_name, ... }`
--       (976 entries), `{ source: 'relais_chateaux', metadata: {...} }`
--       (470 entries), `{ source: 'grecotel', ... }` (26 entries).
--
-- The two semantics conflict structurally:
--   - (a) describes *facts* (one entry per `field`)
--   - (b) describes *third-party identities* the hotel belongs to (one
--     entry per affiliation; cumulative for labels)
--
-- This migration disentangles them:
--   1. Adds a dedicated `affiliations jsonb` column with shape contract
--      enforced by `packages/db/src/schema/affiliations.ts` (Zod).
--   2. Backfills it from the (b)-shaped entries currently in
--      `external_sources`, attributing the proper `kind`:
--        - `luxury_chain_xlsx`  → kind=brand (Aman/Four Seasons/Oetker/...)
--        - `relais_chateaux`    → kind=label
--        - `grecotel`           → kind=brand
--   3. Cleans up `external_sources` by removing the moved entries — the
--      column reverts to its original 0038 semantics (provenance of facts),
--      ready to be populated by the Wikidata / Tavily enrichment passes.
--
-- The new column drives:
--   - JSON-LD `Hotel.award[]` (one entry per `verified: true` label —
--     packages/seo/jsonld/hotel.ts must be updated to read from this
--     column).
--   - `/marque/[brandSlug]` and the upcoming `/label/[labelSlug]` facets
--     (apps/web/src/app/[locale]/marque/[brandSlug]/page.tsx).
--   - The upcoming `fetch-atout-france-palaces.ts`,
--     `fetch-forbes-5-star.ts`, `fetch-michelin-keys.ts`,
--     `fetch-leading-hotels.ts` ingestion pipelines (they patch
--     `affiliations[]` not `external_sources[]`).
--
-- Forward-only. The backfill is idempotent: a hotel whose `affiliations`
-- already contains entries is left untouched (the migration assumes
-- prior run completed correctly).
--
-- Skill: supabase-postgres-rls, content-modeling.
-- ADR: docs/adr/0023-hotel-affiliations-vs-external-sources.md.

-- ----------------------------------------------------------------
-- 1. DDL — add the column + shape constraint + GIN index
-- ----------------------------------------------------------------

alter table public.hotels
  add column if not exists affiliations jsonb not null default '[]'::jsonb;

alter table public.hotels
  drop constraint if exists hotels_affiliations_shape_ck;

alter table public.hotels
  add constraint hotels_affiliations_shape_ck
  check (jsonb_typeof(affiliations) = 'array');

-- GIN index for label / brand facet queries (e.g.
-- `where affiliations @> '[{"source": "relais_chateaux"}]'::jsonb`).
create index if not exists hotels_affiliations_gin
  on public.hotels using gin (affiliations);

-- ----------------------------------------------------------------
-- 2. Backfill — transform external_sources entries into affiliations
-- ----------------------------------------------------------------
-- Idempotent guard: only touch rows whose affiliations array is empty.

update public.hotels h
set affiliations = sub.transformed
from (
  select
    h2.id as hotel_id,
    coalesce(
      jsonb_agg(
        jsonb_strip_nulls(
          jsonb_build_object(
            'kind',
              case
                when src->>'source' = 'luxury_chain_xlsx' then 'brand'
                when src->>'source' = 'grecotel' then 'brand'
                when src->>'source' = 'relais_chateaux' then 'label'
              end,
            'source',
              case
                when src->>'source' = 'luxury_chain_xlsx'
                  then replace(coalesce(src->>'chain_facet_slug', ''), '-', '_')
                when src->>'source' = 'grecotel' then 'grecotel'
                when src->>'source' = 'relais_chateaux' then 'relais_chateaux'
              end,
            'display_name',
              case
                when src->>'source' = 'luxury_chain_xlsx' then src->>'chain_display_name'
                when src->>'source' = 'grecotel' then 'Grecotel Hotels & Resorts'
                when src->>'source' = 'relais_chateaux' then 'Relais & Châteaux'
              end,
            'verified', true,
            'facet_slug',
              case
                when src->>'source' = 'luxury_chain_xlsx' then src->>'chain_facet_slug'
                when src->>'source' = 'grecotel' then 'grecotel'
                when src->>'source' = 'relais_chateaux' then 'relais-chateaux'
              end,
            'source_url', src->>'source_url',
            'scraped_at', src->>'scraped_at',
            'metadata', src->'metadata'
          )
        )
        order by src->>'scraped_at' nulls last
      ) filter (
        where src->>'source' in ('luxury_chain_xlsx', 'relais_chateaux', 'grecotel')
      ),
      '[]'::jsonb
    ) as transformed
  from public.hotels h2,
       jsonb_array_elements(h2.external_sources) as src
  where jsonb_typeof(h2.external_sources) = 'array'
    and jsonb_array_length(h2.external_sources) > 0
    and h2.affiliations = '[]'::jsonb
  group by h2.id
) sub
where h.id = sub.hotel_id
  and h.affiliations = '[]'::jsonb
  and jsonb_array_length(sub.transformed) > 0;

-- ----------------------------------------------------------------
-- 3. Cleanup — remove the moved entries from external_sources
-- ----------------------------------------------------------------
-- After this step, external_sources contains only the original-shape
-- provenance records (`{ field, value, source, confidence, collected_at }`),
-- or `[]` for hotels that had no such records.

update public.hotels h
set external_sources = sub.cleaned
from (
  select
    h2.id as hotel_id,
    coalesce(
      jsonb_agg(src) filter (
        where src->>'source' not in ('luxury_chain_xlsx', 'relais_chateaux', 'grecotel')
      ),
      '[]'::jsonb
    ) as cleaned
  from public.hotels h2,
       jsonb_array_elements(h2.external_sources) as src
  where jsonb_typeof(h2.external_sources) = 'array'
    and jsonb_array_length(h2.external_sources) > 0
  group by h2.id
) sub
where h.id = sub.hotel_id
  and h.external_sources is distinct from sub.cleaned;

-- ----------------------------------------------------------------
-- 4. Documentation
-- ----------------------------------------------------------------

comment on column public.hotels.affiliations is
  'Array of third-party affiliations driving the brand/label/ranking/guide signals (JSON-LD Hotel.award[], /marque/[slug] and /label/[slug] facets). Shape per entry (validated by Zod in packages/db/src/schema/affiliations.ts): { kind: ''brand''|''label''|''ranking''|''guide'', source: snake_case_slug, display_name, verified: bool, since_year?: int, source_url?: url, facet_slug?: kebab-case-slug, scraped_at?: ISO 8601, metadata?: object }. Replaces the misuse of external_sources for scaffold trace (migration 0038). See ADR-0023.';

comment on column public.hotels.external_sources is
  'Array of provenance records (one per fact injected into the editorial LLM brief). Shape: { field, value, source: ''wikidata:P*''|''wikipedia_fr''|''tavily:<domain>''|''google_places''|''tourism_api_<cc>''|''manual'', confidence: ''high''|''medium''|''low'', collected_at, deprecated_by? }. NOTE 2026-05-28: scaffold-trace entries (luxury_chain_xlsx, relais_chateaux, grecotel) were migrated to the dedicated `affiliations` column in migration 0062 — this column now hosts only its original 0038 semantics.';

-- ----------------------------------------------------------------
-- 5. Migration log
-- ----------------------------------------------------------------

insert into public._cct_sql_migrations (filename, applied_at)
  values ('0062_hotels_affiliations_column.sql', timezone('utc', now()))
  on conflict do nothing;
