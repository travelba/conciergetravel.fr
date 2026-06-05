-- 0071 — Multi-supplier bookable catalog foundations.
--
-- Context (plan: .cursor/plans/multi-supplier_bookable_catalog_*.plan.md)
-- ----------------------------------------------------------------------------
-- Today a hotel is bookable through a SINGLE supplier via `hotels.booking_mode`
-- and the bridge to live inventory is a runtime FUZZY name match
-- (apps/web getTravelportLiveRoomPrices / matchEditorialRoomImages). We are
-- moving to a supplier-agnostic, rate-shopping architecture where:
--
--   - a hotel can be connected to N suppliers simultaneously
--     (`hotel_supplier_connections`);
--   - each editorial room (`hotel_rooms`) is linked to one or more supplier
--     room identities by a STORED, deterministic key
--     (`room_supplier_mappings`) — no more fuzzy matching at request time;
--   - supplier static room content (e.g. RateHawk `room_groups` / `rg_ext`)
--     is cached locally (`supplier_room_catalog`) both to build/validate the
--     mappings and to fall back inside the non-indexed booking funnel.
--
-- This migration is purely ADDITIVE (3 new empty tables + RLS). It does not
-- touch `hotels.booking_mode` yet — that column is deprecated in favour of
-- `hotel_supplier_connections` but kept readable during the transition.
--
-- IMPORTANT — supplier content indexability (RateHawk / ETG contract):
--   RateHawk internal content (photos, descriptions) MUST NOT be indexed by
--   search engines. `supplier_room_catalog.images` therefore feeds ONLY the
--   non-indexed booking funnel; indexable pages keep our curated Cloudinary
--   photos in `hotel_rooms`.
--
-- Forward-only: do NOT edit this migration after it ships. Create a new
-- 00NN_*.sql to amend.
--
-- Skill: supabase-postgres-rls, product-architecture, api-integration.

----------------------------------------------------------------
-- 0. Shared supplier allow-list (kept in sync with the domain
--    `Supplier` union in packages/integrations/src/supplier/types.ts).
--    'amadeus' and 'little' are included for forward-compat so the legacy
--    channels can migrate onto this model without a constraint rewrite.
----------------------------------------------------------------

----------------------------------------------------------------
-- 1. hotel_supplier_connections — N bookable suppliers per hotel
----------------------------------------------------------------

create table if not exists public.hotel_supplier_connections (
  id           uuid primary key default gen_random_uuid(),
  hotel_id     uuid not null references public.hotels (id) on delete cascade,
  supplier     text not null,
  -- Supplier-specific property identity. Shapes by supplier:
  --   travelport      : { "chainCode": "..", "propertyCode": ".." }
  --   ratehawk        : { "hotelId": "etg_hotel_id" }
  --   little_emperors : { "propertyRef": ".." }  (no public API — informational)
  supplier_property_key jsonb not null,
  enabled      boolean not null default true,
  -- Lower wins on price ties / preferred channel. 100 = default.
  priority     integer not null default 100,
  -- Preferred display/settlement currency for this connection (nullable —
  -- the orchestrator normalises to EUR for comparison regardless).
  currency     text,
  notes        text,
  created_at   timestamptz not null default timezone('utc', now()),
  updated_at   timestamptz not null default timezone('utc', now()),

  constraint hotel_supplier_connections_supplier_ck
    check (supplier in ('travelport', 'ratehawk', 'little_emperors', 'amadeus', 'little')),
  constraint hotel_supplier_connections_priority_ck
    check (priority >= 0 and priority <= 1000),
  constraint hotel_supplier_connections_currency_ck
    check (currency is null or currency in ('EUR', 'USD', 'GBP', 'CHF')),
  constraint hotel_supplier_connections_unique
    unique (hotel_id, supplier)
);

create index if not exists hotel_supplier_connections_hotel_id_idx
  on public.hotel_supplier_connections (hotel_id);

create index if not exists hotel_supplier_connections_enabled_idx
  on public.hotel_supplier_connections (hotel_id, supplier)
  where enabled = true;

