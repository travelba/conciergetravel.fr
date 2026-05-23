-- 0050 — Add base64 variant of the itinerary seed loader.
--
-- Why: the seed UPSERTs contain massive JSONB literals with double
-- quotes that need fragile escaping when transported as JSON over
-- MCP. Base64 transit is 100% JSON-safe (only [A-Za-z0-9+/=]).
-- This variant decodes server-side then delegates to the same
-- safety checks as `_exec_itinerary_seed(text)`.

create or replace function public._exec_itinerary_seed_b64(p_sql_b64 text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  sql_text text;
begin
  sql_text := convert_from(decode(p_sql_b64, 'base64'), 'UTF8');
  if sql_text !~* 'insert\s+into\s+public\.itineraries' then
    raise exception 'Only INSERT INTO public.itineraries is allowed in this function';
  end if;
  if sql_text ~* '\b(drop|truncate|alter|grant|revoke|create|copy|delete)\b' then
    raise exception 'DDL / mass-mutation keywords are not allowed in this function';
  end if;
  execute sql_text;
end;
$$;

revoke execute on function public._exec_itinerary_seed_b64(text) from public, anon, authenticated;

comment on function public._exec_itinerary_seed_b64(text) is
  'Base64 variant of _exec_itinerary_seed for transport over MCP. Decodes p_sql_b64 then enforces the same safety filters as the text variant.';

insert into public._cct_sql_migrations (filename)
  values ('0050_exec_itinerary_seed_b64_variant.sql')
  on conflict do nothing;
