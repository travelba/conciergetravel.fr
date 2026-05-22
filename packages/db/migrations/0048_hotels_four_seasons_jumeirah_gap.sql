-- 0048 — Insert Four Seasons Resort Dubai at Jumeirah Beach stub.
--
-- Caught after 0047 was applied : the Dubai itinerary
-- (`dubai-luxe-week-end.json`) lists `four-seasons-jumeirah` in
-- `hotel_slugs_target`, but the slug audit only flagged `burj-al-arab`
-- as the missing brand-flagship for Dubai. Adding this row keeps the
-- LLM itinerary composer able to link the third step of the Dubai brief
-- to a real `hotel_id`.

insert into public.hotels (
  slug, name, name_en, city, country_code, country_label_fr, country_label_en,
  stars, is_palace, priority, is_published, booking_mode, luxury_tier
) values
  ('four-seasons-jumeirah', 'Four Seasons Resort Dubai at Jumeirah Beach',
   'Four Seasons Resort Dubai at Jumeirah Beach',
   'Dubaï', 'AE', 'Émirats Arabes Unis', 'United Arab Emirates',
   5, false, 'P2', false, 'display_only', 'four_seasons')
on conflict (slug) do nothing;

insert into public._cct_sql_migrations (filename)
  values ('0048_hotels_four_seasons_jumeirah_gap.sql')
  on conflict do nothing;
