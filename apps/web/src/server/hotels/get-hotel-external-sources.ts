import 'server-only';

import { z } from 'zod';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { isValidSlug } from '@/server/hotels/get-hotel-by-slug';

/**
 * `external_sources` — EEAT provenance entries seeded by the Phase 1.5
 * backfill (skill: content-enrichment-pipeline, ADR-0023). Each entry is
 * a single factual claim grounded in a verifiable external source.
 *
 * Shape: `{ field, value, source, source_url, confidence, collected_at }`
 *
 * Backfill source: `scripts/editorial-pilot/src/enrichment/convert-wikidata-to-external-sources.ts`
 *   - Reads scalar columns already resolved on `public.hotels`
 *     (`wikidata_id`, `wikipedia_url_fr/en`, `official_url`,
 *     `tripadvisor_location_id`, `booking_com_hotel_id`,
 *     `commons_category`, `external_sameas`).
 *   - Emits one entry per identifier, with a stable `source_url`
 *     anchored on the external site (Wikidata Q-page, Wikipedia
 *     article, official URL, etc.).
 *   - Extracts derived facts from `external_sameas`: inception year,
 *     architects, heritage designations, social handles.
 *
 * Why the shape diverges from the editorial guides/rankings
 * `external_sources` (`{ url, label_fr, label_en, type }` — see
 * `apps/web/src/components/editorial/external-sources-footer.tsx`):
 *
 * - Hotels carry **per-fact provenance** (which scalar field came from
 *   which source). Guides/rankings carry **per-source citations** for
 *   editorial article footers ("Sources & références" block).
 * - Both columns are named `external_sources` for historical reasons
 *   but the consumers are disjoint: this file is the canonical reader
 *   for the hotel shape, the editorial footer reads the article shape.
 *
 * The unknown-passthrough on `value` keeps the schema future-proof
 * (some Wikidata-derived fields are arrays — architects, heritage —
 * others are scalars — Q-IDs, URLs, years).
 *
 * Skills: api-integration, geo-llm-optimization §EEAT,
 *         content-enrichment-pipeline §provenance.
 */
export const ExternalSourceProvenanceEntrySchema = z.object({
  field: z.string().min(1),
  value: z.unknown(),
  source: z.string().min(1),
  source_url: z.string().url().optional(),
  confidence: z.enum(['high', 'medium', 'low']).optional(),
  collected_at: z.string().min(1).optional(),
});

export type ExternalSourceProvenanceEntry = z.infer<typeof ExternalSourceProvenanceEntrySchema>;

const RowSchema = z.object({
  slug: z.string().min(1),
  slug_en: z.string().min(1).nullable().optional(),
  name: z.string().min(1),
  name_en: z.string().min(1).nullable().optional(),
  updated_at: z.string().min(1).nullable().optional(),
  external_sources: z.unknown().nullable().optional(),
});

export interface HotelExternalSourcesPayload {
  readonly slug: string;
  readonly slugEn: string | null;
  readonly name: string;
  readonly nameEn: string | null;
  readonly updatedAt: string | null;
  readonly sources: readonly ExternalSourceProvenanceEntry[];
}

function parseSourcesLenient(raw: unknown): readonly ExternalSourceProvenanceEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: ExternalSourceProvenanceEntry[] = [];
  for (const candidate of raw) {
    // Per-entry lenient parse — drop the bad shape instead of failing
    // the whole row. The backfill is idempotent and may revisit the
    // entry later; in the meantime LLM agents see the valid entries.
    const parsed = ExternalSourceProvenanceEntrySchema.safeParse(candidate);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

/**
 * Fetch the EEAT `external_sources` provenance array for a published
 * hotel by canonical slug (FR or EN — we look up against either).
 *
 * Returns `null` when the slug doesn't match a published row. Returns
 * an empty `sources` array (not null) when the row exists but has no
 * EEAT provenance yet — agents can use that to distinguish "unknown
 * hotel" from "hotel with no sources yet".
 *
 * Service-role read: bypasses RLS but the SELECT is scoped to public
 * `is_published = true` rows, so no PII leak.
 */
export async function getHotelExternalSourcesBySlug(
  slug: string,
): Promise<HotelExternalSourcesPayload | null> {
  if (!isValidSlug(slug)) return null;

  const supabase = getSupabaseAdminClient();
  // Match on either `slug` or `slug_en` so EN-locale slugs work too
  // (mirrors `getHotelBySlug` lookup behaviour). PostgREST `or=()` is
  // expressed via the JS client's `.or()` helper.
  const { data, error } = await supabase
    .from('hotels')
    .select('slug, slug_en, name, name_en, updated_at, external_sources')
    .or(`slug.eq.${slug},slug_en.eq.${slug}`)
    .eq('is_published', true)
    .limit(1)
    .maybeSingle();

  if (error !== null || data === null) return null;

  const parsed = RowSchema.safeParse(data);
  if (!parsed.success) return null;
  const row = parsed.data;

  return {
    slug: row.slug,
    slugEn: row.slug_en !== null && row.slug_en !== undefined ? row.slug_en : null,
    name: row.name,
    nameEn: row.name_en !== null && row.name_en !== undefined ? row.name_en : null,
    updatedAt: row.updated_at !== null && row.updated_at !== undefined ? row.updated_at : null,
    sources: parseSourcesLenient(row.external_sources),
  };
}
