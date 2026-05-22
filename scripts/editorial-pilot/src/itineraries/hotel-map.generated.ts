/**
 * GENERATED FILE — slug → { id, name } snapshot for every hotel cited
 * by the 20 P0 itinerary briefs (after alias resolution).
 *
 * This is a static snapshot, NOT a live query: the editorial-pilot runs
 * offline (no Postgres URL in `.env.local`) and we still need the LLM
 * composer to link real UUIDs into the generated SQL.
 *
 * How to regenerate (when briefs or hotels change) :
 *   1. List every distinct `hotel_slugs_target` + `steps_outline[].hotel_slug_hint`
 *      across `scripts/editorial-pilot/itineraries/briefs/*.json`.
 *   2. Resolve each one through `HOTEL_SLUG_ALIASES` in country-codes.ts.
 *   3. Query Supabase :
 *        select slug, id, name from public.hotels where slug = any($1);
 *   4. Paste the result here, sorted alphabetically by slug.
 *
 * Snapshot date : 2026-05-22.
 * Generated against migrations through 0048.
 */

export interface HotelMapEntry {
  readonly id: string;
  readonly name: string;
}

export const HOTEL_SLUG_TO_ENTRY: Readonly<Record<string, HotelMapEntry>> = {
  'aman-kyoto': { id: 'd5c805ab-bb82-488d-bd60-b4cde727caf7', name: 'Aman Kyoto' },
  'aman-new-york': { id: '8be932d5-0bde-4317-b23e-f234f2df4cf2', name: 'Aman New York' },
  'aman-tokyo': { id: 'd5acea07-c82e-42a5-9861-7bd063dc633d', name: 'Aman Tokyo' },
  amankila: { id: 'ffc302d4-83b0-443e-98cb-a93147356b9b', name: 'Amankila' },
  'atlantis-the-royal': { id: '24376396-cd97-43b6-bb11-c40354af2f16', name: 'Atlantis The Royal' },
  'baumaniere-les-baux-de-provence': {
    id: 'bf2c2341-c849-4420-a66f-c77b9416bcfb',
    name: 'Baumanière Les Baux-de-Provence',
  },
  'borgo-san-felice': { id: '4867823c-12c7-4030-8286-6fd7be0950ee', name: 'Borgo San Felice' },
  'brindos-lac-and-chateau': {
    id: 'c06901bd-9ede-4959-be99-2280d1390799',
    name: 'Brindos, Lac & Château',
  },
  'burj-al-arab': { id: 'e2ad8e85-63eb-4aca-8a0e-6a75a0f05cc9', name: 'Burj Al Arab Jumeirah' },
  'castello-di-casole-a-belmond-hotel': {
    id: '8f549172-9bd7-4cce-b147-6a3136809a80',
    name: 'Castello di Casole, A Belmond Hotel',
  },
  'chateau-de-la-chevre-d-or': {
    id: '7ba51145-ac89-40e2-852b-eb3bc2975174',
    name: 'Château de la Chèvre d’Or',
  },
  'chateau-de-la-messardiere': {
    id: '8f52838e-bd31-4f2a-94cd-7125219a5cd4',
    name: 'Château de la Messardière',
  },
  'chateau-lafaurie-peyraguey': {
    id: '8c04886e-baaa-4087-ae7a-7565b1609e76',
    name: 'Château Lafaurie-Peyraguey',
  },
  'cheval-blanc-randheli': {
    id: '1692e0b2-4fd6-4ca5-b624-1fa5bd2fffeb',
    name: 'Cheval Blanc Randheli',
  },
  'cheval-blanc-saint-tropez': {
    id: '3e427939-6e88-4848-a7dd-d6774fb39421',
    name: 'Cheval Blanc St-Tropez',
  },
  'como-uma-ubud': { id: 'bb6480e3-49d3-4ab3-970c-32ae3bae1c54', name: 'COMO Uma Ubud' },
  'four-seasons-hotel-george-v': {
    id: '2ea63526-c31b-4bed-b715-b2d986478c55',
    name: 'Four Seasons Hotel George V',
  },
  'four-seasons-jumeirah': {
    id: 'dd908266-21d9-4351-a972-101116683f80',
    name: 'Four Seasons Resort Dubai at Jumeirah Beach',
  },
  'four-seasons-megeve': {
    id: '63ec7327-f140-4034-aca1-62d786e122c8',
    name: 'Four Seasons Hotel Megève',
  },
  'four-seasons-resort-bali-at-jimbaran-bay': {
    id: 'b21417f6-ea72-496f-a2ff-76a50b594a58',
    name: 'Four Seasons Resort Bali at Jimbaran Bay',
  },
  'grand-hotel-cap-ferrat': {
    id: 'e916763a-0885-4d2b-acd9-aa0ad9592a71',
    name: 'Grand-Hôtel du Cap-Ferrat, A Four Seasons Hotel',
  },
  'hakone-ginyu': { id: '599a05ae-1eb3-4cdf-927d-64d8da06b65c', name: 'Hakone Ginyu' },
  'hotel-cipriani': { id: 'e842fad6-65d2-44b3-8770-07b2f178f695', name: 'Hotel Cipriani' },
  'hotel-crillon-le-brave': {
    id: '81a159d9-d605-448d-8a1e-d4fe31edce98',
    name: 'Hôtel Crillon Le Brave',
  },
  'hotel-de-crillon-a-rosewood-hotel': {
    id: '38f0576e-0915-4080-aeee-a51202b0e1f3',
    name: 'Hôtel de Crillon, A Rosewood Hotel',
  },
  'hotel-du-cap-eden-roc': {
    id: 'c132f507-9071-40b5-8cd9-566ca9d11fcf',
    name: 'Hôtel du Cap-Eden-Roc',
  },
  'hotel-du-palais-biarritz': {
    id: '39e8ca5b-4512-4acb-9b79-dac130b34fcf',
    name: 'Hôtel du Palais Biarritz',
  },
  'hotel-ritz-paris': { id: 'a98835cf-705d-4730-995e-d42ff0b3ee51', name: 'Ritz Paris' },
  'intercontinental-lyon-hotel-dieu': {
    id: '899be19b-9183-4103-ac27-5aef276cec21',
    name: 'InterContinental Lyon Hôtel-Dieu',
  },
  'ksar-char-bagh': { id: '5c302b9d-7597-4be9-9dec-76577424caf8', name: 'Ksar Char-Bagh' },
  'la-mamounia': { id: 'aa101807-df7b-4213-a142-aa0bc3baade2', name: 'La Mamounia' },
  'le-bristol-paris': {
    id: '324fa78d-d155-4883-afd1-18ac665d3cce',
    name: 'Hôtel Le Bristol Paris',
  },
  'le-chalet-zannier': { id: '334f538c-36d6-4d22-852d-d701244979f6', name: 'Le Chalet Zannier' },
  'le-royal-champagne-hotel-spa': {
    id: 'c5d087fd-d241-4757-a28b-98229572008b',
    name: 'Royal Champagne Hotel & Spa',
  },
  'les-crayeres': { id: '91e9c94c-c442-4e46-abea-ee34d23799ac', name: 'Les Crayères' },
  'les-fermes-de-marie': {
    id: '48e5ffaf-e789-493f-8600-81fb483af8b3',
    name: 'Les Fermes de Marie',
  },
  'les-sources-de-caudalie': {
    id: '2c60506b-34c2-4e5c-a142-5693a9f700ed',
    name: 'Les Sources de Caudalie',
  },
  'lily-of-the-valley': { id: '96e81289-6599-4417-8639-2748c0af46b1', name: 'Lily of the Valley' },
  'mara-plains-camp': { id: '3347cb99-ad11-4fe7-b699-060f3548e58d', name: 'Mara Plains Camp' },
  'mount-nelson': { id: '4c09dd82-e89c-4255-8794-e27375801f97', name: 'Mount Nelson' },
  'one-and-only-reethi-rah': {
    id: 'a3876d4e-6471-4be1-b30c-1a8b64a77a1c',
    name: 'One&Only Reethi Rah',
  },
  'park-hyatt-kyoto': { id: '6eee364d-d7a8-4352-9ca2-43d899d8a0a1', name: 'Park Hyatt Kyoto' },
  'plaza-athenee-paris': {
    id: '7950dca3-d81c-465b-a34c-05ae1797a87b',
    name: 'Plaza Athénée Paris',
  },
  'rosewood-castiglion-del-bosco': {
    id: 'c5598f9d-c47a-489c-a4bd-a3a6d622391b',
    name: 'Rosewood Castiglion del Bosco',
  },
  'royal-malewane': { id: '22304fac-9cea-41e9-b1bf-da83b4b3b3fb', name: 'Royal Malewane' },
  'royal-mansour': { id: 'ff6d8b17-a643-45b0-a498-2cbe732e821b', name: 'Royal Mansour' },
  'soneva-fushi': { id: '4da3ee07-e4e6-4abc-b3ec-d7a2578db1ba', name: 'Soneva Fushi' },
  'the-carlyle': { id: '91c1cfa9-b3b7-474d-aade-a87dfb5ab2a3', name: 'The Carlyle' },
  'the-mark': { id: 'e0ee14a6-fe4c-4178-8479-d763ba36621a', name: 'The Mark' },
  'villa-gallici': { id: '4e3d3af1-038b-4880-937b-00aaf2b2796d', name: 'Villa Gallici' },
  'villa-maia': { id: '5db09f45-c2b4-4f0b-b42d-eee6958cf327', name: 'Villa Maïa' },
};
