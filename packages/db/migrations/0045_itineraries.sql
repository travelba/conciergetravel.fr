-- 0045 — Itineraries (SEO/GEO acquisition feature).
--
-- See `docs/cdc-itineraires.md` §2.1 (CDC v1.0 — Sprint 1 / ticket S1.1)
-- and `docs/itineraires-integration-plan.md` §1.3 D1 for the migration
-- numbering decision (CDC v1.0 originally said "0038" but that slot is
-- already taken — migrations are forward-only, see AGENTS.md §4.5).
--
-- The `itineraries` table powers the new `/[locale]/itineraires` hub +
-- `/[locale]/itineraire/[slug]` (FR) and `/[locale]/itinerary/[slug]`
-- (EN) routes. Each row stores a fully editorialised travel itinerary
-- (intro, ordered `sections` jsonb, FAQ jsonb, recommended `hotel_ids[]`,
-- AEO block, internal-mesh references) ready to be rendered as
-- Schema.org `HowTo` + `ItemList` + `FAQPage` + `Article` JSON-LD.
--
-- Forward-only — never edit, never reorder (AGENTS.md §4.5).
-- Bilingual columns mirror the `hotels` / `editorial_guides` convention:
-- `_fr` is canonical, `_en` is optional and triggers the "EN coming
-- soon" fallback when null.
--
-- Skill references: content-modeling, seo-technical,
-- geo-llm-optimization, supabase-postgres-rls, itinerary-editorial-pipeline.

