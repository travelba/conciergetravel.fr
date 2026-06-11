import { describe, expect, it } from 'vitest';

import { KIT_PO_REMARK_REGISTRY } from './kit-po-remark-registry.js';
import {
  evaluateKitAcceptanceGates,
  orderKitVisibleRoomSlugs,
  visibleKitRoomSlugs,
} from './kit-fiche-acceptance-gates.js';

const NOW = Date.parse('2026-06-10T12:00:00.000Z');

function wave5StubInput(slug: string) {
  return {
    slug,
    name: 'Test Hotel',
    concierge_pick: { slug: 'seine-junior-suite', note: { fr: 'Note FR', en: 'Note EN' } },
    gallery_images: [
      { url: 'https://example.com/same.jpg', category: 'spa', alt_fr: 'spa test' },
      { url: 'https://example.com/same.jpg', category: 'dining', alt_fr: 'restaurant test' },
    ],
    google_reviews: [
      {
        author: 'A',
        rating: 5,
        text: 'Long enough review text here.',
        publish_time: '2024-01-01T00:00:00.000Z',
      },
    ],
    last_reviews_sync: null,
    faq_content_kit: [{ question_fr: 'Q1', answer_fr: 'A1' }],
    faq_content: [{ question_fr: 'Q1', answer_fr: 'A1' }],
    concierge_questions: [
      {
        category_fr: 'Réservations de restaurants',
        category_en: 'Restaurant bookings',
        question_fr: 'Q',
        reply_fr: 'Je réserve pour vous.',
      },
    ],
    signature_experiences: [
      {
        key: 'exp-1',
        title_fr: 'T',
        title_en: 'T',
        description_fr: 'D',
        description_en: 'D',
        booking_required: false,
      },
    ],
    points_of_interest: [],
    rooms: [
      { slug: 'deluxe-room', imageCount: 0 },
      { slug: 'eiffel-suite', imageCount: 0 },
      { slug: 'louvre-deluxe-room', imageCount: 0 },
      { slug: 'seine-junior-suite', imageCount: 0 },
    ],
  };
}

describe('KIT_PO_REMARK_REGISTRY', () => {
  it('covers all five wave-5 PO themes', () => {
    const remarks = KIT_PO_REMARK_REGISTRY.map((e) => e.remark);
    expect(remarks.some((r) => r.includes('chambre'))).toBe(true);
    expect(remarks.some((r) => r.includes('Concierge chambre'))).toBe(true);
    expect(remarks.some((r) => r.includes('expérience') || r.includes('restaurant'))).toBe(true);
    expect(remarks.some((r) => r.includes('FAQ'))).toBe(true);
    expect(remarks.some((r) => r.includes('Avis Google'))).toBe(true);
  });
});

describe('orderKitVisibleRoomSlugs', () => {
  it('puts concierge pick first among visible three', () => {
    const slugs = ['deluxe-room', 'junior-suite', 'terrace-eiffel-view-room', 'superior-room'];
    expect(visibleKitRoomSlugs(slugs)).toEqual([
      'deluxe-room',
      'junior-suite',
      'terrace-eiffel-view-room',
    ]);
    expect(orderKitVisibleRoomSlugs(slugs, 'terrace-eiffel-view-room')).toEqual([
      'terrace-eiffel-view-room',
      'deluxe-room',
      'junior-suite',
    ]);
  });
});

