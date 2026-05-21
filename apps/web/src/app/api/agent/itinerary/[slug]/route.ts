import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { agentJson, gateAgentRequest } from '@/server/agent/respond';
import { getItineraryBySlug } from '@/server/itineraries/get-itinerary-by-slug';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/itinerary/[slug] — full itinerary payload for an agent.
 *
 * Mirror of `get-itinerary` skill (CDC §6.1, ADR-0017). Returns the
 * editorial structure an LLM needs to quote an itinerary faithfully:
 *
 *   - identity (slug, title, country, themes, travel_style, season)
 *   - meta (title + description for OG / quotes)
 *   - intro narrative
 *   - day-by-day steps (HowTo source) with hotel + POI hints
 *   - canonical FAQ Q&A pairs
 *   - related guide / itinerary / ranking slugs (cross-linking)
 *   - hero image identity (Cloudinary id + alt text)
 *   - lastUpdated + updatedAt for freshness signalling
 *
 * Cache: 30-min private + SWR 1 h — itineraries change at most a few
 * times per month once published, so a short private cache keeps
 * multi-turn agent loops cheap without serving stale narrative for long.
 */
const QuerySchema = z.object({
  locale: z.enum(['fr', 'en']).default('fr'),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const gate = await gateAgentRequest(req);
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    locale: url.searchParams.get('locale') ?? undefined,
  });
  if (!parsed.success) {
    return agentJson(
      { ok: false, error: 'invalid_query' },
      { status: 400, cacheControl: 'no-store' },
    );
  }
  const { locale } = parsed.data;

  const { slug } = await params;
  if (typeof slug !== 'string' || slug.length === 0) {
    return agentJson(
      { ok: false, error: 'invalid_slug' },
      { status: 400, cacheControl: 'no-store' },
    );
  }

  const row = await getItineraryBySlug(slug).catch(() => null);
  if (row === null) {
    return agentJson(
      { ok: false, error: 'not_found', slug },
      { status: 404, cacheControl: 'no-store' },
    );
  }

  const pick = <T>(fr: T, en: T): T => (locale === 'en' ? en : fr);
  const pickNullable = <T>(fr: T, en: T | null): T => (locale === 'en' && en !== null ? en : fr);

  const canonicalSlug =
    locale === 'en' && row.slug_en !== null && row.slug_en.length > 0 ? row.slug_en : row.slug_fr;

  return agentJson(
    {
      ok: true,
      itinerary: {
        slug: row.slug_fr,
        title: pickNullable(row.title_fr, row.title_en),
        metaTitle: pickNullable(row.meta_title_fr, row.meta_title_en),
        metaDescription: pickNullable(row.meta_desc_fr, row.meta_desc_en),
        countryCode: row.country_code,
        destinationRegion: row.destination_region,
        destinationCity: row.destination_city,
        themes: row.themes,
        travelStyle: row.travel_style,
        season: row.season,
        durationMinDays: row.duration_min_days,
        durationMaxDays: row.duration_max_days,
        intro: pickNullable(row.intro_fr, row.intro_en),
        aeo:
          row.aeo_question_fr !== null && row.aeo_answer_fr !== null
            ? {
                question: pickNullable(row.aeo_question_fr, row.aeo_question_en),
                answer: pickNullable(row.aeo_answer_fr, row.aeo_answer_en),
              }
            : null,
        steps: row.sections.map((s) => ({
          step: s.step,
          title: pick(s.title_fr, s.title_en),
          body: pick(s.body_fr, s.body_en),
          city: s.city,
          poi: s.poi,
          hotelId: s.hotel_id ?? null,
          durationDays: s.duration_days ?? null,
        })),
        hotelIds: row.hotel_ids,
        faq: row.faq_content.map((f) => ({
          question: pick(f.q_fr, f.q_en),
          answer: pick(f.a_fr, f.a_en),
        })),
        related: {
          itinerarySlugs: row.related_itinerary_slugs,
          guideSlugs: row.related_guide_slugs,
          rankingIds: row.related_ranking_ids,
        },
        hero:
          row.hero_cloudinary_id !== null
            ? {
                cloudinaryId: row.hero_cloudinary_id,
                alt: pickNullable(row.hero_alt_fr, row.hero_alt_en),
              }
            : null,
        priority: row.priority,
        lastUpdated: row.last_updated,
        updatedAt: row.updated_at,
        canonicalUrl:
          locale === 'en' ? `/en/itineraire/${canonicalSlug}` : `/fr/itineraire/${canonicalSlug}`,
      },
    },
    { cacheControl: 'private, max-age=1800, stale-while-revalidate=3600' },
  );
}
