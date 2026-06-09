import { describe, expect, it } from 'vitest';

import { formatGoogleReviewDate } from '@/lib/format-google-review-date';
import { enrichAirellesRoomRow } from '@/server/hotels/enrich-airelles-rooms';
import type { HotelRoomRow } from '@/server/hotels/get-hotel-by-slug';

describe('formatGoogleReviewDate', () => {
  it('formats ISO publish_time for FR and EN', () => {
    expect(formatGoogleReviewDate('2026-01-10T12:00:00Z', 'fr')).toMatch(/2026/);
    expect(formatGoogleReviewDate('2026-01-10T12:00:00Z', 'en')).toMatch(/2026/);
  });

  it('returns null for invalid input', () => {
    expect(formatGoogleReviewDate(null, 'fr')).toBeNull();
    expect(formatGoogleReviewDate('not-a-date', 'en')).toBeNull();
  });
});

describe('enrichAirellesRoomRow', () => {
  const baseRoom: HotelRoomRow = {
    id: 'room-1',
    slug: 'deluxe-room-valley-side',
    room_code: 'deluxe-room-valley-side',
    name: null,
    description: null,
    max_occupancy: null,
    bed_type: null,
    size_sqm: null,
    amenities: [],
    isSignature: false,
    indicativePrice: null,
    displayOrder: null,
    cardImagePublicId: null,
    cardImageAlt: null,
    galleryImages: [],
  };

  it('backfills photo, surface and bed from golden catalogue', () => {
    const enriched = enrichAirellesRoomRow(baseRoom, 'fr');
    expect(enriched.galleryImages).toHaveLength(1);
    expect(enriched.size_sqm).toBe(34);
    expect(enriched.bed_type).toContain('King');
    expect(enriched.name).toContain('Deluxe');
  });

  it('localises bed type for EN', () => {
    const enriched = enrichAirellesRoomRow(baseRoom, 'en');
    expect(enriched.bed_type).toContain('King-size');
  });
});
