/**
 * amenities-taxonomy.ts — canonical bilingual amenity universe for the
 * CDC §2 bloc 6 montée (target ≥ 80 attributs).
 *
 * Each entry reuses the stable `key` taxonomy from the web app
 * (`apps/web/src/server/hotels/amenity-taxonomy.ts`) where one already
 * exists, so the public AmenityGrid categorises it correctly. New keys
 * introduced here render under the `other` group on the web until they
 * are back-ported into the web taxonomy (tracked as a follow-up).
 *
 * `baseline: true` marks amenities that are near-universal across the
 * curated luxury catalogue (4-5★ / Palace / Relais & Châteaux). The
 * enrichment pipeline always includes the baseline set so every fiche
 * clears the Phase 1 floor (≥ 12) without an LLM call; the classifier
 * then adds the category-specific amenities it can ground from the
 * hotel brief (anti-fabrication: the LLM only SELECTS from this closed
 * list, it never invents a new amenity).
 *
 * Skill: editorial-pilot, content-modeling, content-enrichment-pipeline.
 */

export type AmenityCategory =
  | 'wellness'
  | 'dining'
  | 'services'
  | 'rooms'
  | 'family'
  | 'connectivity'
  | 'business'
  | 'accessibility'
  | 'sustainability'
  | 'other';

export interface CanonicalAmenity {
  readonly key: string;
  readonly category: AmenityCategory;
  readonly label_fr: string;
  readonly label_en: string;
  /** Near-universal across the curated luxury catalogue — always included. */
  readonly baseline?: boolean;
}

