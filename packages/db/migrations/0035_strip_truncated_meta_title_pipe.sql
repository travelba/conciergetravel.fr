-- 0035 — Strip truncated `| MyConciergeHotel` suffix from international meta titles.
--
-- The first Tier 1 seed batch (337 hotels, May 2026) produced meta_title
-- strings of the form `<Name> · <City> · 5★ | MyConciergeHotel` and asked
-- the LLM to stay <= 70 chars. When the prefix already exceeded the budget,
-- the LLM truncated mid-suffix and left a dangling ` |` at the end (67/337
-- titles affected). Visually ugly and a soft SEO penalty (truncated brand
-- mid-pipe is read as broken metadata by some crawlers).
--
-- This migration strips any trailing whitespace + pipe + optional whitespace.
-- The application-layer brand suffix (`| MyConciergeHotel`) is appended at
-- render time by the SEO metadata helper, so removing it here is safe.
--
-- Forward-only. Idempotent: rows without a trailing pipe match the regex
-- with a no-op substitution.

update public.hotels
set
  meta_title_fr = regexp_replace(meta_title_fr, '\s*\|\s*$', ''),
  meta_title_en = regexp_replace(coalesce(meta_title_en, ''), '\s*\|\s*$', '')
where country_code <> 'FR'
  and (meta_title_fr like '%|' or meta_title_en like '%|');

insert into public._cct_sql_migrations (filename)
values ('0035_strip_truncated_meta_title_pipe.sql')
  on conflict do nothing;
