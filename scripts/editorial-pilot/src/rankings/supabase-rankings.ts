/**
 * Supabase REST helpers for `editorial_rankings` content backfills.
 *
 * Mirrors `scripts/editorial-pilot/src/hotels/supabase-hotels.ts` —
 * hits PostgREST directly with the service-role JWT, no
 * `@supabase/supabase-js` dependency, narrow types. Scope here is the
 * meta_desc backfill on draft rankings; if other backfills land
 * later they can extend the same helpers.
 *
 * Skill: editorial-pilot, content-modeling, supabase-postgres-rls.
 */

export interface SupabaseRestConfig {
  readonly url: string;
  readonly serviceRoleKey: string;
}

export interface RankingRow {
  readonly id: string;
  readonly slug: string;
  readonly title_fr: string;
  readonly title_en: string;
  readonly kind: string;
  readonly intro_fr: string | null;
  readonly intro_en: string | null;
  readonly outro_fr: string | null;
  readonly outro_en: string | null;
  readonly meta_desc_fr: string | null;
  readonly meta_desc_en: string | null;
  readonly editorial_sections: unknown;
  readonly is_published: boolean;
}

const RANKING_SELECT_COLUMNS = [
  'id',
  'slug',
  'title_fr',
  'title_en',
  'kind',
  'intro_fr',
  'intro_en',
  'outro_fr',
  'outro_en',
  'meta_desc_fr',
  'meta_desc_en',
  'editorial_sections',
  'is_published',
].join(',');

export interface ListRankingsOptions {
  readonly limit?: number;
  /** Restrict to `is_published = true`. Default true. */
  readonly onlyPublished?: boolean;
  /** Restrict to a single slug — handy for debug. */
  readonly slug?: string;
  /** Restrict to an explicit list of slugs. */
  readonly slugs?: readonly string[];
  /** Only rows where `editorial_sections` is non-empty. Default true. */
  readonly requireSections?: boolean;
  /** Order — default `updated_at.desc`. */
  readonly order?: string;
}

