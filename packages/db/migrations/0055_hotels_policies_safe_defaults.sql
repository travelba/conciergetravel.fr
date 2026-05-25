-- 0055 — Backfill `policies` jsonb with safe industry defaults on the
-- 357 published hotels currently NULL.
--
-- Context: CDC §2.9 makes the `policies` block a hard rule, but the
-- production reader (`PoliciesSchema` in `apps/web/src/server/hotels/
-- get-hotel-by-slug.ts:1838-1847`) treats every sub-block as optional.
-- 357/443 published hotels nonetheless have `policies IS NULL`, which
-- means the renderer shows nothing in the Policies block. Closing
-- that gap at the publish gate without inventing factual data is the
-- goal of this migration.
--
-- We inject only the three blocks where industry-standard defaults
-- exist for 5★/Palace hotels in 2026:
--
--   * check_in.from = 15:00       — French luxury hotel norm
--   * check_out.until = 12:00     — French luxury hotel norm
--   * wifi.included = true,
--     wifi.scope = whole_property — universal at 5★/Palace
--
-- We intentionally OMIT the blocks that carry per-hotel factual data
-- we cannot safely synthesize:
--
--   * cancellation    — varies by rate plan
--   * pets            — varies (some palaces accept, some don't)
--   * children        — varies (most welcome, some adult-only)
--   * payment.methods — varies (cash/diners/jcb mix)
--   * city_tax        — varies by municipality + category
--
-- A `_synthetic: true` flag marks every row so that the future Google
-- Places + Tavily enrichment pass (planned together with the photo
-- migration) can SELECT them precisely and overwrite or extend each
-- block with real source data.
--
-- Rule reference: `.cursor/skills/llm-output-robustness/SKILL.md` rule
-- 14 ("audit metric vs production validator") and `editorial-voice`
-- ("toujours précis — never invent factual numbers").
--
-- Idempotent: `where policies is null` prevents double-writes if the
-- migration is reapplied.

update public.hotels
set
  policies = jsonb_build_object(
    '_synthetic', true,
    '_synthetic_source', '0055_hotels_policies_safe_defaults',
    '_synthetic_applied_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'check_in', jsonb_build_object('from', '15:00'),
    'check_out', jsonb_build_object('until', '12:00'),
    'wifi', jsonb_build_object('included', true, 'scope', 'whole_property')
  ),
  updated_at = now()
where is_published = true
  and policies is null;

insert into public._cct_sql_migrations (filename)
  values ('0055_hotels_policies_safe_defaults.sql')
  on conflict do nothing;
