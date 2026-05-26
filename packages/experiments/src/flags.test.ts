import { describe, expect, it } from 'vitest';

import { applyEnvOverrides, getDefaultFlags, parseFlagsPayload } from './flags';

describe('@mch/experiments — flags', () => {
  it('returns defaults that are all off for Phase 1', () => {
    const flags = getDefaultFlags();
    expect(flags.member_price_differential_enabled).toBe(false);
    expect(flags.little_personalization_enabled).toBe(false);
  });

  it('parses a well-formed payload', () => {
    const flags = parseFlagsPayload({
      member_price_differential_enabled: true,
      little_personalization_enabled: true,
    });
    expect(flags.member_price_differential_enabled).toBe(true);
    expect(flags.little_personalization_enabled).toBe(true);
  });

  it('falls back to defaults when the payload is malformed', () => {
    const flags = parseFlagsPayload({
      member_price_differential_enabled: 'oui',
      little_personalization_enabled: 42,
    });
    expect(flags).toEqual(getDefaultFlags());
  });

  it('keeps unknown keys out of the result', () => {
    const flags = parseFlagsPayload({
      member_price_differential_enabled: true,
      mystery_flag: true,
    });
    expect(flags).not.toHaveProperty('mystery_flag');
    expect(flags.member_price_differential_enabled).toBe(true);
  });

  it('applies env overrides with true/1', () => {
    const base = getDefaultFlags();
    const next = applyEnvOverrides(base, {
      MCH_EXPERIMENT_MEMBER_PRICE_DIFFERENTIAL_ENABLED: 'true',
      MCH_EXPERIMENT_LITTLE_PERSONALIZATION_ENABLED: '1',
    });
    expect(next.member_price_differential_enabled).toBe(true);
    expect(next.little_personalization_enabled).toBe(true);
  });

  it('applies env overrides with false/0', () => {
    const base = {
      member_price_differential_enabled: true,
      little_personalization_enabled: true,
    };
    const next = applyEnvOverrides(base, {
      MCH_EXPERIMENT_MEMBER_PRICE_DIFFERENTIAL_ENABLED: 'false',
      MCH_EXPERIMENT_LITTLE_PERSONALIZATION_ENABLED: '0',
    });
    expect(next.member_price_differential_enabled).toBe(false);
    expect(next.little_personalization_enabled).toBe(false);
  });

  it('ignores unknown env values', () => {
    const base = getDefaultFlags();
    const next = applyEnvOverrides(base, {
      MCH_EXPERIMENT_MEMBER_PRICE_DIFFERENTIAL_ENABLED: 'maybe',
    });
    expect(next).toEqual(base);
  });
});