create trigger hotel_supplier_connections_set_updated_at
  before update on public.hotel_supplier_connections
  for each row execute function public.set_updated_at();

----------------------------------------------------------------
-- 2. room_supplier_mappings — deterministic editorial room <-> supplier room
----------------------------------------------------------------
--
-- Replaces the runtime fuzzy matcher. A single editorial room can be reached
-- through several supplier room identities (e.g. a Travelport "Junior Suite"
-- label AND a RateHawk rg_ext). The reverse must be deterministic: a given
-- (hotel, supplier, supplier_room_key) maps to AT MOST one canonical room,
-- enforced by the unique index below (jsonb supports btree equality).

create table if not exists public.room_supplier_mappings (
  id            uuid primary key default gen_random_uuid(),
  hotel_id      uuid not null references public.hotels (id) on delete cascade,
  hotel_room_id uuid not null references public.hotel_rooms (id) on delete cascade,
  supplier      text not null,
  -- Supplier room identity. Shapes by supplier:
  --   travelport : { "labels": ["..."], "bookingCodes": ["..."] }
  --   ratehawk   : { "rg_ext": { "class": 0, "quality": 2, ... } }
  supplier_room_key jsonb not null,
  -- How the mapping was produced (human validation = strongest EEAT signal).
  confidence    text not null default 'manual',
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now()),

  constraint room_supplier_mappings_supplier_ck
    check (supplier in ('travelport', 'ratehawk', 'little_emperors', 'amadeus', 'little')),
  constraint room_supplier_mappings_confidence_ck
    check (confidence in ('manual', 'auto_high', 'auto_medium', 'auto_low')),
  -- One supplier room identity resolves to a single canonical room per hotel.
  constraint room_supplier_mappings_identity_unique
    unique (hotel_id, supplier, supplier_room_key)
);

create index if not exists room_supplier_mappings_hotel_room_id_idx
  on public.room_supplier_mappings (hotel_room_id);

create index if not exists room_supplier_mappings_hotel_supplier_idx
  on public.room_supplier_mappings (hotel_id, supplier);

create trigger room_supplier_mappings_set_updated_at
  before update on public.room_supplier_mappings
  for each row execute function public.set_updated_at();

----------------------------------------------------------------
-- 3. supplier_room_catalog — cached supplier static room content
----------------------------------------------------------------
--
-- Preloaded from supplier Content APIs (RateHawk hotel_content_by_ids
-- room_groups, Travelport room descriptions). Used to (a) build/validate
-- room_supplier_mappings and (b) provide a NON-INDEXED fallback room visual
-- inside the booking funnel. `images` for RateHawk is contractually
-- non-indexable — never surface it on a page that emits index,follow.

create table if not exists public.supplier_room_catalog (
  id            uuid primary key default gen_random_uuid(),
  hotel_id      uuid not null references public.hotels (id) on delete cascade,
  supplier      text not null,
  supplier_room_key jsonb not null,
  room_name     text,
  room_amenities jsonb,
  -- Supplier-hosted image URLs (CDN). Non-indexable for RateHawk.
  images        jsonb,
  -- Raw supplier room-group payload for debugging / re-mapping.
  raw           jsonb,
  fetched_at    timestamptz not null default timezone('utc', now()),
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now()),

  constraint supplier_room_catalog_supplier_ck
    check (supplier in ('travelport', 'ratehawk', 'little_emperors', 'amadeus', 'little')),
  constraint supplier_room_catalog_identity_unique
    unique (hotel_id, supplier, supplier_room_key)
);

create index if not exists supplier_room_catalog_hotel_supplier_idx
  on public.supplier_room_catalog (hotel_id, supplier);

create trigger supplier_room_catalog_set_updated_at
  before update on public.supplier_room_catalog
  for each row execute function public.set_updated_at();

----------------------------------------------------------------
-- 4. RLS — staff reads; writes restricted to operator/admin.
--    The booking orchestrator reads server-side with the service role
--    (which bypasses RLS), so we do NOT open these tables to anon.
----------------------------------------------------------------

