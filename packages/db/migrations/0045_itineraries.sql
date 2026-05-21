-- 0045 — Itineraries (CDC §2.1 — feature SEO/GEO acquisition).
--
-- New top-level editorial surface beyond `editorial_guides` and
-- `editorial_rankings`: long-form day-by-day travel itineraries that
-- bundle 5★ / Palace hotels (referenced by FK to `hotels`) into
-- bookable journeys.
--
-- Routes:
--   /[locale]/itineraires            — hub (/itineraries in EN routing)
--   /[locale]/itineraire/[slug]      — detail (/itinerary/[slug] in EN)
--
-- Why a dedicated table and not `editorial_pages.type = 'itinerary'`?
--   - Distinct lifecycle: itineraries refresh seasonally (spring/autumn
--     rotations) whereas editorial guides refresh yearly.
--   - Distinct shape: ordered `hotel_ids[]` + structured `sections`
--     jsonb (HowTo steps) — neither maps cleanly onto the existing
--     guides/rankings columns.
--   - Distinct SEO contract: emits `HowTo` + `ItemList` + `FAQPage` +
--     `Article` JSON-LD simultaneously. Cleanest as its own row shape.
--
-- Spec:        docs/cdc-itineraires.md §2.1
-- Plan:        docs/plan-itineraires-reprise.md §3.1.1
-- Routing:     apps/web/src/i18n/routing.ts
-- Rule:        .cursor/rules/itinerary-page.mdc
-- Skill:       .cursor/skills/itinerary-editorial-pipeline/SKILL.md
--
-- ============================================================================
-- itineraries
-- ============================================================================

