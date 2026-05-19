-- 0034 — Hotels gallery_images: document external photo entries.
--
-- Context (May 2026)
-- ------------------
-- Migration 0008 introduced `gallery_images jsonb` as an array of
-- Cloudinary-shaped records:
--     { public_id, alt_fr?, alt_en?, category? }
--
-- The 337 Tier-1 international hotels seeded in May 2026
-- (`feat/intl-phase-2-polish`) ship photos from Wikimedia Commons +
-- Tavily — direct HTTPS URLs, not Cloudinary uploads. To densify those
-- fiches without first re-uploading every Commons file to Cloudinary
-- (cost + license attribution drift), we widen the contract of
-- `gallery_images` to accept TWO entry shapes living side-by-side in
-- the same JSONB array:
--
--   1. Cloudinary entry (existing, unchanged) :
--      {
--        public_id : 'cct/hotels/<slug>/<n>',  -- mandatory
--        alt_fr?, alt_en?, category?
--      }
--
--   2. External entry (new, additive) :
--      {
--        url        : 'https://…',             -- mandatory
--        caption    : '…',                     -- mandatory (CDC §2 +
--                                              -- Schema.org ImageObject.caption)
--        source     : 'wikimedia_commons' | 'tavily',
--        attribution: 'CC BY-SA Wikimedia Commons contributors' | '<domain>',
--        category?  : 'exterior' | 'interior' | 'room' | 'restaurant'
--                   | 'spa' | 'pool' | 'lobby' | 'view' | 'detail',
--        width?, height? : positive integers when known,
--        alt_fr?, alt_en? : copied from caption for downstream
--                           localisation fallback.
--      }
--
-- Discrimination key:
--   - `public_id` present and string → Cloudinary entry.
--   - `url` present and HTTPS string → external entry.
--
-- This is a JSONB shape contract — no DDL change is necessary. We use
-- this migration to update the column comment so downstream tooling
-- (Payload back-office, Zod reader in
-- `apps/web/src/server/hotels/get-hotel-by-slug.ts`) is aware of the
-- second shape and can opt into rendering it.
--
-- The strict Zod `GalleryImagesSchema` in `get-hotel-by-slug.ts` will
-- be widened in a follow-up PR (parent agent) to a discriminated union
-- so external entries render in the public gallery. Until that lands,
-- external entries are silently skipped by the public reader but
-- still:
--   - contribute to `jsonb_array_length(gallery_images)` for the
--     SEO-indexability gate in `listIndexableHotelSlugs()`,
--   - power the freshness signal for the sitemap `<lastmod>`,
--   - feed Schema.org `ImageObject[]` builders that read `gallery_images`
--     directly (jsonb path-ops indexes still work).
--
-- Skill: content-modeling + supabase-postgres-rls (additive, no DDL).
-- Forward-only — see `supabase-rls.mdc` § Migrations.

comment on column public.hotels.gallery_images is
  'Array of gallery entries. Two shapes coexist:
   (1) Cloudinary: { public_id, alt_fr?, alt_en?, category? } — used by FR
       Atout France palaces uploaded via the Cloudinary asset pipeline.
   (2) External (intl seed, May 2026): { url, caption, source: ''wikimedia_commons''|''tavily'',
       attribution, category?, width?, height?, alt_fr?, alt_en? } — used by
       Tier-1 international hotels whose photos remain on Commons / press
       index pages (license + attribution preserved in-place).
   Discrimination: presence of public_id (shape 1) vs url (shape 2).
   See migration 0034 for the full contract.';

-- Log this migration so the orchestrator can detect schema drift.
insert into public._cct_sql_migrations (filename) values ('0034_hotels_gallery_external_shape.sql')
  on conflict do nothing;
