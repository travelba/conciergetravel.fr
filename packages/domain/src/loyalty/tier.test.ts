import { describe, expect, it } from 'vitest';

import { fixedClock } from '../shared/clock';
import { canUpgradeToPrestige, tierFor, trialState } from './tier';
import type { LoyaltyMember } from './types';

const NOW = new Date('2026-06-01T12:00:00Z');
const clock = fixedClock(NOW);

const baseClub: LoyaltyMember = {
  userId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' as never,
  tier: 'club',
  createdAt: new Date('2026-05-01T00:00:00Z'),
};

const basePrestige: LoyaltyMember = {
  ...baseClub,
  tier: 'prestige',
};

describe('tierFor', () => {
  it('returns "anon" when no member is provided', () => {
    expect(tierFor(null)).toBe('anon');
    expect(tierFor(undefined)).toBe('anon');
  });

  it('returns the member tier when present', () => {
    expect(tierFor(baseClub)).toBe('club');
    expect(tierFor(basePrestige)).toBe('prestige');
  });
});

describe('trialState', () => {
  it('club tier is always active', () => {
    expect(trialState(baseClub, clock)).toBe('active');
  });

  it('prestige in trial window → trialing', () => {
    const member: LoyaltyMember = {
      ...basePrestige,
      trialStartedAt: new Date('2026-05-15T00:00:00Z'),
      trialEndsAt: new Date('2026-06-15T00:00:00Z'),
    };
    expect(trialState(member, clock)).toBe('trialing');
  });

  it('prestige paid + no cancellation → active', () => {
    const member: LoyaltyMember = {
      ...basePrestige,
      paidUntil: new Date('2027-06-01T00:00:00Z'),
    };
    expect(trialState(member, clock)).toBe('active');
  });

  it('prestige cancelled but still in paid period → cancelled', () => {
    const member: LoyaltyMember = {
      ...basePrestige,
      cancelledAt: new Date('2026-05-15T00:00:00Z'),
      paidUntil: new Date('2027-06-01T00:00:00Z'),
    };
    expect(trialState(member, clock)).toBe('cancelled');
  });

  it('prestige cancelled + paid_until in past → expired', () => {
    const member: LoyaltyMember = {
      ...basePrestige,
      cancelledAt: new Date('2026-05-15T00:00:00Z'),
      paidUntil: new Date('2026-05-20T00:00:00Z'),
    };
    expect(trialState(member, clock)).toBe('expired');
  });

  it('prestige with no dates at all → expired (defensive)', () => {
    expect(trialState(basePrestige, clock)).toBe('expired');
  });

  it('boundary: now === trialEndsAt → still trialing', () => {
    const member: LoyaltyMember = {
      ...basePrestige,
      trialStartedAt: new Date('2026-05-01T00:00:00Z'),
      trialEndsAt: NOW,
    };
    expect(trialState(member, clock)).toBe('trialing');
  });
});

describe('canUpgradeToPrestige', () => {
  it('returns false when the upgrades flag is off', () => {
    expect(canUpgradeToPrestige(baseClub, clock, { prestigeUpgradesEnabled: false })).toBe(false);
  });

  it('returns false for anonymous users', () => {
    expect(canUpgradeToPrestige(null, clock, { prestigeUpgradesEnabled: true })).toBe(false);
  });

  it('returns true for club members when upgrades are enabled', () => {
    expect(canUpgradeToPrestige(baseClub, clock, { prestigeUpgradesEnabled: true })).toBe(true);
  });

  it('returns false for active prestige members', () => {
    const active: LoyaltyMember = {
      ...basePrestige,
      paidUntil: new Date('2027-01-01T00:00:00Z'),
    };
    expect(canUpgradeToPrestige(active, clock, { prestigeUpgradesEnabled: true })).toBe(false);
  });

  it('returns true for expired prestige members (resubscription path)', () => {
    const expired: LoyaltyMember = {
      ...basePrestige,
      paidUntil: new Date('2024-01-01T00:00:00Z'),
    };
    expect(canUpgradeToPrestige(expired, clock, { prestigeUpgradesEnabled: true })).toBe(true);
  });
});
