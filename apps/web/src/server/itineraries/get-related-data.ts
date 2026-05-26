import 'server-only';

import { z } from 'zod';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Batch lookups for the itinerary detail page.
 *
 * The detail page needs four related-entity reads at once:
 *
 *   - Hotels referenced from `sections[].hotel_id` and `hotel_ids[]`
 *     (lookup by UUID).
 *   - Rankings referenced from `related_ranking_ids[]` (lookup by UUID).
 *   - Editorial guides referenced from `related_guide_slugs[]` (lookup
 *     by slug).
 *   - Sibling itineraries referenced from `related_itinerary_slugs[]`
 *     (lookup by FR slug).
 *
 * Each helper returns the **minimum projection** the page renders
 * (slug + name + a couple of ancillary fields) and stays parser-strict
 * via Zod so a malformed jsonb cell never crashes the page. They are
 * all `published`-aware (via the data layer's existing RLS policy on
 * each source table) so an unpublished related entity never leaks.
 *
 * Skill: itinerary-editorial-pipeline §Maillage interne.
 * Rule: itinerary-page.mdc §5.1.
 */

// ---------------------------------------------------------------------------
// Hotels — lookup by UUID, project to slug + locale-aware name + city
// ---------------------------------------------------------------------------

export interface HotelLookup {
  readonly id: string;
  readonly slug: string;
  readonly slugEn: string | null;
  readonly nameFr: string;
  readonly nameEn: string | null;
  readonly city: string | null;
  readonly stars: number | null;
  readonly isPalace: boolean;
  /**
   * Hotel hero image — either a fully-qualified URL (Wikimedia, vendor
   * site, …) or a Cloudinary public_id (`cct/hotels/<slug>/…`). The
   * itinerary page falls back to this when the row has no
   * `hero_cloudinary_id` of its own (skill `photo-pipeline` §fallback).
   */
  readonly heroImage: string | null;
}

const HotelLookupRowSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  slug_en: z.string().nullable(),
  name: z.string(),
  name_en: z.string().nullable(),
  city: z.string().nullable(),
  stars: z.number().int().nullable(),
  is_palace: z.boolean(),
  hero_image: z.string().nullable(),
});

export async function getHotelsByIds(ids: readonly string[]): Promise<readonly HotelLookup[]> {
  if (ids.length === 0) return [];
  const unique = Array.from(new Set(ids));

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('hotels')
      .select('id, slug, slug_en, name, name_en, city, stars, is_palace, hero_image')
      .in('id', unique)
      .eq('is_published', true);

    if (error !== null || !Array.isArray(data)) {
      if (error !== null) {
        console.error('[itineraries.related] hotels lookup failed', {
          message: error.message,
          code: error.code,
        });
      }
      return [];
    }

    const out: HotelLookup[] = [];
    for (const raw of data) {
      const parsed = HotelLookupRowSchema.safeParse(raw);
      if (!parsed.success) continue;
      out.push({
        id: parsed.data.id,
        slug: parsed.data.slug,
        slugEn: parsed.data.slug_en,
        nameFr: parsed.data.name,
        nameEn: parsed.data.name_en,
        city: parsed.data.city,
        stars: parsed.data.stars,
        isPalace: parsed.data.is_palace,
        heroImage: parsed.data.hero_image,
      });
    }
    return out;
  } catch (e) {
    console.error(
      '[itineraries.related] getHotelsByIds threw:',
      e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    );
    return [];
  }
}

// ---------------------------------------------------------------------------
// Rankings — lookup by UUID
// ---------------------------------------------------------------------------

export interface RankingLookup {
  readonly id: string;
  readonly slug: string;
  readonly titleFr: string;
  readonly titleEn: string | null;
  readonly factualSummaryFr: string | null;
  readonly factualSummaryEn: string | null;
}

const RankingLookupRowSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title_fr: z.string(),
  title_en: z.string().nullable(),
  factual_summary_fr: z.string().nullable(),
  factual_summary_en: z.string().nullable(),
});

export async function getRankingsByIds(ids: readonly string[]): Promise<readonly RankingLookup[]> {
  if (ids.length === 0) return [];
  const unique = Array.from(new Set(ids));

  try {
    const supabase = getSupabaseAdminClient();
    // Bug fix (2026-05-26): the source table is `editorial_rankings`
    // (the `rankings` symbol below is the editorial CMS naming used
    // since migration 0029) and the publish flag is `is_published`,
    // not a `status` text column. The previous shape returned `[]`
    // silently on every call so the `<RelatedRankings>` block on
    // itinerary pages was always blank.
    const { data, error } = await supabase
      .from('editorial_rankings')
      .select('id, slug, title_fr, title_en, factual_summary_fr, factual_summary_en')
      .in('id', unique)
      .eq('is_published', true);

    if (error !== null || !Array.isArray(data)) {
      if (error !== null) {
        console.error('[itineraries.related] rankings lookup failed', {
          message: error.message,
          code: error.code,
        });
      }
      return [];
    }

    const out: RankingLookup[] = [];
    for (const raw of data) {
      const parsed = RankingLookupRowSchema.safeParse(raw);
      if (!parsed.success) continue;
      out.push({
        id: parsed.data.id,
        slug: parsed.data.slug,
        titleFr: parsed.data.title_fr,
        titleEn: parsed.data.title_en,
        factualSummaryFr: parsed.data.factual_summary_fr,
        factualSummaryEn: parsed.data.factual_summary_en,
      });
    }
    return out;
  } catch (e) {
    console.error(
      '[itineraries.related] getRankingsByIds threw:',
      e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    );
    return [];
  }
}

