import 'server-only';

import type {
  HotelDetail,
  HotelDetailRow,
  HotelRoomRow,
  SupportedLocale,
} from '@/server/hotels/get-hotel-by-slug';

/**
 * Dev/E2E-only synthetic hotel-detail fixture for `/[locale]/hotel/[slug]`.
 * Same activation contract as `dev-fake-hotel.ts`:
 *
 *  - Reads `MCH_E2E_FAKE_HOTEL_ID` (the canonical UUID exposed to the
 *    tests via `e2e/fixtures/env.ts`).
 *  - Both the FR slug (`hotel-de-test-e2e`) and the EN slug
 *    (`hotel-de-test-e2e-en`) resolve to the same synthetic detail.
 *  - The fake hotel is published, email-mode, located in Paris with
 *    real-looking lat/long so the JSON-LD `geo` block is exercised.
 *
 * The shape MUST stay aligned with `HotelDetailRow` — when that schema
 * changes the seam is the first thing to update. The `id` matches the
 * fake offer seam so the same hotel can drive the booking-email tunnel
 * spec too.
 */

export const FAKE_HOTEL_DETAIL_SLUG_FR = 'hotel-de-test-e2e';
export const FAKE_HOTEL_DETAIL_SLUG_EN = 'hotel-de-test-e2e-en';

function configuredFakeId(): string | undefined {
  const raw = process.env['MCH_E2E_FAKE_HOTEL_ID'];
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
}

