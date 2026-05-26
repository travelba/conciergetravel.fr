-- 0058 — RLS init-plan fix for the Le Concierge Club tables.
--
-- Same defect as the one 0007 addressed for the original tables: the
-- Supabase advisor only credits the `auth_rls_initplan` optimisation
-- when `auth.<fn>()` is the **immediate** child of the SELECT subquery.
-- 0057 used the wrong pattern `(select auth.jwt() ->> 'role')` — the
-- correct one is `((select auth.jwt()) ->> 'role')`, with `->> 'role'`
-- applied outside the subquery.
--
-- This migration rewrites every policy from 0057 to use the linter-blessed
-- shape. It is a forward-only fix — DO NOT edit 0057 in place.
--
-- Skill: supabase-postgres-rls.

----------------------------------------------------------------
-- hotel_member_benefits
----------------------------------------------------------------
drop policy if exists hotel_member_benefits_insert_staff on public.hotel_member_benefits;
create policy hotel_member_benefits_insert_staff on public.hotel_member_benefits
  for insert to authenticated
  with check (((select auth.jwt()) ->> 'role') = any (array['operator', 'admin']));

drop policy if exists hotel_member_benefits_update_staff on public.hotel_member_benefits;
create policy hotel_member_benefits_update_staff on public.hotel_member_benefits
  for update to authenticated
  using (((select auth.jwt()) ->> 'role') = any (array['operator', 'admin']))
  with check (((select auth.jwt()) ->> 'role') = any (array['operator', 'admin']));

drop policy if exists hotel_member_benefits_delete_staff on public.hotel_member_benefits;
create policy hotel_member_benefits_delete_staff on public.hotel_member_benefits
  for delete to authenticated
  using (((select auth.jwt()) ->> 'role') = any (array['operator', 'admin']));

----------------------------------------------------------------
-- member_price_differential
----------------------------------------------------------------
drop policy if exists member_price_differential_insert_staff on public.member_price_differential;
create policy member_price_differential_insert_staff on public.member_price_differential
  for insert to authenticated
  with check (((select auth.jwt()) ->> 'role') = any (array['operator', 'admin']));

drop policy if exists member_price_differential_update_staff on public.member_price_differential;
create policy member_price_differential_update_staff on public.member_price_differential
  for update to authenticated
  using (((select auth.jwt()) ->> 'role') = any (array['operator', 'admin']))
  with check (((select auth.jwt()) ->> 'role') = any (array['operator', 'admin']));

drop policy if exists member_price_differential_delete_staff on public.member_price_differential;
create policy member_price_differential_delete_staff on public.member_price_differential
  for delete to authenticated
  using (((select auth.jwt()) ->> 'role') = any (array['operator', 'admin']));

----------------------------------------------------------------
-- club_eligibility
----------------------------------------------------------------
drop policy if exists club_eligibility_insert_staff on public.club_eligibility;
create policy club_eligibility_insert_staff on public.club_eligibility
  for insert to authenticated
  with check (((select auth.jwt()) ->> 'role') = any (array['operator', 'admin']));

drop policy if exists club_eligibility_update_staff on public.club_eligibility;
create policy club_eligibility_update_staff on public.club_eligibility
  for update to authenticated
  using (((select auth.jwt()) ->> 'role') = any (array['operator', 'admin']))
  with check (((select auth.jwt()) ->> 'role') = any (array['operator', 'admin']));

drop policy if exists club_eligibility_delete_staff on public.club_eligibility;
create policy club_eligibility_delete_staff on public.club_eligibility
  for delete to authenticated
  using (((select auth.jwt()) ->> 'role') = any (array['operator', 'admin']));

----------------------------------------------------------------
-- prestige_waitlist
----------------------------------------------------------------
drop policy if exists prestige_waitlist_select_staff on public.prestige_waitlist;
create policy prestige_waitlist_select_staff on public.prestige_waitlist
  for select to authenticated
  using (((select auth.jwt()) ->> 'role') = any (array['operator', 'admin']));

drop policy if exists prestige_waitlist_update_staff on public.prestige_waitlist;
create policy prestige_waitlist_update_staff on public.prestige_waitlist
  for update to authenticated
  using (((select auth.jwt()) ->> 'role') = any (array['operator', 'admin']))
  with check (((select auth.jwt()) ->> 'role') = any (array['operator', 'admin']));

drop policy if exists prestige_waitlist_delete_staff on public.prestige_waitlist;
create policy prestige_waitlist_delete_staff on public.prestige_waitlist
  for delete to authenticated
  using (((select auth.jwt()) ->> 'role') = any (array['operator', 'admin']));

----------------------------------------------------------------
-- Migration log
----------------------------------------------------------------
insert into public._cct_sql_migrations (filename)
  values ('0058_le_concierge_club_rls_fix.sql')
  on conflict do nothing;
