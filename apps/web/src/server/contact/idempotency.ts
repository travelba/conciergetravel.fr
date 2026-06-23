import 'server-only';

import { buildContactRequestIdempotencyKey } from '@mch/domain/contact';

import { redis } from '@/lib/redis';

const ONE_DAY_SEC = 24 * 60 * 60;

export interface ContactRequestKeyInput {
  readonly email: string;
  readonly subject: string;
  readonly message: string;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  const bytes = new Uint8Array(hash);
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += (bytes[i] as number).toString(16).padStart(2, '0');
  }
  return out;
}

/** Redis key for the contact idempotency record. */
export function contactIdempotencyRedisKey(hash: string): string {
  return `idempotency:contact:${hash}`;
}

export type IdempotencyOutcome =
  | { readonly kind: 'fresh' }
  | { readonly kind: 'existing'; readonly requestRef: string };

/**
 * Reserves an idempotency slot keyed by `{email, subject, message}`. Returns
 * `existing` with the stored ref when the identical message was submitted
 * within the 24h window; `fresh` otherwise (including the concurrent-pending
 * case, to avoid blocking the sender).
 */
export async function reserveContactIdempotency(
  input: ContactRequestKeyInput,
): Promise<{ readonly hash: string; readonly outcome: IdempotencyOutcome }> {
  const canonical = buildContactRequestIdempotencyKey(input);
  const hash = await sha256Hex(canonical);
  const key = contactIdempotencyRedisKey(hash);

  const acquired = await redis.set(key, 'pending', { nx: true, ex: ONE_DAY_SEC });
  if (acquired !== null) {
    return { hash, outcome: { kind: 'fresh' } };
  }
  const existing = await redis.get<string>(key);
  if (typeof existing === 'string' && existing.startsWith('CR-')) {
    return { hash, outcome: { kind: 'existing', requestRef: existing } };
  }
  return { hash, outcome: { kind: 'fresh' } };
}

/** Replaces the pending placeholder with the real ref (renews 24h TTL). */
export async function finaliseContactIdempotency(hash: string, requestRef: string): Promise<void> {
  await redis.set(contactIdempotencyRedisKey(hash), requestRef, { ex: ONE_DAY_SEC });
}

/** Releases the slot if the submission ultimately failed. */
export async function releaseContactIdempotency(hash: string): Promise<void> {
  await redis.del(contactIdempotencyRedisKey(hash));
}