create table if not exists public.itineraries (
  id uuid primary key default gen_random_uuid(),

  -- Identification — kebab-case slugs (ASCII, lowercased).
  -- `slug_fr` is the canonical identifier; `slug_en` mirrors it on the
  -- EN route. Both are unique when present.
  slug_fr text not null,
  slug_en text,

  -- Editorial content. `title_*` powers the H1; `meta_title_*`
  -- (30-70 chars) and `meta_desc_*` (140-160 chars) override the
  -- default `<title>` / `<meta description>` when set. `intro_*`
  -- is the 150-200 word "chapeau Concierge" rendered right under
  -- the hero.
  title_fr text not null,
  title_en text,
  meta_title_fr text,
  meta_title_en text,
  meta_desc_fr text,
  meta_desc_en text,
  intro_fr text,
  intro_en text,

  -- AEO block (Answer Engine Optimisation) — validated by
  -- `buildAeoBlock` from `@mch/seo` (40-80 words). Surfaced in the
  -- visible `<section data-aeo>` block AND in the `FAQPage` JSON-LD.
  aeo_question_fr text,
  aeo_answer_fr text,
  aeo_question_en text,
  aeo_answer_en text,

  -- Taxonomy.
  destination_country text not null,
  destination_region text,
  destination_city text,
  themes text[] not null default '{}',

  -- Duration window. `duration_max_days` is null for fixed-length
  -- itineraries (e.g. "Paris — week-end" → max = null, min = 3).
  duration_min_days smallint not null,
  duration_max_days smallint,

  -- Travel style / season are constrained enums so the filters in the
  -- hub UI can rely on a finite set. Adding a new value requires a
  -- migration (and a corresponding `messages/{fr,en}.json` entry).
  travel_style text not null,
  constraint itineraries_travel_style_ck check (
    travel_style in (
      'luxe', 'famille', 'couple', 'solo',
      'aventure', 'bien-etre', 'gastronomie', 'culture', 'affaires'
    )
  ),

  season text,
  constraint itineraries_season_ck check (
    season is null
    or season in ('printemps', 'ete', 'automne', 'hiver', 'toute-saison')
  ),

  -- Recommended hotels — array order = itinerary step order
  -- (1, 2, 3…). Each id MUST point at a `public.hotels.id`. We do
  -- not enforce a FK on each array element (Postgres can't FK an
  -- array element); the application layer validates membership at
  -- write time and gracefully skips missing hotels at read time.
  hotel_ids uuid[] not null default '{}',

  -- Editorial sections (HowTo-shaped). Stored as a JSONB array:
  --   [{
  --     "step": 1,
  --     "title_fr": "…", "title_en": "…",
  --     "body_fr": "…",  "body_en": "…",  -- ≥ 150 mots chacun
  --     "hotel_id": "uuid|null",
  --     "duration_days": 2,
  --     "city": "Paris",
  --     "poi": ["Tour Eiffel", "Musée d'Orsay"]
  --   }]
  -- Zod-validated at read time via `@mch/domain/itineraries`
  -- (`ItinerarySectionZod`).
  sections jsonb,

  -- FAQ — minimum 8 Q&A enforced by the editorial pipeline
  -- (validate-itinerary.mjs) + the Payload publish hook. Schema:
  --   [{ "q_fr": "…", "a_fr": "…", "q_en": "…", "a_en": "…" }]
  faq_content jsonb,

  -- Internal-mesh references (CDC §5.5).
  --   - `related_ranking_ids` → editorial_rankings.id
  --   - `related_guide_slugs` → editorial_guides.slug
  --   - `related_itinerary_slugs` → itineraries.slug_fr
  -- Stored as raw ids/slugs (not FKs) to avoid update-storms when a
  -- ranking / guide / itinerary is renamed.
  related_ranking_ids uuid[] default '{}',
  related_guide_slugs text[] default '{}',
  related_itinerary_slugs text[] default '{}',

  -- Media — Cloudinary public ids (e.g. `editorial/itineraries/japon-luxe`).
  hero_cloudinary_id text,
  hero_alt_fr text,
  hero_alt_en text,
  gallery_images jsonb,

  -- Editorial provenance + freshness signal. `last_updated` drives
  -- the visible `<LastUpdatedBadge>`, the `dateModified` field of the
  -- `Article` JSON-LD, AND the `<lastmod>` entry in
  -- `/sitemaps/itineraries.xml`.
  author_id uuid references public.authors (id) on delete set null,
  last_updated date not null default current_date,

  -- Publication workflow.
  status text not null default 'draft',
  constraint itineraries_status_ck check (status in ('draft', 'published')),

  -- Editorial priority — drives sitemap `<priority>` (0.9 / 0.8 /
  -- 0.7 / 0.6) and the llms-full.txt selection (P0 only).
  priority text not null default 'P2',
  constraint itineraries_priority_ck check (priority in ('P0', 'P1', 'P2', 'P3')),

  word_count_target integer default 2000,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint itineraries_slug_fr_ck check (slug_fr ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint itineraries_slug_en_ck check (
    slug_en is null or slug_en ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint itineraries_slug_fr_unique unique (slug_fr),
  constraint itineraries_slug_en_unique unique (slug_en)
);

comment on table public.itineraries is
  'Travel itineraries (SEO/GEO feature) — see docs/cdc-itineraires.md §2.1 + docs/itineraires-integration-plan.md. Powers /[locale]/itineraires hub and /[locale]/itineraire/[slug] detail pages.';

-- ---------------------------------------------------------------------------
-- Indexes — read patterns:
--   1. Hub list filtered by country + status            (B-tree composite)
--   2. Theme-based filter                                (GIN on text[])
--   3. "Which itineraries feature hotel X?"             (GIN on uuid[])
--   4. JSON-LD FAQPage extraction / FAQ search          (GIN jsonb_path_ops)
--   5. Step-by-step HowTo render                         (GIN jsonb_path_ops)
-- ---------------------------------------------------------------------------

create index if not exists itineraries_published_country_idx
  on public.itineraries (status, destination_country);

create index if not exists itineraries_themes_gin
  on public.itineraries using gin (themes);

create index if not exists itineraries_hotel_ids_gin
  on public.itineraries using gin (hotel_ids);

create index if not exists itineraries_faq_gin
  on public.itineraries using gin (faq_content jsonb_path_ops);

create index if not exists itineraries_sections_gin
  on public.itineraries using gin (sections jsonb_path_ops);

-- ---------------------------------------------------------------------------
-- Trigger — re-use the shared `public.set_updated_at()` declared in
-- migration 0001 (do NOT redefine it).
-- ---------------------------------------------------------------------------

drop trigger if exists itineraries_set_updated_at on public.itineraries;
create trigger itineraries_set_updated_at
before update on public.itineraries
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — public reads only published rows; staff (admin / editor) get
-- full read+write access.
--
-- `auth.jwt()` is wrapped in `(select …)` so the planner caches the
-- JWT lookup once per statement instead of re-evaluating per row
-- (Supabase `auth_rls_initplan` advisor — see migration 0007 +
-- `.cursor/rules/supabase-rls.mdc`).
-- ---------------------------------------------------------------------------

alter table public.itineraries enable row level security;

drop policy if exists itineraries_public_read on public.itineraries;
create policy itineraries_public_read on public.itineraries
  for select to anon, authenticated
  using (status = 'published');

drop policy if exists itineraries_staff_all on public.itineraries;
create policy itineraries_staff_all on public.itineraries
  for all to authenticated
  using (((select auth.jwt()) ->> 'role') in ('admin', 'editor'))
  with check (((select auth.jwt()) ->> 'role') in ('admin', 'editor'));

insert into public._cct_sql_migrations (filename)
values ('0045_itineraries.sql')
  on conflict do nothing;
