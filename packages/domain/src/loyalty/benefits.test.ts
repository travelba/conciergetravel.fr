import { describe, expect, it } from 'vitest';

import { CONCIERGE_CLUB_BENEFITS } from './catalogue';
import { eligibleBenefits } from './benefits';
import type { HotelBenefit } from './types';

const HOTEL_ID = 'hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh';

describe('eligibleBenefits', () => {
  it('anonymous viewer sees the full maximalist catalogue, never personalised', () => {
    const out = eligibleBenefits({
      viewerTier: 'anon',
      hotelBenefits: [],
      littlePersonalisationEnabled: true,
    });
    expect(out).toHaveLength(CONCIERGE_CLUB_BENEFITS.length);
    expect(out.every((r) => !r.personalised)).toBe(true);
  });

  it('club member in Phase 1 sees catalogue at club tier, no personalisation', () => {
    const out = eligibleBenefits({
      viewerTier: 'club',
      hotelBenefits: [],
      littlePersonalisationEnabled: false,
    });
    const codes = out.map((r) => r.benefit.code);
    expect(codes).toEqual(
      CONCIERGE_CLUB_BENEFITS.filter((b) => b.minTier === 'club').map((b) => b.code),
    );
    expect(out.every((r) => !r.personalised)).toBe(true);
  });

  it('prestige member with no hotel reality falls back to catalogue (all perks)', () => {
    const out = eligibleBenefits({
      viewerTier: 'prestige',
      hotelBenefits: [],
      littlePersonalisationEnabled: true,
    });
    expect(out).toHaveLength(CONCIERGE_CLUB_BENEFITS.length);
    expect(out.every((r) => !r.personalised)).toBe(true);
  });

  it('personalisation kicks in when both the flag and at least one hotel row match', () => {
    const hotelBenefits: HotelBenefit[] = [
      {
        hotelId: HOTEL_ID,
        tier: 'prestige',
        code: 'breakfast_for_2',
        subjectToAvailability: false,
        source: 'little_api',
      },
      {
        hotelId: HOTEL_ID,
        tier: 'prestige',
        code: 'late_checkout_14h',
        subjectToAvailability: true,
        source: 'little_api',
      },
    ];

    const out = eligibleBenefits({
      viewerTier: 'prestige',
      hotelBenefits,
      littlePersonalisationEnabled: true,
    });

    expect(out.map((r) => r.benefit.code)).toEqual(['breakfast_for_2', 'late_checkout_14h']);
    expect(out.every((r) => r.personalised && r.hotelOverride?.source === 'little_api')).toBe(true);
  });

  it('flag off → personalisation suppressed even when hotel rows exist', () => {
    const hotelBenefits: HotelBenefit[] = [
      {
        hotelId: HOTEL_ID,
        tier: 'prestige',
        code: 'breakfast_for_2',
        subjectToAvailability: false,
        source: 'little_api',
      },
    ];

    const out = eligibleBenefits({
      viewerTier: 'prestige',
      hotelBenefits,
      littlePersonalisationEnabled: false,
    });

    expect(out).toHaveLength(CONCIERGE_CLUB_BENEFITS.length);
    expect(out.every((r) => !r.personalised)).toBe(true);
  });

  it('club viewer ignores prestige-only hotel rows even when personalisation is on', () => {
    const hotelBenefits: HotelBenefit[] = [
      {
        hotelId: HOTEL_ID,
        tier: 'prestige',
        code: 'breakfast_for_2',
        subjectToAvailability: false,
        source: 'little_api',
      },
    ];

    const out = eligibleBenefits({
      viewerTier: 'club',
      hotelBenefits,
      littlePersonalisationEnabled: true,
    });

    // No club-tier row in input → fall back to catalogue at club tier.
    expect(out.every((r) => r.benefit.minTier === 'club')).toBe(true);
    expect(out.every((r) => !r.personalised)).toBe(true);
  });

  it('unknown codes from upstream are silently dropped (defensive)', () => {
    const hotelBenefits: HotelBenefit[] = [
      {
        hotelId: HOTEL_ID,
        tier: 'prestige',
        code: 'unknown_code' as never,
        subjectToAvailability: false,
        source: 'little_api',
      },
      {
        hotelId: HOTEL_ID,
        tier: 'prestige',
        code: 'breakfast_for_2',
        subjectToAvailability: false,
        source: 'little_api',
      },
    ];

    const out = eligibleBenefits({
      viewerTier: 'prestige',
      hotelBenefits,
      littlePersonalisationEnabled: true,
    });

    expect(out.map((r) => r.benefit.code)).toEqual(['breakfast_for_2']);
  });
});