export const AMENITIES_TAXONOMY: readonly CanonicalAmenity[] = [
  // ── services (baseline-heavy) ──
  {
    key: 'concierge_24h',
    category: 'services',
    label_fr: 'Conciergerie 24h/24',
    label_en: '24-hour concierge',
    baseline: true,
  },
  {
    key: 'reception_24h',
    category: 'services',
    label_fr: 'Réception 24h/24',
    label_en: '24-hour front desk',
    baseline: true,
  },
  {
    key: 'daily_housekeeping',
    category: 'services',
    label_fr: 'Service de chambre quotidien',
    label_en: 'Daily housekeeping',
    baseline: true,
  },
  {
    key: 'housekeeping_twice_daily',
    category: 'services',
    label_fr: 'Service de chambre deux fois par jour',
    label_en: 'Twice-daily housekeeping',
  },
  {
    key: 'turndown_service',
    category: 'services',
    label_fr: 'Service de couverture',
    label_en: 'Turndown service',
    baseline: true,
  },
  {
    key: 'luggage_storage',
    category: 'services',
    label_fr: 'Consigne à bagages',
    label_en: 'Luggage storage',
    baseline: true,
  },
  {
    key: 'laundry',
    category: 'services',
    label_fr: 'Blanchisserie',
    label_en: 'Laundry service',
    baseline: true,
  },
  {
    key: 'dry_cleaning',
    category: 'services',
    label_fr: 'Nettoyage à sec',
    label_en: 'Dry cleaning',
  },
  { key: 'valet', category: 'services', label_fr: 'Voiturier', label_en: 'Valet parking' },
  {
    key: 'butler_service',
    category: 'services',
    label_fr: 'Service de majordome',
    label_en: 'Butler service',
  },
  {
    key: 'airport_shuttle',
    category: 'services',
    label_fr: 'Navette aéroport',
    label_en: 'Airport shuttle',
  },
  {
    key: 'limousine_service',
    category: 'services',
    label_fr: 'Service de limousine',
    label_en: 'Limousine service',
  },
  {
    key: 'car_rental',
    category: 'services',
    label_fr: 'Location de voiture',
    label_en: 'Car rental desk',
  },
  { key: 'florist', category: 'services', label_fr: 'Fleuriste', label_en: 'Florist' },
  {
    key: 'shoe_shine',
    category: 'services',
    label_fr: 'Cirage de chaussures',
    label_en: 'Shoeshine service',
  },
  {
    key: 'wake_up_service',
    category: 'services',
    label_fr: 'Service de réveil',
    label_en: 'Wake-up service',
    baseline: true,
  },
  {
    key: 'currency_exchange',
    category: 'services',
    label_fr: 'Change de devises',
    label_en: 'Currency exchange',
  },
  {
    key: 'multilingual_staff',
    category: 'services',
    label_fr: 'Personnel multilingue',
    label_en: 'Multilingual staff',
    baseline: true,
  },
  {
    key: 'tour_desk',
    category: 'services',
    label_fr: 'Bureau d’excursions',
    label_en: 'Tour desk',
  },
  { key: 'gift_shop', category: 'services', label_fr: 'Boutique', label_en: 'Gift shop' },

  // ── wellness ──
  { key: 'spa', category: 'wellness', label_fr: 'Spa', label_en: 'Spa' },
  {
    key: 'indoor_pool',
    category: 'wellness',
    label_fr: 'Piscine intérieure',
    label_en: 'Indoor pool',
  },
  {
    key: 'outdoor_pool',
    category: 'wellness',
    label_fr: 'Piscine extérieure',
    label_en: 'Outdoor pool',
  },
  {
    key: 'heated_pool',
    category: 'wellness',
    label_fr: 'Piscine chauffée',
    label_en: 'Heated pool',
  },
  {
    key: 'fitness',
    category: 'wellness',
    label_fr: 'Salle de fitness',
    label_en: 'Fitness centre',
  },
  {
    key: 'personal_trainer',
    category: 'wellness',
    label_fr: 'Coach personnel',
    label_en: 'Personal trainer',
  },
  { key: 'hammam', category: 'wellness', label_fr: 'Hammam', label_en: 'Hammam' },
  { key: 'sauna', category: 'wellness', label_fr: 'Sauna', label_en: 'Sauna' },
  { key: 'jacuzzi', category: 'wellness', label_fr: 'Jacuzzi', label_en: 'Hot tub' },
  { key: 'yoga', category: 'wellness', label_fr: 'Cours de yoga', label_en: 'Yoga classes' },
  { key: 'massage', category: 'wellness', label_fr: 'Massages', label_en: 'Massage treatments' },
  {
    key: 'hair_salon',
    category: 'wellness',
    label_fr: 'Salon de coiffure',
    label_en: 'Hair salon',
  },
  {
    key: 'beauty_salon',
    category: 'wellness',
    label_fr: 'Institut de beauté',
    label_en: 'Beauty salon',
  },

  // ── dining ──
  {
    key: 'restaurant',
    category: 'dining',
    label_fr: 'Restaurant',
    label_en: 'Restaurant',
    baseline: true,
  },
  {
    key: 'michelin_restaurant',
    category: 'dining',
    label_fr: 'Restaurant étoilé Michelin',
    label_en: 'Michelin-starred restaurant',
  },
  {
    key: 'fine_dining',
    category: 'dining',
    label_fr: 'Restaurant gastronomique',
    label_en: 'Fine-dining restaurant',
  },
  {
    key: 'breakfast',
    category: 'dining',
    label_fr: 'Petit-déjeuner',
    label_en: 'Breakfast service',
    baseline: true,
  },
  { key: 'bar', category: 'dining', label_fr: 'Bar', label_en: 'Bar', baseline: true },
  { key: 'rooftop_bar', category: 'dining', label_fr: 'Bar sur le toit', label_en: 'Rooftop bar' },
  { key: 'lounge', category: 'dining', label_fr: 'Salon', label_en: 'Lounge' },
  {
    key: 'cigar_lounge',
    category: 'dining',
    label_fr: 'Fumoir à cigares',
    label_en: 'Cigar lounge',
  },
  {
    key: 'afternoon_tea',
    category: 'dining',
    label_fr: 'Afternoon tea',
    label_en: 'Afternoon tea',
  },
  {
    key: 'room_service_24h',
    category: 'dining',
    label_fr: 'Room service 24h/24',
    label_en: '24-hour room service',
  },
  { key: 'wine_cellar', category: 'dining', label_fr: 'Cave à vin', label_en: 'Wine cellar' },
  {
    key: 'private_dining',
    category: 'dining',
    label_fr: 'Salle à manger privée',
    label_en: 'Private dining room',
  },

  // ── rooms (in-room comfort) ──
  {
    key: 'air_conditioning',
    category: 'rooms',
    label_fr: 'Climatisation',
    label_en: 'Air conditioning',
    baseline: true,
  },
  { key: 'minibar', category: 'rooms', label_fr: 'Minibar', label_en: 'Minibar', baseline: true },
  {
    key: 'in_room_safe',
    category: 'rooms',
    label_fr: 'Coffre-fort en chambre',
    label_en: 'In-room safe',
    baseline: true,
  },
  {
    key: 'nespresso_machine',
    category: 'rooms',
    label_fr: 'Machine Nespresso',
    label_en: 'Nespresso machine',
    baseline: true,
  },
  {
    key: 'flat_screen_tv',
    category: 'rooms',
    label_fr: 'Télévision écran plat',
    label_en: 'Flat-screen TV',
    baseline: true,
  },
  {
    key: 'bathrobes_slippers',
    category: 'rooms',
    label_fr: 'Peignoirs et chaussons',
    label_en: 'Bathrobes and slippers',
    baseline: true,
  },
  {
    key: 'premium_toiletries',
    category: 'rooms',
    label_fr: 'Produits d’accueil de luxe',
    label_en: 'Premium toiletries',
    baseline: true,
  },
  {
    key: 'pillow_menu',
    category: 'rooms',
    label_fr: 'Carte des oreillers',
    label_en: 'Pillow menu',
  },
  {
    key: 'blackout_curtains',
    category: 'rooms',
    label_fr: 'Rideaux occultants',
    label_en: 'Blackout curtains',
    baseline: true,
  },
  {
    key: 'soundproofing',
    category: 'rooms',
    label_fr: 'Insonorisation',
    label_en: 'Soundproofing',
  },
  {
    key: 'walk_in_shower',
    category: 'rooms',
    label_fr: 'Douche à l’italienne',
    label_en: 'Walk-in shower',
  },
  { key: 'bathtub', category: 'rooms', label_fr: 'Baignoire', label_en: 'Bathtub' },
  { key: 'balcony', category: 'rooms', label_fr: 'Balcon', label_en: 'Balcony' },
  {
    key: 'terrace',
    category: 'rooms',
    label_fr: 'Terrasse privative',
    label_en: 'Private terrace',
  },
  { key: 'fireplace', category: 'rooms', label_fr: 'Cheminée', label_en: 'Fireplace' },

  // ── connectivity ──
  {
    key: 'wifi',
    category: 'connectivity',
    label_fr: 'Wi-Fi gratuit',
    label_en: 'Free Wi-Fi',
    baseline: true,
  },
  {
    key: 'wifi_premium',
    category: 'connectivity',
    label_fr: 'Wi-Fi haut débit',
    label_en: 'High-speed Wi-Fi',
  },
  {
    key: 'in_room_tablet',
    category: 'connectivity',
    label_fr: 'Tablette en chambre',
    label_en: 'In-room tablet',
  },
  {
    key: 'usb_charging',
    category: 'connectivity',
    label_fr: 'Ports de charge USB',
    label_en: 'USB charging ports',
    baseline: true,
  },

  // ── family ──
  {
    key: 'family_friendly',
    category: 'family',
    label_fr: 'Adapté aux familles',
    label_en: 'Family-friendly',
  },
  { key: 'kids_club', category: 'family', label_fr: 'Club enfants', label_en: 'Kids’ club' },
  {
    key: 'babysitting',
    category: 'family',
    label_fr: 'Service de baby-sitting',
    label_en: 'Babysitting service',
  },
  {
    key: 'cribs_available',
    category: 'family',
    label_fr: 'Lits bébé disponibles',
    label_en: 'Cribs available',
  },
  {
    key: 'pet_friendly',
    category: 'family',
    label_fr: 'Animaux acceptés',
    label_en: 'Pets allowed',
  },
  {
    key: 'connecting_rooms',
    category: 'family',
    label_fr: 'Chambres communicantes',
    label_en: 'Connecting rooms',
  },

  // ── business ──
  {
    key: 'business_center',
    category: 'business',
    label_fr: 'Centre d’affaires',
    label_en: 'Business centre',
  },
  {
    key: 'meeting_rooms',
    category: 'business',
    label_fr: 'Salles de réunion',
    label_en: 'Meeting rooms',
  },
  {
    key: 'private_events',
    category: 'business',
    label_fr: 'Événements privés',
    label_en: 'Private events',
  },
  { key: 'ballroom', category: 'business', label_fr: 'Salle de bal', label_en: 'Ballroom' },
  {
    key: 'wedding_services',
    category: 'business',
    label_fr: 'Organisation de mariages',
    label_en: 'Wedding services',
  },

  // ── accessibility ──
  {
    key: 'step_free_access',
    category: 'accessibility',
    label_fr: 'Accès de plain-pied',
    label_en: 'Step-free access',
  },
  {
    key: 'accessible_rooms',
    category: 'accessibility',
    label_fr: 'Chambres accessibles',
    label_en: 'Accessible rooms',
  },
  {
    key: 'elevator',
    category: 'accessibility',
    label_fr: 'Ascenseur',
    label_en: 'Elevator',
    baseline: true,
  },

  // ── sustainability ──
  {
    key: 'green_key',
    category: 'sustainability',
    label_fr: 'Label Clef Verte',
    label_en: 'Green Key certified',
  },
  {
    key: 'electric_charging',
    category: 'sustainability',
    label_fr: 'Borne de recharge électrique',
    label_en: 'EV charging station',
  },

  // ── other / property-level ──
  { key: 'garden', category: 'other', label_fr: 'Jardin', label_en: 'Garden' },
  {
    key: 'private_parking',
    category: 'other',
    label_fr: 'Parking privé',
    label_en: 'Private parking',
  },
  {
    key: 'non_smoking',
    category: 'other',
    label_fr: 'Établissement non-fumeur',
    label_en: 'Non-smoking property',
    baseline: true,
  },
  { key: 'beach_access', category: 'other', label_fr: 'Accès plage', label_en: 'Beach access' },
  {
    key: 'ski_in_ski_out',
    category: 'other',
    label_fr: 'Accès ski aux pieds',
    label_en: 'Ski-in/ski-out',
  },
];

