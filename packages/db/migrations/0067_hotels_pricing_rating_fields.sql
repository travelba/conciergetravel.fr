-- 0067_hotels_pricing_rating_fields
--
-- Pricing + aggregate-rating fields surfaced in the Hotel JSON-LD
-- (`Hotel.priceRange` / `Hotel.aggregateRating`) and the indicative price.
-- All nullable: only fiches with editorially-sourced figures populate them
-- (first use: Airelles Gordes, La Bastide — Booking 9.8/847).
--
-- Idempotent (`add column if not exists`) so it is safe to replay on an
-- environment where the columns were already created out-of-band.

alter table public.hotels
  add column if not exists telephone text,
  add column if not exists price_range text,
  add column if not exists price_from integer,
  add column if not exists aggregate_rating_value numeric(3, 1),
  add column if not exists aggregate_rating_count integer,
  add column if not exists aggregate_rating_source text;

comment on column public.hotels.telephone is 'Display-format phone (human readable). E.164 form lives in phone_e164 and drives JSON-LD telephone.';
comment on column public.hotels.price_range is 'Schema.org Hotel.priceRange coarse anchor (EUR sign band). Overrides the computed room range when set.';
comment on column public.hotels.price_from is 'Indicative nightly entry price (whole units, currency EUR).';
comment on column public.hotels.aggregate_rating_value is 'Aggregated review score for JSON-LD AggregateRating. Scale implied by source (booking = /10).';
comment on column public.hotels.aggregate_rating_count is 'Number of reviews backing aggregate_rating_value.';
comment on column public.hotels.aggregate_rating_source is 'Provenance of the aggregate rating (e.g. booking, google, amadeus).';
