import { err, ok, type Result } from '@mch/domain/shared';
import { z } from 'zod';

import { retryingJsonRequest, type RequestBody } from '../http/index';
import {
  redisGetString,
  redisSetStringWithTtl,
  runWithRedisLock,
  type IntegrationRedis,
} from '../redis/cache-helpers';

import { travelportAuthLockKey, travelportAuthTokenKey } from './cache-keys';
import type { TravelportError } from './errors';
import { TravelportOAuthTokenSchema } from './types';

const TOKEN_SKEW_MS = 60_000;

const CachedTokenEnvelopeSchema = z.object({
  accessToken: z.string(),
  expiresAtMs: z.number(),
});

export type TravelportOAuthConfig = {
  readonly authUrl: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly username: string;
  readonly password: string;
  readonly redis: IntegrationRedis;
};

async function readCachedToken(redis: IntegrationRedis): Promise<string | null> {
  const raw = await redisGetString(redis, travelportAuthTokenKey());
  if (raw === null) return null;
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = CachedTokenEnvelopeSchema.safeParse(parsedJson);
  if (!parsed.success) return null;
  if (parsed.data.expiresAtMs <= Date.now() + TOKEN_SKEW_MS) return null;
  return parsed.data.accessToken;
}

async function postPasswordGrant(
  cfg: TravelportOAuthConfig,
): Promise<
  Result<{ readonly accessToken: string; readonly expiresInSec: number }, TravelportError>
> {
  const body: RequestBody = {
    kind: 'form',
    pairs: {
      grant_type: 'password',
      username: cfg.username,
      password: cfg.password,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      scope: 'openid',
    },
  };

  const res = await retryingJsonRequest({
    url: cfg.authUrl,
    method: 'POST',
    body,
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) return err({ kind: 'http', error: res.error });
  if (res.value.status < 200 || res.value.status >= 300) {
    return err({ kind: 'oauth_rejected', details: `status ${res.value.status}` });
  }
  if (res.value.json === undefined)
    return err({ kind: 'parse_failure', details: 'empty oauth response' });
  const token = TravelportOAuthTokenSchema.safeParse(res.value.json);
  if (!token.success) return err({ kind: 'parse_failure', details: 'oauth response shape' });
  return ok({ accessToken: token.data.access_token, expiresInSec: token.data.expires_in });
}

async function storeToken(
  redis: IntegrationRedis,
  token: string,
  expiresInSec: number,
): Promise<void> {
  const envelope = { accessToken: token, expiresAtMs: Date.now() + expiresInSec * 1000 };
  const ttlSec = Math.max(60, Math.floor(expiresInSec) - 60);
  await redisSetStringWithTtl(redis, travelportAuthTokenKey(), JSON.stringify(envelope), ttlSec);
}

export async function getTravelportAccessToken(
  cfg: TravelportOAuthConfig,
): Promise<Result<string, TravelportError>> {
  const hit = await readCachedToken(cfg.redis);
  if (hit !== null) return ok(hit);

  let oauthFail: TravelportError | undefined;

  try {
    await runWithRedisLock(
      cfg.redis,
      travelportAuthLockKey(),
      15,
      async () => {
        const hit2 = await readCachedToken(cfg.redis);
        if (hit2 !== null) return;
        const fresh = await postPasswordGrant(cfg);
        if (!fresh.ok) {
          oauthFail = fresh.error;
          return;
        }
        await storeToken(cfg.redis, fresh.value.accessToken, fresh.value.expiresInSec);
      },
      { maxWaitMs: 8_000, spinMs: 100 },
    );
  } catch {
    return err({ kind: 'oauth_rejected', details: 'lock wait timeout' });
  }

  if (oauthFail !== undefined) return err(oauthFail);

  const final = await readCachedToken(cfg.redis);
  if (final !== null) return ok(final);
  return err({ kind: 'oauth_rejected', details: 'token missing after refresh' });
}
