-- 0064 — Polish prerequisites for the 4 priority hotel fiches.
--
-- Context (2026-05-28)
-- --------------------
-- The "finalisation 4 fiches" task (Le Bristol Paris, Akelarre, Al Moudira,
-- Alila Jabal Akhdar) requires the photo pipeline + alt enrichment to run
-- against a clean catalogue. Three pre-flight gaps stand in the way:
--
--   1. Akelarre exists as **two published rows** — `akelarre` (the legacy
--      slug with the right `google_place_id` and 5 photos) and
--      `akelarre-restaurant-hotel` (a 2026-05-25 Relais & Châteaux scaffold
--      that landed published but with no hero, no gallery, no place_id).
--      Both live at indexable URLs → duplicate-content risk + Google
--      cannibalisation. Per ADR-0008 (flat slug) the canonical row stays
--      `akelarre`. We port the Relais & Châteaux affiliation jsonb entry
--      from the duplicate into the canonical row, register a 301 redirect,
--      and flip the duplicate to `is_published = false` (history kept).
--
--   2. `le-bristol-paris.google_place_id` is NULL — without it the
--      `--tier=places` step of `pnpm photos:sync` cannot fetch the
--      official Google-curated press shots. Resolved out-of-band via
--      `scripts/editorial-pilot/src/photos/lookup-bristol-place-id.ts`
--      (Google Places Text Search) → `ChIJVeUHqupv5kcR4taEicvH7ww`.
--
--   3. `commons_category` is NULL for `akelarre`, `al-moudira`,
--      `alila-jabal-akhdar` — these are the slugs that block the
--      `--tier=commons` step. Known categories from Wikimedia Commons:
--        - Akelarre        → `Akelarre Hotel` (Category exists, sparse).
--        - Al Moudira      → `Al Moudira Hotel`.
--        - Alila Jabal Akhdar → `Alila Jabal Akhdar`.
--      Le Bristol Paris already has `Hôtel Le Bristol Paris` set.
--
-- All four steps are idempotent (`coalesce` guards, `on conflict do nothing`,
-- `where ... is null`). Re-runs are safe.

-- ----------------------------------------------------------------
-- 1. Consolidate duplicate Akelarre row
-- ----------------------------------------------------------------

-- 1a. Port the Relais & Châteaux affiliation entry from the duplicate
--     into the canonical row (jsonb merge — skips if same source already
--     present on the canonical row, preserves existing CN Gold List entry).
update public.hotels canonical
set affiliations = canonical.affiliations || (
  select coalesce(
    jsonb_agg(dup_aff),
    '[]'::jsonb
  )
  from public.hotels duplicate,
       jsonb_array_elements(duplicate.affiliations) as dup_aff
  where duplicate.slug = 'akelarre-restaurant-hotel'
    and not exists (
      select 1
      from jsonb_array_elements(canonical.affiliations) as existing_aff
      where existing_aff->>'source' = dup_aff->>'source'
    )
)
where canonical.slug = 'akelarre';

-- 1b. Insert the 301 redirect from the duplicate slug → canonical slug.
--     Source path is locale-agnostic (the middleware strips the locale
--     prefix before matching against `redirects.source_path`).
insert into public.redirects (source_path, target_path, status_code, note)
  values (
    '/hotel/akelarre-restaurant-hotel',
    '/hotel/akelarre',
    301,
    'Migration 0064 — Akelarre duplicate consolidation (Relais & Châteaux scaffold landed published 2026-05-25).'
  )
  on conflict do nothing;

-- 1c. Flip the duplicate row to unpublished. We keep the row to preserve
--     the historical scaffold metadata (`affiliations`, `external_sources`,
--     scraped_at) — editors can audit, but the page is no longer reachable.
update public.hotels
set
  is_published = false,
  updated_at = timezone('utc', now())
where slug = 'akelarre-restaurant-hotel'
  and is_published = true;

-- ----------------------------------------------------------------
-- 2. Backfill `google_place_id` for Le Bristol Paris
-- ----------------------------------------------------------------

update public.hotels
set
  google_place_id = 'ChIJVeUHqupv5kcR4taEicvH7ww',
  updated_at = timezone('utc', now())
where slug = 'le-bristol-paris'
  and google_place_id is null;

-- ----------------------------------------------------------------
-- 3. Backfill `commons_category` for the 4 priority hotels
-- ----------------------------------------------------------------

update public.hotels
set
  commons_category = case slug
    when 'akelarre'            then 'Akelarre Hotel'
    when 'al-moudira'          then 'Al Moudira Hotel'
    when 'alila-jabal-akhdar'  then 'Alila Jabal Akhdar'
  end,
  updated_at = timezone('utc', now())
where slug in ('akelarre', 'al-moudira', 'alila-jabal-akhdar')
  and commons_category is null;

-- ----------------------------------------------------------------
-- 4. Migration log
-- ----------------------------------------------------------------

insert into public._cct_sql_migrations (filename, applied_at)
  values ('0064_hotels_polish_4_fiches.sql', timezone('utc', now()))
  on conflict do nothing;
