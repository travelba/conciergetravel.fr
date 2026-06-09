-- Google Places traveler reviews cache (synced daily via editorial-pilot).
-- Array shape: { author, rating (1-5), text, publish_time?, language? }
-- No RLS change — same visibility as google_rating / google_reviews_count.

alter table public.hotels
  add column if not exists google_reviews jsonb;

comment on column public.hotels.google_reviews is
  'Cached Google Maps / Business Profile reviews (max 5 per Google ToS). Synced by scripts/editorial-pilot sync-google-reviews.';
