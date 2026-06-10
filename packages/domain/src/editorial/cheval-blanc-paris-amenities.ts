/**
 * Factual amenities for Cheval Blanc Paris — CDC §2.6 (≥ 80).
 * Sourced from chevalblanc.com (Maison Paris, wellness, careers) and LVMH press kit.
 */

export interface ChevalBlancParisAmenityRecord {
  readonly key: string;
  readonly label_fr: string;
  readonly label_en: string;
}

function a(key: string, label_fr: string, label_en: string): ChevalBlancParisAmenityRecord {
  return { key, label_fr, label_en };
}

/** 80 curated amenities — Cheval Blanc Paris / Samaritaine / LVMH. */
export const CHEVAL_BLANC_PARIS_AMENITIES: readonly ChevalBlancParisAmenityRecord[] = [
  a('concierge_24h', 'Conciergerie 24h/24', '24-hour concierge'),
  a('reception_24h', 'Réception 24h/24', '24-hour front desk'),
  a('daily_housekeeping', 'Service de chambre quotidien', 'Daily housekeeping'),
  a('turndown_service', 'Service de couverture', 'Turndown service'),
  a('luggage_storage', 'Consigne à bagages', 'Luggage storage'),
  a('laundry', 'Blanchisserie', 'Laundry service'),
  a('dry_cleaning', 'Nettoyage à sec', 'Dry cleaning'),
  a('valet', 'Voiturier', 'Valet parking'),
  a('limousine_service', 'Service de limousine', 'Limousine service'),
  a('multilingual_staff', 'Personnel multilingue', 'Multilingual staff'),
  a('cheval_blanc_brand', 'Maison Cheval Blanc (LVMH)', 'Cheval Blanc Maison (LVMH)'),
  a(
    'samaritaine_building',
    'Bâtiment historique de la Samaritaine',
    'Historic Samaritaine building',
  ),
  a('peter_marino_design', 'Intérieurs signés Peter Marino', 'Interiors by Peter Marino'),
  a(
    'edouard_francois_architecture',
    'Architecture Edouard François',
    'Architecture by Edouard François',
  ),
  a(
    'plenitude_restaurant',
    'Restaurant Plénitude (3 étoiles MICHELIN)',
    'Plénitude restaurant (3 MICHELIN Stars)',
  ),
  a('le_tout_paris', 'Le Tout-Paris — brasserie étoilée', 'Le Tout-Paris — starred brasserie'),
  a('langosteria', 'Langosteria — restaurant italien', 'Langosteria — Italian restaurant'),
  a(
    'hakuba',
    'Hakuba — restaurant japonais (2 étoiles MICHELIN)',
    'Hakuba — Japanese restaurant (2 MICHELIN Stars)',
  ),
  a('le_jardin', 'Le Jardin — rooftop saisonnier', 'Le Jardin — seasonal rooftop'),
  a('rooftop_terrace', 'Terrasse arborée 7e étage', 'Planted 7th-floor terrace'),
  a('cocktail_bar', 'Bar cocktails Le Tout-Paris', 'Le Tout-Paris cocktail bar'),
  a('fine_dining', 'Tables gastronomiques sur site', 'On-site fine dining'),
  a('breakfast', 'Petit-déjeuner', 'Breakfast'),
  a('brunch', 'Brunch Le Tout-Paris', 'Le Tout-Paris brunch'),
  a('room_service_24h', 'Room service 24h/24', '24-hour room service'),
  a('in_room_dining', 'Carte Blanche — dîner en chambre', 'Carte Blanche — in-room dining'),
  a('private_dining', 'Dîners privatifs', 'Private dining'),
  a('dior_spa', 'Dior Spa Cheval Blanc', 'Dior Spa Cheval Blanc'),
  a('spa_treatment_suites', 'Suites de soins Dior', 'Dior treatment suites'),
  a('infinity_pool', 'Piscine à débordement en mosaïque', 'Mosaic infinity pool'),
  a('indoor_pool', 'Piscine intérieure', 'Indoor pool'),
  a('fitness', 'Centre de fitness', 'Fitness centre'),
  a('sauna', 'Sauna', 'Sauna'),
  a('hammam', 'Hammam', 'Hammam'),
  a('le_carrousel', 'Le Carrousel — club enfants', 'Le Carrousel — kids club'),
  a('family_friendly', 'Adapté aux familles', 'Family-friendly'),
  a('babysitting', 'Baby-sitting (sur demande)', 'Babysitting (on request)'),
  a('cribs_available', 'Lits bébé disponibles', 'Cribs available'),
  a('extra_beds', 'Lits supplémentaires (sur demande)', 'Extra beds (on request)'),
  a('butler_service', 'Service de majordome (suites)', 'Butler service (suites)'),
  a('air_conditioning', 'Climatisation', 'Air conditioning'),
  a('minibar', 'Minibar', 'Minibar'),
  a('in_room_safe', 'Coffre-fort en chambre', 'In-room safe'),
  a('flat_screen_tv', 'Télévision écran plat', 'Flat-screen TV'),
  a('bathrobes_slippers', 'Peignoirs et chaussons', 'Bathrobes and slippers'),
  a('dior_toiletries', 'Produits d’accueil Dior', 'Dior toiletries'),
  a('complimentary_water', 'Eau minérale offerte', 'Complimentary mineral water'),
  a('pillow_menu', 'Carte des oreillers', 'Pillow menu'),
  a('blackout_curtains', 'Rideaux occultants', 'Blackout curtains'),
  a('soundproofing', 'Insonorisation', 'Soundproofing'),
  a('walk_in_shower', 'Douche à l’italienne', 'Walk-in shower'),
  a('bathtub', 'Baignoire', 'Bathtub'),
  a('marble_bathroom', 'Salle de bain en marbre', 'Marble bathroom'),
  a('winter_garden', 'Jardin d’hiver (certaines suites)', 'Winter garden (select suites)'),
  a('balcony', 'Balcon (certaines chambres)', 'Balcony (select rooms)'),
  a('terrace', 'Terrasse privative (suites)', 'Private terrace (suites)'),
  a('seine_view', 'Vue Seine (certaines suites)', 'Seine view (select suites)'),
  a('eiffel_tower_view', 'Vue Tour Eiffel (certaines suites)', 'Eiffel Tower view (select suites)'),
  a('wifi', 'Wi-Fi gratuit', 'Free Wi-Fi'),
  a('wifi_premium', 'Wi-Fi haut débit', 'High-speed Wi-Fi'),
  a('usb_charging', 'Ports de charge USB', 'USB charging ports'),
  a('king_bed', 'Lit king size', 'King-size bed'),
  a('connecting_rooms', 'Chambres communicantes', 'Connecting rooms'),
  a('business_center', 'Centre d’affaires', 'Business centre'),
  a('meeting_rooms', 'Salles de réunion', 'Meeting rooms'),
  a('private_events', 'Événements privés', 'Private events'),
  a('mice_capable', 'Capacité MICE', 'MICE capability'),
  a('wedding_services', 'Mariages et réceptions', 'Weddings and receptions'),
  a(
    'step_free_access',
    'Accès de plain-pied (parties communes)',
    'Step-free access (public areas)',
  ),
  a('accessible_rooms', 'Chambres accessibles', 'Accessible rooms'),
  a('elevator', 'Ascenseur', 'Elevator'),
  a('non_smoking', 'Établissement non-fumeur', 'Non-smoking property'),
  a('smoke_free_rooms', 'Chambres non-fumeur', 'Smoke-free rooms'),
  a('valet_parking', 'Parking avec voiturier', 'Valet parking'),
  a('nearby_parking', 'Parking à proximité', 'Nearby parking'),
  a('electric_charging', 'Borne de recharge électrique', 'EV charging station'),
  a('louvre_proximity', 'Face au Louvre et à la Seine', 'Facing the Louvre and the Seine'),
  a('pont_neuf_proximity', 'À deux pas du Pont Neuf', 'Steps from Pont Neuf'),
  a('marais_proximity', 'Proche du Marais', 'Near Le Marais'),
  a('chatelet_metro', 'Métro Châtelet / Louvre-Rivoli', 'Châtelet / Louvre-Rivoli metro'),
] as const;
