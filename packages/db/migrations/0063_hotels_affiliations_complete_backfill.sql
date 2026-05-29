-- 0063 — Complete `hotels.affiliations` backfill from `luxury_tier`.
--
-- Context (audit follow-up 2026-05-28)
-- ------------------------------------
-- Migration 0062 backfilled `affiliations` from `external_sources` for the
-- 1466 hotels whose chain/label was traced there. That left two gaps:
--
--   1. Misclassification of Small Luxury Hotels of the World — 199 rows
--      arrived in `affiliations` with `kind = 'brand'` because they were
--      stored as `luxury_chain_xlsx` entries. SLH is a **consortium /
--      label**, not an operational brand. Fix: rewrite those 199 entries
--      with `kind = 'label'`.
--
--   2. 332 hotels carry a `luxury_tier` value (`world_50_best`,
--      `tl_worlds_best`, `cn_gold_list`, `lhw_member`,
--      `palace_atout_france`, `forbes_5_star`, `michelin_3_keys`, plus
--      24 SLH and the brand tiers that never made it through the xlsx
--      scaffold pass like `aman`, `park_hyatt`, `four_seasons`,
--      `rosewood`, etc.). They have **no** entry in `external_sources`,
--      hence no entry in `affiliations` after 0062. Fix: derive a single
--      affiliation entry from `luxury_tier`.
--
-- The mapping below uses three kinds:
--
--   `label`    — consortia and verified distinctions:
--                relais_chateaux, small_luxury_hotels, lhw_member,
--                palace_atout_france, forbes_5_star, michelin_3_keys
--
--   `ranking`  — annual editorial lists:
--                world_50_best, tl_worlds_best, cn_gold_list
--
--   `brand`    — operational chains (mono-affiliation):
--                aman, belmond, rosewood, four_seasons, ritz_carlton_reserve,
--                mandarin_oriental, park_hyatt, st_regis, fairmont,
--                bulgari, six_senses, ritz_carlton, waldorf_astoria,
--                peninsula, raffles, jumeirah, kempinski, anantara,
--                dorchester, cheval_blanc, como, viceroy, capella,
--                oetker_collection, soneva, nayara, grace_hotels, nihi,
--                grecotel
--
-- Skipped: `self_5_star` (generic positioning, not a third-party
-- affiliation).
--
-- Forward-only. Idempotent: the second update only fires when an entry
-- of the same `(kind, source)` is not already present in `affiliations`.
--
-- Skill: supabase-postgres-rls, content-modeling.
-- ADR: docs/adr/0023-hotel-affiliations-vs-external-sources.md.

-- ----------------------------------------------------------------
-- 1. FIX — small_luxury_hotels miscategorised as kind=brand
-- ----------------------------------------------------------------

update public.hotels h
set affiliations = (
  select jsonb_agg(
    case
      when aff->>'source' = 'small_luxury_hotels'
        then jsonb_set(aff, '{kind}', '"label"'::jsonb)
      else aff
    end
  )
  from jsonb_array_elements(h.affiliations) as aff
)
where exists (
  select 1
  from jsonb_array_elements(h.affiliations) as aff
  where aff->>'source' = 'small_luxury_hotels'
    and aff->>'kind' = 'brand'
);

-- ----------------------------------------------------------------
-- 2. BACKFILL — derive an affiliation entry from luxury_tier
-- ----------------------------------------------------------------

