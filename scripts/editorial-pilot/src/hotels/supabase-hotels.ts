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
  readonly meta_desc_fr: string | null;
  readonly meta_desc_en: string | null;
  readonly concierge_advice: unknown;
  // Premium Concierge sections — migration 0057 (Le Concierge Club).
  // jsonb columns shaped `{ fr: { body }, en: { body } }`.
  readonly conseil_enrichi: unknown;
  readonly quartier_concierge: unknown;
  readonly gastronomie_concierge: unknown;
  readonly timing_acces_concierge: unknown;
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
  'meta_desc_fr',
  'meta_desc_en',
  'concierge_advice',
  'conseil_enrichi',
  'quartier_concierge',
  'gastronomie_concierge',
  'timing_acces_concierge',
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
  /**
   * Only include hotels where `concierge_advice` is currently null.
   * Default false — concierge_advice CLI flips it true.
   */
  readonly onlyMissingConciergeAdvice?: boolean;
  /**
   * Only include hotels where `meta_desc_fr` OR `meta_desc_en` is
   * outside the production target band (140-170 chars). Default false —
   * meta-desc CLI flips it true. Uses PostgREST `or(...)` to combine
   * the FR and EN length checks.
   */
  readonly onlyOutOfBandMetaDesc?: boolean;
  /**
   * Only include hotels where the given premium Concierge column is
   * currently null. Default unset — the premium-section CLI sets this
   * to the section it's generating.
   */
  readonly onlyMissingPremiumSection?:
    | 'conseil_enrichi'
    | 'quartier_concierge'
    | 'gastronomie_concierge'
    | 'timing_acces_concierge';
  /**
   * Restrict to `is_published = true`. Default true — editorial
   * backfills target the live catalogue first. Set to false to
   * include draft rows (Phase 2 work).
   */
  readonly onlyPublished?: boolean;
  /** Restrict to a single hotel by slug — handy for one-shot debugging. */
  readonly slug?: string;
  /** Restrict to an explicit list of slugs (comma-separated in CLI). */
  readonly slugs?: readonly string[];
  /**
   * Order: default `updated_at.desc`. Pass `priority.asc.nullslast` to
   * surface high-priority hotels first when running a partial batch.
   */
  readonly order?: string;
}

export async function listHotelsForFactualSummary(
  cfg: SupabaseRestConfig,
  opts: ListHotelsOptions = {},
): Promise<HotelRow[]> {
  return listHotels(cfg, {
    ...opts,
    onlyMissingFactualSummary: opts.onlyMissingFactualSummary !== false,
  });
}

export async function listHotelsForConciergeAdvice(
  cfg: SupabaseRestConfig,
  opts: Omit<ListHotelsOptions, 'onlyMissingConciergeAdvice'> = {},
): Promise<HotelRow[]> {
  return listHotels(cfg, { ...opts, onlyMissingConciergeAdvice: true });
}

/**
 * Eligible rows for the meta_desc backfill: published hotels whose
 * `meta_desc_fr` or `meta_desc_en` falls outside the 140-170 char
 * production target band. Also includes rows where either column is
 * NULL or the empty string.
 */
export async function listHotelsForMetaDesc(
  cfg: SupabaseRestConfig,
  opts: Omit<ListHotelsOptions, 'onlyOutOfBandMetaDesc'> = {},
): Promise<HotelRow[]> {
  return listHotels(cfg, { ...opts, onlyOutOfBandMetaDesc: true });
}

/**
 * Eligible rows for the description-extend backfill: published hotels
 * whose `description_fr` is non-null but shorter than the CDC §2.4
 * 600-char floor. The length check runs client-side (PostgREST cannot
 * filter on `char_length`).
 *
 * Rows where `description_fr IS NULL` are intentionally excluded — the
 * extend pipeline preserves the opening and therefore cannot run on
 * an empty seed. Use the future `run-hotel-description-rewrite.ts`
 * pipeline (TODO) for those.
 */
export async function listHotelsForDescriptionExtend(
  cfg: SupabaseRestConfig,
  opts: ListHotelsOptions = {},
): Promise<HotelRow[]> {
  return listHotels(cfg, { ...opts, requireDescription: true });
}

