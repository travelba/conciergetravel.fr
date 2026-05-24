-- 0053: response-based seed apply function
--
-- Migration 0052 created a procedure that `commit;`s between the
-- pg_net enqueue and the response wait. PostgREST/MCP wraps every
-- `CALL` in a transaction, so the `commit;` raises `invalid
-- transaction termination` when invoked through that path.
--
-- This migration splits the workflow into two cleanly-committable
-- steps that PostgREST can both run:
--
--   step 1 (one statement, all slugs at once):
--     select net.http_get(...) for each slug;
--     -> MCP autocommits, the pg_net worker can now see the queue.
--
--   step 2 (one statement per slug, after waiting a few seconds):
--     select public.apply_itinerary_from_response(p_slug, p_request_id);
--     -> reads net._http_response, validates, EXECUTE's the SQL.
--
-- Safety contract identical to 0051/0052.

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

comment on function public.apply_itinerary_from_response(text, bigint) is
  'Read an already-fetched pg_net response body, validate it as an itinerary seed UPSERT, and EXECUTE it. Use after enqueuing requests with net.http_get(...). Safety contract identical to 0049-0052.';
