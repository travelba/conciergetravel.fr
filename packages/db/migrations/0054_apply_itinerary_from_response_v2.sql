-- 0054: tighten DDL/DML detection in apply_itinerary_from_response
--
-- The first version (migration 0053) blocked any occurrence of the
-- bare tokens `drop`, `create`, `alter`, etc. That triggered a false
-- positive on natural-language editorial content (e.g. an English
-- itinerary body that says "ask the concierge for a car drop at the
-- foot of the Rocher" — "drop" is a noun here, not a SQL keyword).
--
-- This version requires the dangerous tokens to be followed by a
-- real SQL object keyword (table / function / schema / etc.) before
-- treating it as DDL. That keeps the defence in depth without
-- blocking realistic editorial copy.
--
-- The seed itself still:
--   - must start with `insert into public.itineraries`
--   - must mention its own slug literal somewhere in the body
-- so a payload that doesn't look like an itinerary seed is still
-- refused at the prefix / slug-reference stage.

create or replace function public.apply_itinerary_from_response(
  p_slug       text,
  p_request_id bigint
) returns text
language plpgsql
security definer
set search_path = public, pg_temp, extensions, net
as $fn$
declare
  v_status_code int;
  v_body        text;
  v_trimmed     text;
  v_lowered     text;
begin
  if p_slug !~ '^[a-z0-9][a-z0-9-]{1,80}[a-z0-9]$' then
    raise exception 'invalid slug pattern: %', p_slug
      using errcode = '22023';
  end if;

  select status_code, content
    into v_status_code, v_body
    from net._http_response
    where id = p_request_id;

  if v_status_code is null then
    raise exception 'pg_net request % has no response yet (slug %)', p_request_id, p_slug
      using errcode = '57014';
  end if;

  if v_status_code <> 200 then
    raise exception 'GitHub raw fetch failed for slug % (status %)', p_slug, v_status_code
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

  -- DDL/DML tokens must be followed by a real SQL object keyword
  -- to count as a threat. Bare "drop", "create", etc. in natural
  -- language are explicitly allowed.
  if v_lowered ~ '(^|[^a-z_])drop\s+(table|function|procedure|schema|view|index|extension|database|role|user|policy|trigger|sequence|materialized)\b'
     or v_lowered ~ '(^|[^a-z_])alter\s+(table|function|procedure|schema|view|index|extension|database|role|user|policy|trigger|sequence|system)\b'
     or v_lowered ~ '(^|[^a-z_])create\s+(table|function|procedure|schema|view|index|extension|database|role|user|policy|trigger|sequence|or\s+replace)\b'
     or v_lowered ~ '(^|[^a-z_])truncate\s+(table\s+)?[a-z_"]'
     or v_lowered ~ '(^|[^a-z_])grant\s+(all|select|insert|update|delete|usage|execute|references|connect|trigger)\b'
     or v_lowered ~ '(^|[^a-z_])revoke\s+(all|select|insert|update|delete|usage|execute|references|connect|trigger)\b'
     or v_lowered ~ '(^|[^a-z_])delete\s+from\s' then
    raise exception 'fetched SQL contains a forbidden DDL/DML pattern (slug %)', p_slug
      using errcode = '42501';
  end if;

  if position('''' || p_slug || '''' in v_body) = 0 then
    raise exception 'fetched body does not reference expected slug %', p_slug
      using errcode = '42501';
  end if;

  execute v_body;
  return format('ok: %s applied (%s bytes)', p_slug, length(v_body));
end;
$fn$;

revoke all on function public.apply_itinerary_from_response(text, bigint) from public, anon, authenticated;
grant execute on function public.apply_itinerary_from_response(text, bigint) to service_role;
