import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { gateAgentByIp, readClientIp } from '@/server/agent/rate-limit';
import {
  getHotelBySlug,
  readConciergeAdvice,
  readFactualSummary,
  readGeoQa,
  readLocationByBucket,
  readRestaurants,
  readSignatureExperiences,
  type LocalisedPointOfInterest,
} from '@/server/hotels/get-hotel-by-slug';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/hotel/[slug] — full hotel snapshot for LLM agents
 * (C2 / CDC §6.5 — mirror of declarative skill `get-hotel`).
 *
 * Returns a flat JSON envelope an LLM can quote verbatim:
 *   - identity (slug, name, stars, palace, city)
 *   - factual summary (CDC §2.3, IA-ready 130-150 chars)
 *   - concierge advice (« Le Conseil du Concierge », ADR-0011)
 *   - awards (verified only — JSON-LD-grade signal)
 *   - amenities list
 *   - canonical URLs (FR + EN)
 *   - booking mode + Amadeus property id
 *
 * Concierge lens (post-booking recommendation surface, master plan
 * INFRA GEO) — included by default so a WhatsApp/LLM concierge can
 * recommend without a second round-trip:
 *   - `dining`       on-property F&B venues (chef, must-order, tip…)
 *   - `nearby`       POIs bucketed visit / do / eat / shop (capped)
 *   - `experiences`  signature on-property programmes
 *   - `geoQa`        data-driven answer-engine Q&A blocks (AEO)
 *
 * Pass `?lens=off` to drop the concierge lens for a lean identity-only
 * payload. Heavy POI buckets are capped at `NEARBY_CAP` per bucket.
 *
 * Does NOT include the long-form description (multi-KB) by default —
 * the agent should follow `canonicalUrl` for a full render. Query
 * param `?body=long` opts into the full description for agents that
 * need to summarise.
 *
 * Skill: api-integration, geo-llm-optimization, structured-data-schema-org.
 */
const QuerySchema = z.object({
  locale: z.enum(['fr', 'en']).default('fr'),
  body: z.enum(['short', 'long']).default('short'),
  lens: z.enum(['on', 'off']).default('on'),
});

/** Max POIs returned per bucket — keeps the envelope under LLM tool-call limits. */
const NEARBY_CAP = 10;

interface AgentNearbyPoi {
  readonly name: string;
  readonly type: string;
  readonly category: string | null;
  readonly distanceMeters: number;
  readonly walkMinutes: number | null;
  readonly description: string | null;
  readonly website: string | null;
  readonly reservationUrl: string | null;
  readonly address: string | null;
  readonly phone: string | null;
}

