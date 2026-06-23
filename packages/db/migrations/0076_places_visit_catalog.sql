-- 0076 — "Lieux à visiter" canonical catalog foundations.
--
-- Context (plan: .cursor/plans/lieux_à_visiter_vertical_*.plan.md)
-- ----------------------------------------------------------------------------
-- Today points of interest are EMBEDDED attributes of a hotel
-- (`hotels.points_of_interest` JSONB, buckets visit/do/eat/shop). That
-- duplicates content hotel-by-hotel, exposes no indexable page per place,
-- enables no city ranking and no monetisation.
--
-- This migration introduces the canonical entity model for the two
-- editorial buckets we surface as standalone fiches:
--   - `visit` — patrimony + culture (museum, monument, garden, viewpoint…)
--   - `do`    — activities (guided tour, theatre, bike, specific shopping…)
--
-- Three additive tables (all empty after this migration):
--   1. `places`             — the canonical SEO/GEO fiche per place.
--   2. `place_hotel_links`  — pre-computed proximity (place <-> hotel),
--      feeds BOTH the hotel "Autour" section AND the "hôtels à proximité"
--      block on a place fiche. Geographic only (haversine), city-agnostic.
--   3. `place_gyg_products` — GetYourGuide Partner API products matched to
--      a place (deeplink monetisation, Palier A — no internal checkout).
--
-- The eat/shop buckets stay embedded in `hotels.points_of_interest` for
-- now (restaurants/bars = future TheFork chantier). This migration does
-- NOT touch `hotels.points_of_interest` — the backfill script reads it
-- read-only to seed `places`.
--
-- Forward-only: do NOT edit this migration after it ships. Create a new
-- 00NN_*.sql to amend.
--
-- Skill: supabase-postgres-rls, product-architecture, content-modeling.

----------------------------------------------------------------
-- 1. places — canonical fiche per place to visit
----------------------------------------------------------------

create table if not exists public.places (
  id            uuid primary key default gen_random_uuid(),
  -- Canonical FR slug (used in /lieux/<city_key>/<slug>). slug_en is the
  -- English alias; falls back to slug when absent.
  slug          text not null,
  slug_en       text,
  -- Normalised city grouping key (e.g. 'paris'), used for the city index
  -- + ranking. NOT a FK — cities are not a table; the key mirrors the
  -- destination city slug convention.
  city_key      text not null,
  -- Human-readable city + country, mirrored from the source for display.
  city          text not null,
  country_code  text not null default 'FR',
  -- Editorial bucket — only the two standalone-fiche buckets are allowed
  -- here (eat/shop stay embedded in hotels.points_of_interest).
  bucket        text not null,
  -- Fine-grained typology, drives the Schema.org @type via
  -- packages/seo place-amenity osmToSchemaClass + the UI icon.
  kind          text not null default 'attraction',
  -- Geo (numeric like hotels.latitude/longitude). Mandatory for a place
  -- to be eligible for publish (proximity + map + JSON-LD geo).
  latitude      numeric(9, 6),
  longitude     numeric(9, 6),
  address       text,
  -- ── Editorial content (mirrors the hotels editorial envelope) ───────
  name          text not null,
  name_en       text,
  factual_summary_fr text,
  factual_summary_en text,
  description_fr text,
  description_en text,
  -- Concierge-voice operational tip (ADR-0011), 50-110 words FR.
  concierge_advice jsonb,
  -- FAQ Q&A array [{ q_fr, a_fr, q_en, a_en }]. >= 6 to publish.
  faq           jsonb,
  -- EEAT provenance array (same shape as hotels.external_sources).
  external_sources jsonb,
  -- ── Media ───────────────────────────────────────────────────────────
  hero_image    text,
  gallery_images jsonb,
  -- ── SEO ──────────────────────────────────────────────────────────────
  meta_title_fr text,
  meta_title_en text,
  meta_desc_fr  text,
  meta_desc_en  text,
  -- ── Source provenance (dedupe on re-runs) ───────────────────────────
  -- e.g. 'dt/<uuid>' (DATAtourisme), 'gp/<place_id>' (Google Places),
  -- 'node/123' / 'way/456' (Overpass/OSM), 'hotel-poi' (backfill).
  source_ref    text,
  -- ── Publication ──────────────────────────────────────────────────────
  is_published  boolean not null default false,
  priority      integer not null default 100,
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now()),

  constraint places_bucket_ck
    check (bucket in ('visit', 'do')),
  constraint places_country_code_ck
    check (char_length(country_code) = 2),
  constraint places_priority_ck
    check (priority >= 0 and priority <= 1000),
  -- One canonical fiche per (city, slug). Two places sharing a name in
  -- different cities get different city_key so the pair stays unique.
  constraint places_city_slug_unique
    unique (city_key, slug)
);

