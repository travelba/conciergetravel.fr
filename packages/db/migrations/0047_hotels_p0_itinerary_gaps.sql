-- 0047 — Insert 12 international luxury hotels missing from the catalogue.
--
-- Discovered via the 20 P0 itinerary briefs (see
-- `scripts/editorial-pilot/itineraries/briefs/`) on 2026-05-22 :
-- briefs cite Aman / Belmond / R&C / Cheval Blanc / One&Only / Singita-class
-- properties that don't have a row in `public.hotels` yet, so the LLM
-- itinerary composer cannot link them to a real `hotel_id` and the
-- generated SQL ends up with `hotel_ids = '{}'::uuid[]` and `sections[].hotel_id: null`.
--
-- Inserted as MINIMAL STUBS (slug, name, name_en, city, country, brand
-- tier) with `is_published = false` and `priority = 'P2'` so they remain
-- invisible on the public site until the editor enriches them via the
-- normal content pipeline (descriptions, ≥30 photos, FAQ, JSON-LD, etc.).
--
-- One brief cited `singita-grumeti` for the Cape Town step of the safari
-- itinerary; Grumeti is in Tanzania, not South Africa, so the brief was
-- corrected in the same PR to point at `mount-nelson` (already in DB) and
-- `singita-grumeti` is deliberately NOT inserted.
--
-- See also : `scripts/editorial-pilot/src/itineraries/country-codes.ts`
-- where 11 brief→DB slug aliases were added in the same PR.

insert into public.hotels (
  slug, name, name_en, city, country_code, country_label_fr, country_label_en,
  stars, is_palace, priority, is_published, booking_mode, luxury_tier
) values
  -- France — Megève (ski luxe)
  ('le-chalet-zannier', 'Le Chalet Zannier', 'Le Chalet Zannier',
   'Megève', 'FR', 'France', 'France',
   5, false, 'P2', false, 'display_only', 'relais_chateaux'),
  ('four-seasons-megeve', 'Four Seasons Hotel Megève', 'Four Seasons Hotel Megève',
   'Megève', 'FR', 'France', 'France',
   5, false, 'P2', false, 'display_only', 'four_seasons'),

  -- Japon — Hakone (ryokan)
  ('hakone-ginyu', 'Hakone Ginyu', 'Hakone Ginyu',
   'Hakone', 'JP', 'Japon', 'Japan',
   5, false, 'P2', false, 'display_only', 'self_5_star'),

  -- Indonésie — Bali (Ubud)
  ('como-uma-ubud', 'COMO Uma Ubud', 'COMO Uma Ubud',
   'Ubud', 'ID', 'Indonésie', 'Indonesia',
   5, false, 'P2', false, 'display_only', 'lhw_member'),

  -- Maldives (Malé Nord + Noonu)
  ('one-and-only-reethi-rah', 'One&Only Reethi Rah', 'One&Only Reethi Rah',
   'Atoll de Malé Nord', 'MV', 'Maldives', 'Maldives',
   5, false, 'P2', false, 'display_only', 'self_5_star'),
  ('cheval-blanc-randheli', 'Cheval Blanc Randheli', 'Cheval Blanc Randheli',
   'Atoll de Noonu', 'MV', 'Maldives', 'Maldives',
   5, false, 'P2', false, 'display_only', 'self_5_star'),

  -- Italie — Toscane
  ('borgo-san-felice', 'Borgo San Felice', 'Borgo San Felice',
   'Castelnuovo Berardenga', 'IT', 'Italie', 'Italy',
   5, false, 'P2', false, 'display_only', 'relais_chateaux'),
  ('rosewood-castiglion-del-bosco', 'Rosewood Castiglion del Bosco', 'Rosewood Castiglion del Bosco',
   'Montalcino', 'IT', 'Italie', 'Italy',
   5, false, 'P2', false, 'display_only', 'rosewood'),

  -- Maroc — Marrakech
  ('ksar-char-bagh', 'Ksar Char-Bagh', 'Ksar Char-Bagh',
   'Marrakech', 'MA', 'Maroc', 'Morocco',
   5, false, 'P2', false, 'display_only', 'relais_chateaux'),

  -- Afrique du Sud — Sabi Sands
  ('royal-malewane', 'Royal Malewane', 'Royal Malewane',
   'Sabi Sands', 'ZA', 'Afrique du Sud', 'South Africa',
   5, false, 'P2', false, 'display_only', 'forbes_5_star'),

  -- Kenya — Masai Mara
  ('mara-plains-camp', 'Mara Plains Camp', 'Mara Plains Camp',
   'Masai Mara', 'KE', 'Kenya', 'Kenya',
   5, false, 'P2', false, 'display_only', 'lhw_member'),

  -- Émirats Arabes Unis — Dubaï
  ('burj-al-arab', 'Burj Al Arab Jumeirah', 'Burj Al Arab Jumeirah',
   'Dubaï', 'AE', 'Émirats Arabes Unis', 'United Arab Emirates',
   5, false, 'P2', false, 'display_only', 'self_5_star')
on conflict (slug) do nothing;

insert into public._cct_sql_migrations (filename)
  values ('0047_hotels_p0_itinerary_gaps.sql')
  on conflict do nothing;
