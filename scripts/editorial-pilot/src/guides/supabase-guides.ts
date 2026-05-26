/**
 * Supabase REST helpers for `editorial_guides` content backfills.
 *
 * Mirrors `scripts/editorial-pilot/src/rankings/supabase-rankings.ts`.
 * Scope here is the meta_desc backfill on draft guides.
 *
 * Skill: editorial-pilot, content-modeling, supabase-postgres-rls.
 */

import type { RankingLlmInput } from '../rankings/meta-desc-generator.js';

export interface SupabaseRestConfig {
  readonly url: string;
  readonly serviceRoleKey: string;
}

export interface GuideRow {
  readonly id: string;
  readonly slug: string;
  readonly name_fr: string;
  readonly name_en: string | null;
  readonly scope: string | null;
  readonly country_code: string | null;
  readonly summary_fr: string | null;
  readonly summary_en: string | null;
  readonly summary_long_fr: string | null;
  readonly meta_desc_fr: string | null;
  readonly meta_desc_en: string | null;
  readonly editorial_sections: unknown;
  readonly is_published: boolean;
}

const GUIDE_SELECT_COLUMNS = [
  'id',
  'slug',
  'name_fr',
  'name_en',
  'scope',
  'country_code',
  'summary_fr',
  'summary_en',
  'summary_long_fr',
  'meta_desc_fr',
  'meta_desc_en',
  'editorial_sections',
  'is_published',
].join(',');

export interface ListGuidesOptions {
  readonly limit?: number;
  readonly onlyPublished?: boolean;
  readonly slug?: string;
  readonly slugs?: readonly string[];
  readonly requireSections?: boolean;
  readonly order?: string;
}

export async function listGuides(
  cfg: SupabaseRestConfig,
  opts: ListGuidesOptions,
): Promise<GuideRow[]> {
  const params = new URLSearchParams();
  params.set('select', GUIDE_SELECT_COLUMNS);
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
  const url = `${cfg.url}/rest/v1/editorial_guides?${qs}`;

  const res = await fetch(url, {
    headers: {
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[supabase-guides] SELECT failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const json: unknown = await res.json();
  if (!Array.isArray(json)) {
    throw new Error('[supabase-guides] SELECT did not return an array');
  }
  return json as GuideRow[];
}

export interface MetaDescUpdate {
  readonly meta_desc_fr: string;
  readonly meta_desc_en: string;
}

export async function updateGuideMetaDesc(
  cfg: SupabaseRestConfig,
  guideId: string,
  payload: MetaDescUpdate,
): Promise<void> {
  await patchGuide(cfg, guideId, payload as unknown as Record<string, unknown>);
}

async function patchGuide(
  cfg: SupabaseRestConfig,
  guideId: string,
  body: Record<string, unknown>,
): Promise<void> {
  const url = `${cfg.url}/rest/v1/editorial_guides?id=eq.${encodeURIComponent(guideId)}`;
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
      `[supabase-guides] PATCH failed (${res.status}): ${responseBody.slice(0, 300)}`,
    );
  }
}

/**
 * Project a guide row into the `RankingLlmInput` shape so we can reuse
 * the rankings meta-desc generator + prompt. Guides and rankings share
 * a similar SERP-card optimisation function (the page is a curated
 * editorial selection, not a transactional product), so the same gate
 * applies (banned words, no listed hotels, comma + period, etc.).
 *
 * Field mapping:
 *   guide.name_fr            → ranking.title_fr
 *   guide.name_en (or name)  → ranking.title_en
 *   guide.scope ?? 'guide'   → ranking.kind (the prompt branches on this)
 *   guide.summary_long_fr    → ranking.intro_excerpt_fr (truncated)
 *   guide.summary_en         → ranking.intro_excerpt_en
 *   []                       → ranking.top_hotel_names (guides don't
 *                              list hotels in their intro; the prompt's
 *                              "must not name hotels" rule remains
 *                              relevant but the gate has no hits to
 *                              check against)
 */
export function projectGuideForLlm(row: GuideRow): RankingLlmInput {
  const truncate = (s: string | null, n: number): string => {
    if (s === null) return '';
    if (s.length <= n) return s;
    return `${s.slice(0, n).trimEnd()}…`;
  };

  const scopeLabel = row.name_fr
    .replace(/^(guide|le guide|la guide)\s+/iu, '')
    .replace(/^(des|du|de la|de l'|d'|de)\s+/iu, '')
    .trim();

  const sectionsCount = Array.isArray(row.editorial_sections) ? row.editorial_sections.length : 0;

  return {
    slug: row.slug,
    title_fr: row.name_fr,
    title_en: row.name_en ?? row.name_fr,
    kind: row.scope ?? 'guide',
    scope_label: scopeLabel,
    intro_excerpt_fr: truncate(row.summary_long_fr ?? row.summary_fr, 600),
    intro_excerpt_en: truncate(row.summary_en, 600),
    top_hotel_names: [],
    sections_count: sectionsCount,
  };
}
