-- 0061 — Extend `hotels.luxury_tier` CHECK constraint with the `grecotel`
-- value to support the Grecotel Hotels & Resorts scaffold pass (Greek
-- national operator, Daskalantonakis Group, ~30 properties across Crete,
-- Corfu, Mykonos, Rhodes, Kos, Athens, Halkidiki, Peloponnese).
--
-- Context: Grecotel is the largest Greek hospitality group with a
-- mixed-tier portfolio (4★ family resorts → 5★ Luxe Me Exclusive Resorts).
-- The flagships (Amirandes, Cape Sounio, Caramel, Mandola Rosa, Corfu
-- Imperial, Mykonos Blu) earn the editorial line; the family-resort tail
-- is scaffolded as drafts and will be gated by editorial review before
-- publication. See scripts/editorial-pilot/src/global-sources/
-- scaffold-grecotel.ts for the exact scaffolding contract and
-- chain-mapping.ts (Wave C, P2) for the canonical metadata.
--
-- Rationale for a distinct tier (rather than reusing `self_5_star` for
-- the 5★ subset and tagging only via `external_sources`): consistent with
-- the policy adopted by migration 0059 for every named chain — a distinct
-- tier value drives the `/marque/grecotel` facet, the JSON-LD `award[]`
-- block from packages/seo/jsonld/hotel.ts, and any future cross-mesh
-- (e.g. "Top 10 Grecotel Luxe Resorts 2026" ranking page). It also avoids
-- the silent merge of Grecotel-branded inventory into the unaffiliated
-- `self_5_star` bucket.
--
-- Forward-only. Idempotent: `drop constraint if exists` + recreate with
-- the complete value list (carries over the 37 values from migration 0059
-- + adds `grecotel`).
--
-- Skill: supabase-postgres-rls, content-modeling.

alter table public.hotels
  drop constraint if exists hotels_luxury_tier_check;

alter table public.hotels
  add constraint hotels_luxury_tier_check check (
    luxury_tier is null
    or luxury_tier = any (
      array[
        -- Tiers from migration 0033 + earlier passes
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
        -- Tiers from migration 0059 (luxury chain gap closure)
        'bulgari',
        'six_senses',
        'ritz_carlton',
        'waldorf_astoria',
        'peninsula',
        'raffles',
        'jumeirah',
        'kempinski',
        'anantara',
        'dorchester',
        'cheval_blanc',
        'como',
        'viceroy',
        'capella',
        'oetker_collection',
        'soneva',
        'nayara',
        'grace_hotels',
        'nihi',
        -- New tier (this migration) — Wave C regional operator
        'grecotel'
      ]
    )
  );

insert into public._cct_sql_migrations (filename)
  values ('0061_hotels_luxury_tier_add_grecotel.sql')
  on conflict do nothing;
