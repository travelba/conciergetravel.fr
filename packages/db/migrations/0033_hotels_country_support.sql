-- 0033 — International hotels support.
--
-- Until now MCH only listed French hotels: schema enforced `region not null`
-- with no country column. To support Yonder + Travel & Leisure + Condé Nast
-- Gold List + World's 50 Best, we add :
--
--   - `country_code` (ISO 3166-1 alpha-2, default 'FR' for backward compat)
--   - `country_label_fr` / `country_label_en` for display
--   - `region` becomes nullable (foreign hotels don't have a French admin region)
--   - `luxury_tier` enum-like column to track which premium "label" earned
--     the hotel its MCH listing (Atout France Palace = FR canonical, plus
--     Forbes 5-Star / Michelin Keys / LHW / R&C / Aman etc. abroad).
--
-- The existing `stars = 5` CHECK is preserved : abroad we rely on the
-- `luxury_tier` proxy + `is_palace` flag for "palace-equivalent" hotels.
--
-- Mirror : `apps/web/src/server/hotels/get-hotel-by-slug.ts` Zod schema will
-- be updated in a follow-up commit to expose these fields downstream.

alter table public.hotels
  add column if not exists country_code char(2) not null default 'FR';

alter table public.hotels
  add column if not exists country_label_fr text;

alter table public.hotels
  add column if not exists country_label_en text;

alter table public.hotels
  alter column region drop not null;

alter table public.hotels
  add column if not exists luxury_tier text;

-- Drop and recreate the CHECK so the migration is idempotent when re-run.
alter table public.hotels
  drop constraint if exists hotels_luxury_tier_ck;

alter table public.hotels
  add constraint hotels_luxury_tier_ck check (
    luxury_tier is null or luxury_tier in (
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
      'self_5_star'
    )
  );

create index if not exists hotels_country_code_idx on public.hotels(country_code);

comment on column public.hotels.country_code is
  'ISO 3166-1 alpha-2 country code. Default ''FR''. Required for international hotels added via Yonder/T&L/CN/W50 ingestion (May 2026).';

comment on column public.hotels.luxury_tier is
  'Premium label that earned the hotel its MCH listing. ''palace_atout_france'' is the FR canonical (32 hotels). Foreign hotels use Forbes/Michelin Keys/LHW/R&C/brand-flagship as a proxy. See migration 0033 header for the full enum.';

insert into public._cct_sql_migrations (filename) values ('0033_hotels_country_support.sql')
  on conflict do nothing;