with tier_mapping as (
  -- Single source of truth for the tier → affiliation mapping. The
  -- migration is forward-only; if a new luxury_tier value is added in a
  -- later migration, add the matching row here in that migration.
  select * from (values
    -- LABEL kind
    ('relais_chateaux',      'label',   'relais_chateaux',      'Relais & Châteaux',                       'relais-chateaux'),
    ('small_luxury_hotels',  'label',   'small_luxury_hotels',  'Small Luxury Hotels of the World',        'small-luxury-hotels'),
    ('lhw_member',           'label',   'lhw_member',           'The Leading Hotels of the World',         'leading-hotels-of-the-world'),
    ('palace_atout_france',  'label',   'palace_atout_france',  'Palace (distinction Atout France)',       'palace-atout-france'),
    ('forbes_5_star',        'label',   'forbes_5_star',        'Forbes Travel Guide Five-Star',           'forbes-5-star'),
    ('michelin_3_keys',      'label',   'michelin_3_keys',      'Michelin Guide — Three Keys',             'michelin-3-keys'),

    -- RANKING kind
    ('world_50_best',        'ranking', 'world_50_best',        'World''s 50 Best Hotels',                 'world-50-best'),
    ('tl_worlds_best',       'ranking', 'tl_worlds_best',       'Travel + Leisure World''s Best',          'travel-leisure-worlds-best'),
    ('cn_gold_list',         'ranking', 'cn_gold_list',         'Condé Nast Traveler Gold List',           'conde-nast-gold-list'),

    -- BRAND kind
    ('aman',                 'brand',   'aman',                 'Aman Resorts',                            'aman'),
    ('belmond',              'brand',   'belmond',              'Belmond',                                 'belmond'),
    ('rosewood',             'brand',   'rosewood',             'Rosewood Hotels & Resorts',               'rosewood'),
    ('four_seasons',         'brand',   'four_seasons',         'Four Seasons Hotels & Resorts',           'four-seasons'),
    ('ritz_carlton_reserve', 'brand',   'ritz_carlton_reserve', 'The Ritz-Carlton Reserve',                'ritz-carlton-reserve'),
    ('mandarin_oriental',    'brand',   'mandarin_oriental',    'Mandarin Oriental',                       'mandarin-oriental'),
    ('park_hyatt',           'brand',   'park_hyatt',           'Park Hyatt',                              'park-hyatt'),
    ('st_regis',             'brand',   'st_regis',             'St. Regis Hotels & Resorts',              'st-regis'),
    ('fairmont',             'brand',   'fairmont',             'Fairmont Hotels & Resorts',               'fairmont'),
    ('bulgari',              'brand',   'bulgari',              'Bulgari Hotels & Resorts',                'bulgari'),
    ('six_senses',           'brand',   'six_senses',           'Six Senses Hotels Resorts Spas',          'six-senses'),
    ('ritz_carlton',         'brand',   'ritz_carlton',         'The Ritz-Carlton',                        'ritz-carlton'),
    ('waldorf_astoria',      'brand',   'waldorf_astoria',      'Waldorf Astoria',                         'waldorf-astoria'),
    ('peninsula',            'brand',   'peninsula',            'The Peninsula Hotels',                    'peninsula'),
    ('raffles',              'brand',   'raffles',              'Raffles Hotels & Resorts',                'raffles'),
    ('jumeirah',             'brand',   'jumeirah',             'Jumeirah Hotels & Resorts',               'jumeirah'),
    ('kempinski',            'brand',   'kempinski',            'Kempinski Hotels',                        'kempinski'),
    ('anantara',             'brand',   'anantara',             'Anantara Hotels & Resorts',               'anantara'),
    ('dorchester',           'brand',   'dorchester',           'Dorchester Collection',                   'dorchester'),
    ('cheval_blanc',         'brand',   'cheval_blanc',         'Cheval Blanc',                            'cheval-blanc'),
    ('como',                 'brand',   'como',                 'COMO Hotels & Resorts',                   'como'),
    ('viceroy',              'brand',   'viceroy',              'Viceroy Hotels & Resorts',                'viceroy'),
    ('capella',              'brand',   'capella',              'Capella Hotels & Resorts',                'capella'),
    ('oetker_collection',    'brand',   'oetker_collection',    'Oetker Collection',                       'oetker-collection'),
    ('soneva',               'brand',   'soneva',               'Soneva',                                  'soneva'),
    ('nayara',               'brand',   'nayara',               'Nayara Hotels',                           'nayara'),
    ('grace_hotels',         'brand',   'grace_hotels',         'Grace Hotels',                            'grace-hotels'),
    ('nihi',                 'brand',   'nihi',                 'NIHI Hotels',                             'nihi'),
    ('grecotel',             'brand',   'grecotel',             'Grecotel Hotels & Resorts',               'grecotel')
  ) as t(tier_value, kind_value, source_value, display_name_value, facet_slug_value)
)
update public.hotels h
set affiliations = h.affiliations || jsonb_build_array(
  jsonb_build_object(
    'kind',         tm.kind_value,
    'source',       tm.source_value,
    'display_name', tm.display_name_value,
    'verified',     true,
    'facet_slug',   tm.facet_slug_value
  )
)
from tier_mapping tm
where h.luxury_tier = tm.tier_value
  and not exists (
    select 1
    from jsonb_array_elements(h.affiliations) as existing_aff
    where existing_aff->>'source' = tm.source_value
  );

-- ----------------------------------------------------------------
-- 3. Migration log
-- ----------------------------------------------------------------

insert into public._cct_sql_migrations (filename, applied_at)
  values ('0063_hotels_affiliations_complete_backfill.sql', timezone('utc', now()))
  on conflict do nothing;
