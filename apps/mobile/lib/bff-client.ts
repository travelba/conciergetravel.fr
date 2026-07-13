import { z } from 'zod';

const DEFAULT_BFF_BASE = process.env['EXPO_PUBLIC_BFF_BASE_URL'] ?? 'http://localhost:3001';

/** Mobile BFF hotel snapshot — subset of web-v2 read-model. */
export const MobileHotelSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  stars: z.number().int().min(1).max(5),
  city: z.string().min(1),
  country: z.string().min(1),
  district: z.string().optional(),
  distanceLabel: z.string().optional(),
  ratingScoreOutOfTen: z.number().min(0).max(10),
  reviewCount: z.number().int().nonnegative(),
  editorialBadge: z.string().optional(),
  highlights: z.array(z.string()),
  heroImage: z.string().url(),
  description: z.string(),
  conciergeAdvice: z.string(),
  publicPriceMinor: z.number().int().nonnegative(),
  memberPriceMinor: z.number().int().nonnegative().optional(),
  rooms: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        maxOccupants: z.number().int().positive(),
        sizeSqm: z.number().positive(),
        bedDescription: z.string(),
        conditionsLabel: z.string(),
        publicPriceMinor: z.number().int().nonnegative(),
      }),
    )
    .optional(),
});

export type MobileHotel = z.infer<typeof MobileHotelSchema>;

export const MobileSearchResultSchema = z.object({
  query: z.string(),
  total: z.number().int().nonnegative(),
  hotels: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      city: z.string(),
      country: z.string(),
      stars: z.number().int(),
      ratingScoreOutOfTen: z.number(),
      reviewCount: z.number().int(),
      heroImage: z.string().url(),
      publicPriceMinor: z.number().int(),
      editorialBadge: z.string().optional(),
      distanceLabel: z.string().optional(),
    }),
  ),
});

export type MobileSearchResult = z.infer<typeof MobileSearchResultSchema>;

export type BffError =
  | { readonly kind: 'network'; readonly message: string }
  | { readonly kind: 'http'; readonly status: number; readonly message: string }
  | { readonly kind: 'parse'; readonly message: string };

export type BffResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: BffError };

const ok = <T>(value: T): BffResult<T> => ({ ok: true, value });
const fail = <T>(error: BffError): BffResult<T> => ({ ok: false, error });

async function bffFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<BffResult<T>> {
  const url = `${DEFAULT_BFF_BASE.replace(/\/$/, '')}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...init?.headers,
      },
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Network request failed';
    return fail({ kind: 'network', message });
  }

  if (!response.ok) {
    return fail({
      kind: 'http',
      status: response.status,
      message: `BFF ${response.status}`,
    });
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return fail({ kind: 'parse', message: 'Invalid JSON response' });
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return fail({ kind: 'parse', message: parsed.error.message });
  }
  return ok(parsed.data);
}

export function getBffBaseUrl(): string {
  return DEFAULT_BFF_BASE;
}

export async function fetchHotel(slug: string, locale = 'fr'): Promise<BffResult<MobileHotel>> {
  const encoded = encodeURIComponent(slug);
  return bffFetch(`/api/mobile/v1/hotel/${encoded}?locale=${locale}`, MobileHotelSchema);
}

export async function searchHotels(
  query: string,
  locale = 'fr',
): Promise<BffResult<MobileSearchResult>> {
  const params = new URLSearchParams({ q: query, locale });
  return bffFetch(`/api/mobile/v1/search?${params.toString()}`, MobileSearchResultSchema);
}
