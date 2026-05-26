/**
 * Le Concierge Club — domain types.
 *
 * Three tiers are visible from the outside world:
 *   - `anon`     : not authenticated, sees the maximalist catalogue + disclaimer.
 *   - `club`     : free signup, no CB. Phase 1 = catalogue + "personalisation
 *     in progress". Phase 6 = real per-hotel benefits from Little API sync.
 *   - `prestige` : paid €99/an, 30-day trial, Phase 6 launch. All perks activated.
 *
 * The DB stores `'club' | 'prestige'` only — `'anon'` is a UI-only state
 * derived from the absence of a session.
 *
 * Skill: loyalty-program + membership-program.
 */
import type { UserId } from '../shared/branded';

export type AnonTier = 'anon';
export type MemberTier = 'club' | 'prestige';
export type Tier = AnonTier | MemberTier;

/**
 * The 9 perks of the Concierge Club catalogue (Phase 1 maximalist view).
 *
 * Phase 1 reality: only `concierge_newsletter_monthly` and
 * `program_membership_account` are actively delivered. The rest are
 * advertised as the catalogue maximaliste; their per-hotel availability
 * gets resolved Phase 6 via the Little API sync (see migration 0057's
 * `hotel_member_benefits` table).
 */
export type BenefitCode =
  | 'concierge_newsletter_monthly'
  | 'program_membership_account'
  | 'prestige_launch_priority'
  | 'member_rate_differential'
  | 'breakfast_for_2'
  | 'room_upgrade'
  | 'hotel_credit'
  | 'late_checkout_14h'
  | 'welcome_gift'
  | 'whatsapp_concierge_24_7'
  | 'gm_introduction';

export interface Benefit {
  readonly code: BenefitCode;
  /** Minimum tier that gets this perk under the Phase 6 personalised view. */
  readonly minTier: MemberTier;
  /** Whether the actual delivery depends on the hotel's policy on a given date. */
  readonly subjectToAvailability: boolean;
  /**
   * Phase 1 = catalogue-only (we promise it, we don't yet deliver it
   * automatically). Phase 6 = the Little API sync populates per-hotel
   * reality and we deliver it operationally.
   */
  readonly availableInPhase1: boolean;
  /** Where the perk comes from at runtime once Phase 6 is wired. */
  readonly source: 'us' | 'amadeus' | 'little_api';
}

/**
 * Subscription state of a member. The `'club'` tier is always "active"
 * (free). Prestige carries a real billing lifecycle: trialing, active,
 * cancelled (still active until paid_until), expired.
 */
export type SubscriptionStatus =
  | 'active' // club tier, always; or prestige with paid_until > now
  | 'trialing' // prestige, trial_started_at <= now <= trial_ends_at
  | 'cancelled' // prestige, cancelled_at set but paid_until > now (still has access)
  | 'expired'; // prestige, paid_until <= now

export interface LoyaltyMember {
  readonly userId: UserId;
  readonly tier: MemberTier;
  readonly createdAt: Date;
  /** Prestige only. ISO timestamp set when the trial started. */
  readonly trialStartedAt?: Date;
  /** Prestige only. ISO timestamp when the trial ends (typically +30d). */
  readonly trialEndsAt?: Date;
  /** Prestige only. ISO timestamp until which the subscription is paid. */
  readonly paidUntil?: Date;
  /** Stripe IDs (Phase 6). Always null in Phase 1. */
  readonly stripeSubscriptionId?: string;
  readonly stripeCustomerId?: string;
  readonly cancelledAt?: Date;
  readonly cancellationReason?: string;
}

/**
 * Hotel-scoped benefit reality, materialised in Phase 6 from the Little
 * API sync (`source='little_api'`) or from manual addendums
 * (`source='manual_addendum'`). In Phase 1 the table is empty and we
 * fall back to the catalogue.
 */
export interface HotelBenefit {
  readonly hotelId: string;
  readonly tier: MemberTier;
  readonly code: BenefitCode;
  readonly subjectToAvailability: boolean;
  readonly source: 'default' | 'manual_addendum' | 'little_api';
  readonly validFrom?: Date;
  readonly validUntil?: Date;
}
