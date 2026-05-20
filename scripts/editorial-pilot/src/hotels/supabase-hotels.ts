/**
 * Supabase REST helpers for hotel fiche content generation.
 *
 * Mirrors the lightweight pattern adopted in
 * `scripts/editorial-pilot/src/photos/supabase-rest.ts` (avoid
 * `@supabase/supabase-js`, hit PostgREST directly with the service-role
 * JWT). Scope here = read hotel rows that need editorial enrichment
 * (factual_summary, concierge_advice, …) and write the enriched
 * fields back.
 *
 * Skill: editorial-pilot, content-modeling, supabase-postgres-rls.
 */

export interface SupabaseRestConfig {
  readonly url: string;
  readonly serviceRoleKey: string;
}

/**
 * Subset of `public.hotels` columns we need to render the factual
 * summary prompt input. Mirrors the column list in
 * `apps/web/src/server/hotels/get-hotel-by-slug.ts` but kept minimal so
 * the pipeline batch payload stays small (we read 442+ rows per pilot
 * run).
 */
export interface HotelRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly name_en: string | null;
  readonly city: string | null;
  readonly district: string | null;
  readonly region: string | null;
  readonly country_code: string | null;
  readonly country_label_fr: string | null;
  readonly country_label_en: string | null;
  readonly stars: number | null;
  readonly is_palace: boolean | null;
  readonly description_fr: string | null;
  readonly description_en: string | null;
  readonly points_of_interest: unknown;
  readonly restaurant_info: unknown;
  readonly spa_info: unknown;
  readonly amenities: unknown;
  readonly signature_experiences: unknown;
  readonly awards: unknown;
  readonly factual_summary_fr: string | null;
  readonly factual_summary_en: string | null;
  readonly concierge_advice: unknown;
}

const HOTEL_SELECT_COLUMNS = [
  'id',
  'slug',
  'name',
  'name_en',
  'city',
  'district',
  'region',
  'country_code',
  'country_label_fr',
  'country_label_en',
  'stars',
  'is_palace',
  'description_fr',
  'description_en',
  'points_of_interest',
  'restaurant_info',
  'spa_info',
  'amenities',
  'signature_experiences',
  'awards',
  'factual_summary_fr',
  'factual_summary_en',
  'concierge_advice',
].join(',');

export interface ListHotelsOptions {
  /** Cap result count (PostgREST `limit`). */
  readonly limit?: number;
  /**
   * Only include hotels where `description_fr` is non-null AND long
   * enough to anchor a factual summary. Default true — generating
   * summaries from a 30-char description risks hallucination.
   */
  readonly requireDescription?: boolean;
  /**
   * Only include hotels where `factual_summary_fr` is currently null.
   * Default true — we don't want to overwrite already-validated
   * summaries on a re-run.
   */
  readonly onlyMissingFactualSummary?: boolean;
  /** Restrict to a single hotel by slug — handy for one-shot debugging. */
  readonly slug?: string;
  /** Restrict to an explicit list of slugs (comma-separated in CLI). */
  readonly slugs?: readonly string[];
}

export async function listHotelsForFactualSummary(
  cfg: SupabaseRestConfig,
  opts: ListHotelsOptions = {},
): Promise<HotelRow[]> {
  const params = new URLSearchParams();
  params.set('select', HOTEL_SELECT_COLUMNS);
  params.set('order', 'updated_at.desc');

  const filterParts: string[] = [];

  if (opts.requireDescription !== false) {
    // description_fr IS NOT NULL — PostgREST: not.is.null
    filterParts.push('description_fr=not.is.null');
  }

  if (opts.onlyMissingFactualSummary !== false) {
    filterParts.push('factual_summary_fr=is.null');
  }

  if (opts.slug !== undefined) {
    filterParts.push(`slug=eq.${encodeURIComponent(opts.slug)}`);
  } else if (opts.slugs !== undefined && opts.slugs.length > 0) {
    const list = opts.slugs.map((s) => encodeURIComponent(s)).join(',');
    filterParts.push(`slug=in.(${list})`);
  }

  if (opts.limit !== undefined) {
    params.set('limit', String(opts.limit));
  }

  const qs = `${params.toString()}${filterParts.length > 0 ? `&${filterParts.join('&')}` : ''}`;
  const url = `${cfg.url}/rest/v1/hotels?${qs}`;

  const res = await fetch(url, {
    headers: {
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[supabase-hotels] SELECT failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const json: unknown = await res.json();
  if (!Array.isArray(json)) {
    throw new Error('[supabase-hotels] SELECT did not return an array');
  }
  return json as HotelRow[];
}

export interface FactualSummaryUpdate {
  readonly factual_summary_fr: string;
  readonly factual_summary_en: string;
}

export async function updateHotelFactualSummary(
  cfg: SupabaseRestConfig,
  hotelId: string,
  payload: FactualSummaryUpdate,
): Promise<void> {
  const url = `${cfg.url}/rest/v1/hotels?id=eq.${encodeURIComponent(hotelId)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[supabase-hotels] PATCH failed (${res.status}): ${body.slice(0, 300)}`);
  }
}

/**
 * Compact projection sent to the LLM prompt. Strips long-form
 * descriptions to the first 800 chars (enough to ground the USPs
 * without blowing the context window) and serialises POIs/awards to a
 * 5-item cap.
 */
export interface HotelLlmInput {
  readonly slug: string;
  readonly name: string;
  readonly name_en: string | null;
  readonly city: string | null;
  readonly district: string | null;
  readonly country_code: string | null;
  readonly country_label_fr: string | null;
  readonly country_label_en: string | null;
  readonly stars: number | null;
  readonly is_palace: boolean | null;
  readonly description_fr_excerpt: string | null;
  readonly description_en_excerpt: string | null;
  readonly points_of_interest: unknown;
  readonly restaurant_info: unknown;
  readonly spa_info: unknown;
  readonly amenities: unknown;
  readonly signature_experiences: unknown;
  readonly awards: unknown;
}

export function projectHotelForLlm(row: HotelRow): HotelLlmInput {
  const truncate = (s: string | null, n: number): string | null => {
    if (s === null) return null;
    if (s.length <= n) return s;
    return `${s.slice(0, n).trimEnd()}…`;
  };

  return {
    slug: row.slug,
    name: row.name,
    name_en: row.name_en,
    city: row.city,
    district: row.district,
    country_code: row.country_code,
    country_label_fr: row.country_label_fr,
    country_label_en: row.country_label_en,
    stars: row.stars,
    is_palace: row.is_palace,
    description_fr_excerpt: truncate(row.description_fr, 800),
    description_en_excerpt: truncate(row.description_en, 800),
    points_of_interest: capArray(row.points_of_interest, 5),
    restaurant_info: row.restaurant_info,
    spa_info: row.spa_info,
    amenities: capArray(row.amenities, 12),
    signature_experiences: capArray(row.signature_experiences, 5),
    awards: capArray(row.awards, 5),
  };
}

function capArray(value: unknown, max: number): unknown {
  if (Array.isArray(value)) return value.slice(0, max);
  return value;
}