create table if not exists public.itineraries (
  id uuid primary key default gen_random_uuid(),

  -- ----- Identification --------------------------------------------------
  -- Slug shape mirrors `hotels.slug` and `editorial_rankings.slug` (kebab
  -- ASCII). FR slug is the canonical URL part for both locales (ADR-0008).
  slug_fr text not null,
  slug_en text,

  -- ----- Editorial copy --------------------------------------------------
  title_fr      text not null,
  title_en      text,
  meta_title_fr text,
  meta_title_en text,
  -- Free-form bounds — Payload + the build-time audit script enforce the
  -- 140-160 char window for `meta_desc_*` (CDC §5.1). No DB CHECK so an
  -- editor can stage a partial draft before validation runs.
  meta_desc_fr text,
  meta_desc_en text,
  intro_fr     text,
  intro_en     text,

  -- ----- AEO block (validated by `buildAeoBlock` — 40-80 words) ---------
  -- Plain text columns; the answer is parsed by `buildAeoBlock` at render
  -- time in apps/web/src/app/[locale]/itineraire/[slug]/page.tsx and the
  -- page throws fail-fast if the count falls outside the envelope.
  aeo_question_fr text,
  aeo_answer_fr   text,
  aeo_question_en text,
  aeo_answer_en   text,

  -- ----- Taxonomy -------------------------------------------------------
  -- ISO 3166-1 alpha-2. Aligned with `hotels.country_code` and
  -- `editorial_guides.country_code` so cross-table joins (rétroliens
  -- guides pays → itinéraires) stay trivial. The user-facing slug from
  -- the CDC §6.1 list-itineraries skill ("japon", "italie") is mapped
  -- to ISO-2 in the agent endpoint — never persisted as label here.
  country_code text not null
    constraint itineraries_country_code_ck check (country_code ~ '^[A-Z]{2}$'),
  -- Free-form region/cluster ("Toscane", "Côte d'Azur", "Hokkaido").
  destination_region text,
  -- Free-form city ("Paris", "Kyoto", "Marrakech"). Optional — multi-city
  -- itineraries (`japon-culture-2-semaines`) leave this null.
  destination_city text,
  -- Loose tags — luxe, romantique, gastronomie, vignobles, ski, plage…
  -- A GIN index supports `themes && '{spa,ski}'::text[]` filters.
  themes text[] not null default '{}',

  -- ----- Duration -------------------------------------------------------
  duration_min_days smallint not null
    constraint itineraries_duration_min_ck check (duration_min_days between 1 and 60),
  duration_max_days smallint
    constraint itineraries_duration_max_ck check (
      duration_max_days is null or duration_max_days >= duration_min_days
    ),

  -- ----- Style / season -------------------------------------------------
  travel_style text not null
    constraint itineraries_travel_style_ck check (
      travel_style in (
        'luxe','famille','couple','solo',
        'aventure','bien-etre','gastronomie','culture','affaires'
      )
    ),
  season text
    constraint itineraries_season_ck check (
      season is null
      or season in ('printemps','ete','automne','hiver','toute-saison')
    ),

  -- ----- Hotels recommended ---------------------------------------------
  -- Ordered (step 1, 2, 3…). The same hotel can repeat (return-to-Paris
  -- pattern). NULL UUIDs are NOT allowed (Postgres rejects them in array
  -- with FK). FK enforcement happens via the `hotels.id` references in
  -- read queries (no cascade — orphan UUID = stale reference logged).
  hotel_ids uuid[] not null default '{}',

  -- ----- Editorial sections (HowTo step structure) ----------------------
  -- Shape (mirrored by `ItinerarySectionSchema` in
  --  apps/web/src/server/itineraries/get-itinerary-by-slug.ts):
  --   [{
  --     step:           int (1-based),
  --     title_fr:       text,    title_en: text,
  --     body_fr:        text (≥150 words),
  --     body_en:        text (≥150 words, NEVER literal FR translation
  --                          — see skill `concierge-voice-pipeline` rule 10),
  --     hotel_id:       uuid | null,
  --     duration_days:  int,
  --     city:           text,
  --     poi:            text[]   (≥1 POI per step)
  --   }]
  -- Body word-count + POI presence checked by the audit script
  -- `audit-itineraries.mjs` (Sprint 4); no DB CHECK to keep
  -- in-progress drafts admissible.
  sections jsonb,

  -- ----- FAQ (FAQPage JSON-LD + AEO long-tail capture) ------------------
  -- Shape: [{q_fr, a_fr, q_en, a_en, anchor?}]
  -- Minimum 8 Q&A enforced by `audit-itineraries.mjs`. The 10 canonical
  -- questions from the skill rule 5 are the editorial baseline.
  faq_content jsonb,

  -- ----- Internal mesh (CDC §5.5) ---------------------------------------
  related_ranking_ids     uuid[] not null default '{}',
  related_guide_slugs     text[] not null default '{}',
  related_itinerary_slugs text[] not null default '{}',

  -- ----- Media ----------------------------------------------------------
  -- Cloudinary `public_id` (e.g. `editorial/itineraries/japon-culture-hero`).
  hero_cloudinary_id text,
  hero_alt_fr        text,
  hero_alt_en        text,
  -- Optional carousel — same shape as `editorial_guides.gallery_images`.
  gallery_images jsonb,

  -- ----- Author + freshness ---------------------------------------------
  author_id    uuid references public.authors (id) on delete set null,
  -- Drives sitemap `<lastmod>`, JSON-LD `Article.dateModified`, and the
  -- visible `<LastUpdatedBadge />` near the H1.
  last_updated date not null default current_date,

  -- ----- Workflow -------------------------------------------------------
  status text not null default 'draft'
    constraint itineraries_status_ck check (status in ('draft','published')),
  priority text not null default 'P2'
    constraint itineraries_priority_ck check (priority in ('P0','P1','P2','P3')),
  word_count_target integer default 2000,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  -- ----- Slug shape + uniqueness ----------------------------------------
  constraint itineraries_slug_fr_ck check (slug_fr ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint itineraries_slug_en_ck check (
    slug_en is null or slug_en ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint itineraries_slug_fr_unique unique (slug_fr),
  constraint itineraries_slug_en_unique unique (slug_en)
);

comment on table public.itineraries is
  'CDC §2.1 — long-form travel itineraries with curated 5★/Palace hotel '
  'selection. Routes: /itineraires (hub) + /itineraire/[slug] (detail). '
  'Migration 0045.';

comment on column public.itineraries.country_code is
  'ISO 3166-1 alpha-2 — aligned with hotels.country_code & '
  'editorial_guides.country_code for cross-table joins (rétroliens '
  'guides pays). The CDC §6.1 list-itineraries skill maps user labels '
  '("japon") to ISO-2 ("JP") in the agent endpoint.';

comment on column public.itineraries.hotel_ids is
  'Ordered hotel UUIDs (step 1, 2, 3…). Same hotel can repeat. Resolved '
  'against hotels.id at read time; orphan UUIDs are silently dropped + '
  'logged (no FK cascade, this column is editorial intent — the read '
  'query is the source of truth).';

comment on column public.itineraries.sections is
  'HowTo step structure: [{step, title_fr/_en, body_fr/_en, hotel_id, '
  'duration_days, city, poi[]}]. Body ≥150 words, ≥1 POI per step '
  '(enforced by audit-itineraries.mjs, not by DB).';

comment on column public.itineraries.aeo_answer_fr is
  '40-80 word answer validated by `buildAeoBlock` at render time. '
  'Out-of-envelope = page throws fail-fast (rule itinerary-page.mdc §4).';

-- ============================================================================
-- Indexes
-- ============================================================================

-- Hub listing query: published × country (CDC §6.1 list-itineraries filter).
create index if not exists itineraries_published_country_idx
  on public.itineraries (status, country_code)
  where status = 'published';

-- Theme facetting (`themes && '{spa-bienetre,romantique}'`).
create index if not exists itineraries_themes_gin
  on public.itineraries using gin (themes);

-- "Cet hôtel apparaît dans nos itinéraires" widget on /hotel/[slug].
create index if not exists itineraries_hotel_ids_gin
  on public.itineraries using gin (hotel_ids);

-- FAQ + sections containment queries (jsonb_path_ops is smaller + faster
-- for the `@>` containment we actually use on these columns).
create index if not exists itineraries_faq_gin
  on public.itineraries using gin (faq_content jsonb_path_ops);
create index if not exists itineraries_sections_gin
  on public.itineraries using gin (sections jsonb_path_ops);

-- FK covering index (rule supabase-rls.mdc §Indexes — non-negotiable).
create index if not exists itineraries_author_id_idx
  on public.itineraries (author_id)
  where author_id is not null;

-- ============================================================================
-- Trigger — reuse the shared `public.set_updated_at` from migration 0001.
-- ============================================================================

drop trigger if exists itineraries_set_updated_at on public.itineraries;
create trigger itineraries_set_updated_at
  before update on public.itineraries
  for each row execute function public.set_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.itineraries enable row level security;

-- Public read of published rows. `auth` lookup wrapped in a `select`
-- subquery is irrelevant here (no auth predicate), but the policy is
-- split FOR SELECT per rule supabase-rls.mdc §RLS performance.
drop policy if exists itineraries_public_read on public.itineraries;
create policy itineraries_public_read on public.itineraries
  for select to anon, authenticated
  using (status = 'published');

-- Editor / admin all-access. `auth.jwt()` MUST be wrapped in
-- `(select auth.jwt())` so the planner caches the JWT lookup once per
-- statement — rule supabase-rls.mdc §RLS performance.
drop policy if exists itineraries_staff_select on public.itineraries;
create policy itineraries_staff_select on public.itineraries
  for select to authenticated
  using (((select auth.jwt()) ->> 'role') in ('admin', 'editor'));

drop policy if exists itineraries_staff_insert on public.itineraries;
create policy itineraries_staff_insert on public.itineraries
  for insert to authenticated
  with check (((select auth.jwt()) ->> 'role') in ('admin', 'editor'));

drop policy if exists itineraries_staff_update on public.itineraries;
create policy itineraries_staff_update on public.itineraries
  for update to authenticated
  using  (((select auth.jwt()) ->> 'role') in ('admin', 'editor'))
  with check (((select auth.jwt()) ->> 'role') in ('admin', 'editor'));

drop policy if exists itineraries_staff_delete on public.itineraries;
create policy itineraries_staff_delete on public.itineraries
  for delete to authenticated
  using (((select auth.jwt()) ->> 'role') in ('admin', 'editor'));

-- ============================================================================
-- Migration ledger
-- ============================================================================

insert into public._cct_sql_migrations (filename)
values ('0045_itineraries.sql')
  on conflict do nothing;
