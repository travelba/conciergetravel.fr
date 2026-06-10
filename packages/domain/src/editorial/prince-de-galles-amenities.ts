/**
 * Factual amenities for Prince de Galles, a Luxury Collection Hotel, Paris —
 * CDC §2.6 (≥ 80).
 * Sourced from Marriott PARLC property features (Luxury Collection / palace Art déco).
 */

export interface PrinceDeGallesAmenityRecord {
  readonly key: string;
  readonly label_fr: string;
  readonly label_en: string;
}

function a(key: string, label_fr: string, label_en: string): PrinceDeGallesAmenityRecord {
  return { key, label_fr, label_en };
}

/** 80 curated amenities — no `michelin_restaurant` (Akira Back is fine dining, not a starred table here). */
export const PRINCE_DE_GALLES_AMENITIES: readonly PrinceDeGallesAmenityRecord[] = [
  a('concierge_24h', 'Conciergerie 24h/24', '24-hour concierge'),
  a('reception_24h', 'Réception 24h/24', '24-hour front desk'),
  a('daily_housekeeping', 'Service de chambre quotidien', 'Daily housekeeping'),
  a('turndown_service', 'Service de couverture', 'Turndown service'),
  a('luggage_storage', 'Consigne à bagages', 'Luggage storage'),
  a('laundry', 'Blanchisserie', 'Laundry service'),
  a('dry_cleaning', 'Nettoyage à sec', 'Dry cleaning'),
  a('valet', 'Voiturier', 'Valet parking'),
  a('limousine_service', 'Service de limousine', 'Limousine service'),
  a('car_rental', 'Location de voiture', 'Car rental desk'),
  a('wake_up_service', 'Service de réveil', 'Wake-up service'),
  a('currency_exchange', 'Change de devises', 'Currency exchange'),
  a('multilingual_staff', 'Personnel multilingue', 'Multilingual staff'),
  a('tour_desk', 'Bureau d’excursions', 'Tour desk'),
  a('florist', 'Fleuriste', 'Florist'),
  a('shoe_shine', 'Cirage de chaussures', 'Shoeshine service'),
  a('press_service', 'Presse quotidienne', 'Daily newspaper service'),
  a('luxury_collection', 'The Luxury Collection by Marriott', 'The Luxury Collection by Marriott'),
  a('art_deco_palace', 'Palace Art déco (depuis 1929)', 'Art Deco palace (since 1929)'),
  a('le_patio_courtyard', 'Le Patio — cour intérieure', 'Le Patio — inner courtyard'),
  a('mosaic_courtyard', 'Cour à mosaïques Art déco', 'Art Deco mosaic courtyard'),
  a('akira_back_restaurant', 'Restaurant Akira Back', 'Akira Back restaurant'),
  a('fine_dining', 'Table gastronomique Akira Back', 'Akira Back fine dining'),
  a('bar_19_20', 'Bar & salon 19.20', '19.20 bar & lounge'),
  a('lounge', 'Salons de réception', 'Reception lounges'),
  a('patio_dining', 'Restauration sur Le Patio', 'Dining on Le Patio'),
  a('brunch_service', 'Brunch Le Patio', 'Le Patio brunch'),
  a('breakfast', 'Petit-déjeuner', 'Breakfast'),
  a('room_service_24h', 'Room service 24h/24', '24-hour room service'),
  a('private_dining', 'Dîners privatifs', 'Private dining'),
  a('fitness', 'Centre de fitness', 'Fitness centre'),
  a('personal_trainer', 'Coach personnel (sur demande)', 'Personal trainer (on request)'),
  a('air_conditioning', 'Climatisation', 'Air conditioning'),
  a('minibar', 'Minibar', 'Minibar'),
  a('in_room_safe', 'Coffre-fort en chambre', 'In-room safe'),
  a('flat_screen_tv', 'Télévision écran plat', 'Flat-screen TV'),
  a('bathrobes_slippers', 'Peignoirs et chaussons', 'Bathrobes and slippers'),
  a('lalique_toiletries', 'Produits d’accueil Lalique', 'Lalique toiletries'),
  a('complimentary_water', 'Eau minérale offerte', 'Complimentary mineral water'),
  a('pillow_menu', 'Carte des oreillers', 'Pillow menu'),
  a('blackout_curtains', 'Rideaux occultants', 'Blackout curtains'),
  a('soundproofing', 'Insonorisation', 'Soundproofing'),
  a('walk_in_shower', 'Douche à l’italienne', 'Walk-in shower'),
  a('bathtub', 'Baignoire', 'Bathtub'),
  a('marble_bathroom', 'Salle de bain en marbre', 'Marble bathroom'),
  a('art_deco_mosaic', 'Mosaïque d’inspiration Art déco', 'Art Deco-inspired mosaic'),
  a('mirrored_headboard', 'Tête de lit miroitée', 'Mirrored headboard'),
  a('art_deco_decor', 'Décor Art déco', 'Art Deco décor'),
  a('balcony', 'Balcon (26 chambres et suites)', 'Balcony (26 rooms and suites)'),
  a('terrace', 'Terrasse privative (suites)', 'Private terrace (suites)'),
  a('courtyard_view', 'Vue sur Le Patio', 'Le Patio courtyard view'),
  a('avenue_view', 'Vue avenue George V', 'Avenue George V view'),
  a('wifi', 'Wi-Fi gratuit', 'Free Wi-Fi'),
  a('wifi_premium', 'Wi-Fi haut débit', 'High-speed Wi-Fi'),
  a('usb_charging', 'Ports de charge USB', 'USB charging ports'),
  a('king_bed', 'Lit king size', 'King-size bed'),
  a('connecting_rooms', 'Chambres communicantes', 'Connecting rooms'),
  a('family_friendly', 'Adapté aux familles', 'Family-friendly'),
  a('cribs_available', 'Lits bébé disponibles', 'Cribs available'),
  a('extra_beds', 'Lits supplémentaires (sur demande)', 'Extra beds (on request)'),
  a('business_center', 'Centre d’affaires', 'Business centre'),
  a('meeting_rooms', 'Salles de réunion', 'Meeting rooms'),
  a('seminar_av', 'Équipement audiovisuel', 'Audiovisual equipment'),
  a('private_events', 'Événements privés', 'Private events'),
  a('wedding_services', 'Mariages et réceptions', 'Weddings and receptions'),
  a('mice_capable', 'Capacité MICE', 'MICE capability'),
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
  a('golden_triangle', 'Triangle d’Or (8e arrondissement)', 'Golden Triangle (8th arr.)'),
  a('champs_elysees_proximity', 'À deux pas des Champs-Élysées', 'Steps from the Champs-Élysées'),
  a('montaigne_proximity', 'Proche avenue Montaigne', 'Near Avenue Montaigne'),
  a('george_v_metro', 'Métro George V (ligne 1)', 'George V metro (line 1)'),
  a('eiffel_tower_view', 'Vue Tour Eiffel (certaines suites)', 'Eiffel Tower view (select suites)'),
  a('butler_service', 'Service de majordome (suites)', 'Butler service (suites)'),
] as const;
