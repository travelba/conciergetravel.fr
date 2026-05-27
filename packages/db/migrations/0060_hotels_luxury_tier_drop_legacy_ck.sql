-- 0060_hotels_luxury_tier_drop_legacy_ck.sql
--
-- Migration 0059 extended the `hotels_luxury_tier_check` CHECK constraint
-- but the table had a DUPLICATE legacy constraint named `hotels_luxury_tier_ck`
-- (no `_check` suffix) that still listed only the original 19 tier values.
-- Inserts with the new tiers (`six_senses`, `bulgari`, `cheval_blanc`,
-- `kempinski`, `ritz_carlton`, `waldorf_astoria`, `peninsula`, `raffles`,
-- `jumeirah`, `dorchester`, `como`, `viceroy`, `capella`, `oetker_collection`,
-- `soneva`, `nayara`, `grace_hotels`, `nihi`, `anantara`, `fairmont`) failed
-- silently against the legacy constraint with `code: 23514`.
--
-- The two constraints are functionally identical (same column, same shape).
-- We drop the legacy one — `hotels_luxury_tier_check` (kept) is the canonical
-- source of truth.
--
-- Skill: editorial-pilot, supabase-postgres-rls.

alter table public.hotels
  drop constraint if exists hotels_luxury_tier_ck;

insert into public._cct_sql_migrations (filename)
  values ('0060_hotels_luxury_tier_drop_legacy_ck.sql')
  on conflict do nothing;
