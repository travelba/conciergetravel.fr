import { type NextRequest } from 'next/server';

import { listPublishedHotelsForIndex } from '@/server/hotels/get-hotel-by-slug';
import { detectBrand, KNOWN_BRANDS } from '@/server/hotels/get-related-hotels';
import { agentJson, gateAgentRequest } from '@/server/agent/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/brands — hotel groups represented in the catalogue.
 *
 * Mirror of `list-brands` skill. Combines the static `KNOWN_BRANDS`
 * declaration (the 13 groups our brand detector recognises) with a
 * per-brand live count from `listPublishedHotelsForIndex` so the
 * agent knows which brands have actually shipped hotels and which
 * are still empty (helpful to avoid recommending an empty page).
 *
 * Cache: 1 h public + 24 h CDN. Brand catalogue grows slowly —
 * shorter than the static taxonomy endpoints because new hotels
 * change the per-brand `hotelCount` more frequently than the
 * brand list itself.
 */
export async function GET(req: NextRequest) {
  const gate = await gateAgentRequest(req);
  if (!gate.ok) return gate.response;

  const hotels = await listPublishedHotelsForIndex().catch(() => []);
  const counts = new Map<string, number>();
  for (const h of hotels) {
    const brand = detectBrand(h.nameFr);
    if (brand !== null) counts.set(brand.slug, (counts.get(brand.slug) ?? 0) + 1);
  }

  return agentJson(
    {
      ok: true,
      count: KNOWN_BRANDS.length,
      brands: KNOWN_BRANDS.map((b) => ({
        slug: b.slug,
        label: b.label,
        hotelCount: counts.get(b.slug) ?? 0,
        canonicalUrl: {
          fr: `/fr/marque/${b.slug}`,
          en: `/en/marque/${b.slug}`,
        },
      })),
    },
    { cacheControl: 'public, max-age=3600, s-maxage=86400' },
  );
}
