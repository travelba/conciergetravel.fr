-- 0079 — list reads no longer pull description_fr / description_en.
--
-- The published catalogue (~2 900 hotels) was selected in full, descriptions
-- included, on every public render (pages 0–999, 1000–1999, 2000–2499).
-- That was ~8 MB per pass and tens of GB of egress per day. List surfaces
-- only show a short excerpt (cards cut at 200 characters, JSONL summaries
-- prefer factual_summary and otherwise 280). These views return that
-- excerpt under the same column names so callers stay unchanged.
-- Detail pages keep reading `hotels` / `hotel_rooms` directly.
--
-- The affiliation RPC used by /marque and /label returned the same full
-- columns. It now returns the excerpt too.

create or replace view public.hotels_published_list
with (security_invoker = true) as
select
  h.id,
  h.slug,
  h.slug_en,
  h.name,
  h.name_en,
  h.city,
  h.district,
  h.region,
  h.country_code,
  h.country_label_fr,
  h.country_label_en,
  h.luxury_tier,
  h.is_palace,
  h.stars,
  h.priority,
  left(h.description_fr, 320) as description_fr,
  left(h.description_en, 320) as description_en,
  h.hero_image,
  h.amadeus_hotel_id,
  h.latitude,
  h.longitude,
  h.affiliations,
  h.is_published
from public.hotels h
where h.is_published = true;

comment on view public.hotels_published_list is
  'Published hotels for lists and hubs. description_fr/en are 320-character excerpts. Full text stays on hotels.';

grant select on public.hotels_published_list to anon, authenticated, service_role;

create or replace view public.hotel_rooms_list
with (security_invoker = true) as
select
  r.id,
  r.hotel_id,
  r.slug,
  r.room_code,
  r.name_fr,
  r.name_en,
  left(r.description_fr, 400) as description_fr,
  left(r.description_en, 400) as description_en,
  r.max_occupancy,
  r.bed_type,
  r.size_sqm,
  r.amenities,
  r.is_signature,
  r.indicative_price_minor,
  r.display_order,
  r.hero_image,
  r.images
from public.hotel_rooms r;

comment on view public.hotel_rooms_list is
  'Room cards on a hotel page. Short descriptions only. The room page reads hotel_rooms, including the long text.';

grant select on public.hotel_rooms_list to anon, authenticated, service_role;

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
    left(h.description_fr, 320),
    left(h.description_en, 320),
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
    h.name,
    h.id
  limit greatest(1, least(coalesce(p_limit, 1500), 20000));
$$;

comment on function public.published_hotels_by_affiliation(text, text, integer) is
  'Published hotels for one affiliation facet. Descriptions are 320-character excerpts. The limit follows the full catalogue, not the old 3000 cap. Migration 0079.';

insert into public._cct_sql_migrations (filename)
values ('0079_hotel_list_excerpts.sql')
on conflict do nothing;
