-- 0072 — Hotels: data-driven GEO/AEO question blocks (`geo_qa`).
--
-- Context (Golden-template generalisation, 2026-06-05)
-- ----------------------------------------------------------------------------
-- The GEO/AEO answer-engine block (three short H2-led Q&A built for AI
-- Overviews) was hard-coded for the Airelles Gordes fiche only, inside
-- `apps/web/src/components/hotel/hotel-geo-section.tsx` and gated at the call
-- site by `row.slug === 'les-airelles-gordes'`. To let ANY golden fiche carry
-- its own GEO block (first new use: Prince de Galles), the content moves to a
-- jsonb column read by `readGeoQa` and the component becomes data-driven.
--
--   - `geo_qa jsonb` — ordered array of answer-engine blocks. Each entry:
--       { id:string,
--         question_fr:string, question_en:string,
--         paragraphs_fr:string[], paragraphs_en:string[] }
--       Rendered by `<HotelGeoSection>` (self-elides when null/empty). Each
--       answer is 2-3 sentences (<= 25 words) in the Concierge voice.
--
-- Nullable: only fiches with editorially-sourced Q&A populate it. The Airelles
-- and Prince de Galles rows are seeded right after this migration.
--
-- Forward-only. Idempotent (`add column if not exists`).
--
-- Skill: supabase-postgres-rls, content-modeling, geo-llm-optimization.

-- ----------------------------------------------------------------
-- 1. DDL — add the jsonb column
-- ----------------------------------------------------------------

alter table public.hotels
  add column if not exists geo_qa jsonb;

-- Shape guard: an array when present (object/scalar rejected).
alter table public.hotels
  drop constraint if exists hotels_geo_qa_shape_ck;
alter table public.hotels
  add constraint hotels_geo_qa_shape_ck
  check (geo_qa is null or jsonb_typeof(geo_qa) = 'array');

-- ----------------------------------------------------------------
-- 2. Documentation
-- ----------------------------------------------------------------

comment on column public.hotels.geo_qa is
  'Data-driven GEO/AEO answer-engine blocks. jsonb array: [{ id, question_fr, question_en, paragraphs_fr:[], paragraphs_en:[] }]. Rendered by <HotelGeoSection> (self-elides when null/empty). Each answer 2-3 sentences <= 25 words, Concierge voice. Replaces the Airelles-only hard-coded gate.';

-- ----------------------------------------------------------------
-- 3. Migration log
-- ----------------------------------------------------------------

insert into public._cct_sql_migrations (filename, applied_at)
  values ('0072_hotels_geo_qa_column.sql', timezone('utc', now()))
  on conflict do nothing;
