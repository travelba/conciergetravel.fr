/**
 * Eligible-benefits resolution — the function that drives
 * `<ClubBenefitsBlock>` on the hotel detail page.
 *
 * Three-state logic (pure):
 *
 *   1. **Anonymous viewer**  → return the full maximalist catalogue, every
 *      perk flagged as "aspirational" so the UI can render the disclaimer.
 *
 *   2. **Club member, no hotel reality available** (Phase 1, or a hotel
 *      with no `hotel_member_benefits` row yet) → return the catalogue
 *      filtered to perks whose `minTier === 'club'`, marked as
 *      "personalisation in progress" so the UI shows the same disclaimer
 *      tailored to the logged-in voice.
 *
 *   3. **Member + hotel reality** (Phase 6 default) → return the actual
 *      `HotelBenefit[]` rows joined with the catalogue metadata. Anything
 *      not in `hotel_member_benefits` is dropped (we never promise a
 *      benefit the hotel hasn't agreed to deliver).
 *
 * Skill: loyalty-program.
 */
import { CONCIERGE_CLUB_BENEFITS, benefitByCode } from './catalogue';
import type { Benefit, HotelBenefit, Tier } from './types';

export interface ResolvedBenefit {
  readonly benefit: Benefit;
  /**
   * Whether this row is rendered as actually-delivered (true) or as
   * aspirational catalogue with a disclaimer (false).
   */
  readonly personalised: boolean;
  /** When personalised, the resolved hotel-scoped reality. */
  readonly hotelOverride?: HotelBenefit;
}

export interface EligibleBenefitsInput {
  readonly viewerTier: Tier;
  /** May be empty in Phase 1, or for hotels with no Little API sync yet. */
  readonly hotelBenefits: ReadonlyArray<HotelBenefit>;
  /**
   * Phase 6 master flag. When false, even hotels with a populated
   * `hotel_member_benefits` row render the aspirational catalogue
   * (used during the gated rollout of the Little API sync).
   */
  readonly littlePersonalisationEnabled: boolean;
}

export function eligibleBenefits(input: EligibleBenefitsInput): ReadonlyArray<ResolvedBenefit> {
  const { viewerTier, hotelBenefits, littlePersonalisationEnabled } = input;

  // Anonymous viewer — full maximalist catalogue, never personalised.
  if (viewerTier === 'anon') {
    return CONCIERGE_CLUB_BENEFITS.map((b) => ({ benefit: b, personalised: false }));
  }

  // Personalisation is gated by the master flag AND the presence of at
  // least one hotel-scoped row that matches the viewer's tier.
  const personalisable =
    littlePersonalisationEnabled &&
    hotelBenefits.some((row) => isVisibleAtTier(row.tier, viewerTier));

  if (!personalisable) {
    return catalogueAtTier(viewerTier);
  }

  // Personalised view — keep only rows the hotel actually agreed to deliver.
  const out: ResolvedBenefit[] = [];
  for (const row of hotelBenefits) {
    if (!isVisibleAtTier(row.tier, viewerTier)) continue;
    const benefit = benefitByCode(row.code);
    if (benefit === undefined) continue;
    out.push({ benefit, personalised: true, hotelOverride: row });
  }
  // Stable ordering: catalogue order, then hotel-specific extras.
  out.sort(
    (a, b) =>
      CONCIERGE_CLUB_BENEFITS.indexOf(a.benefit) - CONCIERGE_CLUB_BENEFITS.indexOf(b.benefit),
  );
  return out;
}

function catalogueAtTier(viewerTier: Exclude<Tier, 'anon'>): ReadonlyArray<ResolvedBenefit> {
  return CONCIERGE_CLUB_BENEFITS.filter((b) => isVisibleAtTier(b.minTier, viewerTier)).map((b) => ({
    benefit: b,
    personalised: false,
  }));
}

function isVisibleAtTier(perkTier: 'club' | 'prestige', viewerTier: Tier): boolean {
  if (viewerTier === 'anon') return true;
  if (viewerTier === 'prestige') return true;
  // Club viewer sees only perks whose minTier is 'club'.
  return perkTier === 'club';
}
