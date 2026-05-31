-- 0066 — Add the two columns `hotel_rooms` is missing vs the app contract.
--
-- Context (Wave 4 rooms seed, 2026-05-31)
-- ----------------------------------------------------------------------------
-- `apps/web/src/server/hotels/get-room-by-slug.ts` selects
-- `ROOM_DETAIL_COLUMNS` which includes `is_signature` and
-- `indicative_price_minor`. Neither column exists on `public.hotel_rooms`
-- yet (the table was scaffolded before those fields were added to the
-- read contract). Because the table is empty (0 rows) the missing-column
-- error never surfaced — but the moment a room is seeded, the PostgREST
-- SELECT would error on the unknown columns and `getRoomBySlug` would
-- return `null` → the sub-page would 404 for every room.
--
-- This migration aligns the schema with the read contract so the
-- already-shipped room sub-page (`/hotel/[slug]/chambres/[roomSlug]`)
-- works as soon as `hotel_rooms` is populated.
--
--   - `is_signature boolean not null default false`
--       Drives the "Suite signature" badge + meta-title suffix and the
--       destination-hub `ItemList` inclusion rule (only signature suites
--       surface on `/destination/[city]`). Defaults to false so no room
--       is wrongly promoted.
--   - `indicative_price_minor jsonb` (nullable)
--       Optional editorial "from / to" indicative price in minor units.
--       Shape `{ from:int, to?:int, currency:'EUR'|'USD'|'GBP'|'CHF' }`
--       validated app-side by `IndicativePriceMinorDetailSchema` (Zod).
--       NOT a live Amadeus rate — booking pricing stays Phase 6 (frozen).
--       Left null by the Wave 4 seed (no fabricated prices).
--
-- Forward-only. Idempotent (`add column if not exists`).
--
-- Skill: supabase-postgres-rls, content-modeling.
-- ADR: docs/adr/0009-hotel-room-subpages-indexable.md.

-- ----------------------------------------------------------------
-- 1. DDL — add the two missing columns
-- ----------------------------------------------------------------

alter table public.hotel_rooms
  add column if not exists is_signature boolean not null default false;

alter table public.hotel_rooms
  add column if not exists indicative_price_minor jsonb;

-- Shape guard for the optional price object (array/scalar rejected).
alter table public.hotel_rooms
  drop constraint if exists hotel_rooms_indicative_price_shape_ck;

alter table public.hotel_rooms
  add constraint hotel_rooms_indicative_price_shape_ck
  check (
    indicative_price_minor is null
    or jsonb_typeof(indicative_price_minor) = 'object'
  );

-- Partial index for the destination-hub signature-suite query
-- (`where is_signature = true`).
create index if not exists hotel_rooms_signature_idx
  on public.hotel_rooms (hotel_id)
  where is_signature = true;

-- ----------------------------------------------------------------
-- 2. Documentation
-- ----------------------------------------------------------------

comment on column public.hotel_rooms.is_signature is
  'When true, the room is a signature suite: gets the "Suite signature" badge + meta-title suffix and is eligible for the /destination/[city] ItemList. Default false.';

comment on column public.hotel_rooms.indicative_price_minor is
  'Optional editorial indicative price in minor units: { from:int, to?:int, currency:''EUR''|''USD''|''GBP''|''CHF'' }. Validated app-side (IndicativePriceMinorDetailSchema). NOT a live booking rate — Amadeus pricing is Phase 6.';

-- ----------------------------------------------------------------
-- 3. Migration log
-- ----------------------------------------------------------------

insert into public._cct_sql_migrations (filename, applied_at)
  values ('0066_hotel_rooms_signature_price_columns.sql', timezone('utc', now()))
  on conflict do nothing;
