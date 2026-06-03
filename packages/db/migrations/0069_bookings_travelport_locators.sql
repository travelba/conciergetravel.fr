-- 0069 — Persist Travelport reservations in `public.bookings`.
--
-- Context (Travelport Phase 6, Étape C)
-- ----------------------------------------------------------------------------
-- The Travelport sandbox tunnel (apps/web `confirmTravelportSandboxReservation`)
-- now creates a real preprod reservation and must persist it like any other
-- booking so it surfaces in `/compte`, in the back-office and triggers the
-- confirmation e-mail. Two gaps versus the current schema:
--
--   1. `bookings_channel_ck` only allowed ('amadeus','little','email').
--      Travelport bookings need their own channel value.
--   2. A Travelport reservation returns three locators (Supplier = hotel
--      confirmation, Travelport = aggregator/PNR, Agency = our PCC). The
--      Supplier + aggregator locators are REQUIRED to cancel later, so they
--      must be stored. `amadeus_pnr` / `little_booking_id` already exist for
--      the other channels; we add the Travelport equivalents rather than
--      overloading them.
--
-- Forward-only. Additive + nullable columns and a widened CHECK constraint —
-- no data rewrite, safe on a populated table.
--
-- Skill: supabase-postgres-rls, booking-engine.

-- ----------------------------------------------------------------
-- 1. Widen the booking channel allow-list
-- ----------------------------------------------------------------

alter table public.bookings
  drop constraint if exists bookings_channel_ck;

alter table public.bookings
  add constraint bookings_channel_ck
  check (booking_channel in ('amadeus', 'little', 'email', 'travelport'));

-- ----------------------------------------------------------------
-- 2. Travelport locators (nullable — only set for travelport bookings)
-- ----------------------------------------------------------------

alter table public.bookings
  add column if not exists travelport_supplier_locator text;

alter table public.bookings
  add column if not exists travelport_aggregator_locator text;

alter table public.bookings
  add column if not exists travelport_agency_locator text;

-- ----------------------------------------------------------------
-- 3. Documentation
-- ----------------------------------------------------------------

comment on column public.bookings.travelport_supplier_locator is
  'Travelport "Supplier" locator = hotel confirmation number. REQUIRED (with the aggregator locator) to cancel the reservation. Null for non-travelport channels.';

comment on column public.bookings.travelport_aggregator_locator is
  'Travelport "Travelport" locator = aggregator / PNR. Used to retrieve/modify/cancel the reservation. Null for non-travelport channels.';

comment on column public.bookings.travelport_agency_locator is
  'Travelport "Agency" locator = our PCC record locator. Informational. Null for non-travelport channels.';

-- ----------------------------------------------------------------
-- 4. Migration log
-- ----------------------------------------------------------------

insert into public._cct_sql_migrations (filename, applied_at)
  values ('0069_bookings_travelport_locators.sql', timezone('utc', now()))
  on conflict do nothing;
