-- 0078 — `list_indexable_hotel_slugs` RPC for /sitemaps/hotels.xml.
--
-- Context (2026-06-23)
-- --------------------
-- `listIndexableHotelSlugs()` (apps/web/src/server/hotels/get-hotel-by-slug.ts)
-- fed the hotels sub-sitemap. It selected the full heavy JSONB payload
-- (long_description_sections, faq_content, gallery_images) for every
-- published hotel just to evaluate the indexability predicate in JS.
--
-- Two problems compounded:
--   1. `.limit(5000)` was silently clamped to Supabase `db_max_rows=1000`,
--      so the sitemap only emitted the first 1 000 of 2 219 hotels.
--   2. The naive fix (`.range()` pagination over all 2 219 rows) transferred
--      ~100 MB of section/FAQ bodies across 3 sequential round-trips; a later
--      page threw (payload/time), the reader's outer catch returned [], and
--      the sitemap rendered an EMPTY <urlset> in production.
--
-- Fix: evaluate the indexability predicate server-side and return only the
-- three columns the sitemap needs (slug, slug_en, updated_at). The payload
-- drops from ~100 MB to a few hundred KB, the row cap no longer applies
-- (set-returning function), and a single round-trip covers the whole
-- catalogue.
--
-- IMPORTANT — lockstep with `isHotelIndexable`
-- --------------------------------------------
-- The predicate below MUST mirror `apps/web/src/server/hotels/indexability.ts`
-- (`isHotelIndexable`), which also gates the hotel page's `noindex` flag and
-- the llms-full.txt corpus. A divergence would let the sitemap advertise a
-- URL the page marks noindex (or vice-versa) and tank crawl budget. The two
-- paths to indexability:
--   1. Photo-rich:  hero_image present AND (>=5 gallery photos OR >=1 section)
--   2. Editorial:   >=1 long_description_section
--                   OR (description_fr >= 600 chars AND factual_summary_fr
--                       >= 100 chars AND concierge_advice non-null object
--                       AND faq_content >= 10 items)
--
-- Skill: supabase-postgres-rls §RPC for sitemap scaling, seo-technical.
-- Surface: apps/web/src/server/hotels/get-hotel-by-slug.ts
--          → listIndexableHotelSlugs()
-- Route:   /sitemaps/hotels.xml

create or replace function public.list_indexable_hotel_slugs()
returns table (
  slug       text,
  slug_en    text,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    h.slug,
    h.slug_en,
    h.updated_at
  from public.hotels h
  where h.is_published = true
    and (
      -- Path 1 — photo-rich.
      (
        h.hero_image is not null
        and length(h.hero_image) > 0
        and (
          (case when jsonb_typeof(h.gallery_images) = 'array'
                then jsonb_array_length(h.gallery_images) else 0 end) >= 5
          or (case when jsonb_typeof(h.long_description_sections) = 'array'
                   then jsonb_array_length(h.long_description_sections) else 0 end) > 0
        )
      )
      -- Path 2a — at least one long-form section.
      or (case when jsonb_typeof(h.long_description_sections) = 'array'
               then jsonb_array_length(h.long_description_sections) else 0 end) > 0
      -- Path 2b — full editorial publish-gate set.
      or (
        coalesce(length(h.description_fr), 0) >= 600
        and coalesce(length(h.factual_summary_fr), 0) >= 100
        and h.concierge_advice is not null
        and jsonb_typeof(h.concierge_advice) = 'object'
        and (case when jsonb_typeof(h.faq_content) = 'array'
                  then jsonb_array_length(h.faq_content) else 0 end) >= 10
      )
    )
  order by h.priority asc, h.slug asc;
$$;

-- Read-only, routes through the table's existing `is_published = true`
-- filter — safe to expose to all roles.
revoke all on function public.list_indexable_hotel_slugs() from public;
grant execute on function public.list_indexable_hotel_slugs()
  to anon, authenticated, service_role;

comment on function public.list_indexable_hotel_slugs() is
  'List slug/slug_en/updated_at for every indexable published hotel (mirrors isHotelIndexable). Powers /sitemaps/hotels.xml without transferring heavy JSONB bodies or hitting the PostgREST max-rows cap. Migration 0078.';

-- Migration ledger
insert into public._cct_sql_migrations (filename) values ('0078_list_indexable_hotel_slugs_rpc.sql')
  on conflict do nothing;
