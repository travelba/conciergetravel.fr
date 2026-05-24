-- 0051: synchronous seed loader from GitHub raw via pg_net
--
-- Used by the agent loop to apply editorial itinerary seeds without
-- having to transport 30 KB of SQL or base64 through MCP tool args.
-- Each MCP call shrinks to ~80 chars: `select _exec_itinerary_seed_from_github('reims-champagne-week-end');`.
--
-- Safety contract (mirror of 0049/0050):
-- - SECURITY DEFINER, EXECUTE revoked from anon/authenticated.
-- - Slug allow-list regex: only kebab-case slugs accepted.
-- - URL hard-coded to the `travelba/conciergetravel.fr` repo + `main`
--   branch + `scripts/editorial-pilot/itineraries/seed/` prefix.
--   The function cannot be tricked into fetching arbitrary URLs.
-- - Downloaded SQL must start with `INSERT INTO public.itineraries`
--   (case-insensitive, whitespace-tolerant). Anything else is refused.
-- - Forbidden tokens (`DROP `, `TRUNCATE `, `ALTER `, `GRANT `, `REVOKE `,
--   `CREATE `, `DELETE FROM `) trigger a refusal even if the prefix
--   passes — defence in depth. `UPDATE` is *not* forbidden because the
--   seed itself uses `ON CONFLICT (...) DO UPDATE SET ...`.

create extension if not exists pg_net schema extensions;

create or replace function public._exec_itinerary_seed_from_github(p_slug text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp, extensions, net
as $fn$
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

  loop
    v_attempts := v_attempts + 1;
    select status_code, content
      into v_status_code, v_body
      from net._http_response
      where id = v_request_id;

    exit when v_status_code is not null;
    exit when v_attempts > 40;
    perform pg_sleep(0.25);
  end loop;

  if v_status_code is null then
    raise exception 'pg_net request % did not complete within 10 s', v_request_id
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

  execute v_body;

  return format('ok: %s applied (%s bytes from %s)', p_slug, length(v_body), v_url);
end;
$fn$;

revoke all on function public._exec_itinerary_seed_from_github(text) from public, anon, authenticated;
grant execute on function public._exec_itinerary_seed_from_github(text) to service_role;

comment on function public._exec_itinerary_seed_from_github(text) is
  'Fetch a single seed file from the project''s GitHub raw URL and apply it to public.itineraries. Slug must match [a-z0-9-]+. SECURITY DEFINER, service_role only. See migration 0049/0050 for the b64 / inline-SQL variants.';
