-- 0038 — Editorial pipeline source layering (deferred Tourism APIs).
--
-- Context (May 2026, overnight FR Concierge production)
-- -----------------------------------------------------
-- We're producing FR Concierge content on the full 936-hotel corpus
-- (273 FR + 663 INTL). For INTL the user has signaled that authoritative
-- Tourism APIs (per-country) will land later. To avoid rewriting content
-- when those APIs arrive, we add two columns:
--
--   1. external_sources jsonb : array of provenance records, one per fact
--      injected into the LLM brief. Shape:
--        {
--          field: 'rooms_count' | 'spa_name' | 'nearest_airport_km' | …,
--          value: <jsonb>,                       -- the fact value
--          source: 'wikidata:P1234' | 'wikipedia_fr' | 'wikipedia_en'
--                | 'tavily:<domain>' | 'google_places' | 'tourism_api_<cc>'
--                | 'manual' | 'amadeus' | 'official_url',
--          confidence: 'high' | 'medium' | 'low',
--          collected_at: ISO 8601 timestamp,
--          deprecated_by?: 'tourism_api_<cc>'    -- set when re-enriched later
--        }
--
--   2. brief_metadata jsonb : pipeline run metadata.
--        {
--          brief_version: 'v1-no-tourism-api' | 'v2-with-tourism-api-<cc>',
--          brief_generated_at: ISO 8601,
--          model_factual: 'o3-pro-2026-01-15' | 'gpt-4o-2024-11-20' | …,
--          model_creative: 'gpt-5.5-pro-2026-04-24' | …,
--          sources_used: ['wikidata', 'wikipedia_en', 'tavily', 'google_places'],
--          sources_pending: ['tourism_api_us', 'tourism_api_jp', …],
--          pipeline_run_id: uuid,
--          hallucination_audit_score?: number,   -- pass 9 score (0-100)
--          last_audit_at?: ISO 8601
--        }
--
-- Re-enrichment trigger (future phase 6) : when Tourism API_<cc> arrives,
-- a script `re-enrich-with-tourism-api.ts` filters
--   where brief_metadata->'sources_pending' ? 'tourism_api_<cc>'
-- and re-runs the brief + selective LLM passes (only sections impacted).
--
-- These are JSONB columns (no schema enforced at the DDL level) — Zod
-- validators in `scripts/editorial-pilot/src/schemas.ts` will hold the
-- contract.  Skill: content-enrichment-pipeline (Deferred sources pattern).

alter table public.hotels
  add column if not exists external_sources jsonb not null default '[]'::jsonb;

alter table public.hotels
  add column if not exists brief_metadata jsonb;

create index if not exists hotels_brief_pending_gin on public.hotels using gin
  ((brief_metadata -> 'sources_pending'));

comment on column public.hotels.external_sources is
  'Array of provenance records (one per fact injected into the editorial LLM brief). Shape: { field, value, source: ''wikidata:P*''|''wikipedia_fr''|''tavily:<domain>''|''google_places''|''tourism_api_<cc>''|''manual'', confidence: ''high''|''medium''|''low'', collected_at, deprecated_by? }. Used by the deferred Tourism API re-enrichment phase. See migration 0038 + content-enrichment-pipeline skill.';

comment on column public.hotels.brief_metadata is
  'Pipeline run metadata: brief_version, models used, sources_used[], sources_pending[] (e.g. ''tourism_api_us''), pipeline_run_id, hallucination_audit_score (Pass 9). Drives the re-enrichment trigger when authoritative Tourism APIs land. See migration 0038.';

insert into public._cct_sql_migrations (filename) values ('0038_hotels_source_layering.sql')
  on conflict do nothing;