// ---------------------------------------------------------------------------
// Editorial guides — lookup by slug (text)
// ---------------------------------------------------------------------------

export interface GuideLookup {
  readonly slug: string;
  readonly nameFr: string;
  readonly nameEn: string | null;
  readonly summaryFr: string | null;
  readonly summaryEn: string | null;
}

const GuideLookupRowSchema = z.object({
  slug: z.string(),
  name_fr: z.string(),
  name_en: z.string().nullable(),
  summary_fr: z.string().nullable(),
  summary_en: z.string().nullable(),
});

export async function getGuidesBySlugs(slugs: readonly string[]): Promise<readonly GuideLookup[]> {
  if (slugs.length === 0) return [];
  const unique = Array.from(new Set(slugs));

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('editorial_guides')
      .select('slug, name_fr, name_en, summary_fr, summary_en')
      .in('slug', unique)
      .eq('is_published', true);

    if (error !== null || !Array.isArray(data)) {
      if (error !== null) {
        console.error('[itineraries.related] guides lookup failed', {
          message: error.message,
          code: error.code,
        });
      }
      return [];
    }

    const out: GuideLookup[] = [];
    for (const raw of data) {
      const parsed = GuideLookupRowSchema.safeParse(raw);
      if (!parsed.success) continue;
      out.push({
        slug: parsed.data.slug,
        nameFr: parsed.data.name_fr,
        nameEn: parsed.data.name_en,
        summaryFr: parsed.data.summary_fr,
        summaryEn: parsed.data.summary_en,
      });
    }
    return out;
  } catch (e) {
    console.error(
      '[itineraries.related] getGuidesBySlugs threw:',
      e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    );
    return [];
  }
}

// ---------------------------------------------------------------------------
// Sibling itineraries — lookup by FR slug (mini card)
// ---------------------------------------------------------------------------

export interface ItineraryMiniCard {
  readonly slugFr: string;
  readonly titleFr: string;
  readonly titleEn: string | null;
  readonly destinationCity: string | null;
  readonly destinationRegion: string | null;
  readonly countryCode: string;
  readonly durationMinDays: number;
  readonly durationMaxDays: number | null;
  readonly heroCloudinaryId: string | null;
}

const MiniCardRowSchema = z.object({
  slug_fr: z.string(),
  title_fr: z.string(),
  title_en: z.string().nullable(),
  destination_city: z.string().nullable(),
  destination_region: z.string().nullable(),
  country_code: z.string(),
  duration_min_days: z.number().int().positive(),
  duration_max_days: z.number().int().positive().nullable(),
  hero_cloudinary_id: z.string().nullable(),
});

export async function getItinerariesBySlugs(
  slugs: readonly string[],
): Promise<readonly ItineraryMiniCard[]> {
  if (slugs.length === 0) return [];
  const unique = Array.from(new Set(slugs));

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('itineraries')
      .select(
        'slug_fr, title_fr, title_en, destination_city, destination_region, country_code, duration_min_days, duration_max_days, hero_cloudinary_id',
      )
      .in('slug_fr', unique)
      .eq('status', 'published');

    if (error !== null || !Array.isArray(data)) {
      if (error !== null) {
        console.error('[itineraries.related] itineraries lookup failed', {
          message: error.message,
          code: error.code,
        });
      }
      return [];
    }

    const out: ItineraryMiniCard[] = [];
    for (const raw of data) {
      const parsed = MiniCardRowSchema.safeParse(raw);
      if (!parsed.success) continue;
      out.push({
        slugFr: parsed.data.slug_fr,
        titleFr: parsed.data.title_fr,
        titleEn: parsed.data.title_en,
        destinationCity: parsed.data.destination_city,
        destinationRegion: parsed.data.destination_region,
        countryCode: parsed.data.country_code,
        durationMinDays: parsed.data.duration_min_days,
        durationMaxDays: parsed.data.duration_max_days,
        heroCloudinaryId: parsed.data.hero_cloudinary_id,
      });
    }
    return out;
  } catch (e) {
    console.error(
      '[itineraries.related] getItinerariesBySlugs threw:',
      e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    );
    return [];
  }
}