function buildRow(_locale: SupportedLocale): HotelDetailRow {
  const id = configuredFakeId() ?? '00000000-0000-0000-0000-000000000000';
  return {
    id,
    slug: FAKE_HOTEL_DETAIL_SLUG_FR,
    slug_en: FAKE_HOTEL_DETAIL_SLUG_EN,
    name: 'Hôtel de Test (E2E)',
    name_en: 'Test Hotel (E2E)',
    stars: 5,
    is_palace: false,
    region: 'Île-de-France',
    department: 'Paris',
    city: 'Paris',
    district: '1er arrondissement',
    address: '1 rue de Rivoli',
    postal_code: '75001',
    latitude: 48.8566,
    longitude: 2.3522,
    description_fr:
      'Un hôtel fictif servant aux tests end-to-end. La description française décrit un établissement parisien intimiste idéal pour valider la fiche hôtel.\n\nDeuxième paragraphe pour exercer le rendu multi-paragraphe.',
    description_en:
      'A synthetic hotel used for end-to-end testing. This English description verifies locale fallback in the public detail page.',
    factual_summary_fr:
      'Hôtel-test Palace 5 étoiles situé Tuileries Paris, à 5 min du Louvre, avec spa privé, conciergerie 24/7 et restaurant gastronomique étoilé.',
    factual_summary_en:
      'Synthetic 5-star Palace test hotel in Tuileries Paris, 5 minutes from the Louvre, with private spa, 24/7 concierge and Michelin-starred restaurant.',
    hero_video: null,
    highlights: ['Vue sur les Tuileries', 'Spa privé', 'Conciergerie 24/7'],
    amenities: ['Wi-Fi gratuit', 'Petit-déjeuner inclus', 'Animaux acceptés'],
    faq_content: [
      {
        question_fr: 'Quel est l’horaire du check-in ?',
        question_en: 'What is the check-in time?',
        answer_fr:
          'Le check-in commence à 15h00, parfois plus tôt sur demande. Mes clients arrivés du Sud du pays profitent souvent du salon de l’étage pour patienter.',
        answer_en: 'From 3:00 PM, sometimes earlier on request.',
        category: 'before',
        featured: true,
        concierge_tip_fr: 'Si vous arrivez avant 11h, je peux vous garder vos bagages.',
        concierge_tip_en: 'If you land before 11am, I can keep your bags safe.',
      },
      {
        question_fr: 'Le petit-déjeuner est-il inclus ?',
        question_en: 'Is breakfast included?',
        answer_fr:
          'Oui, dans tous les tarifs. Service en chambre ou au restaurant entre 7h00 et 10h30 en semaine.',
        answer_en: 'Yes, included in every rate.',
        category: 'before',
        featured: true,
      },
      {
        question_fr: 'Les animaux sont-ils acceptés ?',
        question_en: 'Are pets allowed?',
        answer_fr:
          'Oui, les chiens jusqu’à 10 kg sont accueillis sans supplément. Panier et gamelle fournis.',
        answer_en: 'Yes, dogs under 10kg are welcome at no extra cost.',
        category: 'before',
        featured: true,
      },
      {
        question_fr: 'Quelle est la distance avec l’aéroport ?',
        question_en: 'How far from the airport?',
        answer_fr:
          'Comptez 45 minutes en taxi depuis Roissy-CDG, hors heures de pointe. Le service voiturier peut organiser votre transfert.',
        answer_en: 'About 45 minutes by taxi from Roissy-CDG.',
        category: 'before',
        featured: true,
        concierge_tip_fr:
          'Je vous réserve une voiture avec chauffeur, c’est plus serein qu’un Uber.',
      },
      {
        question_fr: 'Quels sont les horaires du spa ?',
        question_en: 'What are the spa hours?',
        answer_fr: 'Le spa est ouvert tous les jours de 10h00 à 21h00. Sauna et hammam inclus.',
        answer_en: 'The spa is open daily 10am-9pm.',
        category: 'during',
        featured: true,
      },
      {
        question_fr: 'La piscine est-elle chauffée ?',
        question_en: 'Is the pool heated?',
        answer_fr: 'Oui, la piscine extérieure est chauffée à 27 °C toute l’année.',
        answer_en: 'Yes, the outdoor pool is heated year-round at 27°C.',
        category: 'during',
      },
    ],
    meta_title_fr: null,
    meta_title_en: null,
    meta_desc_fr: null,
    meta_desc_en: null,
    // `email` so the booking section renders the "request via email" CTA
    // — keeps the fake hotel testable without firing any Amadeus stub.
    booking_mode: 'email',
    // Email-mode → no Amadeus property code. Sentiment fetch is skipped
    // upstream when this is null, which means E2E doesn't need to mock
    // any Amadeus rating endpoint.
    amadeus_hotel_id: null,
    priority: 'P1',
    google_rating: 4.7,
    google_reviews_count: 312,
    phone_e164: '+33199990000',
    telephone: null,
    price_range: null,
    price_from: null,
    aggregate_rating_value: null,
    aggregate_rating_count: null,
    aggregate_rating_source: null,
    // Editorial history (Phase 11.2). The synthetic E2E hotel inherits a
    // deterministic 2010 opening — old enough to populate the JSON-LD
    // `foundingDate` field but not so old it tempts smoke tests into
    // asserting on real historical hotels.
    opened_at: '2010-06-01',
    last_renovated_at: null,
    // No virtual tour for the synthetic E2E hotel — keeps the iframe
    // off the test page so smoke specs don't have to mock Matterport.
    virtual_tour_url: null,
    // Minimal MICE entry so the a11y scan can validate the section's
    // landmarks, headings, mailto CTA and structured `<dl>` list. The
    // payload is intentionally tiny (one space, two event types) so
    // it doesn't pollute the leisure-tunnel specs which assert against
    // the rooms grid, the FAQ and the booking CTA.
    mice_info: {
      summary_fr: 'Deux espaces événementiels privatifs au cœur de Paris pour vos réceptions.',
      summary_en: 'Two private event spaces in the heart of Paris for your receptions.',
      contact_email: 'events@hoteldetest.example',
      total_capacity_seated: 80,
      max_room_height_m: 4.2,
      event_types: ['corporate-meeting', 'wedding'],
      spaces: [
        {
          key: 'salon-test',
          name: 'Salon de Test',
          surface_sqm: 120,
          max_seated: 80,
          configurations: ['theatre', 'banquet'],
          has_natural_light: true,
        },
        {
          key: 'salle-conseil',
          name: 'Salle Conseil',
          surface_sqm: 40,
          max_seated: 20,
          configurations: ['boardroom', 'u-shape'],
          has_natural_light: false,
        },
      ],
    },
    // External identifiers + knowledge-graph anchors (migration 0025).
    // All `null` for the synthetic E2E fixture — the real Wikidata
    // enrichment cron never sees this row.
    wikidata_id: null,
    wikipedia_url_fr: null,
    wikipedia_url_en: null,
    tripadvisor_location_id: null,
    booking_com_hotel_id: null,
    expedia_property_id: null,
    hotels_com_hotel_id: null,
    agoda_hotel_id: null,
    official_url: null,
    email_reservations: null,
    commons_category: null,
    external_sameas: null,
    country_code: 'FR',
    country_label_fr: 'France',
    country_label_en: 'France',
    luxury_tier: null,
    // Voix Concierge (ADR-0011) — synthetic advice so the E2E spec can
    // assert the <ConciergeAdvice> block renders. Stays within the
    // 50-110 word envelope enforced by the Zod schema upstream.
    concierge_advice: {
      fr: {
        title: 'Demandez la chambre 305 si vous arrivez en train',
        body: "Mon conseil : à la réservation, demandez la chambre 305. Elle ouvre sur la cour intérieure côté ouest, donc le soleil de fin d'après-midi entre jusqu'à dix-huit heures. Le lit fait face à la fenêtre, pas au couloir, et le bureau Louis-Philippe d'origine reste en place. Précisez « arrivée Gare de Lyon » au check-in : le concierge prévient la voiturière, votre valise monte en chambre avant même que vous ayez signé.",
        tip_for: 'room',
      },
      en: {
        title: 'Ask for room 305 if you arrive by train',
        body: "My tip: when you book, ask specifically for room 305. It opens onto the inner courtyard on the west side, so the late afternoon sun reaches it until six. The bed faces the window, not the corridor, and the original Louis-Philippe writing desk is still in place. Mention 'arriving Gare de Lyon' at check-in: the concierge alerts the valet, your luggage goes up before you've signed.",
        tip_for: 'room',
      },
    },
    // Three POIs covering the three editorial buckets (visit / do /
    // shop) so the E2E spec can verify the bucket sections render with
    // the Concierge-voice copy + tip fallback (WS5 phase 1). No
    // `bucket_tip_fr` is set on purpose — the spec exercises the i18n
    // fallback path. The humanizer-populated path is covered later by
    // the audit script (WS5 phase 2).
    points_of_interest: [
      {
        name: 'Musée du Louvre',
        type: 'museum',
        category_fr: 'Musée',
        distance_meters: 350,
        walk_minutes: 5,
        latitude: 48.8606,
        longitude: 2.3376,
        bucket: 'visit',
        description_fr: 'Le musée le plus visité au monde, à cinq minutes à pied.',
        schema_type: 'https://schema.org/Museum',
        osm_id: 'node/test-louvre',
      },
      {
        name: 'Comptoir de la Gastronomie',
        type: 'restaurant',
        category_fr: 'Restaurant',
        distance_meters: 220,
        walk_minutes: 3,
        latitude: 48.8628,
        longitude: 2.3457,
        bucket: 'do',
        osm_id: 'node/test-resto',
      },
      {
        name: 'Pharmacie du Marché Saint-Honoré',
        type: 'pharmacy',
        category_fr: 'Pharmacie',
        distance_meters: 180,
        walk_minutes: 3,
        latitude: 48.8669,
        longitude: 2.3343,
        bucket: 'shop',
        schema_type: 'https://schema.org/Pharmacy',
        osm_id: 'node/test-pharmacy',
      },
    ],
    // One upcoming event so the events block exercises the Concierge
    // tip fallback + the standalone `Event` JSON-LD node.
    upcoming_events: [
      {
        name: 'Nuit Blanche Paris',
        start_date: '2099-10-04',
        end_date: '2099-10-05',
        venue_name: 'Île de la Cité',
        venue_address: 'Île de la Cité, 75001 Paris',
        latitude: 48.854,
        longitude: 2.347,
        distance_meters: 700,
        category: 'festival',
        description_fr: 'Parcours artistique nocturne dans Paris, ouvert au public.',
      },
    ],
    is_published: true,
    updated_at: '2026-05-01T10:00:00.000Z',
    // Inventory counts surface in JSON-LD Hotel.numberOfRooms and the
    // HotelFactSheet UI. Synthetic values for the E2E hotel are fine; the
    // JSON-LD only emits them when positive.
    number_of_rooms: 80,
    number_of_suites: 12,
    // No hero/gallery for the E2E synthetic hotel — keeps the fake
    // testable without Cloudinary credentials at build time.
    hero_image: null,
  };
}

