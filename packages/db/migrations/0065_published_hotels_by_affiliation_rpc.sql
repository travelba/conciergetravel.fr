-- 0065 — `published_hotels_by_affiliation` RPC for /marque + /label routes.
--
-- Context (2026-05-29 / 2026-05-31)
-- ---------------------------------
-- Migration 0063 backfilled `hotels.affiliations jsonb` with 14 brands and 6
-- labels backed by a GIN index (`hotels_affiliations_gin`).
--
-- The `/marque/[brandSlug]` and `/label/[facetSlug]` routes need to list every
-- hotel matching one affiliation facet. Naïve approach (PostgREST
-- `.contains('affiliations', [{...}])`) fails for two reasons:
--   1. The default PostgREST `max-rows` cap (Supabase: 1000) hides the
--      P2 scaffold drafts — e.g. all 100 Ritz-Carlton rows sit past the
--      cap because they share `priority = 'P2'`.
--   2. The Supabase JS client's `.contains()` helper serializes JSONB
--      array payloads in a way that PostgREST does NOT translate into
--      the `@>` operator: a direct `SELECT count(*) … affiliations @>
--      '[{"facet_slug":"relais-chateaux","verified":true,"kind":"label"}]'`
--      returns 478, while the route returned 0 (cf. commit 369406b
--      "Known issue" footer).
--
-- Solving both at the same time: expose a stable RPC that performs the
-- containment server-side. PostgREST then sees a single function call
-- with primitive arguments — no JSONB serialisation surprises — and the
-- result set is not subject to the table-level row cap.
--
-- Skill: supabase-postgres-rls §RPC for facet pages.
-- Surface: apps/web/src/server/hotels/get-hotel-by-slug.ts
--          → listPublishedHotelsByAffiliation()
-- Routes:  /marque/[brandSlug], /label/[facetSlug]

create or replace function public.published_hotels_by_affiliation(
  p_facet_slug text,
  p_kind       text default null,
  p_limit      integer default 1500
)
returns table (
  slug              text,
  slug_en           text,
  name              text,
  name_en           text,
  city              text,
  region            text,
  stars             smallint,
  is_palace         boolean,
  priority          text,
  hero_image        text,
  description_fr    text,
  description_en    text,
  country_code      text,
  country_label_fr  text,
  country_label_en  text,
  affiliations      jsonb
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  -- Build the containment matcher inline. The GIN index on `affiliations`
  -- still applies because PostgreSQL recognises `jsonb_build_array(...)`
  -- as a stable expression and pushes the @> predicate through it.
  --
  -- `p_kind` is optional — when NULL the matcher omits the `kind` key,
  -- which matches any affiliation kind (label, brand, ranking, guide).
  -- Most callers pass an explicit kind to keep `dorchester` (brand) and
  -- `dorchester` (label) cleanly separated, but `null` is supported for
  -- future cross-kind lookups.
  select
    h.slug,
    h.slug_en,
    h.name,
    h.name_en,
    h.city,
    h.region,
    h.stars,
    h.is_palace,
    h.priority,
    h.hero_image,
    h.description_fr,
    h.description_en,
    h.country_code::text,
    h.country_label_fr,
    h.country_label_en,
    h.affiliations
  from public.hotels h
  where h.is_published = true
    and h.affiliations @> case
      when p_kind is null then
        jsonb_build_array(jsonb_build_object(
          'facet_slug', p_facet_slug,
          'verified',   true
        ))
      else
        jsonb_build_array(jsonb_build_object(
          'facet_slug', p_facet_slug,
          'verified',   true,
          'kind',       p_kind
        ))
    end
  order by
    case h.priority when 'P0' then 0 when 'P1' then 1 else 2 end,
    h.name
  limit greatest(1, least(coalesce(p_limit, 1500), 3000));
$$;

-- The function is read-only and routes via RLS through the table's
-- existing `is_published = true` filter — safe to expose to all roles.
revoke all on function public.published_hotels_by_affiliation(text, text, integer) from public;
grant execute on function public.published_hotels_by_affiliation(text, text, integer)
  to anon, authenticated, service_role;

comment on function public.published_hotels_by_affiliation(text, text, integer) is
  'List published hotels carrying a verified affiliation with the given facet_slug (and optional kind). Powers /marque/[brandSlug] and /label/[facetSlug]. Bypasses the PostgREST max-rows cap that hides P2-only chains like Ritz-Carlton. Migration 0065.';

-- Migration ledger
insert into public._cct_sql_migrations (filename) values ('0065_published_hotels_by_affiliation_rpc.sql')
  on conflict do nothing;
