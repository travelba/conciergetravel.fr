import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { getRoomBySlug } from '@/server/hotels/get-room-by-slug';
import { agentJson, gateAgentRequest } from '@/server/agent/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/hotel/[slug]/room/[roomSlug] — room detail for an
 * agent answering "which suite at <hotel>?".
 *
 * Mirror of `get-hotel-room` skill. The room sub-pages
 * `/hotel/[slug]/chambres/[roomSlug]` are indexable per ADR-0009 but
 * the catalogue surface is invisible to LLM crawlers that haven't
 * deep-crawled the hotel detail page. This endpoint makes them
 * discoverable through the agent contract.
 *
 * Returns:
 *   - room identity (slug, name, code, max occupancy, bed type, size)
 *   - short + long descriptions (locale-aware)
 *   - amenities list (already locale-resolved by the reader)
 *   - hero image + photo gallery (Cloudinary public_ids)
 *   - signature flag (suite cited in `/destination/[city]` ItemList)
 *   - indicative price range
 *   - canonical URL
 *
 * Suppresses the `concierge_advice` raw JSON — that's exposed
 * separately via `/api/agent/concierge-tip/[slug]` which is the
 * stable surface for the Conseil du Concierge (ADR-0011).
 */
const QuerySchema = z.object({
  locale: z.enum(['fr', 'en']).default('fr'),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; roomSlug: string }> },
): Promise<NextResponse> {
  const gate = await gateAgentRequest(req);
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const parsedQuery = QuerySchema.safeParse({
    locale: url.searchParams.get('locale') ?? undefined,
  });
  if (!parsedQuery.success) {
    return agentJson(
      { ok: false, error: 'invalid_query' },
      { status: 400, cacheControl: 'no-store' },
    );
  }
  const { locale } = parsedQuery.data;

  const { slug: hotelSlug, roomSlug } = await params;
  if (
    typeof hotelSlug !== 'string' ||
    hotelSlug.length === 0 ||
    typeof roomSlug !== 'string' ||
    roomSlug.length === 0
  ) {
    return agentJson(
      { ok: false, error: 'invalid_slug' },
      { status: 400, cacheControl: 'no-store' },
    );
  }

  const detail = await getRoomBySlug(hotelSlug, roomSlug, locale).catch(() => null);
  if (detail === null) {
    return agentJson(
      { ok: false, error: 'not_found', hotelSlug, roomSlug },
      { status: 404, cacheControl: 'no-store' },
    );
  }

  const { room, hotel } = detail;
  const hotelRow = hotel.row;
  const canonicalHotelSlug =
    locale === 'en' && hotelRow.slug_en !== null && hotelRow.slug_en.length > 0
      ? hotelRow.slug_en
      : hotelRow.slug;

  return agentJson(
    {
      ok: true,
      hotel: {
        slug: hotelRow.slug,
        name: hotelRow.name,
        city: hotelRow.city,
      },
      room: {
        slug: room.slug,
        code: room.roomCode,
        name: room.name,
        shortDescription: room.shortDescription,
        longDescription: room.longDescription,
        maxOccupancy: room.maxOccupancy,
        bedType: room.bedType,
        sizeSqm: room.sizeSqm,
        amenities: room.amenities,
        isSignature: room.isSignature,
        heroImage: room.heroImage,
        imageCount: room.images.length,
        indicativePrice: room.indicativePrice,
        canonicalUrl:
          locale === 'en'
            ? `/en/hotel/${canonicalHotelSlug}/chambres/${room.slug}`
            : `/fr/hotel/${canonicalHotelSlug}/chambres/${room.slug}`,
      },
    },
    { cacheControl: 'private, max-age=1800, stale-while-revalidate=3600' },
  );
}
