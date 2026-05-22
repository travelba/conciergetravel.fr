import 'server-only';

import { z } from 'zod';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Itinerary detail reader (CDC §2.1, migration 0045).
 *
 * Reads a single published itinerary row by FR slug and parses every
 * jsonb / array field through Zod so downstream consumers never see a
 * malformed payload. Modelled after
 * `apps/web/src/server/rankings/get-ranking-by-slug.ts` to keep the
 * editorial reader pattern uniform.
 *
 * Caching is left to the page-level `revalidate = 3600` ISR window
 * (rule itinerary-page.mdc §6) — wrapping in `unstable_cache` here
 * would only add a layer with no observable benefit on a single-row
 * read keyed by a unique slug, AND would re-introduce the `Map`/`Set`
 * JSON-serialisation foot-gun the rule explicitly warns against.
 *
 * Skill: itinerary-editorial-pipeline, supabase-postgres-rls.
 */

// ============================================================================
// Zod schemas — every jsonb column is parsed through one of these.
// ============================================================================

/**
 * `sections[]` — HowTo step structure.
 *
 * Loose by design at the read boundary: missing `body_en`, `hotel_id`
 * or `poi[]` fall back to defaults so a draft missing one field never
 * crashes the page. The audit script `audit-itineraries.mjs` (Sprint
 * 4) is the source of truth for hard editorial limits (≥150 words,
 * ≥1 POI per step). See migration 0045 column comment for the canonical
 * shape.
 */
export const ItinerarySectionSchema = z.object({
  step: z.number().int().positive(),
  title_fr: z.string(),
  title_en: z.string().optional().default(''),
  body_fr: z.string(),
  body_en: z.string().optional().default(''),
  hotel_id: z.string().uuid().nullish(),
  duration_days: z.number().int().positive().optional(),
  city: z.string().optional().default(''),
  poi: z.array(z.string()).default([]),
});
export type ItinerarySection = z.infer<typeof ItinerarySectionSchema>;

/**
 * `faq_content[]` — `FAQPage` JSON-LD source.
 *
 * Anchor is optional so editors can introduce them progressively
 * (the FAQ component derives a slugified anchor from the question
 * when missing).
 */
export const ItineraryFaqEntrySchema = z.object({
  q_fr: z.string(),
  a_fr: z.string(),
  q_en: z.string().optional().default(''),
  a_en: z.string().optional().default(''),
  anchor: z.string().nullish(),
});
export type ItineraryFaqEntry = z.infer<typeof ItineraryFaqEntrySchema>;

/**
 * `gallery_images[]` — same shape as `editorial_guides.gallery_images`.
 * Kept loose: editors may stage entries with missing alts.
 */
export const ItineraryGalleryImageSchema = z.object({
  cloudinary_id: z.string(),
  alt_fr: z.string().optional().default(''),
  alt_en: z.string().optional().default(''),
  caption_fr: z.string().optional().default(''),
  caption_en: z.string().optional().default(''),
});
export type ItineraryGalleryImage = z.infer<typeof ItineraryGalleryImageSchema>;

/**
 * Full itinerary row schema. Mirrors the DDL in migration 0045 column-
 * for-column. Every nullable text column is `.nullable()` (not
 * `.optional()`) because Supabase always returns the key, possibly
 * with a `null` value.
 */
