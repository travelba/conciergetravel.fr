-- 0034 — Publish Tier 1 international hotels.
--
-- After migration 0033 added the international scaffolding (663 hotels)
-- and the `seed-tier1-content` pipeline populated `meta_title_fr/en`,
-- `meta_desc_fr/en` (130-150 chars per CDC §2.3) and `description_fr/en`
-- (200-300 mots, Concierge voice) for the top ~340 candidates, this
-- migration flips `is_published = true` on rows that pass the
-- minimum-viable content gate.
--
-- The WHERE clause is the SEO safety net: a hotel can only become live
-- if it has BOTH a populated description (≥ 200 chars FR) AND a
-- factual meta description (100-200 chars FR). Hotels where the
-- LLM seed failed or produced thin content stay as drafts — they will
-- be reattempted by a follow-up batch.
--
-- Tier 1 = `luxury_tier` ∈ award-list (W50, T+L, CN Gold List) OR
-- recognised brand collections (Aman, Belmond, Rosewood, Four Seasons,
-- Mandarin Oriental, Park Hyatt, Ritz-Carlton Reserve). This keeps the
-- first international wave concentrated on hotels with strong
-- knowledge-graph signals (Wikipedia, official sites, brand authority).
--
-- Idempotent: re-running this migration is a no-op (already-published
-- hotels match the WHERE clause but the assignment is identical).

update public.hotels
set is_published = true,
    updated_at = now()
where country_code <> 'FR'
  and not is_published
  and luxury_tier in (
    'world_50_best',
    'tl_worlds_best',
    'cn_gold_list',
    'aman',
    'belmond',
    'rosewood',
    'four_seasons',
    'mandarin_oriental',
    'park_hyatt',
    'ritz_carlton_reserve'
  )
  -- Minimum-viable content gate (SEO safety net).
  and length(coalesce(description_fr, '')) >= 200
  and length(coalesce(meta_desc_fr, '')) between 100 and 200
  and length(coalesce(meta_title_fr, '')) between 30 and 70;

insert into public._cct_sql_migrations (filename) values ('0034_publish_tier1_international.sql')
  on conflict do nothing;
