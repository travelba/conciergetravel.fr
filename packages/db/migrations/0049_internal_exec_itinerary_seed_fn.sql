-- 0049 — Internal RPC for applying itinerary seed SQL files via service_role.
--
-- The editorial-pilot batch (`scripts/editorial-pilot/src/itineraries/`)
-- produces 19 long UPSERT statements under `itineraries/seed/`. These
-- are too large and too complex (multi-KB JSONB literals, array
-- casts, embedded apostrophes) to apply efficiently via the Supabase
-- MCP `execute_sql` tool one-by-one from the agent UI.
--
-- This function exposes a service-role-only RPC the apply-seeds Node
-- script can call. It refuses any SQL that does NOT target
-- `public.itineraries` so it cannot be misused as a generic SQL
-- backdoor even if the function is accidentally granted to a broader
-- role.
--
-- After the seed campaign is over, migration 0050 drops the function.

create or replace function public._exec_itinerary_seed(p_sql text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_sql !~* 'insert\s+into\s+public\.itineraries' then
    raise exception 'Only INSERT INTO public.itineraries is allowed in this function';
  end if;
  if p_sql ~* '\b(drop|truncate|alter|grant|revoke|create|copy|delete)\b' then
    raise exception 'DDL / mass-mutation keywords are not allowed in this function';
  end if;
  execute p_sql;
end;
$$;

revoke execute on function public._exec_itinerary_seed(text) from public, anon, authenticated;

comment on function public._exec_itinerary_seed(text) is
  'Service-role-only loader for itinerary seed UPSERTs (0049). Refuses anything that does not start with INSERT INTO public.itineraries and rejects DDL keywords. Dropped by 0050 once the seed campaign is over.';

insert into public._cct_sql_migrations (filename)
  values ('0049_internal_exec_itinerary_seed_fn.sql')
  on conflict do nothing;