alter table public.hotel_supplier_connections enable row level security;
alter table public.room_supplier_mappings     enable row level security;
alter table public.supplier_room_catalog       enable row level security;

-- hotel_supplier_connections
create policy hotel_supplier_connections_select_staff
  on public.hotel_supplier_connections
  for select
  to authenticated
  using ((select auth.jwt() ->> 'role') in ('seo', 'editor', 'operator', 'admin'));

create policy hotel_supplier_connections_insert_staff
  on public.hotel_supplier_connections
  for insert
  to authenticated
  with check ((select auth.jwt() ->> 'role') in ('operator', 'admin'));

create policy hotel_supplier_connections_update_staff
  on public.hotel_supplier_connections
  for update
  to authenticated
  using ((select auth.jwt() ->> 'role') in ('operator', 'admin'))
  with check ((select auth.jwt() ->> 'role') in ('operator', 'admin'));

create policy hotel_supplier_connections_delete_staff
  on public.hotel_supplier_connections
  for delete
  to authenticated
  using ((select auth.jwt() ->> 'role') in ('operator', 'admin'));

-- room_supplier_mappings
create policy room_supplier_mappings_select_staff
  on public.room_supplier_mappings
  for select
  to authenticated
  using ((select auth.jwt() ->> 'role') in ('seo', 'editor', 'operator', 'admin'));

create policy room_supplier_mappings_insert_staff
  on public.room_supplier_mappings
  for insert
  to authenticated
  with check ((select auth.jwt() ->> 'role') in ('editor', 'operator', 'admin'));

create policy room_supplier_mappings_update_staff
  on public.room_supplier_mappings
  for update
  to authenticated
  using ((select auth.jwt() ->> 'role') in ('editor', 'operator', 'admin'))
  with check ((select auth.jwt() ->> 'role') in ('editor', 'operator', 'admin'));

create policy room_supplier_mappings_delete_staff
  on public.room_supplier_mappings
  for delete
  to authenticated
  using ((select auth.jwt() ->> 'role') in ('operator', 'admin'));

-- supplier_room_catalog
create policy supplier_room_catalog_select_staff
  on public.supplier_room_catalog
  for select
  to authenticated
  using ((select auth.jwt() ->> 'role') in ('seo', 'editor', 'operator', 'admin'));

create policy supplier_room_catalog_insert_staff
  on public.supplier_room_catalog
  for insert
  to authenticated
  with check ((select auth.jwt() ->> 'role') in ('operator', 'admin'));

create policy supplier_room_catalog_update_staff
  on public.supplier_room_catalog
  for update
  to authenticated
  using ((select auth.jwt() ->> 'role') in ('operator', 'admin'))
  with check ((select auth.jwt() ->> 'role') in ('operator', 'admin'));

create policy supplier_room_catalog_delete_staff
  on public.supplier_room_catalog
  for delete
  to authenticated
  using ((select auth.jwt() ->> 'role') in ('operator', 'admin'));

----------------------------------------------------------------
-- 5. Documentation
----------------------------------------------------------------

comment on table public.hotel_supplier_connections is
  'N bookable supplier connections per hotel (rate-shopping). Supersedes the single hotels.booking_mode. Read server-side by the booking orchestrator (service role).';
comment on table public.room_supplier_mappings is
  'Deterministic link from an editorial hotel_rooms row to one or more supplier room identities (Travelport labels/bookingCodes, RateHawk rg_ext). Replaces the runtime fuzzy matcher.';
comment on table public.supplier_room_catalog is
  'Cached supplier static room content (RateHawk room_groups, etc.). images[] is a NON-INDEXED funnel fallback only — never expose RateHawk media on index,follow pages.';

----------------------------------------------------------------
-- 6. Migration log entry (mandatory per supabase-rls.mdc)
----------------------------------------------------------------

insert into public._cct_sql_migrations (filename)
  values ('0071_multi_supplier_bookable_catalog.sql')
  on conflict do nothing;
