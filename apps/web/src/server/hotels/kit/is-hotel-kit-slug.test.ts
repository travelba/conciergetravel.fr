import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: {
    MCH_HOTEL_KIT_CATALOGUE_ROLLOUT: false,
  },
}));

import {
  HOTEL_KIT_VALIDATE_BATCH_SLUGS,
  isHotelKitSlug,
  isHotelKitValidateBatchSlug,
  shouldRenderHotelKitPage,
} from './is-hotel-kit-slug';

describe('isHotelKitSlug', () => {
  it('recognises pilot slugs', () => {
    expect(isHotelKitSlug('les-airelles-gordes')).toBe(true);
    expect(isHotelKitSlug('le-meurice')).toBe(false);
  });
});

describe('HOTEL_KIT_VALIDATE_BATCH_SLUGS', () => {
  it('lists four post-Airelles validation pilots', () => {
    expect(HOTEL_KIT_VALIDATE_BATCH_SLUGS).toHaveLength(4);
    expect(isHotelKitValidateBatchSlug('prince-de-galles-paris')).toBe(true);
    expect(isHotelKitValidateBatchSlug('les-airelles-gordes')).toBe(false);
  });
});

describe('shouldRenderHotelKitPage', () => {
  it('renders kit for pilot slugs when published', () => {
    expect(shouldRenderHotelKitPage('cheval-blanc-paris', true)).toBe(true);
  });

  it('skips unpublished hotels even when pilot', () => {
    expect(shouldRenderHotelKitPage('cheval-blanc-paris', false)).toBe(false);
  });

  it('skips catalogue hotels until rollout flag is on', () => {
    expect(shouldRenderHotelKitPage('le-meurice', true)).toBe(false);
  });
});