create index if not exists places_published_city_bucket_idx
  on public.places (is_published, city_key, bucket);

create index if not exists places_geo_idx
  on public.places (latitude, longitude)
  where latitude is not null and longitude is not null;

create unique index if not exists places_source_ref_uk
  on public.places (source_ref)
  where source_ref is not null;

create trigger places_set_updated_at
  before update on public.places
  for each row execute function public.set_updated_at();

----------------------------------------------------------------
-- 2. place_hotel_links — pre-computed proximity (bidirectional)
----------------------------------------------------------------
--
-- Populated by the batch proximity resolver
-- (scripts/editorial-pilot proximity job + packages/domain haversine).
-- Read by:
--   - the hotel "Autour" section (lieux canoniques proches d'un hôtel),
--   - the place fiche "hôtels à proximité" block.
-- Geographic only — no city join, so a hotel near a city boundary still
-- links to the right places across the line.

create table if not exists public.place_hotel_links (
  id            uuid primary key default gen_random_uuid(),
  place_id      uuid not null references public.places (id) on delete cascade,
  hotel_id      uuid not null references public.hotels (id) on delete cascade,
  distance_meters integer not null,
  walk_minutes  integer,
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now()),

  constraint place_hotel_links_distance_ck
    check (distance_meters >= 0),
  constraint place_hotel_links_walk_ck
    check (walk_minutes is null or walk_minutes >= 0),
  constraint place_hotel_links_unique
    unique (place_id, hotel_id)
);

create index if not exists place_hotel_links_place_id_idx
  on public.place_hotel_links (place_id, distance_meters);

create index if not exists place_hotel_links_hotel_id_idx
  on public.place_hotel_links (hotel_id, distance_meters);

create trigger place_hotel_links_set_updated_at
  before update on public.place_hotel_links
  for each row execute function public.set_updated_at();

----------------------------------------------------------------
-- 3. place_gyg_products — GetYourGuide Partner API products
----------------------------------------------------------------
--
-- Cached from the GYG Partner API (search by coords) and matched to a
-- place. `deeplink_url` carries the affiliate partner_id — Palier A
-- monetisation (no internal checkout, conforme phase API-last). Prices
-- are indicative ("à partir de") and refreshed by the sourcing pipeline.

create table if not exists public.place_gyg_products (
  id            uuid primary key default gen_random_uuid(),
  place_id      uuid not null references public.places (id) on delete cascade,
  -- GYG tour id (string — the Partner API uses opaque ids).
  gyg_tour_id   text not null,
  title         text not null,
  abstract      text,
  -- Indicative "from" price in minor units (cents) + currency. Avoid
  -- floats; render as "à partir de X €".
  price_from_minor integer,
  currency      text,
  rating        numeric(2, 1),
  review_count  integer,
  -- Affiliate deeplink (carries partner_id). Never a bare GYG URL.
  deeplink_url  text not null,
  image_url     text,
  -- Lower wins (sort order on the fiche). 100 = default.
  sort_order    integer not null default 100,
  cached_at     timestamptz not null default timezone('utc', now()),
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now()),

  constraint place_gyg_products_currency_ck
    check (currency is null or currency in ('EUR', 'USD', 'GBP', 'CHF')),
  constraint place_gyg_products_rating_ck
    check (rating is null or (rating >= 0 and rating <= 5)),
  constraint place_gyg_products_price_ck
    check (price_from_minor is null or price_from_minor >= 0),
  constraint place_gyg_products_unique
    unique (place_id, gyg_tour_id)
);

