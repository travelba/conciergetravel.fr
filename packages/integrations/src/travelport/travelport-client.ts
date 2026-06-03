import { err, ok, type Result } from '@mch/domain/shared';

import { retryingJsonRequest } from '../http/index';
import { redisGetString, redisSetStringWithTtl } from '../redis/cache-helpers';

import { travelportSearchByCoordsCacheKey, travelportSearchByPropertyCacheKey } from './cache-keys';
import type { TravelportError } from './errors';
import { getTravelportAccessToken, type TravelportOAuthConfig } from './oauth-token';
import {
  SearchByCoordinatesInputSchema,
  SearchByPropertyInputSchema,
  SearchCompleteResponseSchema,
  TravelportErrorEnvelopeSchema,
  type PropertyItem,
  type SearchByCoordinatesInput,
  type SearchByPropertyInput,
  type SearchCompleteResponse,
} from './types';

const SEARCH_TTL_SEC = 10 * 60;
const SEARCH_VERSION = '12';
const AGGREGATOR = 'TVPT';

export type TravelportCredentials = TravelportOAuthConfig & {
  readonly apiBaseUrl: string;
  readonly accessGroup: string;
  readonly pcc: string;
};

export function mapTravelportErrorBody(status: number, body: unknown): TravelportError {
  const parsed = TravelportErrorEnvelopeSchema.safeParse(body);
  if (parsed.success && parsed.data.errors) {
    for (const e of parsed.data.errors) {
      const detail = (e.details ?? '').toUpperCase();
      if (e.code === 2500 || detail.includes('AUTHORIZATION ERROR')) {
        return {
          kind: 'authorization_error',
          ...(e.details !== undefined ? { details: e.details } : {}),
        };
      }
      if (detail.includes('OFFER') && detail.includes('EXPIRED')) return { kind: 'offer_expired' };
      if (detail.includes('PRICE') && detail.includes('CHANG'))
        return { kind: 'pricing_changed', offerId: 'unknown' };
      if (detail.includes('GUARANTEE') && detail.includes('CHANG'))
        return { kind: 'guarantee_changed', offerId: 'unknown' };
    }
  }
  return {
    kind: 'http',
    error: { kind: status >= 500 ? 'upstream_5xx' : 'upstream_4xx', status, body },
  };
}

export interface AuthorizedRequestInit {
  readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  readonly pathname: string;
  /** Version ODM du modèle. Search = '12' ; réservation/annulation = '11'. */
  readonly version?: string;
  readonly jsonBody?: unknown;
  readonly query?: Record<string, string>;
  readonly idempotencyKey?: string;
}

export async function authorizedJsonRequest(
  creds: TravelportCredentials,
  init: AuthorizedRequestInit,
): Promise<
  Result<{ readonly status: number; readonly json: unknown | undefined }, TravelportError>
> {
  const token = await getTravelportAccessToken(creds);
  if (!token.ok) return err(token.error);

  const version = init.version ?? SEARCH_VERSION;
  const url = new URL(init.pathname, creds.apiBaseUrl);
  for (const [k, v] of Object.entries(init.query ?? {})) {
    url.searchParams.set(k, v);
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token.value}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'Accept-Version': version,
    'Content-Version': version,
    XAUTH_TRAVELPORT_ACCESSGROUP: creds.accessGroup,
  };

  const body =
    init.jsonBody !== undefined
      ? ({ kind: 'json', value: init.jsonBody } as const)
      : ({ kind: 'none' } as const);

  const res = await retryingJsonRequest({
    url: url.toString(),
    method: init.method,
    headers,
    body,
    ...(init.idempotencyKey !== undefined ? { idempotencyKey: init.idempotencyKey } : {}),
  });

  if (!res.ok) return err({ kind: 'http', error: res.error });
  if (res.value.status < 200 || res.value.status >= 300) {
    return err(mapTravelportErrorBody(res.value.status, res.value.json));
  }
  return ok({ status: res.value.status, json: res.value.json });
}