describe('evaluateKitAcceptanceGates', () => {
  it('fails wave-5 pattern across all PO remark gate families', () => {
    const checks = evaluateKitAcceptanceGates(wave5StubInput('cheval-blanc-paris'), NOW);
    const failed = checks.filter((c) => !c.passed).map((c) => c.id);

    expect(failed).toContain('kit.02.chambres_pick_first_visible');
    expect(failed).toContain('kit.02.chambres_visible_have_photo');
    expect(failed).toContain('kit.02.chambres_pick_has_photo');
    expect(failed).toContain('kit.11.faq_kit_not_stub');
    expect(failed).toContain('kit.11.faq_kit_count');
    expect(failed).toContain('kit.11.concierge_questions_count');
    expect(failed.some((id) => id.startsWith('kit.11.concierge_informative_tone'))).toBe(true);
    expect(failed).toContain('kit.02.gallery_no_duplicate_source_url');
    expect(failed).toContain('kit.10.gmb_review_count');
    expect(failed).toContain('kit.10.gmb_sync_fresh');
    expect(failed).toContain('kit.10.gmb_display_triplet_fresh');
    expect(failed).toContain('kit.03.signature_experiences_dedicated_image');
    expect(failed).toContain('kit.16.room_batch_script');
    expect(failed).toContain('kit.16.room_display_module');
    expect(failed).toContain('kit.19.closure_audit_exit_zero');
  });

  it('passes chambres + GMB gates when pick-first and photos present', () => {
    const checks = evaluateKitAcceptanceGates(
      {
        slug: 'prince-de-galles-paris',
        name: 'Prince de Galles',
        concierge_pick: {
          slug: 'chambre-art-deco-deluxe-balcon',
          note: { fr: 'Pick', en: 'Pick' },
        },
        gallery_images: (() => {
          const cats = [
            'exterior',
            'lobby',
            'room',
            'dining',
            'spa',
            'pool',
            'view',
            'detail',
            'concierge',
            'events',
          ] as const;
          return Array.from({ length: 30 }, (_, i) => {
            const category = cats[i % cats.length] ?? 'exterior';
            const alt =
              category === 'spa'
                ? 'Spa wellness Prince de Galles Paris'
                : category === 'dining'
                  ? 'Restaurant bar Prince de Galles Paris'
                  : category === 'room'
                    ? 'Chambre suite Prince de Galles Paris'
                    : `Vue ${category} Prince de Galles Paris`;
            return { url: `https://example.com/pdg-${i}.jpg`, category, alt_fr: alt };
          });
        })(),
        google_reviews: Array.from({ length: 3 }, (_, i) => ({
          author: `User ${i}`,
          rating: 5,
          text: 'Substantive traveler review comment.',
          publish_time: '2026-05-01T00:00:00.000Z',
        })),
        last_reviews_sync: '2026-06-01T00:00:00.000Z',
        faq_content_kit: [],
        faq_content: [],
        concierge_questions: [],
        signature_experiences: Array.from({ length: 4 }, (_, i) => ({
          key: `exp-${i}`,
          title_fr: 'T',
          title_en: 'T',
          description_fr: 'D',
          description_en: 'D',
          booking_required: false,
          image_public_id: `cct/hotels/prince-de-galles-paris/press-${i + 1}`,
        })),
        points_of_interest: [],
        orderedRoomSlugs: ['chambre-art-deco-deluxe-balcon', 'suite-or', 'chambre-art-deco-deluxe'],
        rooms: [
          { slug: 'chambre-art-deco-deluxe-balcon', imageCount: 2 },
          { slug: 'suite-or', imageCount: 1 },
          { slug: 'chambre-art-deco-deluxe', imageCount: 1 },
        ],
      },
      NOW,
    );

    const roomGmbIds = [
      'kit.02.chambres_pick_first_visible',
      'kit.02.chambres_visible_have_photo',
      'kit.02.chambres_pick_has_photo',
      'kit.02.concierge_pick_note',
      'kit.10.gmb_review_count',
      'kit.10.gmb_review_recency',
      'kit.10.gmb_sync_fresh',
      'kit.10.gmb_display_triplet_fresh',
    ];
    for (const id of roomGmbIds) {
      expect(checks.find((c) => c.id === id)?.passed).toBe(true);
    }
  });

  it('ignores non-kit slugs', () => {
    expect(evaluateKitAcceptanceGates(wave5StubInput('le-meurice'))).toEqual([]);
  });
});
