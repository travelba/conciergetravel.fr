/**
 * Seed Elena RateHawk certification pilot hotels (Conrad LA + Pullman Dubai JLT).
 *
 * Inserts minimal published fiches + supplier connections + editorial rooms
 * sourced from RateHawk room_groups when the sandbox API is reachable.
 *
 * Usage:
 *   pnpm --filter @mch/editorial-pilot seed:elena-pilot [--dry-run]
 *
 * Then bootstrap room mappings:
 *   pnpm --filter @mch/editorial-pilot ratehawk:bootstrap -- --slug=conrad-los-angeles --etg-id=conrad_los_angeles
 *   pnpm --filter @mch/editorial-pilot travelport:bootstrap -- --slug=conrad-los-angeles --chain-code=CN --property-code=G8912 --adults=2
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fetchRoomGroups, type RateHawkClientConfig } from '@mch/integrations/ratehawk';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });
loadDotenv({ path: resolve(__dirname, '../../../../apps/web/.env.local') });

const EnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  RATEHAWK_API_BASE: z.string().url().optional(),
  RATEHAWK_KEY_ID: z.string().optional(),
  RATEHAWK_API_KEY: z.string().optional(),
});

interface PilotHotelSpec {
  readonly slug: string;
  readonly name: string;
  readonly name_en: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly address: string;
  readonly city: string;
  readonly country_code: string;
  readonly country_label_fr: string;
  readonly country_label_en: string;
  readonly ratehawk_etg_id: string;
  readonly travelport_chain: string;
  readonly travelport_property: string;
}

const PILOTS: readonly PilotHotelSpec[] = [
  {
    slug: 'conrad-los-angeles',
    name: 'Conrad Los Angeles',
    name_en: 'Conrad Los Angeles',
    latitude: 34.05554,
    longitude: -118.24875,
    address: '100 South Grand Avenue, Los Angeles, CA 90012',
    city: 'Los Angeles',
    country_code: 'US',
    country_label_fr: 'États-Unis',
    country_label_en: 'United States',
    ratehawk_etg_id: 'conrad_los_angeles',
    travelport_chain: 'CN',
    travelport_property: 'G8912',
  },
  {
    slug: 'pullman-dubai-jumeirah-lakes-towers',
    name: 'Pullman Dubai Jumeirah Lakes Towers Hotel and Residence',
    name_en: 'Pullman Dubai Jumeirah Lakes Towers Hotel and Residence',
    latitude: 25.079737,
    longitude: 55.149967,
    address: 'Cluster T, Jumeirah Lakes Towers, Dubai',
    city: 'Dubai',
    country_code: 'AE',
    country_label_fr: 'Émirats arabes unis',
    country_label_en: 'United Arab Emirates',
    ratehawk_etg_id: 'pullman_dubai_jumeirah_lakes_towers__hotel_and_residence',
    travelport_chain: 'PU',
    travelport_property: 'B1397',
  },
];

function flag(name: string): string | undefined {
  const prefix = `--${name}=`;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith(prefix)) return arg.slice(prefix.length);
    if (arg === `--${name}`) return 'true';
  }
  return undefined;
}

function slugifyRoom(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function roomCodeFromSlug(slug: string, index: number): string {
  const base = slug.toUpperCase().replace(/-/g, '_');
  return `${base}_${index}`;
}

function stubDescription(hotelName: string, city: string): { fr: string; en: string } {
  const fr =
    `${hotelName} occupe une adresse centrale à ${city}, dans une tour contemporaine pensée pour les voyageurs exigeants. ` +
    `Les chambres et suites offrent des volumes généreux, des salles de bain en marbre et des vues ouvertes sur le skyline ou la baie selon les catégories. ` +
    `Le lobby accueille les arrivées en journée comme en soirée ; le room service et la conciergerie restent joignables 24 h/24. ` +
    `Les espaces restauration couvrent petit-déjeuner, déjeuner et dîner avec cartes saisonnières et options végétariennes. ` +
    `Le spa et la salle de fitness complètent l'offre bien-être ; la piscine extérieure ou intérieure varie selon la configuration de l'établissement. ` +
    `L'hôtel se situe à quelques minutes des quartiers d'affaires et des axes majeurs ; transferts privés et taxis se réservent via la réception. ` +
    `Cette fiche pilote Elena RateHawk documente l'inventaire live Travelport + RateHawk pour la certification MyConciergeHotel.com.`;
  const en =
    `${hotelName} sits on a central address in ${city}, inside a contemporary tower built for discerning travellers. ` +
    `Rooms and suites offer generous volumes, marble bathrooms and skyline or bay views depending on category. ` +
    `The lobby welcomes arrivals day and night; room service and concierge remain reachable 24/7. ` +
    `Dining covers breakfast, lunch and dinner with seasonal menus and vegetarian options. ` +
    `Spa and fitness facilities complete the wellness offer; pool access varies by property layout. ` +
    `The hotel lies minutes from business districts and major arteries; private transfers and taxis can be arranged at reception. ` +
    `This Elena RateHawk pilot fiche documents live Travelport + RateHawk inventory for MyConciergeHotel.com certification.`;
  return { fr, en };
}

function stubFaq(hotelName: string): readonly Record<string, string>[] {
  const items = [
    [
      "Où se situe l'hôtel ?",
      `Where is ${hotelName} located?`,
      "Au cœur de la ville, à proximité des quartiers d'affaires et des axes principaux.",
      'In the city centre, close to business districts and main arteries.',
    ],
    [
      'Quels types de chambres propose-t-on ?',
      'What room types are available?',
      'Chambres deluxe, suites et catégories premium avec literie king ou queen.',
      'Deluxe rooms, suites and premium categories with king or queen bedding.',
    ],
    [
      'Y a-t-il un restaurant sur place ?',
      'Is there an on-site restaurant?',
      'Oui, avec service petit-déjeuner, déjeuner et dîner selon les horaires affichés.',
      'Yes, with breakfast, lunch and dinner service per posted hours.',
    ],
    [
      'Le spa est-il accessible aux non-résidents ?',
      'Can non-guests use the spa?',
      "L'accès spa est réservé aux clients de l'hôtel sur réservation.",
      'Spa access is reserved for hotel guests by appointment.',
    ],
    [
      "Quelle est l'heure d'enregistrement ?",
      'What is check-in time?',
      "L'enregistrement débute en général à 15 h ; départ avant 12 h.",
      'Check-in usually from 3 p.m.; checkout before noon.',
    ],
    [
      'Le Wi-Fi est-il inclus ?',
      'Is Wi-Fi included?',
      "Le Wi-Fi haut débit est inclus dans l'ensemble de l'établissement.",
      'High-speed Wi-Fi is included property-wide.',
    ],
    [
      'Peut-on organiser un transfert aéroport ?',
      'Can you arrange airport transfers?',
      'La conciergerie réserve taxis ou van privé sur demande.',
      'Concierge can book taxis or private vans on request.',
    ],
    [
      'Les animaux sont-ils acceptés ?',
      'Are pets allowed?',
      'Politique animaux variable ; confirmer auprès de la réception avant réservation.',
      'Pet policy varies; confirm with reception before booking.',
    ],
    [
      'Y a-t-il un parking ?',
      'Is parking available?',
      "Parking voiturier ou self-parking selon disponibilité, tarif affiché à l'arrivée.",
      'Valet or self-parking subject to availability; rate posted on arrival.',
    ],
    [
      'Comment réserver via MyConciergeHotel ?',
      'How do I book via MyConciergeHotel?',
      "Sélectionnez vos dates sur la fiche ; les tarifs live RateHawk et Travelport s'affichent dans le rail de réservation.",
      'Pick dates on the fiche; live RateHawk and Travelport rates appear in the booking rail.',
    ],
  ] as const;
  return items.map(([qFr, qEn, aFr, aEn]) => ({
    question_fr: qFr,
    answer_fr: aFr,
    question: qEn,
    answer: aEn,
  }));
}

function stubConcierge(hotelName: string): Record<string, unknown> {
  return {
    fr: {
      title: 'Le Conseil du Concierge',
      body:
        `Pour ${hotelName}, demandez une chambre haute étage côté skyline à l'enregistrement ; ` +
        `les arrivées après 18 h passent par l'entrée principale avec bagages marqués au nom du client. ` +
        `Réservez le restaurant une semaine avant le week-end ; le petit-déjeuner est moins chargé avant 8 h 30.`,
    },
    en: {
      title: "Concierge's Tip",
      body:
        `At ${hotelName}, ask for a high-floor skyline-facing room at check-in; ` +
        `arrivals after 6 p.m. use the main entrance with luggage tagged to the guest name. ` +
        `Book the restaurant one week ahead for weekends; breakfast is quietest before 8:30 a.m.`,
    },
  };
}

function stubLongSection(hotelName: string, city: string): readonly Record<string, string>[] {
  return [
    {
      anchor_fr: 'presentation',
      title_fr: 'Présentation',
      body_fr:
        `${hotelName} est une adresse pilote du programme de certification Elena RateHawk sur MyConciergeHotel.com, ` +
        `avec inventaire live RateHawk et Travelport. L'établissement occupe une position centrale à ${city}.`,
      title_en: 'Overview',
      body_en:
        `${hotelName} is an Elena RateHawk certification pilot on MyConciergeHotel.com, ` +
        `with live RateHawk and Travelport inventory. The property holds a central position in ${city}.`,
    },
  ];
}

async function sbGet<T>(env: z.infer<typeof EnvSchema>, path: string): Promise<T> {
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(
      `Supabase GET ${path} failed (${res.status}): ${(await res.text()).slice(0, 200)}`,
    );
  }
  return (await res.json()) as T;
}

async function sbWrite(
  env: z.infer<typeof EnvSchema>,
  method: 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  prefer?: string,
): Promise<unknown> {
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: prefer ?? 'return=representation',
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    throw new Error(
      `Supabase ${method} ${path} failed (${res.status}): ${(await res.text()).slice(0, 300)}`,
    );
  }
  const text = await res.text();
  if (text.length === 0) return null;
  return JSON.parse(text) as unknown;
}

async function fetchRhRoomNames(
  cfg: RateHawkClientConfig | null,
  etgId: string,
): Promise<readonly string[]> {
  if (cfg === null) return [];
  const groupsRes = await fetchRoomGroups(cfg, etgId, 'en');
  if (!groupsRes.ok) return [];
  const names: string[] = [];
  for (const g of groupsRes.value) {
    const name = g.name?.trim();
    if (name !== undefined && name.length > 0) names.push(name);
  }
  return [...new Set(names)].slice(0, 12);
}

async function upsertHotel(
  env: z.infer<typeof EnvSchema>,
  spec: PilotHotelSpec,
  dryRun: boolean,
): Promise<string> {
  const existing = await sbGet<readonly { id: string }[]>(
    env,
    `hotels?slug=eq.${encodeURIComponent(spec.slug)}&select=id&limit=1`,
  );
  const desc = stubDescription(spec.name, spec.city);
  const payload = {
    slug: spec.slug,
    slug_en: spec.slug,
    name: spec.name,
    name_en: spec.name_en,
    stars: 5,
    is_palace: false,
    region: null,
    city: spec.city,
    country_code: spec.country_code,
    country_label_fr: spec.country_label_fr,
    country_label_en: spec.country_label_en,
    address: spec.address,
    latitude: spec.latitude,
    longitude: spec.longitude,
    booking_mode: 'travelport',
    priority: 'P0',
    is_published: true,
    luxury_tier: 'self_5_star',
    description_fr: desc.fr,
    description_en: desc.en,
    meta_desc_fr: `${spec.name} à ${spec.city} : chambres premium, restauration et spa. Tarifs live RateHawk + Travelport sur MyConciergeHotel.com.`,
    meta_desc_en: `${spec.name_en} in ${spec.city}: premium rooms, dining and spa. Live RateHawk + Travelport rates on MyConciergeHotel.com.`,
    factual_summary_fr: `${spec.name} à ${spec.city} : adresse premium avec chambres contemporaines, restauration et spa ; tarifs live RateHawk + Travelport.`,
    factual_summary_en: `${spec.name_en} in ${spec.city}: premium address with contemporary rooms, dining and spa; live RateHawk + Travelport rates.`,
    concierge_advice: stubConcierge(spec.name),
    faq_content: stubFaq(spec.name),
    long_description_sections: stubLongSection(spec.name, spec.city),
    policies: {
      check_in: '15:00',
      check_out: '12:00',
      pets: { allowed: false, fee: null },
      wifi: { scope: 'whole_property', fee: null },
      _synthetic: true,
    },
  };

  if (dryRun) {
    console.log(`[elena:seed] DRY-RUN hotel ${spec.slug}`, payload);
    return existing[0]?.id ?? 'dry-run-id';
  }

  if (existing[0] !== undefined) {
    await sbWrite(env, 'PATCH', `hotels?id=eq.${existing[0].id}`, payload, 'return=minimal');
    console.log(`[elena:seed] PATCH hotel ${spec.slug} (${existing[0].id})`);
    return existing[0].id;
  }

  const inserted = await sbWrite(env, 'POST', 'hotels', payload, 'return=representation');
  const row = Array.isArray(inserted) ? inserted[0] : inserted;
  const id = (row as { id?: string })?.id;
  if (id === undefined) throw new Error(`Insert hotel ${spec.slug} did not return id`);
  console.log(`[elena:seed] INSERT hotel ${spec.slug} (${id})`);
  return id;
}

async function upsertConnections(
  env: z.infer<typeof EnvSchema>,
  hotelId: string,
  spec: PilotHotelSpec,
  dryRun: boolean,
): Promise<void> {
  const rows = [
    {
      hotel_id: hotelId,
      supplier: 'ratehawk',
      supplier_property_key: { hotelId: spec.ratehawk_etg_id },
      enabled: true,
      priority: 100,
      currency: 'EUR',
    },
    {
      hotel_id: hotelId,
      supplier: 'travelport',
      supplier_property_key: {
        chainCode: spec.travelport_chain,
        propertyCode: spec.travelport_property,
      },
      enabled: true,
      priority: 100,
      currency: 'EUR',
    },
  ];
  if (dryRun) {
    console.log(`[elena:seed] DRY-RUN connections for ${spec.slug}`, rows);
    return;
  }
  await sbWrite(
    env,
    'POST',
    'hotel_supplier_connections?on_conflict=hotel_id,supplier',
    rows,
    'resolution=merge-duplicates,return=minimal',
  );
  console.log(`[elena:seed] connections upserted for ${spec.slug} (ratehawk + travelport)`);
}

async function seedRooms(
  env: z.infer<typeof EnvSchema>,
  hotelId: string,
  spec: PilotHotelSpec,
  rhCfg: RateHawkClientConfig | null,
  dryRun: boolean,
): Promise<number> {
  const rhNames = await fetchRhRoomNames(rhCfg, spec.ratehawk_etg_id);
  const fallback = [
    'Deluxe King Room',
    'Deluxe Twin Room',
    'Executive King Room',
    'Junior Suite',
    'One Bedroom Suite',
    'Premium Suite',
  ];
  const names = rhNames.length > 0 ? rhNames : fallback;

  if (!dryRun) {
    await sbWrite(env, 'DELETE', `hotel_rooms?hotel_id=eq.${hotelId}`, undefined, 'return=minimal');
  }

  const roomRows = names.map((name, index) => {
    const slug = slugifyRoom(name) || `room-${index + 1}`;
    const code = roomCodeFromSlug(slug, index + 1);
    return {
      hotel_id: hotelId,
      room_code: code,
      slug,
      name_fr: name,
      name_en: name,
      description_fr: `${name} — catégorie proposée à ${spec.name}.`,
      description_en: `${name} — category offered at ${spec.name_en}.`,
      max_occupancy: 2,
      display_order: (index + 1) * 10,
    };
  });

  if (dryRun) {
    console.log(`[elena:seed] DRY-RUN ${roomRows.length} rooms for ${spec.slug}`);
    return roomRows.length;
  }

  await sbWrite(
    env,
    'POST',
    'hotel_rooms?on_conflict=hotel_id,room_code',
    roomRows,
    'resolution=merge-duplicates,return=minimal',
  );
  console.log(
    `[elena:seed] ${roomRows.length} room(s) for ${spec.slug} (${rhNames.length > 0 ? 'RateHawk names' : 'fallback'})`,
  );
  return roomRows.length;
}

async function main(): Promise<void> {
  const env = EnvSchema.parse(process.env);
  const dryRun = flag('dry-run') === 'true';

  const rhCfg: RateHawkClientConfig | null =
    env.RATEHAWK_API_BASE !== undefined &&
    env.RATEHAWK_KEY_ID !== undefined &&
    env.RATEHAWK_API_KEY !== undefined
      ? {
          baseUrl: env.RATEHAWK_API_BASE,
          keyId: env.RATEHAWK_KEY_ID,
          apiKey: env.RATEHAWK_API_KEY,
        }
      : null;

  console.log(`[elena:seed] ${PILOTS.length} pilot hotel(s)${dryRun ? ' (dry-run)' : ''}`);

  for (const spec of PILOTS) {
    const hotelId = await upsertHotel(env, spec, dryRun);
    await upsertConnections(env, hotelId, spec, dryRun);
    await seedRooms(env, hotelId, spec, rhCfg, dryRun);
  }

  console.log('[elena:seed] done — run ratehawk:bootstrap + travelport:bootstrap per slug next.');
}

main().catch((e: unknown) => {
  console.error('[elena:seed] fatal', e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
