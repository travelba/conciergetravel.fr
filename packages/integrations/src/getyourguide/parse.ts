import { z } from 'zod';

import { buildGygDeeplink } from './deeplink';
import { GygRawTourSchema, GygSearchResponseSchema } from './types';
import type { GygRawTour, GygSearchResponse, ParsedGygTour } from './types';

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function readTourId(raw: GygRawTour): string | null {
  if (typeof raw.tour_id === 'string' && raw.tour_id.length > 0) return raw.tour_id;
  if (typeof raw.tour_id === 'number') return String(raw.tour_id);
  if (typeof raw.id === 'string' && raw.id.length > 0) return raw.id;
  if (typeof raw.id === 'number') return String(raw.id);
  return null;
}

function readPriceMinor(raw: GygRawTour): number | null {
  const major = asNumber(raw.price?.values?.amount) ?? asNumber(raw.price?.amount);
  if (major === null) return null;
  return Math.round(major * 100);
}

function readImageUrl(raw: GygRawTour): string | null {
  const first = raw.photos?.[0]?.url ?? raw.pictures?.[0]?.url;
  return typeof first === 'string' && first.length > 0 ? first : null;
}

const GygDataEnvelopeSchema = z.object({
  data: z.object({ tours: z.array(GygRawTourSchema) }),
});

const GygToursEnvelopeSchema = z.object({
  tours: z.array(GygRawTourSchema),
});

function unwrapTours(response: GygSearchResponse): readonly GygRawTour[] {
  const parsed = GygSearchResponseSchema.safeParse(response);
  if (!parsed.success) return [];
  const body = parsed.data;
  if (Array.isArray(body)) return body;

  const dataEnvelope = GygDataEnvelopeSchema.safeParse(body);
  if (dataEnvelope.success) return dataEnvelope.data.data.tours;

  const toursEnvelope = GygToursEnvelopeSchema.safeParse(body);
  if (toursEnvelope.success) return toursEnvelope.data.tours;

  return [];
}

/**
 * Normalise a parsed Partner API response into {@link ParsedGygTour}[].
 * Drops entries without a tour id or title (the two fields we must
 * render). Builds the affiliate deeplink with the partner id.
 */
export function parseGygSearchResponse(
  response: GygSearchResponse,
  partnerId: string,
): readonly ParsedGygTour[] {
  const out: ParsedGygTour[] = [];
  for (const raw of unwrapTours(response)) {
    const tourId = readTourId(raw);
    if (tourId === null) continue;
    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    if (title.length === 0) continue;

    out.push({
      tourId,
      title,
      abstract: typeof raw.abstract === 'string' && raw.abstract.length > 0 ? raw.abstract : null,
      priceFromMinor: readPriceMinor(raw),
      currency:
        typeof raw.price?.currency === 'string'
          ? raw.price.currency
          : typeof raw.currency === 'string'
            ? raw.currency
            : null,
      rating: asNumber(raw.reviews?.rating),
      reviewCount: asNumber(raw.reviews?.rating_count) ?? asNumber(raw.reviews?.number_of_ratings),
      imageUrl: readImageUrl(raw),
      deeplinkUrl: buildGygDeeplink({
        partnerId,
        tourId,
        canonicalUrl: typeof raw.url === 'string' ? raw.url : null,
      }),
    });
  }
  return out;
}
