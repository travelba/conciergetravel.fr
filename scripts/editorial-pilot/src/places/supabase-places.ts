/**
 * Generic Supabase / PostgREST helper for the "lieux à visiter" tables
 * (`places`, `place_hotel_links`, `place_gyg_products`). Mirrors the
 * hotels-specific helper in ../photos/supabase-rest.ts but parametrised
 * by table name so all three places tables reuse it.
 *
 * Uses the service-role key against `${url}/rest/v1/<table>` — no
 * `@supabase/supabase-js`, no direct pg.
 */
export interface SupabaseRestConfig {
  readonly url: string;
  readonly serviceRoleKey: string;
}

interface SelectOptions {
  readonly columns: string;
  /** PostgREST filters, e.g. `['is_published=eq.true', 'city_key=eq.paris']`. */
  readonly filters?: readonly string[];
  /** e.g. `priority.asc` or `distance_meters.asc`. */
  readonly order?: string;
  readonly limit?: number;
}

const POSTGREST_PAGE_SIZE = 1000;

function authHeaders(cfg: SupabaseRestConfig): Record<string, string> {
  return {
    apikey: cfg.serviceRoleKey,
    Authorization: `Bearer ${cfg.serviceRoleKey}`,
    Accept: 'application/json',
  };
}

/** Paged SELECT on an arbitrary table (PostgREST caps each page at 1000). */
export async function selectTable<T = unknown>(
  cfg: SupabaseRestConfig,
  table: string,
  opts: SelectOptions,
): Promise<T[]> {
  const baseOrder = opts.order ?? 'id.asc';
  const order = baseOrder.includes('id') ? baseOrder : `${baseOrder},id.asc`;
  const filterStr = (opts.filters ?? []).join('&');

  const fetchPage = async (limit: number, offset: number): Promise<T[]> => {
    const params = new URLSearchParams();
    params.set('select', opts.columns);
    params.set('order', order);
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    const qs = `${params.toString()}${filterStr.length > 0 ? `&${filterStr}` : ''}`;
    const res = await fetch(`${cfg.url}/rest/v1/${table}?${qs}`, { headers: authHeaders(cfg) });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Supabase SELECT ${table} failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const json: unknown = await res.json();
    if (!Array.isArray(json)) throw new Error(`Supabase SELECT ${table} did not return an array`);
    return json as T[];
  };

  const rows: T[] = [];
  let offset = 0;
  for (;;) {
    const remaining = opts.limit !== undefined ? opts.limit - rows.length : POSTGREST_PAGE_SIZE;
    if (remaining <= 0) break;
    const pageLimit = Math.min(POSTGREST_PAGE_SIZE, remaining);
    const page = await fetchPage(pageLimit, offset);
    rows.push(...page);
    offset += page.length;
    if (page.length < pageLimit) break;
  }
  return rows;
}

/**
 * Upsert rows on a table. `onConflict` is the comma-separated unique
 * key (e.g. `city_key,slug` for places, `place_id,hotel_id` for links).
 * Idempotent: re-running merges by the conflict target.
 */
export async function upsertRows(
  cfg: SupabaseRestConfig,
  table: string,
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>,
  onConflict: string,
): Promise<void> {
  if (rows.length === 0) return;
  const url = `${cfg.url}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...authHeaders(cfg),
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase UPSERT ${table} failed (${res.status}): ${text.slice(0, 400)}`);
  }
}

/** PATCH a single row by id on an arbitrary table. */
export async function patchById(
  cfg: SupabaseRestConfig,
  table: string,
  id: string,
  body: Readonly<Record<string, unknown>>,
): Promise<void> {
  const url = `${cfg.url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      ...authHeaders(cfg),
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase PATCH ${table} failed (${res.status}): ${text.slice(0, 300)}`);
  }
}

/** Delete rows matching a single PostgREST filter (e.g. `place_id=eq.<uuid>`). */
export async function deleteWhere(
  cfg: SupabaseRestConfig,
  table: string,
  filter: string,
): Promise<void> {
  const res = await fetch(`${cfg.url}/rest/v1/${table}?${filter}`, {
    method: 'DELETE',
    headers: { ...authHeaders(cfg), Prefer: 'return=minimal' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase DELETE ${table} failed (${res.status}): ${text.slice(0, 300)}`);
  }
}