export async function listRankings(
  cfg: SupabaseRestConfig,
  opts: ListRankingsOptions,
): Promise<RankingRow[]> {
  const params = new URLSearchParams();
  params.set('select', RANKING_SELECT_COLUMNS);
  params.set('order', opts.order ?? 'updated_at.desc');

  const filterParts: string[] = [];

  if (opts.onlyPublished !== false) {
    filterParts.push('is_published=eq.true');
  }

  if (opts.requireSections !== false) {
    filterParts.push('editorial_sections=not.is.null');
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
  const url = `${cfg.url}/rest/v1/editorial_rankings?${qs}`;

  const res = await fetch(url, {
    headers: {
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[supabase-rankings] SELECT failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const json: unknown = await res.json();
  if (!Array.isArray(json)) {
    throw new Error('[supabase-rankings] SELECT did not return an array');
  }
  return json as RankingRow[];
}

export interface MetaDescUpdate {
  readonly meta_desc_fr: string;
  readonly meta_desc_en: string;
}

export async function updateRankingMetaDesc(
  cfg: SupabaseRestConfig,
  rankingId: string,
  payload: MetaDescUpdate,
): Promise<void> {
  await patchRanking(cfg, rankingId, payload as unknown as Record<string, unknown>);
}

export async function publishRanking(cfg: SupabaseRestConfig, rankingId: string): Promise<void> {
  await patchRanking(cfg, rankingId, { is_published: true });
}

export interface SectionsAndFaqUpdate {
  /** Serialised `EditorialSection[]` payload (see `generate-ranking-v2.ts`). */
  readonly editorial_sections: unknown;
  /** Serialised FAQ array (see `generate-ranking-v2.ts` `FaqSchema`). */
  readonly faq: unknown;
  /** When true, flip `is_published` to true in the same PATCH. */
  readonly publish?: boolean;
}

/**
 * Patch a ranking row with the freshly generated `editorial_sections`
 * and `faq` payloads, optionally flipping `is_published` to true in the
 * same call. Used by `enrich-ranking-sections-only.ts` to back-fill
 * curated rankings (e.g. `classement-travel-leisure-worlds-best-2025`)
 * without touching the existing intro/outro/entries.
 */
export async function updateRankingSectionsAndFaq(
  cfg: SupabaseRestConfig,
  rankingId: string,
  payload: SectionsAndFaqUpdate,
): Promise<void> {
  const body: Record<string, unknown> = {
    editorial_sections: payload.editorial_sections,
    faq: payload.faq,
  };
  if (payload.publish === true) {
    body['is_published'] = true;
  }
  await patchRanking(cfg, rankingId, body);
}

async function patchRanking(
  cfg: SupabaseRestConfig,
  rankingId: string,
  body: Record<string, unknown>,
): Promise<void> {
  const url = `${cfg.url}/rest/v1/editorial_rankings?id=eq.${encodeURIComponent(rankingId)}`;
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
      `[supabase-rankings] PATCH failed (${res.status}): ${responseBody.slice(0, 300)}`,
    );
  }
}

/**
 * Compact projection sent to the LLM prompt. Strips intro/outro to the
 * first 600 chars (enough to anchor the topic + angle without blowing
 * the context window for a 600-token meta_desc output) and pulls 3-5
 * top hotel names from `editorial_sections` for the gate's
 * forbidden-hotel-name check.
 */
import type { RankingLlmInput } from './meta-desc-generator.js';

export function projectRankingForLlm(row: RankingRow): RankingLlmInput {
  const truncate = (s: string | null, n: number): string => {
    if (s === null) return '';
    if (s.length <= n) return s;
    return `${s.slice(0, n).trimEnd()}…`;
  };

  // Heuristic scope label from the title (strip leading "Meilleurs",
  // "Classement", "Les", "Notre sélection" prefixes for a cleaner
  // anchor in the prompt). We keep the original title in title_fr/_en
  // and just compute a one-shot label for the prompt.
  const scopeLabel = row.title_fr
    .replace(/^(les meilleurs|meilleurs|notre sélection|classement|le top|top)\s+/iu, '')
    .replace(/^(des|du|de la|de l'|d'|de)\s+/iu, '')
    .trim();

  const topHotelNames = extractTopHotelNames(row.editorial_sections, 5);

  return {
    slug: row.slug,
    title_fr: row.title_fr,
    title_en: row.title_en,
    kind: row.kind,
    scope_label: scopeLabel,
    intro_excerpt_fr: truncate(row.intro_fr, 600),
    intro_excerpt_en: truncate(row.intro_en, 600),
    top_hotel_names: topHotelNames,
    sections_count: Array.isArray(row.editorial_sections) ? row.editorial_sections.length : 0,
  };
}

/**
 * Walk `editorial_sections` looking for hotel names inside the
 * canonical section shape. The shape varies across `kind` (v1 vs v2)
 * so we accept multiple field names and silently skip what doesn't
 * match. The gate uses these names to reject meta_desc strings that
 * accidentally preview the ranking content.
 */
function extractTopHotelNames(sections: unknown, max: number): readonly string[] {
  if (!Array.isArray(sections)) return [];
  const out: string[] = [];
  for (const section of sections) {
    if (typeof section !== 'object' || section === null) continue;
    const s = section as Record<string, unknown>;
    // v2 shape: `{ entry: { hotel_name, ...}, ... }`
    const entry = s['entry'];
    if (typeof entry === 'object' && entry !== null) {
      const e = entry as Record<string, unknown>;
      const name = e['hotel_name'] ?? e['name'] ?? e['title'];
      if (typeof name === 'string' && name.length > 0) out.push(name);
    }
    // v1 shape: top-level `{ hotel_name, name, title }`
    const directName = s['hotel_name'] ?? s['name'] ?? s['title'];
    if (typeof directName === 'string' && directName.length > 0 && !out.includes(directName)) {
      out.push(directName);
    }
    if (out.length >= max) break;
  }
  return out;
}
