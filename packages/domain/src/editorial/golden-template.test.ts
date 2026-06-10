import { describe, expect, it } from 'vitest';

import {
  categoryOfSection,
  countCannibalizingSections,
  countCompleteVenues,
  detectFabricatedStarClaim,
  dropCannibalizingSections,
  dropDuplicateCategorySections,
  evaluatePoiBuckets,
  evaluatePoiImages,
  evaluatePoiHandoff,
  evaluateSpaDossier,
  evaluateVenueHandoff,
  hasVerifiedMichelinAward,
  isDuplicateCategorySection,
  resolvePopulatedBlocks,
} from './golden-template';

describe('venue handoff', () => {
  it('is complete with a name, a contact path and a tip', () => {
    const r = evaluateVenueHandoff({
      name: 'Clover Gordes',
      reservation_url: 'https://example.com',
      tip_fr: 'Mon conseil : réservez en terrasse.',
    });
    expect(r.complete).toBe(true);
    expect(r.hasContact).toBe(true);
  });

  it('is incomplete without a tip', () => {
    const r = evaluateVenueHandoff({ name: 'X', phone: '+33 1' });
    expect(r.complete).toBe(false);
  });

  it('counts complete venues in restaurant_info', () => {
    const out = countCompleteVenues({
      venues: [{ name: 'A', website: 'https://a', tip_fr: 't' }, { name: 'B' }],
    });
    expect(out).toEqual({ total: 2, complete: 1 });
  });
});

describe('poi handoff + buckets', () => {
  it('is complete with name, bucket, distance, description and tip', () => {
    const r = evaluatePoiHandoff({
      name: 'Château de Gordes',
      bucket: 'visit',
      distance_meters: 400,
      description_fr: 'Château Renaissance.',
      tip_fr: 'Mon conseil : 6 minutes à pied.',
    });
    expect(r.complete).toBe(true);
    expect(r.bucket).toBe('visit');
  });

  it('flags all three buckets covered', () => {
    const cov = evaluatePoiBuckets([
      { name: 'a', bucket: 'visit', distance_meters: 1, description_fr: 'd', tip_fr: 't' },
      { name: 'b', bucket: 'do', walk_minutes: 5, description_fr: 'd', tip_fr: 't' },
      { name: 'c', bucket: 'shop', distance_meters: 1, description_fr: 'd', tip_fr: 't' },
    ]);
    expect(cov.allBucketsCovered).toBe(true);
    expect(cov.complete).toBe(3);
  });

  it('reports missing bucket coverage', () => {
    const cov = evaluatePoiBuckets([{ name: 'a', bucket: 'visit', distance_meters: 1 }]);
    expect(cov.allBucketsCovered).toBe(false);
  });

  it('counts POIs with image_public_id', () => {
    const cov = evaluatePoiImages([
      { name: 'a', image_public_id: 'cct/hotels/x/poi-a' },
      { name: 'b' },
    ]);
    expect(cov).toEqual({ total: 2, withImage: 1 });
  });
});

describe('spa dossier', () => {
  it('is complete with description + hours + contact + tip', () => {
    const r = evaluateSpaDossier({
      description_fr: 'Sous voûtes de pierre.',
      hours_fr: '10h-20h',
      phone: '+33 4',
      tip_fr: 'Mon conseil : après 17h.',
    });
    expect(r.complete).toBe(true);
  });
});

describe('duplicate category sections', () => {
  it('detects a dining anchor', () => {
    expect(isDuplicateCategorySection({ anchor: 'restauration' })).toBe(true);
  });

  it('detects via title keyword', () => {
    expect(isDuplicateCategorySection({ title_fr: 'Bien-être & spa' })).toBe(true);
  });

  it('keeps a genuine narrative section', () => {
    const sections = [
      { anchor: 'histoire', title_fr: 'Une bastide du XVIIIe' },
      { anchor: 'spa', title_fr: 'Spa' },
    ];
    expect((dropDuplicateCategorySections(sections) as unknown[]).length).toBe(1);
  });
});

describe('conditional cannibalisation (only when block populated)', () => {
  const importedSections = [
    { anchor: 'presentation', title_fr: 'Présentation' },
    { anchor: 'restauration', title_fr: 'Restauration' },
    { anchor: 'bien-etre-spa', title_fr: 'Bien-être & spa' },
    { anchor: 'a-deux-pas', title_fr: 'À deux pas' },
    { anchor: 'service-equipe', title_fr: 'Service & équipe' },
    { anchor: 'notre-verdict', title_fr: 'Notre verdict' },
  ];

  it('categorises sections', () => {
    expect(categoryOfSection({ anchor: 'restauration' })).toBe('dining');
    expect(categoryOfSection({ anchor: 'bien-etre-spa' })).toBe('spa');
    expect(categoryOfSection({ anchor: 'a-deux-pas' })).toBe('location');
    expect(categoryOfSection({ anchor: 'service-equipe' })).toBeNull();
    expect(categoryOfSection({ anchor: 'presentation' })).toBeNull();
  });

  it('counts ZERO cannibalising sections when blocks are empty (bare catalogue fiche)', () => {
    const blocks = resolvePopulatedBlocks({
      restaurantInfo: null,
      spaInfo: null,
      pointsOfInterest: [],
    });
    expect(countCannibalizingSections(importedSections, blocks)).toBe(0);
    expect((dropCannibalizingSections(importedSections, blocks) as unknown[]).length).toBe(
      importedSections.length,
    );
  });

  it('counts only the dining section when restaurant_info is populated', () => {
    const blocks = resolvePopulatedBlocks({
      restaurantInfo: { venues: [{ name: 'X', website: 'https://x', tip_fr: 't' }] },
      spaInfo: null,
      pointsOfInterest: [],
    });
    expect(countCannibalizingSections(importedSections, blocks)).toBe(1);
  });

  it('drops dining + spa + location when all rich blocks exist (golden fiche)', () => {
    const blocks = resolvePopulatedBlocks({
      restaurantInfo: { venues: [{ name: 'X', website: 'https://x', tip_fr: 't' }] },
      spaInfo: { description_fr: 'Sous voûtes.' },
      pointsOfInterest: [
        { name: 'a', bucket: 'visit', distance_meters: 1, description_fr: 'd', tip_fr: 't' },
      ],
    });
    const kept = dropCannibalizingSections(importedSections, blocks) as unknown[];
    // presentation + service-equipe + notre-verdict survive (service never cannibalises).
    expect(kept.length).toBe(3);
  });

  it('never treats a service narrative as cannibalising the amenities list', () => {
    const blocks: ReturnType<typeof resolvePopulatedBlocks> = {
      dining: true,
      spa: true,
      location: true,
    };
    expect(countCannibalizingSections([{ anchor: 'service-equipe' }], blocks)).toBe(0);
  });
});

describe('fabricated star sentinel', () => {
  it('flags a Michelin-star claim with no verified award', () => {
    expect(
      detectFabricatedStarClaim(['Clover Gordes compte 1 étoile au Guide Michelin.'], []),
    ).toBe(true);
  });

  it('does not flag when a verified Michelin award exists', () => {
    const awards = [{ verified: true, issuer: 'Guide MICHELIN' }];
    expect(hasVerifiedMichelinAward(awards)).toBe(true);
    expect(detectFabricatedStarClaim(['table 1 étoile Michelin'], awards)).toBe(false);
  });

  it('ignores neutral prose', () => {
    expect(detectFabricatedStarClaim(['Cuisine provençale de saison.'], [])).toBe(false);
  });
});
