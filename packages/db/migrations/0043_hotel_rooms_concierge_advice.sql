-- 0043 — Hotel rooms: `concierge_advice` block (Voix du Concierge, ADR-0009 + ADR-0011).
--
-- Adds the same bilingual `concierge_advice` jsonb shape adopted for
-- hotels in migration 0032, but at the room level — so each
-- `/hotel/[slug]/chambres/[roomSlug]` sub-page can surface its own
-- short Concierge tip (chambre, étage, vue, timing) below the
-- room amenities block.
--
-- Shape (mirror of `ConciergeAdviceSchema` in
--  `apps/web/src/server/hotels/get-hotel-by-slug.ts`):
--   {
--     fr: { title, body (50-110 words), tip_for: room|dining|timing|access|service|wellness },
--     en: { title, body, tip_for }
--   }
--
-- Differences vs hotel-level `concierge_advice`:
--   - `tip_for` defaults to 'room' in practice (this is a room sub-page);
--     enum values stay aligned with hotels for editorial tooling reuse.
--   - Body length envelope identical (50-110 words) — tested empirically
--     on Phase 3 humanizer-pass outputs to feel concierge-substantial
--     without bloating the room sub-page.
--   - Optional (nullable). Sub-pages without a room-level tip silently
--     render no Concierge block; the parent hotel block remains the
--     canonical Voix-du-Concierge surface (CDC §2 + ADR-0011).
--
-- Skill: editorial-long-read-rendering, content-modeling, concierge-voice-pipeline.

alter table public.hotel_rooms
  add column if not exists concierge_advice jsonb;

comment on column public.hotel_rooms.concierge_advice is
  'Room-level « Le Conseil du Concierge » (ADR-0009 + ADR-0011). Shape: {fr:{title,body,tip_for}, en:{title,body,tip_for}}. body = 50-110 words. tip_for enum: room, dining, timing, access, service, wellness. Optional — null = no room-level tip, parent hotel block remains canonical.';

insert into public._cct_sql_migrations (filename)
values ('0043_hotel_rooms_concierge_advice.sql')
  on conflict do nothing;