export async function searchByCoordinates(
  creds: TravelportCredentials,
  rawInput: SearchByCoordinatesInput,
): Promise<Result<SearchCompleteResponse, TravelportError>> {
  const input = SearchByCoordinatesInputSchema.parse(rawInput);

  const cacheKey = travelportSearchByCoordsCacheKey({
    latitude: input.latitude,
    longitude: input.longitude,
    radius: input.radius,
    unit: input.unit,
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    adults: input.adults,
    currency: input.currency,
  });

  const cached = await redisGetString(creds.redis, cacheKey);
  if (cached !== null) {
    const parsed = SearchCompleteResponseSchema.safeParse(JSON.parse(cached));
    if (parsed.success) return ok(parsed.data);
  }

  const jsonBody = {
    requestedCurrency: input.currency,
    stayDetails: {
      checkInDateLocal: input.checkInDate,
      checkOutDateLocal: input.checkOutDate,
      rooms: 1,
      guests: {
        adults: input.adults,
        ...(input.childAges && input.childAges.length > 0
          ? { children: input.childAges.map((age) => ({ age })) }
          : {}),
      },
    },
    propertyFilter: {
      aggregators: [AGGREGATOR],
      location: {
        type: 'coordinates',
        details: { latitude: String(input.latitude), longitude: String(input.longitude) },
        radius: { value: input.radius, unit: input.unit },
      },
    },
  };

  const res = await authorizedJsonRequest(creds, {
    method: 'POST',
    pathname: `/${SEARCH_VERSION}/hotel/search/searchcomplete`,
    jsonBody,
  });
  if (!res.ok) return err(res.error);

  const parsed = SearchCompleteResponseSchema.safeParse(res.value.json);
  if (!parsed.success)
    return err({ kind: 'parse_failure', details: 'searchcomplete response shape' });

  await redisSetStringWithTtl(creds.redis, cacheKey, JSON.stringify(parsed.data), SEARCH_TTL_SEC);
  return ok(parsed.data);
}

export async function searchByProperty(
  creds: TravelportCredentials,
  rawInput: SearchByPropertyInput,
): Promise<Result<SearchCompleteResponse, TravelportError>> {
  const input = SearchByPropertyInputSchema.parse(rawInput);

  const cacheKey = travelportSearchByPropertyCacheKey({
    propertyKeys: input.propertyKeys,
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    adults: input.adults,
    childAges: input.childAges,
    currency: input.currency,
  });

  const cached = await redisGetString(creds.redis, cacheKey);
  if (cached !== null) {
    const parsed = SearchCompleteResponseSchema.safeParse(JSON.parse(cached));
    if (parsed.success) return ok(parsed.data);
  }

  const jsonBody = {
    requestedCurrency: input.currency,
    stayDetails: {
      checkInDateLocal: input.checkInDate,
      checkOutDateLocal: input.checkOutDate,
      rooms: input.rooms,
      guests: {
        adults: input.adults,
        ...(input.childAges && input.childAges.length > 0
          ? { children: input.childAges.map((age) => ({ age })) }
          : {}),
      },
    },
    propertyFilter: {
      aggregators: [AGGREGATOR],
      propertyKeys: input.propertyKeys.map((k) => ({
        chainCode: k.chainCode,
        propertyCode: k.propertyCode,
      })),
    },
  };

  const res = await authorizedJsonRequest(creds, {
    method: 'POST',
    pathname: `/${SEARCH_VERSION}/hotel/search/searchcomplete`,
    jsonBody,
  });
  if (!res.ok) return err(res.error);

  const parsed = SearchCompleteResponseSchema.safeParse(res.value.json);
  if (!parsed.success)
    return err({ kind: 'parse_failure', details: 'searchcomplete response shape' });

  await redisSetStringWithTtl(creds.redis, cacheKey, JSON.stringify(parsed.data), SEARCH_TTL_SEC);
  return ok(parsed.data);
}

export function uniqueProperties(resp: SearchCompleteResponse): PropertyItem[] {
  const byKey = new Map<string, PropertyItem>();
  for (const it of resp.hotelsResponse.propertyItems) {
    const key = `${it.chainCode}/${it.propertyCode}`;
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, it);
      continue;
    }
    const dCur = it.propertyInfo?.distanceFromSearchPoint?.value ?? Number.POSITIVE_INFINITY;
    const dPrev = existing.propertyInfo?.distanceFromSearchPoint?.value ?? Number.POSITIVE_INFINITY;
    if (dCur < dPrev) byKey.set(key, it);
  }
  return [...byKey.values()];
}
