/**
 * RateHawk / ETG (worldota) B2B v3 client (skill: api-integration).
 *
 * Auth is HTTP Basic `KEY_ID:API_KEY`. Two endpoint families:
 *   - search/book under `/api/b2b/v3/...`
 *   - static content under `/api/content/v1/...`
 *
 * `RATEHAWK_API_BASE` is the host root (e.g. https://api-sandbox.worldota.net).
 * Content must be preloaded/stored locally (do NOT call it for every search).
 */
import { loadSharedEnv, type SharedEnv } from '@mch/config/env';
import { err, ok, type Result } from '@mch/domain/shared';
import { retryingJsonRequest } from '@mch/integrations/http';

import type { RateHawkError } from './errors';
import {
  HotelContentResponseSchema,
  HotelPageResponseSchema,
  type RateHawkHotelContentResponse,
  type RateHawkHotelPageResponse,
} from './types';

export interface RateHawkClientConfig {
  readonly baseUrl: string;
  readonly keyId: string;
  readonly apiKey: string;
}

export interface RateHawkStay {
  readonly checkin: string; // YYYY-MM-DD
  readonly checkout: string;
  readonly adults: number;
  readonly childAges?: readonly number[];
  readonly currency?: string; // ISO 4217; we request EUR by default
  readonly language?: string; // 'en' | 'fr' ...
  readonly residency?: string; // ISO 3166-1 alpha-2 lowercase, e.g. 'fr'
}

function basicAuthHeader(cfg: RateHawkClientConfig): string {
  // `btoa` is available in Node 18+ and edge runtimes; credentials are ASCII.
  const token = btoa(`${cfg.keyId}:${cfg.apiKey}`);
  return `Basic ${token}`;
}

async function postJson<T>(
  cfg: RateHawkClientConfig,
  path: string,
  payload: unknown,
  parse: (raw: unknown) => Result<T, RateHawkError>,
): Promise<Result<T, RateHawkError>> {
  const url = new URL(path, cfg.baseUrl).toString();
  const res = await retryingJsonRequest({
    url,
    method: 'POST',
    headers: { Authorization: basicAuthHeader(cfg), Accept: 'application/json' },
    body: { kind: 'json', value: payload },
    timeoutMs: 12_000,
  });
  if (!res.ok) return err({ kind: 'http', error: res.error });
  if (res.value.json === undefined) {
    return err({ kind: 'parse_failure', details: 'empty response' });
  }
  return parse(res.value.json);
}

/** Hotel page: live availability + rates for one ETG hotel id. */
export async function searchHotelPage(
  cfg: RateHawkClientConfig,
  hotelId: string,
  stay: RateHawkStay,
): Promise<Result<RateHawkHotelPageResponse, RateHawkError>> {
  const guests = [
    {
      adults: stay.adults,
      children: stay.childAges && stay.childAges.length > 0 ? [...stay.childAges] : [],
    },
  ];
  const payload = {
    id: hotelId,
    checkin: stay.checkin,
    checkout: stay.checkout,
    guests,
    currency: stay.currency ?? 'EUR',
    language: stay.language ?? 'en',
    residency: stay.residency ?? 'fr',
  };
  return postJson(cfg, '/api/b2b/v3/search/hp/', payload, (raw) => {
    const parsed = HotelPageResponseSchema.safeParse(raw);
    if (!parsed.success) return err({ kind: 'parse_failure', details: 'hotelpage shape' });
    if (parsed.data.status !== undefined && parsed.data.status !== 'ok') {
      return err({
        kind: 'api_error',
        status: parsed.data.status,
        details: parsed.data.error ?? 'hotelpage error',
      });
    }
    return ok(parsed.data);
  });
}

/** Static content (room_groups with images, amenities, rg_ext) for ETG hotels. */
export async function fetchHotelContent(
  cfg: RateHawkClientConfig,
  hotelIds: readonly string[],
  language = 'en',
): Promise<Result<RateHawkHotelContentResponse, RateHawkError>> {
  const payload = { ids: [...hotelIds], language };
  return postJson(cfg, '/api/content/v1/hotel_content_by_ids/', payload, (raw) => {
    const parsed = HotelContentResponseSchema.safeParse(raw);
    if (!parsed.success) return err({ kind: 'parse_failure', details: 'content shape' });
    if (parsed.data.status !== undefined && parsed.data.status !== 'ok') {
      return err({
        kind: 'api_error',
        status: parsed.data.status,
        details: parsed.data.error ?? 'content error',
      });
    }
    return ok(parsed.data);
  });
}

/** Build a client config from the shared env. Returns `not_configured` when
 *  credentials are missing (RateHawk is optional). */
export function rateHawkConfigFromSharedEnv(
  source?: SharedEnv,
): Result<RateHawkClientConfig, RateHawkError> {
  const env = source ?? loadSharedEnv();
  const baseUrl = env.RATEHAWK_API_BASE;
  const keyId = env.RATEHAWK_KEY_ID;
  const apiKey = env.RATEHAWK_API_KEY;
  if (baseUrl === undefined || keyId === undefined || apiKey === undefined) {
    return err({
      kind: 'not_configured',
      details: 'RATEHAWK_API_BASE / RATEHAWK_KEY_ID / RATEHAWK_API_KEY required',
    });
  }
  return ok({ baseUrl, keyId, apiKey });
}
