/**
 * Tiny Supabase REST helper for the photo orchestrator.
 *
 * We avoid `@supabase/supabase-js` (heavy + requires a fetch polyfill
 * in Node < 18) and pg/pg-pool (would need a DB password not exposed
 * by Supabase). The PostgREST endpoint on `${url}/rest/v1/*` accepts
 * service-role JWT and is enough for our SELECT + UPDATE needs.
 */

export interface SupabaseRestConfig {
  readonly url: string;
  readonly serviceRoleKey: string;
}

interface SelectOptions {
  /** Comma-separated column list. */
  readonly columns: string;
  /** `?eq.col.value` filters. Joined with `&`. */
  readonly filters?: readonly string[];
  /** ?order=col.asc. */
  readonly order?: string;
  /** Max rows to return overall. Undefined = full result set. */
  readonly limit?: number;
}

/**
 * Supabase / PostgREST caps every single response at `max-rows` (1000 by
 * default) regardless of the `limit` query param. A naive `selectHotels`
 * therefore silently truncates the catalogue at 1000 rows — the bug that
 * left `geocode`/`pois` processing only the first 1000 hotels. We page
 * with `offset` and a stable tie-breaker (`slug.asc`) until the page is
 * short, deduping by slug in case a row shifts between pages.
 */
const POSTGREST_PAGE_SIZE = 1000;

export async function selectHotels<T = unknown>(
  cfg: SupabaseRestConfig,
  opts: SelectOptions,
): Promise<T[]> {
  // Ensure a deterministic order so offset paging never skips/duplicates.
  const baseOrder = opts.order ?? 'slug.asc';
  const order = baseOrder.includes('slug') ? baseOrder : `${baseOrder},slug.asc`;
  const filterStr = (opts.filters ?? []).join('&');

  const fetchPage = async (limit: number, offset: number): Promise<T[]> => {
    const params = new URLSearchParams();
    params.set('select', opts.columns);
    params.set('order', order);
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    const qs = `${params.toString()}${filterStr.length > 0 ? `&${filterStr}` : ''}`;
    const res = await fetch(`${cfg.url}/rest/v1/hotels?${qs}`, {
      headers: {
        apikey: cfg.serviceRoleKey,
        Authorization: `Bearer ${cfg.serviceRoleKey}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Supabase SELECT failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const json: unknown = await res.json();
    if (!Array.isArray(json)) throw new Error('Supabase SELECT did not return an array');
    return json as T[];
  };

  const seen = new Set<string>();
  const rows: T[] = [];
  let offset = 0;
  for (;;) {
    const remaining = opts.limit !== undefined ? opts.limit - rows.length : POSTGREST_PAGE_SIZE;
    if (remaining <= 0) break;
    const pageLimit = Math.min(POSTGREST_PAGE_SIZE, remaining);
    const page = await fetchPage(pageLimit, offset);
    for (const row of page) {
      const slug = (row as { slug?: unknown }).slug;
      // Dedupe when the table has a `slug`; otherwise keep every row.
      if (typeof slug === 'string') {
        if (seen.has(slug)) continue;
        seen.add(slug);
      }
      rows.push(row);
      if (opts.limit !== undefined && rows.length >= opts.limit) break;
    }
    offset += page.length;
    if (page.length < pageLimit) break;
  }
  return rows;
}

export async function updateHotelPhotos(
  cfg: SupabaseRestConfig,
  hotelId: string,
  payload: {
    readonly hero_image: string | null;
    readonly gallery_images: ReadonlyArray<{
      readonly public_id: string;
      readonly alt_fr?: string;
      readonly alt_en?: string;
      readonly category?: string;
    }>;
  },
): Promise<void> {
  const url = `${cfg.url}/rest/v1/hotels?id=eq.${encodeURIComponent(hotelId)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
      'Content-Type': 'application/json',
      // `Prefer: return=minimal` keeps the round-trip small (we don't
      // need the updated row payload).
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase PATCH failed (${res.status}): ${body.slice(0, 300)}`);
  }
}