const toAgentPoi = (p: LocalisedPointOfInterest): AgentNearbyPoi => ({
  name: p.name,
  type: p.type,
  category: p.category,
  distanceMeters: p.distanceMeters,
  walkMinutes: p.walkMinutes,
  description: p.description,
  website: p.website,
  reservationUrl: p.reservationUrl,
  address: p.address,
  phone: p.phone,
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const ip = readClientIp(req.headers);
  const gate = await gateAgentByIp(ip);
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited', retryAfterSec: gate.retryAfterSec },
      { status: 429, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const url = new URL(req.url);
  const parsedQuery = QuerySchema.safeParse({
    locale: url.searchParams.get('locale') ?? undefined,
    body: url.searchParams.get('body') ?? undefined,
    lens: url.searchParams.get('lens') ?? undefined,
  });
  if (!parsedQuery.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid_query' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const { locale, body: bodyMode, lens } = parsedQuery.data;

  const { slug } = await params;
  if (typeof slug !== 'string' || slug.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'invalid_slug' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const hotel = await getHotelBySlug(slug, locale).catch(() => null);
  if (hotel === null) {
    return NextResponse.json(
      { ok: false, error: 'not_found', slug },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const row = hotel.row;

  const factualSummary = readFactualSummary(row, locale);
  const conciergeAdvice = readConciergeAdvice(row, locale);

  // Description body — short = first 500 chars of description_{locale};
  // long = full description, capped at 4 KB to keep the envelope under
  // any LLM tool-call payload limit.
  const descriptionRaw =
    locale === 'en' ? (row.description_en ?? row.description_fr) : row.description_fr;
  const description =
    descriptionRaw === null
      ? null
      : bodyMode === 'long'
        ? descriptionRaw.slice(0, 4096)
        : descriptionRaw.length > 500
          ? `${descriptionRaw.slice(0, 497)}…`
          : descriptionRaw;

  // ── Concierge lens (post-booking recommendation surface) ────────────
  // Built once, attached only when `lens=on` (the default). Each branch
  // self-elides to `null` / `[]` when the row carries no data, so the
  // envelope shape is stable regardless of editorial completeness.
  const dining = lens === 'on' ? readRestaurants(row, locale) : null;
  const byBucket = lens === 'on' ? readLocationByBucket(row, locale) : null;
  const experiences = lens === 'on' ? readSignatureExperiences(row, locale) : [];
  const geoQa = lens === 'on' ? readGeoQa(row, locale) : [];

  const conciergeLens =
    lens === 'on'
      ? {
          dining:
            dining === null
              ? null
              : {
                  count: dining.count,
                  michelinStars: dining.michelinStars,
                  venues: dining.venues.map((v) => ({
                    name: v.name,
                    type: v.type,
                    michelinStars: v.michelinStars,
                    chef: v.chef,
                    sommelier: v.sommelier,
                    hours: v.hours,
                    priceNote: v.priceNote,
                    mustOrder: v.mustOrder,
                    tip: v.tip,
                    reservationUrl: v.reservationUrl,
                    website: v.website,
                    phone: v.phone,
                    address: v.address,
                    kidFriendly: v.kidFriendly,
                  })),
                },
          nearby:
            byBucket === null
              ? null
              : {
                  visit: byBucket.visit.slice(0, NEARBY_CAP).map(toAgentPoi),
                  do: byBucket.do.slice(0, NEARBY_CAP).map(toAgentPoi),
                  eat: byBucket.eat.slice(0, NEARBY_CAP).map(toAgentPoi),
                  shop: byBucket.shop.slice(0, NEARBY_CAP).map(toAgentPoi),
                  transports: byBucket.transports.map((t) => ({
                    mode: t.mode,
                    line: t.line,
                    station: t.station,
                    distanceMeters: t.distanceMeters,
                    walkMinutes: t.walkMinutes,
                  })),
                },
          experiences: experiences.map((e) => ({
            key: e.key,
            kind: e.kind,
            title: e.title,
            description: e.description,
            badge: e.badge,
            bookingRequired: e.bookingRequired,
            priceNote: e.priceNote,
            tip: e.tip,
            website: e.website,
          })),
          geoQa: geoQa.map((g) => ({
            id: g.id,
            question: g.question,
            paragraphs: g.paragraphs,
          })),
        }
      : null;

  return NextResponse.json(
    {
      ok: true,
      hotel: {
        id: row.id,
        slug: row.slug,
        slugEn: row.slug_en !== null && row.slug_en.length > 0 ? row.slug_en : null,
        name:
          locale === 'en' && row.name_en !== null && row.name_en.length > 0
            ? row.name_en
            : row.name,
        nameFr: row.name,
        stars: row.stars,
        isPalace: row.is_palace,
        city: row.city,
        region: row.region,
        country: row.country_code,
        bookingMode: row.booking_mode,
        amadeusHotelId:
          row.amadeus_hotel_id !== null && row.amadeus_hotel_id.length > 0
            ? row.amadeus_hotel_id
            : null,
        factualSummary: factualSummary?.text ?? null,
        conciergeAdvice:
          conciergeAdvice !== null
            ? {
                title: conciergeAdvice.title,
                body: conciergeAdvice.body,
                tipFor: conciergeAdvice.tipFor,
              }
            : null,
        description,
        canonicalUrl:
          locale === 'en' ? `/en/hotel/${row.slug_en ?? row.slug}` : `/fr/hotel/${row.slug}`,
        updatedAt: row.updated_at,
        ...(conciergeLens !== null ? { conciergeLens } : {}),
      },
    },
    {
      headers: {
        // 5-minute private cache — long enough to short-circuit a
        // multi-turn agent conversation, short enough to surface
        // editorial updates within the SLA.
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
      },
    },
  );
}