/** Map for O(1) lookup + validation that the classifier only returns known keys. */
export const AMENITIES_BY_KEY: ReadonlyMap<string, CanonicalAmenity> = new Map(
  AMENITIES_TAXONOMY.map((a) => [a.key, a]),
);

export const BASELINE_AMENITY_KEYS: readonly string[] = AMENITIES_TAXONOMY.filter(
  (a) => a.baseline === true,
).map((a) => a.key);

export interface AmenityRecord {
  readonly key: string;
  readonly category: AmenityCategory;
  readonly label_fr: string;
  readonly label_en: string;
}

export function amenityRecord(key: string): AmenityRecord | null {
  const a = AMENITIES_BY_KEY.get(key);
  if (a === undefined) return null;
  return { key: a.key, category: a.category, label_fr: a.label_fr, label_en: a.label_en };
}

/**
 * Merge the always-on baseline set with the classifier-selected keys,
 * preserving any already-persisted keys (so a re-run never removes
 * editorially-curated amenities). Returns deduped `AmenityRecord[]` in
 * taxonomy order, dropping any unknown key (anti-fabrication guard).
 */
export function mergeAmenities(
  existingKeys: readonly string[],
  selectedKeys: readonly string[],
): AmenityRecord[] {
  const keep = new Set<string>([...BASELINE_AMENITY_KEYS, ...existingKeys, ...selectedKeys]);
  const out: AmenityRecord[] = [];
  for (const a of AMENITIES_TAXONOMY) {
    if (keep.has(a.key)) {
      out.push({ key: a.key, category: a.category, label_fr: a.label_fr, label_en: a.label_en });
    }
  }
  return out;
}

/**
 * Extract the stable `key` values from a hotel's existing `amenities`
 * jsonb (objects with `key`, or bare strings that happen to match a key).
 */
export function extractExistingAmenityKeys(raw: unknown): readonly string[] {
  if (!Array.isArray(raw)) return [];
  const keys: string[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string') {
      if (AMENITIES_BY_KEY.has(entry)) keys.push(entry);
      continue;
    }
    if (entry !== null && typeof entry === 'object') {
      const k = (entry as Record<string, unknown>)['key'];
      if (typeof k === 'string' && AMENITIES_BY_KEY.has(k)) keys.push(k);
    }
  }
  return keys;
}
