/**
 * Le Concierge Club — server-side custom event emission.
 *
 * Purpose
 * -------
 * Centralises Sentry breadcrumbs + structured messages for the club
 * funnel surfaces (signup, magic link, oauth, prestige waitlist). The
 * emitter is **never** allowed to throw — Sentry stays optional (no DSN
 * in CI / dev) and any vendor failure must be invisible to the caller.
 *
 * PII contract
 * ------------
 * The full event name space is `club.*`. We deliberately keep payloads
 * structural (kind, surface, source) and route any user identifier
 * through `hashUserId` so PII never leaves the process.
 *
 * Skills:
 *  - `observability-monitoring` §custom events
 *  - `security-engineering` §PII contract
 *  - `membership-program` §Sentry custom events
 *
 * ADR references:
 *  - ADR-0019 — Le Concierge Club architecture (defines the funnel surfaces).
 */

import crypto from 'node:crypto';

import { env } from '@/lib/env';

/**
 * Local salt used to derive `userIdHash`. We deliberately reuse the
 * service-role key as the salt source so it stays in env-scope without
 * adding another variable. The hash is truncated to 32 chars so it is
 * never reversible to a raw uuid by a Sentry viewer.
 */
const SALT: string = env.SUPABASE_SERVICE_ROLE_KEY;

export type ClubEventName =
  | 'club.signup.attempt'
  | 'club.signup.success'
  | 'club.signup.failure'
  | 'club.magic_link.attempt'
  | 'club.magic_link.failure'
  | 'club.oauth.attempt'
  | 'club.oauth.failure'
  | 'club.benefits_viewed'
  | 'club.waitlist_prestige_signup'
  | 'club.waitlist_prestige_failure';

export type ClubEventSurface =
  | 'rejoindre_form'
  | 'rejoindre_magic'
  | 'rejoindre_oauth'
  | 'club_landing'
  | 'prestige_landing'
  | 'hotel_fiche'
  | 'dashboard'
  // LLM agent calling `/api/agent/join-concierge-club` or
  // `/api/agent/join-prestige-waitlist` — the surface lets us segment
  // chat-driven funnel attempts from regular HTML funnel traffic.
  | 'agent_api';

export interface ClubEventPayload {
  readonly surface: ClubEventSurface;
  /** Hashed Supabase user id (never the raw uuid). */
  readonly userIdHash?: string;
  /** OAuth provider or magic-link reason. */
  readonly provider?: 'google' | 'apple' | 'magic_link' | 'password';
  /** Internal failure code — sanitised, never the raw vendor message. */
  readonly errorKind?: string;
  /** Locale at the moment of the event (UI language). */
  readonly locale?: 'fr' | 'en';
  /** Additional structural tags (no PII). */
  readonly tags?: Readonly<Record<string, string | number | boolean>>;
}

export function hashUserId(userId: string | null | undefined): string | undefined {
  if (typeof userId !== 'string' || userId.length === 0) return undefined;
  return crypto.createHmac('sha256', SALT).update(userId).digest('hex').slice(0, 32);
}

/**
 * Emit a `club.*` event into Sentry (if configured). Logs to console
 * in dev for observability without a DSN. Always returns `void` and
 * swallows failures.
 */
export async function emitClubEvent(name: ClubEventName, payload: ClubEventPayload): Promise<void> {
  if (process.env['NODE_ENV'] !== 'production') {
    // eslint-disable-next-line no-console
    console.info('[club-event]', name, payload);
  }

  const dsn = process.env['NEXT_PUBLIC_SENTRY_DSN'];
  if (typeof dsn !== 'string' || dsn.length === 0) return;

  try {
    const Sentry = await import('@sentry/nextjs');
    Sentry.addBreadcrumb({
      category: 'club',
      type: 'user',
      level: 'info',
      message: name,
      data: { ...payload, ...payload.tags },
    });
    Sentry.captureMessage(name, {
      level: name.endsWith('.failure') ? 'warning' : 'info',
      tags: {
        'club.surface': payload.surface,
        ...(payload.provider !== undefined ? { 'club.provider': payload.provider } : {}),
        ...(payload.errorKind !== undefined ? { 'club.error_kind': payload.errorKind } : {}),
        ...(payload.locale !== undefined ? { 'club.locale': payload.locale } : {}),
      },
      extra: {
        ...(payload.userIdHash !== undefined ? { user_id_hash: payload.userIdHash } : {}),
        ...(payload.tags !== undefined ? payload.tags : {}),
      },
    });
  } catch {
    // Never let an observability failure surface to the user.
  }
}
