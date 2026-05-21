import { type NextRequest } from 'next/server';

import { listPublishedCities } from '@/server/destinations/cities';
import { agentJson, gateAgentRequest } from '@/server/agent/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/cities — published destination cities (FR catalogue).
 *
 * Mirror of the declarative `list-cities` skill in
 * `DEFAULT_AGENT_SKILLS`. Pure read of the published cities surfaced
 * by `/destination` directory: every entry has a canonical hub
 * (`/<locale>/destination/<slug>`) and is safe to surface even with
 * an empty hotel grid (the destination page renders an editorial
 * teaser regardless).
 *
 * Note: international destinations are not (yet) modelled as
 * dedicated city entities — they ship as country guides via
 * `editorial_guides scope='country'`. A follow-up endpoint
 * `/api/agent/countries` will expose them once the
 * `/destination-internationale/[country]` route lands (Vague 3).
 */
export async function GET(req: NextRequest) {
  const gate = await gateAgentRequest(req);
  if (!gate.ok) return gate.response;

  const cities = await listPublishedCities().catch(() => []);
  return agentJson(
    {
      ok: true,
      count: cities.length,
      cities: cities.map((c) => ({
        slug: c.slug,
        name: c.name,
        region: c.region,
        hotelCount: c.count,
        hasPalace: c.hasPalace,
        canonicalUrl: {
          fr: `/fr/destination/${c.slug}`,
          en: `/en/destination/${c.slug}`,
        },
      })),
    },
    { cacheControl: 'public, max-age=900, s-maxage=86400' },
  );
}
