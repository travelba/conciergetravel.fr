-- 0059 — Extend `hotels.luxury_tier` CHECK constraint with the 18 luxury
-- chain + boutique tiers required for the catalogue gap closure
-- (Plan: Catalogue luxury gap closure — 749 hôtels en 4 vagues).
--
-- Context: the existing CHECK constraint on `luxury_tier` (introduced
-- by migration 0033 + extended by later passes) accepts these values:
--
--   palace_atout_france, forbes_5_star, michelin_3_keys, lhw_member,
--   relais_chateaux, small_luxury_hotels, aman, belmond, rosewood,
--   four_seasons, ritz_carlton_reserve, mandarin_oriental, park_hyatt,
--   st_regis, fairmont, world_50_best, tl_worlds_best, cn_gold_list,
--   self_5_star
--
-- The 749 missing hotels surfaced by `chaines_hotelières_luxe_monde.xlsx`
-- + `boutique_hotels_monde.xlsx` (May 2026) require 18 additional brand
-- tiers so that scaffolded drafts can carry the canonical chain signal:
--
--   * mainstream chains (Wave B): ritz_carlton (mainstream tier, distinct
--     from the existing ritz_carlton_reserve), waldorf_astoria, peninsula,
--     raffles, jumeirah, kempinski, anantara, dorchester
--   * ultra-luxe chains (Wave A): bulgari, six_senses
--   * boutique ultra-luxe (Wave D): cheval_blanc, como, viceroy, capella,
--     oetker_collection, soneva, nayara, grace_hotels, nihi
--
-- Rationale for separate tier per chain (rather than a generic
-- `luxury_chain` blob): the Concierge brand promise hinges on the
-- editorial cross-mesh (`/recherche?chain=aman`, "autres Mandarin
-- Oriental dans le monde", ranking pages "Top 25 Aman 2026"). A
-- distinct tier value is the simplest signal both for the search
-- facet and for the JSON-LD `award[]` block emitted by
-- packages/seo/jsonld/hotel.ts.
--
-- Forward-only. To remove a tier, write a successor migration —
-- altering the CHECK in place would silently invalidate rows scaffolded
-- in the meantime.
--
-- Idempotent: `drop constraint ... if exists` + recreate with the
-- complete value list.
--
-- Skill: supabase-postgres-rls, content-modeling.

alter table public.hotels
  drop constraint if exists hotels_luxury_tier_check;

alter table public.hotels
  add constraint hotels_luxury_tier_check check (
    luxury_tier is null
    or luxury_tier = any (
      array[
        -- Existing tiers (must stay listed verbatim)
        'palace_atout_france',
        'forbes_5_star',
        'michelin_3_keys',
        'lhw_member',
        'relais_chateaux',
        'small_luxury_hotels',
        'aman',
        'belmond',
        'rosewood',
        'four_seasons',
        'ritz_carlton_reserve',
        'mandarin_oriental',
        'park_hyatt',
        'st_regis',
        'fairmont',
        'world_50_best',
        'tl_worlds_best',
        'cn_gold_list',
        'self_5_star',
        -- New tiers — Wave A (ultra-luxe partially in DB)
        'bulgari',
        'six_senses',
        -- New tiers — Wave B (mainstream-premium chains)
        'ritz_carlton',
        'waldorf_astoria',
        'peninsula',
        'raffles',
        'jumeirah',
        'kempinski',
        'anantara',
        'dorchester',
        -- New tiers — Wave D (boutique ultra-luxe)
        'cheval_blanc',
        'como',
        'viceroy',
        'capella',
        'oetker_collection',
        'soneva',
        'nayara',
        'grace_hotels',
        'nihi'
      ]
    )
  );

insert into public._cct_sql_migrations (filename)
  values ('0059_hotels_luxury_tier_extended_chains.sql')
  on conflict do nothing;
