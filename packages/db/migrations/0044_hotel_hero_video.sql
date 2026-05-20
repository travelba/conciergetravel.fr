-- 0044 — Hotels: `hero_video` jsonb (CDC §2 bloc 2, B8).
--
-- Adds the optional hero video payload surfaced under the
-- `<HotelVideo>` Server Component and emitted as a Schema.org
-- `VideoObject` JSON-LD entry (see `packages/seo/src/jsonld/video-object.ts`).
--
-- Shape mirrors `VideoObjectInput`:
--   {
--     name: string,                  -- e.g. "Visite immersive — Hôtel X"
--     description: string,           -- 100-200 char editorial caption
--     thumbnailUrl: string | string[],
--     uploadDate: 'YYYY-MM-DD',      -- date of editorial publication
--     contentUrl?: string,           -- public MP4 / HLS
--     embedUrl?: string,             -- Cloudinary player URL
--     duration?: string,             -- ISO 8601, e.g. 'PT45S'
--     width?: int,
--     height?: int,
--     caption?: string
--   }
--
-- Constraint: `contentUrl` OR `embedUrl` must be provided (enforced
-- by the Zod schema mirror at read time + by Payload at edit time).
--
-- Skill: structured-data-schema-org, content-modeling.

alter table public.hotels
  add column if not exists hero_video jsonb;

comment on column public.hotels.hero_video is
  'CDC §2 bloc 2 hero video (B8). jsonb mirroring `VideoObjectInput`: {name, description, thumbnailUrl, uploadDate, contentUrl|embedUrl, duration?, width?, height?, caption?}. Optional — null means no hero video, the `<HotelVideo>` component renders no node and the JSON-LD `VideoObject` is omitted.';

insert into public._cct_sql_migrations (filename)
values ('0044_hotel_hero_video.sql')
  on conflict do nothing;
