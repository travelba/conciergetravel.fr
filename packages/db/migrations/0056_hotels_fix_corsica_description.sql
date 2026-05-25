-- 0056 — Fix the broken `description_fr` on `hotel-corsica` (Calvi).
--
-- The legacy description left a literal Markdown bold placeholder
-- (`**occupe**`) in production:
--
--   « Sur les hauteurs de Calvi, l'Hôtel Corsica **occupe** avec
--     élégance et sérénité. Ici, chaque détail est pensé pour
--     offrir aux hôtes une expérience sensorielle. »
--
-- The sentence is grammatically broken (`occupe` without a direct
-- object) and the asterisks render as literal text in the renderer,
-- which never strips Markdown from `description_*`. This was flagged
-- during the meta_desc backfill (Phase 1B audit, 2026-05-25): the
-- hotel sat in the 9 published rows under 200 chars, and the typo
-- was the only one of the 9 that was outright broken.
--
-- The rewrite below is fact-only — every claim is traceable to the
-- existing JSONB columns on `public.hotels`:
--
--   * « Sur les hauteurs de Calvi »      → existing description
--   * « palace Atout France »            → awards[0]
--   * « face à la Méditerranée »         → POI lat/lng + existing
--                                          factual_summary_fr
--   * « table La Signoria, cuisine
--      méditerranéenne et corse »        → restaurant_info.venues[0]
--   * « spa partenaire Guerlain,
--      rituel 90 minutes »               → signature_experiences[
--                                          'rituel-bien-etre-guerlain']
--   * « petit-déjeuner corse en terrasse,
--      réservé aux hôtes des suites »    → signature_experiences[
--                                          'petit-dejeuner-corse']
--   * « excursions en bateau, atelier
--      de dégustation, cours de cuisine » → signature_experiences[
--                                           'excursion-bateaux-calvi',
--                                           'atelier-degustation-vins',
--                                           'cours-cuisine-corse']
--   * « citadelle à environ 2,6 km
--      à pied »                          → POI distances (2,6 km
--                                          minimum to the citadel
--                                          cluster: Sainte-Marie-Majeure
--                                          2,574 m / Fort Torretta
--                                          2,625 m / MUDACC 2,740 m)
--
-- Editorial voice: sentences ≤ 25 words, no banned superlatives
-- (`incroyable`, `écrin`, `cocon`, `magique`, `sublime`,
-- `magnifique`), Concierge tone (factual + complice), per the
-- `editorial-voice.mdc` workspace rule.
--
-- Idempotent: the WHERE clause matches the exact broken substring,
-- so the migration is a no-op once applied (subsequent edits via
-- Payload won't re-introduce the asterisks).

update public.hotels
set
  description_fr = $$Sur les hauteurs de Calvi, l'Hôtel Corsica déploie son palace Atout France face à la Méditerranée. La table La Signoria signe une cuisine méditerranéenne et corse, ouverte sur la baie. Au spa partenaire Guerlain, le rituel de 90 minutes mêle massage et soins haut de gamme. Le petit-déjeuner corse, servi en terrasse, ouvre la journée des hôtes des suites sur charcuterie, fromages artisanaux et fruits de l'île. Excursions en bateau autour de Calvi, atelier de dégustation de vins corses et cours de cuisine prolongent l'immersion. La citadelle se rejoint à environ 2,6 km à pied.$$,
  description_en = $$Perched on the heights of Calvi, Hôtel Corsica is an Atout France Palace facing the Mediterranean. La Signoria serves Mediterranean and Corsican cuisine in a setting open to the bay. At the Guerlain partner spa, a 90-minute ritual combines massage and premium skincare. The Corsican breakfast, served on the terrace for suite guests, opens the day with island charcuterie, artisan cheeses, and fresh produce. Boat trips around Calvi, Corsican wine-tasting workshops, and cooking classes complete the stay. The citadel sits roughly 2.6 km away on foot.$$,
  updated_at = now()
where slug = 'hotel-corsica'
  and description_fr like '%**occupe**%';

insert into public._cct_sql_migrations (filename)
  values ('0056_hotels_fix_corsica_description.sql')
  on conflict do nothing;