export async function listHotels(
  cfg: SupabaseRestConfig,
  opts: ListHotelsOptions,
): Promise<HotelRow[]> {
  const params = new URLSearchParams();
  params.set('select', HOTEL_SELECT_COLUMNS);
  params.set('order', opts.order ?? 'updated_at.desc');

  const filterParts: string[] = [];

  if (opts.onlyPublished !== false) {
    // Default to published-only — Phase 1 backfills target the live
    // catalogue; Phase 2 promotes drafts and can opt out explicitly.
    filterParts.push('is_published=eq.true');
  }

  if (opts.requireDescription !== false) {
    filterParts.push('description_fr=not.is.null');
  }

  if (opts.onlyMissingFactualSummary === true) {
    filterParts.push('factual_summary_fr=is.null');
  }

  if (opts.onlyMissingConciergeAdvice === true) {
    filterParts.push('concierge_advice=is.null');
  }

  if (opts.onlyMissingPremiumSection !== undefined) {
    filterParts.push(`${opts.onlyMissingPremiumSection}=is.null`);
  }

  // NOTE: the length-based filter for meta_desc (140-170 band) lives
  // client-side in the run script — PostgREST doesn't expose
  // `char_length(col)` as a filter operand, so we pull the full
  // published set and refine in TypeScript. `onlyOutOfBandMetaDesc` is
  // therefore a no-op on the server query, but kept on the options
  // type for API parity with the factual_summary / concierge_advice
  // helpers.

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
  await patchHotel(cfg, hotelId, payload as unknown as Record<string, unknown>);
}

/**
 * Concierge advice payload — matches the `ConciergeAdviceBriefSchema`
 * jsonb shape (see `apps/web/src/server/hotels/get-hotel-by-slug.ts`
 * + migration 0032).
 */
export interface ConciergeAdviceLocalePayload {
  readonly title: string;
  readonly body: string;
  readonly tip_for: 'room' | 'dining' | 'timing' | 'access' | 'service' | 'wellness';
}

export interface ConciergeAdvicePayload {
  readonly fr: ConciergeAdviceLocalePayload;
  readonly en: ConciergeAdviceLocalePayload;
}

export async function updateHotelConciergeAdvice(
  cfg: SupabaseRestConfig,
  hotelId: string,
  payload: ConciergeAdvicePayload,
): Promise<void> {
  await patchHotel(cfg, hotelId, { concierge_advice: payload });
}

export interface MetaDescUpdate {
  readonly meta_desc_fr: string;
  readonly meta_desc_en: string;
}

export async function updateHotelMetaDesc(
  cfg: SupabaseRestConfig,
  hotelId: string,
  payload: MetaDescUpdate,
): Promise<void> {
  await patchHotel(cfg, hotelId, payload as unknown as Record<string, unknown>);
}

export interface DescriptionUpdate {
  readonly description_fr: string;
  readonly description_en: string;
}

export async function updateHotelDescription(
  cfg: SupabaseRestConfig,
  hotelId: string,
  payload: DescriptionUpdate,
): Promise<void> {
  await patchHotel(cfg, hotelId, payload as unknown as Record<string, unknown>);
}

/**
 * Premium Concierge section payload — matches the jsonb shape
 * `{ fr: { body }, en: { body }, _editorial_review_status, _generated_at, _llm_model }`
 * applied by migration 0057.
 */
export interface PremiumSectionPayload {
  readonly fr: { readonly body: string };
  readonly en: { readonly body: string };
  readonly _editorial_review_status?: 'draft' | 'pending' | 'approved';
  readonly _generated_at?: string;
  readonly _llm_model?: string;
}

export type PremiumSectionColumn =
  | 'conseil_enrichi'
  | 'quartier_concierge'
  | 'gastronomie_concierge'
  | 'timing_acces_concierge';

export async function updateHotelPremiumSection(
  cfg: SupabaseRestConfig,
  hotelId: string,
  column: PremiumSectionColumn,
  payload: PremiumSectionPayload,
): Promise<void> {
  await patchHotel(cfg, hotelId, { [column]: payload });
}

async function patchHotel(
  cfg: SupabaseRestConfig,
  hotelId: string,
  body: Record<string, unknown>,
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
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const responseBody = await res.text();
    throw new Error(
      `[supabase-hotels] PATCH failed (${res.status}): ${responseBody.slice(0, 300)}`,
    );
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
