-- 0068 — Hotels: golden-template columns (instagram / concierge_pick / concierge_hook).
--
-- Context (Golden-template catalogue audit, 2026-06-03)
-- ----------------------------------------------------------------------------
-- The Airelles Gordes "golden template" surfaces three editorial blocks that
-- had no DB home yet — they lived only in the local override
-- (`apps/web/src/server/hotels/dev-override-airelles.ts`, gated by
-- `MCH_LOCAL_FIXTURE`). To make the reference fiche real (scored by the
-- catalogue audit WITHOUT the local flag) and to let every fiche carry the
-- same richness, we add the three jsonb columns the audit now measures
-- (`golden` dimension in `hotel-fiche-cdc-gates.ts`):
--
--   - `instagram jsonb` — social feed teaser. Shape mirrors the override:
--       { handle:string, profile_url:string, followers?:int,
--         posts: [ { permalink:string, image_public_id:string,
--                    caption_fr?:string, caption_en?:string,
--                    posted_at?:'YYYY-MM-DD' } ] }
--       Read app-side via `HotelDetailRowSchema.instagram` (already optional)
--       and rendered by `<HotelInstagram>` (self-elides when null).
--
--   - `concierge_pick jsonb` — the suite the Concierge recommends first.
--       { slug:string, note: { fr:string, en:string } }
--       Surfaced + framed at the top of the rooms grid.
--
--   - `concierge_hook jsonb` — the hero accroche (Concierge voice, <= 25 words).
--       { fr:string, en:string }
--       Rendered visibly under the H1 in place of the factual summary; the
--       CDC factual summary stays in the DOM (sr-only) for the GEO contracts.
--
-- All nullable: only fiches with editorially-sourced content populate them
-- (first use: Airelles Gordes, La Bastide — migration 0069 promotes the
-- override content into the row).
--
-- Forward-only. Idempotent (`add column if not exists`).
--
-- Skill: supabase-postgres-rls, content-modeling, membership-program.

-- ----------------------------------------------------------------
-- 1. DDL — add the three jsonb columns
-- ----------------------------------------------------------------

alter table public.hotels
  add column if not exists instagram jsonb;

alter table public.hotels
  add column if not exists concierge_pick jsonb;

alter table public.hotels
  add column if not exists concierge_hook jsonb;

-- Shape guards: each block is an object when present (array/scalar rejected).
alter table public.hotels
  drop constraint if exists hotels_instagram_shape_ck;
alter table public.hotels
  add constraint hotels_instagram_shape_ck
  check (instagram is null or jsonb_typeof(instagram) = 'object');

alter table public.hotels
  drop constraint if exists hotels_concierge_pick_shape_ck;
alter table public.hotels
  add constraint hotels_concierge_pick_shape_ck
  check (concierge_pick is null or jsonb_typeof(concierge_pick) = 'object');

alter table public.hotels
  drop constraint if exists hotels_concierge_hook_shape_ck;
alter table public.hotels
  add constraint hotels_concierge_hook_shape_ck
  check (concierge_hook is null or jsonb_typeof(concierge_hook) = 'object');

-- ----------------------------------------------------------------
-- 2. Documentation
-- ----------------------------------------------------------------

comment on column public.hotels.instagram is
  'Golden-template social feed teaser. jsonb object: { handle, profile_url, followers?, posts:[{permalink, image_public_id, caption_fr?, caption_en?, posted_at?}] }. Optional — null means the <HotelInstagram> section self-elides. Production hydrates posts via Graph API -> Cloudinary mirror.';

comment on column public.hotels.concierge_pick is
  'Golden-template Concierge room recommendation. jsonb object: { slug, note:{fr,en} }. Frames the recommended suite at the top of the rooms grid. Optional.';

comment on column public.hotels.concierge_hook is
  'Golden-template hero accroche (Concierge voice, <= 25 words). jsonb object: { fr, en }. Rendered under the H1; the CDC factual summary stays sr-only for the GEO/JSON-LD contracts. Optional.';

-- ----------------------------------------------------------------
-- 3. Migration log
-- ----------------------------------------------------------------

insert into public._cct_sql_migrations (filename, applied_at)
  values ('0068_hotels_golden_template_columns.sql', timezone('utc', now()))
  on conflict do nothing;
