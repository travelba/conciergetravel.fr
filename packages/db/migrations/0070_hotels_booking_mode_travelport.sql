-- 0070 — Allow `booking_mode = 'travelport'` on `public.hotels`.
--
-- Context (Travelport Phase 6, Étape D — convergence par la donnée)
-- ----------------------------------------------------------------------------
-- The Travelport pilot was previously routed by an env allow-list of slugs
-- (`TRAVELPORT_SAMPLE_SLUGS`) decoupled from `hotels.booking_mode`. We now make
-- `booking_mode = 'travelport'` the single source of truth so editors can
-- enable the live Travelport funnel per hotel from the back-office, with
-- `TRAVELPORT_SANDBOX_ENABLED` kept as a global kill-switch.
--
-- `hotels_booking_mode_ck` (0001) only allowed
-- ('amadeus','little','email','display_only'). Widen it to add 'travelport'.
--
-- Forward-only. A widened CHECK constraint — no data rewrite, safe on a
-- populated table.
--
-- Skill: supabase-postgres-rls, backoffice-cms.

-- ----------------------------------------------------------------
-- 1. Widen the hotel booking-mode allow-list
-- ----------------------------------------------------------------

alter table public.hotels
  drop constraint if exists hotels_booking_mode_ck;

alter table public.hotels
  add constraint hotels_booking_mode_ck
  check (booking_mode in ('amadeus', 'little', 'travelport', 'email', 'display_only'));

-- ----------------------------------------------------------------
-- 2. Migration log
-- ----------------------------------------------------------------

insert into public._cct_sql_migrations (filename, applied_at)
  values ('0070_hotels_booking_mode_travelport.sql', timezone('utc', now()))
  on conflict do nothing;
