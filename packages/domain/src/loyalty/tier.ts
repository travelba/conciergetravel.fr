/**
 * Tier resolution + subscription-state machine — pure functions.
 *
 * Skill: loyalty-program. No I/O, no Date.now() — pass a Clock from
 * `../shared/clock.ts` so tests can deterministically pin "today".
 */
import type { Clock } from '../shared/clock';
import type { LoyaltyMember, SubscriptionStatus, Tier } from './types';

/** Resolve the effective tier of the current viewer. */
export function tierFor(member: LoyaltyMember | null | undefined): Tier {
  if (member === null || member === undefined) return 'anon';
  return member.tier;
}

/**
 * Compute the live subscription state of a member at a given instant.
 *
 * Club tier is always 'active'. Prestige walks the
 * `trialing → active → cancelled → expired` ladder based on the dates
 * stored at signup / Stripe webhook time.
 *
 * The order matters: a cancelled subscription whose `paid_until` is
 * still in the future remains usable (the member keeps their benefits
 * until renewal would have occurred). Only once `paid_until` is in
 * the past do we treat them as 'expired'.
 */
export function trialState(member: LoyaltyMember, clock: Clock): SubscriptionStatus {
  if (member.tier === 'club') return 'active';

  const now = clock.now().getTime();
  const paidUntil = member.paidUntil?.getTime();
  const trialStart = member.trialStartedAt?.getTime();
  const trialEnd = member.trialEndsAt?.getTime();
  const cancelledAt = member.cancelledAt?.getTime();

  if (trialStart !== undefined && trialEnd !== undefined && now >= trialStart && now <= trialEnd) {
    return 'trialing';
  }

  if (cancelledAt !== undefined) {
    if (paidUntil !== undefined && paidUntil > now) return 'cancelled';
    return 'expired';
  }

  if (paidUntil !== undefined && paidUntil > now) return 'active';

  return 'expired';
}

/**
 * Whether a club-tier member can upgrade to Prestige right now.
 *
 * Phase 1: always false (Prestige is waitlist-only). Phase 6: true
 * when the member doesn't already hold an active Prestige subscription
 * and the `prestigeUpgradesEnabled` flag is on.
 */
export function canUpgradeToPrestige(
  member: LoyaltyMember | null | undefined,
  clock: Clock,
  options: { readonly prestigeUpgradesEnabled: boolean },
): boolean {
  if (!options.prestigeUpgradesEnabled) return false;
  if (member === null || member === undefined) return false;
  if (member.tier === 'club') return true;
  // Prestige member: only allow "upgrade" semantics if their subscription
  // is no longer active (re-subscription path).
  const status = trialState(member, clock);
  return status === 'expired';
}
