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
  /** PostgREST `limit` param. */
  readonly limit?: number;
}

export async function selectHotels<T = unknown>(
  cfg: SupabaseRestConfig,
  opts: SelectOptions,
): Promise<T[]> {
  const params = new URLSearchParams();
  params.set('select', opts.columns);
  if (opts.order !== undefined) params.set('order', opts.order);
  if (opts.limit !== undefined) params.set('limit', String(opts.limit));
  const filterStr = (opts.filters ?? []).join('&');
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
