import { describe, expect, it } from 'vitest';

import {
  buildPrinceDeGallesRoomAuditContext,
  kitPrinceDeGallesVisibleRoomSlugs,
} from './kit-pilot-room-catalog';
import { PRINCE_DE_GALLES_CONCIERGE_PICK_SLUG } from './prince-de-galles-rooms';

describe('kitPrinceDeGallesVisibleRoomSlugs', () => {
  it('puts concierge pick first among visible cards', () => {
    const slugs = [
      'chambre-art-deco-deluxe',
      'chambre-art-deco-deluxe-balcon',
      'suite-or',
      'suite-lalique',
    ];
    const visible = kitPrinceDeGallesVisibleRoomSlugs(slugs);
    expect(visible[0]).toBe(PRINCE_DE_GALLES_CONCIERGE_PICK_SLUG);
    expect(visible).toEqual(['chambre-art-deco-deluxe-balcon', 'suite-or', 'suite-lalique']);
  });
});

describe('buildPrinceDeGallesRoomAuditContext', () => {
  it('counts curated room heroes for image gate', () => {
    const ctx = buildPrinceDeGallesRoomAuditContext([
      { slug: 'chambre-art-deco-deluxe-balcon', imageCount: 0 },
      { slug: 'suite-or', imageCount: 0 },
    ]);
    expect(ctx.orderedRoomSlugs[0]).toBe('chambre-art-deco-deluxe-balcon');
    expect(ctx.rooms.find((r) => r.slug === 'chambre-art-deco-deluxe-balcon')?.imageCount).toBe(1);
  });
});
