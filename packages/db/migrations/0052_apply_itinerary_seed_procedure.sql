-- 0052: procedure variant of the GitHub seed loader
--
-- Migration 0051 enqueued an `http_get` via pg_net inside a function,
-- then looped waiting for the response. Because plpgsql functions
-- run in a single transaction, the enqueue and the wait are both
-- rolled back when the function raises — meaning the pg_net worker
-- never sees the queued request when retried.
--
-- A PROCEDURE can explicitly `commit;` between the enqueue and the
-- wait, which is what we need. Same security contract: SECURITY
-- DEFINER, execute revoked from anon/authenticated, slug allowlist,
-- URL hard-coded to the `travelba/conciergetravel.fr` repo, body
-- must start with `INSERT INTO public.itineraries`, no DDL tokens.
--
-- Usage from the agent loop:
--   call public.apply_itinerary_seed_from_github('reims-champagne-week-end');

create or replace procedure public.apply_itinerary_seed_from_github(p_slug text)
language plpgsql
security definer
set search_path = public, pg_temp, extensions, net
as $proc$
declare
  v_url            text;
  v_request_id     bigint;
  v_status_code    int;
  v_body           text;
  v_trimmed        text;
  v_lowered        text;
  v_attempts       int := 0;
begin
  if p_slug !~ '^[a-z0-9][a-z0-9-]{1,80}[a-z0-9]$' then
    raise exception 'invalid slug pattern: %', p_slug
      using errcode = '22023';
  end if;

  v_url := 'https://raw.githubusercontent.com/travelba/conciergetravel.fr/main/scripts/editorial-pilot/itineraries/seed/'
        || p_slug
        || '.sql';

  select net.http_get(v_url, timeout_milliseconds := 15000) into v_request_id;
  commit;

  loop
    v_attempts := v_attempts + 1;
    select status_code, content
      into v_status_code, v_body
      from net._http_response
      where id = v_request_id;

    exit when v_status_code is not null;
    exit when v_attempts > 80;
    perform pg_sleep(0.25);
  end loop;

  if v_status_code is null then
    raise exception 'pg_net request % did not complete within 20 s (slug %)', v_request_id, p_slug
      using errcode = '57014';
  end if;

  if v_status_code <> 200 then
    raise exception 'GitHub raw fetch failed for slug % (status %, url %)', p_slug, v_status_code, v_url
      using errcode = 'P0001';
  end if;

  if v_body is null or length(v_body) < 200 then
    raise exception 'unexpectedly small response body for slug % (% bytes)', p_slug, length(v_body)
      using errcode = 'P0001';
  end if;

  v_trimmed := ltrim(v_body);
  v_lowered := lower(v_trimmed);

  if position('insert into public.itineraries' in v_lowered) <> 1 then
    raise exception 'fetched content does not start with INSERT INTO public.itineraries (slug %)', p_slug
      using errcode = '42501';
  end if;

  if v_lowered ~ '(^|[^a-z_])drop\s'
     or v_lowered ~ '(^|[^a-z_])truncate\s'
     or v_lowered ~ '(^|[^a-z_])alter\s'
     or v_lowered ~ '(^|[^a-z_])grant\s'
     or v_lowered ~ '(^|[^a-z_])revoke\s'
     or v_lowered ~ '(^|[^a-z_])create\s'
     or v_lowered ~ '(^|[^a-z_])delete\s+from\s' then
    raise exception 'fetched SQL contains a forbidden DDL/DML token (slug %)', p_slug
      using errcode = '42501';
  end if;

  -- Defence in depth: the URL hard-codes the slug, but verify the
  -- response body actually references it (catches a GitHub redirect
  -- that returned a different file).
  if position('''' || p_slug || '''' in v_body) = 0 then
    raise exception 'fetched body does not reference expected slug %', p_slug
      using errcode = '42501';
  end if;

  execute v_body;
  raise notice 'applied seed % (% bytes)', p_slug, length(v_body);
end;
$proc$;

revoke all on procedure public.apply_itinerary_seed_from_github(text) from public, anon, authenticated;
grant execute on procedure public.apply_itinerary_seed_from_github(text) to service_role;

comment on procedure public.apply_itinerary_seed_from_github(text) is
  'Fetch a single seed file from the project GitHub raw URL via pg_net and apply it to public.itineraries. Uses explicit commit; between enqueue and wait so the pg_net worker actually sees the request. SECURITY DEFINER, service_role only.';

-- Drop the broken function from migration 0051 — it could never
-- succeed because of the transaction-rollback issue documented above.
drop function if exists public._exec_itinerary_seed_from_github(text);
