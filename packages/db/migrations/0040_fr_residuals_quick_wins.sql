-- 0040 — French-residuals quick wins (May 2026).
--
-- The FR-residuals audit (May 2026) surfaced three pockets of English
-- content leaking into the French interface from data the LLM pipeline
-- failed to translate fully:
--
--   1. `editorial_guides.summary_fr` starting with "Guide city <X>" on six
--      city guides (Paris, Lyon, Annecy, Deauville, Dinard, La Baule) — the
--      LLM translated the body but copy-pasted the "Guide city" prefix from
--      the English template.
--
--   2. `hotels.spa_info.features_fr[0]` keeping the English word "skincare"
--      inside an otherwise translated string ("Partenaire skincare : Valmont")
--      on 48 published hotels.
--
--   3. `hotels.city` storing four European capitals under their English
--      spelling on rows where the FR canonical form is unambiguous: Geneva,
--      Athens, Vienna, Venice. These appear verbatim in destination cards,
--      hotel breadcrumbs and the `/hotels` directory.
--
-- Each block below is idempotent — re-running the migration is a no-op once
-- the values are already canonical. Forward-only per supabase-rls rule.

-- ──────────────────────────────────────────────────────────────────────
-- (1) editorial_guides — "Guide city X" → "Guide ville X"
-- ──────────────────────────────────────────────────────────────────────
update public.editorial_guides
set summary_fr = regexp_replace(summary_fr, '^Guide city ', 'Guide ville ')
where summary_fr like 'Guide city %';

-- ──────────────────────────────────────────────────────────────────────
-- (2) hotels.spa_info.features_fr — "Partenaire skincare" → "Partenaire soins"
--     Rebuild the array, replacing the English fragment inside each element.
-- ──────────────────────────────────────────────────────────────────────
update public.hotels
set spa_info = jsonb_set(
  spa_info,
  '{features_fr}',
  (
    select coalesce(jsonb_agg(replace(elem, 'Partenaire skincare', 'Partenaire soins')), '[]'::jsonb)
    from jsonb_array_elements_text(spa_info->'features_fr') as t(elem)
  )
)
where is_published = true
  and jsonb_typeof(spa_info->'features_fr') = 'array'
  and (spa_info->'features_fr')::text like '%Partenaire skincare%';

-- ──────────────────────────────────────────────────────────────────────
-- (3) hotels.city — canonical French spelling for 4 European capitals
--     (Florence, Mumbai, Beijing, Stockholm, Prague are identical in FR/EN
--     so they stay untouched.)
-- ──────────────────────────────────────────────────────────────────────
update public.hotels
set city = case city
  when 'Geneva' then 'Genève'
  when 'Athens' then 'Athènes'
  when 'Vienna' then 'Vienne'
  when 'Venice' then 'Venise'
  else city
end
where city in ('Geneva', 'Athens', 'Vienna', 'Venice');

insert into public._cct_sql_migrations (filename)
values ('0040_fr_residuals_quick_wins.sql')
  on conflict do nothing;