create index if not exists place_gyg_products_place_id_idx
  on public.place_gyg_products (place_id, sort_order);

create trigger place_gyg_products_set_updated_at
  before update on public.place_gyg_products
  for each row execute function public.set_updated_at();

----------------------------------------------------------------
-- 4. RLS — public reads mirror the hotels model.
--    places       : anon reads published rows; staff sees/mutates all.
--    place_*_links / _products : anon reads (no PII), staff writes.
--    The sourcing pipeline writes server-side with the service role
--    (bypasses RLS).
----------------------------------------------------------------

alter table public.places             enable row level security;
alter table public.place_hotel_links  enable row level security;
alter table public.place_gyg_products enable row level security;

-- places ---------------------------------------------------------------
create policy places_select_published
  on public.places
  for select
  to anon, authenticated
  using (
    is_published = true
    or (select auth.jwt() ->> 'role') in ('seo', 'editor', 'operator', 'admin')
  );

create policy places_insert_staff
  on public.places
  for insert
  to authenticated
  with check ((select auth.jwt() ->> 'role') in ('editor', 'operator', 'admin'));

create policy places_update_staff
  on public.places
  for update
  to authenticated
  using ((select auth.jwt() ->> 'role') in ('editor', 'operator', 'admin'))
  with check ((select auth.jwt() ->> 'role') in ('editor', 'operator', 'admin'));

create policy places_delete_staff
  on public.places
  for delete
  to authenticated
  using ((select auth.jwt() ->> 'role') in ('operator', 'admin'));

-- place_hotel_links ----------------------------------------------------
create policy place_hotel_links_select_all
  on public.place_hotel_links
  for select
  to anon, authenticated
  using (true);

create policy place_hotel_links_insert_staff
  on public.place_hotel_links
  for insert
  to authenticated
  with check ((select auth.jwt() ->> 'role') in ('editor', 'operator', 'admin'));

create policy place_hotel_links_update_staff
  on public.place_hotel_links
  for update
  to authenticated
  using ((select auth.jwt() ->> 'role') in ('editor', 'operator', 'admin'))
  with check ((select auth.jwt() ->> 'role') in ('editor', 'operator', 'admin'));

create policy place_hotel_links_delete_staff
  on public.place_hotel_links
  for delete
  to authenticated
  using ((select auth.jwt() ->> 'role') in ('editor', 'operator', 'admin'));

-- place_gyg_products ---------------------------------------------------
create policy place_gyg_products_select_all
  on public.place_gyg_products
  for select
  to anon, authenticated
  using (true);

create policy place_gyg_products_insert_staff
  on public.place_gyg_products
  for insert
  to authenticated
  with check ((select auth.jwt() ->> 'role') in ('editor', 'operator', 'admin'));

create policy place_gyg_products_update_staff
  on public.place_gyg_products
  for update
  to authenticated
  using ((select auth.jwt() ->> 'role') in ('editor', 'operator', 'admin'))
  with check ((select auth.jwt() ->> 'role') in ('editor', 'operator', 'admin'));

create policy place_gyg_products_delete_staff
  on public.place_gyg_products
  for delete
  to authenticated
  using ((select auth.jwt() ->> 'role') in ('editor', 'operator', 'admin'));

----------------------------------------------------------------
-- 5. Documentation
----------------------------------------------------------------

comment on table public.places is
  'Canonical "lieu à visiter" fiche (buckets visit/do). Indexable SEO/GEO page per place. Supersedes the embedded hotels.points_of_interest for the visit/do buckets.';
comment on table public.place_hotel_links is
  'Pre-computed geographic proximity between a place and a hotel. Feeds the hotel "Autour" section AND the place "hôtels à proximité" block. Haversine-derived, city-agnostic.';
comment on table public.place_gyg_products is
  'GetYourGuide Partner API products matched to a place. deeplink_url carries the affiliate partner_id (Palier A monetisation, no internal checkout).';

----------------------------------------------------------------
-- 6. Migration log entry (mandatory per supabase-rls.mdc)
----------------------------------------------------------------

insert into public._cct_sql_migrations (filename)
  values ('0076_places_visit_catalog.sql')
  on conflict do nothing;
