import 'server-only';

import type { User } from '@supabase/supabase-js';

import { redirect } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { getOptionalUser } from './session';
import { getLoyaltyMember, type LoyaltyMemberRow } from './loyalty-member';

import * as Loyalty from '@mch/domain/loyalty';

/**
 * Server-side authorisation gate.
 *
 * Use from any Server Component or Server Action that requires a
 * logged-in user, optionally constrained to a minimum tier. When the
 * user is missing or under-tiered, the helper *redirects* to the
 * appropriate page — it never returns null. Callers always work with
 * a guaranteed `User` (and, when requested, a typed loyalty member).
 *
 * Phase 1 examples:
 *
 *   // Any logged-in user — used by the /compte dashboard.
 *   const { user } = await requireUser({ locale });
 *
 *   // Prestige-gated server action (Phase 6).
 *   const { user, member } = await requireUser({ locale, minTier: 'prestige' });
 *
 * Skill: auth-role-management + membership-program.
 */
export interface RequireUserOptions {
  readonly locale: Locale;
  /** Optional minimum tier. `'club'` requires any signed-in user. */
  readonly minTier?: Loyalty.MemberTier;
  /**
   * Where to send the user after a successful sign-in. Defaults to the
   * current path that triggered the gate. Must be locale-relative.
   */
  readonly nextPath?: string;
}

export interface RequireUserResult {
  readonly user: User;
  readonly member: LoyaltyMemberRow;
  readonly tier: Loyalty.MemberTier;
}

export async function requireUser(options: RequireUserOptions): Promise<RequireUserResult> {
  const { locale, minTier, nextPath } = options;

  const user = await getOptionalUser();
  if (user === null) {
    redirect({
      href: {
        pathname: '/compte/rejoindre',
        query: nextPath !== undefined && nextPath !== '' ? { next: nextPath } : {},
      },
      locale,
    });
  }

  // Defensive: getOptionalUser may legitimately return null when env
  // is missing (CI smoke build). In a real request flow, `redirect()`
  // already threw — this is just for the typechecker.
  if (user === null) throw new Error('unreachable: requireUser without user');

  const member = await getLoyaltyMember(user.id);

  // The DB trigger `handle_new_auth_user` always seeds a row, so a
  // missing member at this point indicates an env / replication race.
  // Treat it as the lowest tier rather than 500ing — the user can still
  // browse their own data.
  const tier: Loyalty.MemberTier = member?.tier ?? 'club';

  if (minTier === 'prestige' && tier !== 'prestige') {
    // Bounce non-Prestige members to the consolidated landing with the
    // `?gated=1` flag — the page surfaces the warning banner inside the
    // `#prestige` section and the browser scrolls to the anchor.
    redirect({
      href: { pathname: '/le-concierge-club', query: { gated: '1' } },
      locale,
    });
  }

  return {
    user,
    member: member ?? defaultClubMember(user.id),
    tier,
  };
}

function defaultClubMember(userId: string): LoyaltyMemberRow {
  return {
    id: userId,
    tier: 'club',
    tier_expiry: null,
    total_bookings: 0,
    premium_price: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    trial_started_at: null,
    trial_ends_at: null,
    paid_until: null,
    stripe_subscription_id: null,
    stripe_customer_id: null,
    cancelled_at: null,
    cancellation_reason: null,
  };
}
