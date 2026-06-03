import { listItineraries } from '@/server/itineraries/list-itineraries';
import { feedOrigin, jsonlResponse } from '@/server/agent/jsonl-feed';

/**
 * /.well-known/itineraries.jsonl — machine-readable catalogue of
 * published itineraries, one JSON object per line. Companion to
 * `hotels.jsonl` / `rankings.jsonl` / `guides.jsonl`.
 *
 * Per-row schema (stable contract — extend additively only):
 *   id, slug_fr, slug_en, title_fr, title_en, summary_fr, summary_en,
 *   country_code, destination_region, destination_city, themes,
 *   duration_min_days, duration_max_days, travel_style, season,
 *   hotel_count, hero_image, url, url_en, last_updated
 *
 * `limit: 100` mirrors the reader's hard cap; the published slate is a
 * small, slow-growing editorial set (well under 100), so this returns
 * the complete catalogue.
 *
 * Skill: geo-llm-optimization §Machine-readable surfaces.
 */
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const origin = feedOrigin();
  const itineraries = await listItineraries({ limit: 100 }).catch(() => []);

  const lines = itineraries.map((it) =>
    JSON.stringify({
      id: it.id,
      slug_fr: it.slugFr,
      slug_en: it.slugEn,
      title_fr: it.titleFr,
      title_en: it.titleEn,
      summary_fr: it.metaDescFr,
      summary_en: it.metaDescEn,
      country_code: it.countryCode,
      destination_region: it.destinationRegion,
      destination_city: it.destinationCity,
      themes: it.themes,
      duration_min_days: it.durationMinDays,
      duration_max_days: it.durationMaxDays,
      travel_style: it.travelStyle,
      season: it.season,
      hotel_count: it.hotelCount,
      hero_image: it.heroCloudinaryId,
      url: `${origin}/fr/itineraire/${it.slugFr}`,
      url_en: `${origin}/en/itineraire/${it.slugEn ?? it.slugFr}`,
      last_updated: it.lastUpdated,
    }),
  );

  return jsonlResponse(lines);
}
