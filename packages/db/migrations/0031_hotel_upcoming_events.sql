-- 0031 — Hotel detail: upcoming local events (CDC §2 — bloc "À proximité").
--
-- Adds a JSONB column to `hotels` to store the next 5 culturally
-- relevant events around the hotel, sourced from DATAtourisme
-- (concerts, expos, festivals, sports). Surfaced on the hotel detail
-- page as a sober "Que se passe-t-il pendant votre séjour ?" block
-- and emitted as `Event[]` JSON-LD (Schema.org Event).
--
-- Sync orchestrator (planned) :
--   scripts/editorial-pilot/src/events/sync-hotel-events.ts
--   - DATAtourisme /events endpoint, geo_distance = 10 km (urban) / 30 km (rural)
--   - lookahead = 60 days
--   - cap 5 events per hotel, sorted by start_date
--   - LLM-described in FR + EN (1-2 sentences, EEAT-safe contract)
--   - JSONL runlog at out/events-runlog-YYYY-MM-DD.jsonl
--   - cron via GitHub Actions weekly (events are time-sensitive)
--
-- Shape (mirror of zod schema `UpcomingEventSchema` in
-- `apps/web/src/server/hotels/get-hotel-by-slug.ts`) :
--   [
--     {
--       name, name_en?,
--       start_date,                -- ISO YYYY-MM-DD
--       end_date?,                 -- ISO YYYY-MM-DD
--       venue_name, venue_address?,
--       latitude, longitude,
--       distance_meters, walk_minutes?,
--       category,                  -- 'concert' | 'expo' | 'festival' | 'sport' | 'theater' | 'other'
--       description_fr?, description_en?,
--       pricing?: { type, amount_eur?, currency },
--       url?,                      -- official event page
--       dt_uuid                    -- DATAtourisme UUID for provenance + dedup
--     },
--     ...
--   ]

alter table public.hotels
  add column if not exists upcoming_events jsonb not null default '[]'::jsonb;

comment on column public.hotels.upcoming_events is
  'Next 5 culturally relevant events around the hotel, sourced from DATAtourisme, refreshed weekly. Shape: [{name, start_date, end_date, venue_name, latitude, longitude, distance_meters, category, description_fr, description_en, pricing, url, dt_uuid}].';

-- Log this migration so the orchestrator can detect schema drift.
insert into public._cct_sql_migrations (filename) values ('0031_hotel_upcoming_events.sql')
  on conflict do nothing;