export const ItineraryRowSchema = z.object({
  id: z.string().uuid(),
  slug_fr: z.string(),
  slug_en: z.string().nullable(),
  title_fr: z.string(),
  title_en: z.string().nullable(),
  meta_title_fr: z.string().nullable(),
  meta_title_en: z.string().nullable(),
  meta_desc_fr: z.string().nullable(),
  meta_desc_en: z.string().nullable(),
  intro_fr: z.string().nullable(),
  intro_en: z.string().nullable(),
  aeo_question_fr: z.string().nullable(),
  aeo_answer_fr: z.string().nullable(),
  aeo_question_en: z.string().nullable(),
  aeo_answer_en: z.string().nullable(),
  country_code: z.string().regex(/^[A-Z]{2}$/u),
  destination_region: z.string().nullable(),
  destination_city: z.string().nullable(),
  themes: z.array(z.string()).default([]),
  duration_min_days: z.number().int().positive(),
  duration_max_days: z.number().int().positive().nullable(),
  travel_style: z.enum([
    'luxe',
    'famille',
    'couple',
    'solo',
    'aventure',
    'bien-etre',
    'gastronomie',
    'culture',
    'affaires',
  ]),
  season: z.enum(['printemps', 'ete', 'automne', 'hiver', 'toute-saison']).nullable(),
  hotel_ids: z.array(z.string().uuid()).default([]),
  // jsonb columns are nullable in the DDL — Supabase returns `null` (not
  // `undefined`) when an editor hasn't filled them, so we preprocess to
  // an empty array before the array parser runs. Without this preprocess
  // step the reader fails its safeParse and the page silently 404s.
  sections: z.preprocess((v) => v ?? [], z.array(ItinerarySectionSchema)),
  faq_content: z.preprocess((v) => v ?? [], z.array(ItineraryFaqEntrySchema)),
  related_ranking_ids: z.array(z.string().uuid()).default([]),
  related_guide_slugs: z.array(z.string()).default([]),
  related_itinerary_slugs: z.array(z.string()).default([]),
  hero_cloudinary_id: z.string().nullable(),
  hero_alt_fr: z.string().nullable(),
  hero_alt_en: z.string().nullable(),
  gallery_images: z.preprocess((v) => v ?? [], z.array(ItineraryGalleryImageSchema)),
  author_id: z.string().uuid().nullable(),
  last_updated: z.string(),
  status: z.enum(['draft', 'published']),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']),
  word_count_target: z.number().int().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ItineraryRow = z.infer<typeof ItineraryRowSchema>;

// ============================================================================
// Column projection — single source of truth for both readers.
// ============================================================================

const ITINERARY_COLUMNS =
  'id, slug_fr, slug_en, title_fr, title_en, meta_title_fr, meta_title_en, ' +
  'meta_desc_fr, meta_desc_en, intro_fr, intro_en, ' +
  'aeo_question_fr, aeo_answer_fr, aeo_question_en, aeo_answer_en, ' +
  'country_code, destination_region, destination_city, themes, ' +
  'duration_min_days, duration_max_days, travel_style, season, ' +
  'hotel_ids, sections, faq_content, ' +
  'related_ranking_ids, related_guide_slugs, related_itinerary_slugs, ' +
  'hero_cloudinary_id, hero_alt_fr, hero_alt_en, gallery_images, ' +
  'author_id, last_updated, status, priority, word_count_target, ' +
  'created_at, updated_at';

/**
 * Pre-computed Zod schema for the projected column set above. Frozen
 * here so the (defensive) parse on each read doesn't allocate a new
 * schema instance per call.
 */
const ItineraryRowProjectedSchema = ItineraryRowSchema;

// ============================================================================
// Reader.
// ============================================================================

export async function getItineraryBySlug(slug: string): Promise<ItineraryRow | null> {
  if (typeof slug !== 'string' || slug.length === 0) return null;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('itineraries')
    .select(ITINERARY_COLUMNS)
    .eq('slug_fr', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (error !== null || data === null) {
    if (error !== null) {
      console.error('[itineraries.get-by-slug] supabase error', {
        slug,
        message: error.message,
        code: error.code,
      });
    }
    return null;
  }

  const parsed = ItineraryRowProjectedSchema.safeParse(data);
  if (!parsed.success) {
    console.error('[itineraries.get-by-slug] schema validation failed', {
      slug,
      issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).slice(0, 5),
    });
    return null;
  }
  return parsed.data;
}
