-- 0046 — Itineraries: consolidate SELECT policies (RLS perf).
--
-- Migration 0045 created two permissive SELECT policies on
-- `public.itineraries`:
--   - `itineraries_public_read` (TO anon, authenticated)
--   - `itineraries_staff_select` (TO authenticated)
--
-- Both targeted `authenticated`, so every SELECT from a logged-in user
-- evaluated **both** policies on every row. Supabase advisor flagged
-- this as `multiple_permissive_policies` (rule supabase-rls.mdc
-- §RLS performance).
--
-- Forward-only fix:
--   - Drop the existing pair.
--   - Re-create them so each role hits exactly one policy:
--       anon          → `itineraries_anon_read`     (published only)
--       authenticated → `itineraries_authenticated_read`
--                       (published OR staff role via JWT)
--
-- The OR predicate keeps the same semantic surface while cutting per-
-- row policy evaluation in half for every authenticated request.
-- `auth.jwt()` is wrapped in `(select auth.jwt())` so the planner
-- caches the lookup once per statement (rule supabase-rls.mdc).
--
-- Skill: supabase-postgres-rls.

drop policy if exists itineraries_public_read   on public.itineraries;
drop policy if exists itineraries_staff_select  on public.itineraries;

create policy itineraries_anon_read on public.itineraries
  for select to anon
  using (status = 'published');

create policy itineraries_authenticated_read on public.itineraries
  for select to authenticated
  using (
    status = 'published'
    or ((select auth.jwt()) ->> 'role') in ('admin', 'editor')
  );

insert into public._cct_sql_migrations (filename)
values ('0046_itineraries_consolidate_select_policies.sql')
  on conflict do nothing;
