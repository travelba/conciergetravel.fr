import 'server-only';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { isHotelIndexable } from '@/server/hotels/indexability';

/**
 * Slim hotel summary tuned for `/llms-full.txt`.
 *
 * Returns exactly the fields the LLM dump needs (factual summary +
 * city + booking mode), nothing more. Keeps the row small so the
 * `force-static` route stays cheap to revalidate (5 KB per hotel ×
 * 500 rows ≈ 2.5 MB upper-bound; well under the per-route Vercel
 * limit).
 *
 * Indexability mirror — uses the shared `isHotelIndexable` predicate
 * so stub hotels (catalog-only sheets seeded for the rankings
 * combinator) never leak into the LLM corpus. Phase 1 (May 2026)
 * relaxes the photo requirement; see `indexability.ts`.
 *
 * Skill: geo-llm-optimization, content-modeling.
 */
export interface LlmIndexableHotel {
  readonly slug: string;
  readonly slugEn: string | null;
  readonly nameFr: string;
  readonly nameEn: string | null;
  readonly city: string;
  readonly stars: number;
  readonly isPalace: boolean;
  readonly factualSummaryFr: string | null;
  readonly factualSummaryEn: string | null;
  readonly descriptionFr: string | null;
  readonly descriptionEn: string | null;
  readonly bookingMode: 'amadeus' | 'little' | 'email' | 'display_only';
  readonly updatedAt: string | null;
}

const SELECT_COLUMNS =
  'slug, slug_en, name, name_en, city, stars, is_palace, factual_summary_fr, factual_summary_en, description_fr, description_en, booking_mode, updated_at, hero_image, gallery_images, long_description_sections, concierge_advice, faq_content';

function stringOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function isBookingMode(v: unknown): v is LlmIndexableHotel['bookingMode'] {
  return v === 'amadeus' || v === 'little' || v === 'email' || v === 'display_only';
}

/**
 * Returns every published, indexable hotel with the LLM-friendly
 * fields populated. Caller sorts / shapes; this helper applies the
 * indexability gate only.
 *
 * Hard caps the result at 500 rows — past that we'd exceed the
 * Vercel route output limit and start serving truncated LLM corpora.
 * A future paginated `/llms-full-2.txt` is the right escape hatch.
 */
export async function listIndexableHotelsForLlms(): Promise<readonly LlmIndexableHotel[]> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('hotels')
      .select(SELECT_COLUMNS)
      .eq('is_published', true)
      .order('priority', { ascending: true })
      .limit(500);
    if (error || !Array.isArray(data)) return [];

    const out: LlmIndexableHotel[] = [];
    for (const raw of data) {
      const r = raw as Record<string, unknown>;
      const slug = stringOrNull(r['slug']);
      if (slug === null) continue;

      // Single source of truth — `apps/web/src/server/hotels/indexability.ts`.
      if (!isHotelIndexable(r)) continue;

      const bookingMode = r['booking_mode'];
      if (!isBookingMode(bookingMode)) continue;

      const nameFr = stringOrNull(r['name']);
      const city = stringOrNull(r['city']);
      const stars = typeof r['stars'] === 'number' ? r['stars'] : null;
      if (nameFr === null || city === null || stars === null) continue;

      out.push({
        slug,
        slugEn: stringOrNull(r['slug_en']),
        nameFr,
        nameEn: stringOrNull(r['name_en']),
        city,
        stars,
        isPalace: r['is_palace'] === true,
        factualSummaryFr: stringOrNull(r['factual_summary_fr']),
        factualSummaryEn: stringOrNull(r['factual_summary_en']),
        descriptionFr: stringOrNull(r['description_fr']),
        descriptionEn: stringOrNull(r['description_en']),
        bookingMode,
        updatedAt: stringOrNull(r['updated_at']),
      });
    }
    return out;
  } catch {
    // Supabase env missing (CI smoke, preview cold boot) → empty
    // corpus rather than 500. The route still serves the static
    // editorial preamble.
    return [];
  }
}
