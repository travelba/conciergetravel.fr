/**
 * Le Concierge Club — perks catalogue.
 *
 * This is the **single source of truth** for the 9 perks displayed on
 * the hotel detail page and the /le-concierge-club landing. It is
 * intentionally hardcoded in the domain layer because:
 *
 *   1. The catalogue is brand-defining, not data — editing it should
 *      go through a PR review, not a back-office form.
 *   2. The Phase 1 anonymous view renders this list verbatim (the
 *      "maximaliste with disclaimer" pattern). No DB roundtrip needed.
 *   3. Phase 6 personalisation reads the per-hotel reality from
 *      `hotel_member_benefits` (sourced by Little API) but **always**
 *      validates the codes against this catalogue — any unknown code
 *      from upstream is dropped.
 *
 * Skill: loyalty-program.
 */
import type { Benefit, BenefitCode } from './types';

export const CONCIERGE_CLUB_BENEFITS: ReadonlyArray<Benefit> = [
  // -------------------------------------------------------------------
  // Club gratuit — infrastructure de capture, zero-ops Phase 1
  // -------------------------------------------------------------------
  {
    code: 'concierge_newsletter_monthly',
    minTier: 'club',
    subjectToAvailability: false,
    availableInPhase1: true,
    source: 'us',
  },
  {
    code: 'program_membership_account',
    minTier: 'club',
    subjectToAvailability: false,
    availableInPhase1: true,
    source: 'us',
  },
  {
    code: 'prestige_launch_priority',
    minTier: 'club',
    subjectToAvailability: false,
    availableInPhase1: true,
    source: 'us',
  },
  // -------------------------------------------------------------------
  // Prestige — activated Phase 6 via Little API + addendums
  // -------------------------------------------------------------------
  {
    code: 'member_rate_differential',
    minTier: 'club',
    subjectToAvailability: false,
    availableInPhase1: false,
    source: 'amadeus',
  },
  {
    code: 'breakfast_for_2',
    minTier: 'prestige',
    subjectToAvailability: false,
    availableInPhase1: false,
    source: 'little_api',
  },
  {
    code: 'room_upgrade',
    minTier: 'prestige',
    subjectToAvailability: true,
    availableInPhase1: false,
    source: 'little_api',
  },
  {
    code: 'hotel_credit',
    minTier: 'prestige',
    subjectToAvailability: false,
    availableInPhase1: false,
    source: 'little_api',
  },
  {
    code: 'late_checkout_14h',
    minTier: 'prestige',
    subjectToAvailability: true,
    availableInPhase1: false,
    source: 'little_api',
  },
  {
    code: 'welcome_gift',
    minTier: 'prestige',
    subjectToAvailability: false,
    availableInPhase1: false,
    source: 'little_api',
  },
  {
    code: 'whatsapp_concierge_24_7',
    minTier: 'prestige',
    subjectToAvailability: false,
    availableInPhase1: false,
    source: 'us',
  },
  {
    code: 'gm_introduction',
    minTier: 'prestige',
    subjectToAvailability: true,
    availableInPhase1: false,
    source: 'us',
  },
] as const;

const BY_CODE: ReadonlyMap<BenefitCode, Benefit> = new Map(
  CONCIERGE_CLUB_BENEFITS.map((b) => [b.code, b] as const),
);

/** Type-narrow check that the unknown string is a valid catalogue code. */
export function isBenefitCode(value: unknown): value is BenefitCode {
  return typeof value === 'string' && BY_CODE.has(value as BenefitCode);
}

/** Lookup a benefit by code. Returns `undefined` for unknown codes. */
export function benefitByCode(code: BenefitCode): Benefit | undefined {
  return BY_CODE.get(code);
}