function buildRooms(): readonly HotelRoomRow[] {
  return [
    {
      id: '22222222-2222-4222-8222-222222222222',
      slug: 'chambre-deluxe-roi',
      room_code: 'TEST-KING',
      name: 'Chambre Deluxe Roi',
      description: 'Vue jardin, lit king-size, salle de bain en marbre.',
      max_occupancy: 2,
      bed_type: 'King',
      size_sqm: 35,
      amenities: ['Vue jardin', 'Lit king-size', 'Salle de bain marbre'],
      isSignature: false,
      indicativePrice: { fromMinor: 95000, toMinor: 130000, currency: 'EUR' },
      displayOrder: 20,
      cardImagePublicId: null,
      cardImageAlt: null,
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      slug: 'suite-junior-tuileries',
      room_code: 'TEST-SUITE',
      name: 'Suite Junior Tuileries',
      description: 'Vue Tuileries, salon séparé, bain à remous.',
      max_occupancy: 3,
      bed_type: 'King',
      size_sqm: 55,
      amenities: ['Vue Tuileries', 'Salon séparé', 'Bain à remous'],
      isSignature: true,
      indicativePrice: { fromMinor: 220000, toMinor: null, currency: 'EUR' },
      displayOrder: 10,
      cardImagePublicId: null,
      cardImageAlt: null,
    },
  ];
}

export function isFakeHotelDetailEnabled(): boolean {
  return configuredFakeId() !== undefined;
}

/**
 * Returns the synthetic detail when the seam is enabled AND the slug
 * matches one of the fake slugs. Returns `null` otherwise so the
 * caller falls through to the real Supabase lookup.
 */
export function getFakeHotelDetailBySlug(
  slug: string,
  locale: SupportedLocale,
): HotelDetail | null {
  if (!isFakeHotelDetailEnabled()) return null;
  if (slug !== FAKE_HOTEL_DETAIL_SLUG_FR && slug !== FAKE_HOTEL_DETAIL_SLUG_EN) return null;
  return { row: buildRow(locale), rooms: buildRooms() };
}
