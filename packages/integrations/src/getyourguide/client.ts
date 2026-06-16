import { loadSharedEnv, type SharedEnv } from '@mch/config/env';
import { err, ok, type Result } from '@mch/domain/shared';
import { retryingJsonRequest } from '@mch/integrations/http';

import type { GetYourGuideError } from './errors';
import { parseGygSearchResponse } from './parse';
import {
  GygSearchInputSchema,
  GygSearchResponseSchema,
  type GygSearchInput,
  type ParsedGygTour,
} from './types';

export interface GetYourGuideClientConfig {
  readonly enabled: boolean;
  readonly baseUrl: string;
  readonly accessToken: string;
  readonly partnerId: string;
}

const DEFAULT_GYG_BASE = 'https://api.getyourguide.com';

/**
 * Build the client config from the shared env. The integration is
 * optional (Palier A) — when disabled or unconfigured, callers receive
 * a typed `disabled` / `unconfigured` error instead of a thrown
 * exception, so the editorial-only build keeps working.
 */
export function getYourGuideConfigFromSharedEnv(source?: SharedEnv): GetYourGuideClientConfig {
  const env = source ?? loadSharedEnv();
  return {
    enabled: env.GETYOURGUIDE_ENABLED,
    baseUrl: env.GETYOURGUIDE_API_BASE ?? DEFAULT_GYG_BASE,
    accessToken: env.GETYOURGUIDE_ACCESS_TOKEN ?? '',
    partnerId: env.GETYOURGUIDE_PARTNER_ID ?? '',
  };
}

function ensureReady(cfg: GetYourGuideClientConfig): GetYourGuideError | null {
  if (!cfg.enabled) return { kind: 'disabled' };
  if (cfg.accessToken.length === 0) {
    return { kind: 'unconfigured', details: 'GETYOURGUIDE_ACCESS_TOKEN missing' };
  }
  if (cfg.partnerId.length === 0) {
    return { kind: 'unconfigured', details: 'GETYOURGUIDE_PARTNER_ID missing' };
  }
  return null;
}

/**
 * Search GetYourGuide tours/activities around a geographic point.
 *
 * Authentication is the `X-ACCESS-TOKEN` header (Partner API spec).
 * Results are normalised to {@link ParsedGygTour} with an affiliate
 * deeplink already built. Returns an empty array when GYG has no
 * inventory near the point (a valid, non-error result).
 */
export async function searchGygToursByCoords(
  cfg: GetYourGuideClientConfig,
  input: GygSearchInput,
): Promise<Result<readonly ParsedGygTour[], GetYourGuideError>> {
  const notReady = ensureReady(cfg);
  if (notReady !== null) return err(notReady);

  const validated = GygSearchInputSchema.safeParse(input);
  if (!validated.success) {
    return err({ kind: 'parse_failure', details: 'invalid GYG search input' });
  }
  const v = validated.data;

  const url = new URL('/1/tours', cfg.baseUrl);
  url.searchParams.set('cnt_language', v.locale ?? 'fr');
  url.searchParams.set('coordinates', `${String(v.latitude)},${String(v.longitude)}`);
  url.searchParams.set('radius', String((v.radiusKm ?? 2) * 1000));
  url.searchParams.set('limit', String(v.limit ?? 6));

  const res = await retryingJsonRequest({
    url: url.toString(),
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-ACCESS-TOKEN': cfg.accessToken,
    },
    body: { kind: 'none' },
    maxAttempts: 3,
  });

  if (!res.ok) return err({ kind: 'http', error: res.error });
  if (res.value.json === undefined) {
    return err({ kind: 'parse_failure', details: 'empty GYG response' });
  }

  const parsed = GygSearchResponseSchema.safeParse(res.value.json);
  if (!parsed.success) {
    return err({
      kind: 'parse_failure',
      details: parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join(' | '),
    });
  }

  return ok(parseGygSearchResponse(parsed.data, cfg.partnerId));
}
