import { describe, expect, it } from 'vitest';

import { MIN_PUBLISHABLE_ENTRIES, resolveEffectivePublish } from './push-ranking-v2.js';

describe('resolveEffectivePublish — zero/thin ranking publish gate', () => {
  it('blocks publishing an empty ranking (the "0 hôtels" prod incident)', () => {
    expect(resolveEffectivePublish(true, 0)).toBe(false);
  });

  it('blocks publishing a thin ranking below the floor', () => {
    expect(resolveEffectivePublish(true, 1)).toBe(false);
    expect(resolveEffectivePublish(true, MIN_PUBLISHABLE_ENTRIES - 1)).toBe(false);
  });

  it('allows publishing at or above the floor', () => {
    expect(resolveEffectivePublish(true, MIN_PUBLISHABLE_ENTRIES)).toBe(true);
    expect(resolveEffectivePublish(true, 10)).toBe(true);
  });

  it('never publishes when the caller did not ask to, regardless of count', () => {
    expect(resolveEffectivePublish(false, 50)).toBe(false);
    expect(resolveEffectivePublish(false, 0)).toBe(false);
  });

  it('honours a custom floor (deliberate small curated ranking)', () => {
    expect(resolveEffectivePublish(true, 1, 1)).toBe(true);
    expect(resolveEffectivePublish(true, 2, 5)).toBe(false);
  });

  it('default floor matches the documented ≥3 eligibility policy', () => {
    expect(MIN_PUBLISHABLE_ENTRIES).toBe(3);
  });
});
