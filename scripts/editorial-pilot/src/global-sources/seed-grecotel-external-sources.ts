/**
 * seed-grecotel-external-sources.ts — one-shot script to seed
 * `hotels.external_sources` for the 26 Grecotel scaffold-only rows
 * with the Tavily-extracted content. Honors ADR-0023:
 * `external_sources` carries provenance of editorial facts
 * (`{field, value, source, confidence, collected_at}`) so the LLM
 * prompts downstream (`seed-tier1-content.ts`, `factual-summary`,
 * etc.) can ground their output on real public copy from grecotel.com.
 *
 * Idempotent: re-running on an already-seeded row is a no-op. The
 * script merges new entries by `(source, field)` and never duplicates.
 *
 * CLI: no flags. Always live (no --dry-run yet) — small one-shot job.
 *
 * Skill: editorial-pilot, content-enrichment-pipeline, content-modeling.
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

interface PostgrestEnv {
  readonly restBase: string;
  readonly apikey: string;
}

function loadPostgrestEnv(): PostgrestEnv {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
  if (url.length === 0 || key.length === 0) {
    throw new Error('[seed-grecotel] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing');
  }
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
  return { restBase: `${url.replace(/\/+$/u, '')}/rest/v1`, apikey: key };
}

function pgHeaders(env: PostgrestEnv, extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: env.apikey,
    Authorization: `Bearer ${env.apikey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...extra,
  };
}

interface TavilySeed {
  readonly slug: string;
  readonly title: string;
  readonly url: string;
  readonly content: string;
  readonly score: number;
}

/**
 * Tavily search results collected via the cursor-ide Tavily MCP on
 * 2026-05-29 (queries scoped to `include_domains=grecotel.com`).
 * Each entry is the highest-scoring grecotel.com page for the hotel
 * — usually the canonical fiche page on the official site.
 */
const SEEDS: readonly TavilySeed[] = [
  {
    slug: 'amirandes',
    title: 'Amirandes | A Grecotel Resort to Live in Crete',
    url: 'https://www.grecotel.com/amirandes',
    content:
      "AMIRANDES, CRETE. A living tribute to Crete's legendary past, the palatial Amirandes reimagines the island's heritage with echoes of Minoan splendor and Venetian grace. Set on Crete's northern coast, just 10 minutes from Heraklion International Airport and a short drive from the UNESCO-listed Palace of Knossos, Amirandes feels both hidden and connected. The iconic resort begins a new chapter of elevated elegance, with refreshed interiors, newly reimagined seafront villas, and spacious new suite collections, paired with an all-inclusive experience. Discover a world of authentic taste at Amirandes, where nine restaurants and bars celebrate Cretan cuisine. Beachfront villas with private pools and panoramic sea views. Framed by a nature reserve and embraced by a golden-sand cove.",
    score: 0.87,
  },
  {
    slug: 'astirpalace',
    title: 'Grecotel Astir Palace | Luxury Hotel in Alexandroupolis',
    url: 'https://www.grecotel.com/astirpalace',
    content:
      'Grecotel Astir Palace nestled in Alexandroupolis enjoys a commanding beachfront location on a pine-draped hillside sloping toward the Thracian Sea. The Astir Palace combines a privileged setting in the northeastern Greek city of Alexandroupolis with the warm Grecotel service. It is the gateway to explore the natural beauty and cultural heritage of Thrace.',
    score: 0.74,
  },
  {
    slug: 'capesounio',
    title: 'Grecotel Cape Sounio | Luxury Resort on the Athens Riviera',
    url: 'https://www.grecotel.com/capesounio',
    content:
      'Cape Sounio in Athens Riviera offers coloured bungalows and exclusive villas in a privileged location, with private pools and unique views to the sea and the Temple of Poseidon. The resort sits on the southernmost tip of Attica, framed by a pine forest and two beaches, on the onset of the Aegean Sea, amid the ancient ruins. Dreamy luxury suites overlook the Temple of Poseidon with exquisite furnishings and private swimming pools. Beachfront bungalows blend contemporary elegance, calming colors and refined furnishings.',
    score: 0.82,
  },
  {
    slug: 'caramel',
    title: 'Grecotel Caramel | Boutique Resort In Crete',
    url: 'https://www.grecotel.com/caramel',
    content:
      "Grecotel's Caramel Boutique Resort offers luxury holidays in Crete. A luxury hotel with unique rooms, private pools, exclusive services and kids activities. Located in Rethymno, the boutique resort features 2-bedroom beach villas with direct sea access and a split-level layout. The site features beachfront villas and unique architecture, with focus on personalized service and a smaller scale than the larger Grecotel resorts on the island.",
    score: 0.82,
  },
  {
    slug: 'casa-marron',
    title: 'Grecotel Casa Marron | All inclusive Hotel in Peloponnese',
    url: 'https://www.grecotel.com/casa-marron',
    content:
      "Casa Marron is an all-inclusive hotel in Peloponnese, situated directly on the beach. An ideal resort for family holidays. An inviting, bohemian family beachfront resort in Achaia, with versatile and bright family accommodation. Embark on unforgettable family getaways at Casa Marron, our all-inclusive beach haven. Dive into endless fun with the Grecoland kids' club.",
    score: 0.92,
  },
  {
    slug: 'casa-paradiso',
    title: 'Grecotel Casa Paradiso | Family Resort in Kos',
    url: 'https://www.grecotel.com/casa-paradiso',
    content:
      "Grecotel Casa Paradiso lies on a wonderful sandy beach in Marmari, with its own palmerai. Ideal for family escapes, located on an idyllic stretch of coast in Kos. Designed with families in mind, Casa Paradiso pairs the timeless character of a traditional Aegean village with the sophisticated comforts of refined island living. Room types include Casa Room, Casa Family, Family Interconnecting Room, and Casa Grande Paradiso suites. An airy open-plan bungalow inspired by Aegean living, set in gardens with private balconies and sea or field views. Children's facilities and an all-inclusive option available.",
    score: 1.0,
  },
  {
    slug: 'casaadele',
    title: 'Grecotel Casa Adele | Luxury Resort in Rethymno, Crete',
    url: 'https://www.grecotel.com/casaadele',
    content:
      'Designed like a Cretan village, Casa Adele is located in the eastern part of Rethymno and offers a great choice of spacious self-catering accommodations. Fully renovated and newly unveiled, guests enjoy three freshwater pools, stylish lounges and pavilions, a Greek-Italian restaurant with seasonal summer flavours. The Fitness Club and Spa spans over 230 m², offering a fully equipped gym, squash court, sauna, hydromassage bathtub. The serene indoor mosaic pool provides a peaceful adults-only retreat. Yoga sessions and two luxury massage cabins available.',
    score: 0.78,
  },
  {
    slug: 'corfuimperial',
    title: 'Grecotel Corfu Imperial | 5 star Hotel in Corfu Island',
    url: 'https://www.grecotel.com/corfuimperial',
    content:
      "Grecotel Corfu Imperial is probably Greece's most impressively located hotel, perched above the olive groves at the end of panoramic Peninsula Kommeno. Exclusive hideaways on the waterfront, with Medusa Estate (a Corfiot palace) on the most privileged spot of Kommeno Peninsula. Part of Grecotel's iconic collection of luxury resorts.",
    score: 0.85,
  },
  {
    slug: 'cretapalace',
    title: 'Grecotel Creta Palace | Luxury Hotel in Crete',
    url: 'https://www.grecotel.com/cretapalace',
    content:
      "Creta Palace is a beach resort in Crete. An avant-garde of Grecotel's luxury resorts. Newly transformed from the ground up, the resort unveils breathtaking poolscapes, entirely redesigned accommodations and a vibrant dining collection, all set against 12 kilometres of the island's finest coastline in Rethymno. Best kids programming and a new Aqua Park, with a spa for rejuvenation. Four overflowing pools, one heated during April, May and October, surrounded by gardens of frangipani and palm trees. A brand-new Aqua Park (operating from July) and a zero-entry pool, plus a black indoor pool. Children up to 12 years stay free in select room types and periods.",
    score: 0.86,
  },
  {
    slug: 'egnatia',
    title: 'Grecotel Egnatia | Hotel in Alexandroupolis',
    url: 'https://www.grecotel.com/egnatia',
    content:
      'Grecotel Egnatia is a premier destination for luxury stays, business meetings, corporate events, and stylish celebrations, combining natural beauty with world-class hospitality. Located in Alexandroupolis with comfortable accommodations and a central location, the ideal base to explore the natural beauty and charm of Thrace, in northeastern Greece.',
    score: 0.77,
  },
  {
    slug: 'eva-palace',
    title: 'Grecotel Eva Palace | Luxury Resort in Corfu',
    url: 'https://www.grecotel.com/eva-palace',
    content:
      "Grecotel's Eva Palace is one of the best 5-star hotels on the Kommeno Peninsula in Corfu, offering luxury accommodation. Gloriously positioned on Kommeno Peninsula with thrilling views, a belle epoque beach and a giant pool jardin. Eva Palace is nestled in cypress gardens. Address: Kommeno 490 83, Corfu. From Corfu International Airport, a short transfer to the resort.",
    score: 0.91,
  },
  {
    slug: 'filoxeniakalamata',
    title: 'Grecotel Filoxenia Kalamata | Luxury Resort in Messinia',
    url: 'https://www.grecotel.com/filoxeniakalamata',
    content:
      'FILOXENIA KALAMATA, MESSINIA. Hotel Filoxenia celebrates the timeless and warm hospitality for which Grecotel is known. With olive and palm gardens flowing into the sea and gorgeous infinity pools, this elegant beachfront hotel offers 162 rooms and suites with Olive Spa pampering. The hotel reopens on May 8th, 2026 after a stunning renovation. Fully renewed for 2026: contemporary, elegant and deeply connected to the Messinian land. Olive Club seafront restaurant, all-day Pool restaurant and Bar celebrating the spirit of Messinia. Framed by the Messinian Gulf and Mount Taygetus. Gateway to Ancient Messini, Methoni & Koroni Byzantine towns, and Mani peninsula.',
    score: 0.89,
  },
  {
    slug: 'la-riviera-peloponnese',
    title: 'Riviera Olympia & Aqua Park | Beach Resorts in Peloponnese',
    url: 'https://www.grecotel.com/luxme-oasis/riviera-olympia',
    content:
      "Riviera Olympia & Aqua Park is a one-of-a-kind Mega Resort in Kyllini, Western Peloponnese, accommodating all ages and preferences. The mythical Riviera Olympia destination features Mandola Rosa, Riviera Olympia, LUXME Oasis and Ilia Palms resorts. Situated on a vast 2 km golden 'Blue Flag' beach and a 500-acre natural estate. The 20,000 m² Olympia Aqua Park is the largest in any Greek resort. Aquamarine crystal-clear waters of the Ionian Sea. Choose from four distinctive resorts and the luxury haven of LUXME Oasis private villas.",
    score: 0.82,
  },
  {
    slug: 'larissaimperial',
    title: 'Grecotel Larissa Imperial | Luxury Hotel in Larissa',
    url: 'https://www.grecotel.com/larissaimperial',
    content:
      'Larissa Imperial 5-star hotel offers luxury accommodation in central Greece. Ideal for luxury vacation, events and meetings. Grecotel Larissa Imperial enjoys a privileged location just 3 km from Larissa city centre in Thessaly, easily accessible year-round from Athens in 3.5 hours.',
    score: 0.76,
  },
  {
    slug: 'luxme-damadama',
    title: 'Grecotel LUXME Dama Dama | Luxury All inclusive Hotel, Rhodes',
    url: 'https://www.grecotel.com/luxme-damadama',
    content:
      'Dama Dama lies on famous Faliraki beach in Rhodes and features sun-filled public spaces, a 100-metre pool and gardens with bungalows framed by a vast beach line. Cutting-edge wellness and an upscale all-inclusive experience under the LUXME package. Beachfront resort with the LUXME (Luxury Made Easy) all-inclusive concept.',
    score: 0.88,
  },
  {
    slug: 'luxme-daphnilabay',
    title: 'Grecotel Daphnila Bay | Luxury Hotel in Corfu',
    url: 'https://www.grecotel.com/luxme-daphnilabay',
    content:
      "Daphnila Bay is one of Corfu's top all-inclusive resorts, located in Dassia, offering stunning views, exceptional dining, and premium hospitality. World of choices on the waterfront, with exceptional food and beverage including breakfast, lunch, dinner, à la carte dining, scheduled snacks, Patisserie-Chocolaterie, Crêperie-Gelateria, and unlimited drinks. In-room comforts include complimentary stocked minibar, Nespresso, tea, Wi-Fi, safe. Natural sandy beach to freely enjoy with family. Children up to 12 stay free with complimentary kids' dining and snacks, Grecoland Kids' programme, access to the Aqua Park at LUXME Costa Botanica.",
    score: 0.85,
  },
  {
    slug: 'luxme-kosimperial',
    title: 'Grecotel LUXME Kos | Luxury All inclusive Hotel, Kos',
    url: 'https://www.grecotel.com/luxme-kosimperial',
    content:
      "Grecotel LUX®ME Kos is ideally situated in Psalidi, just 4 km from Kos Town and its charming harbour. Kos International Airport 'Ippokratis' is 38 km away. The private pebble beach opens onto the Aegean, framed by exotic gardens. The LUXME concept (Luxury Made Easy) is the finest all-inclusive holiday experience in Greece. Adults-only experience includes the SPA indoor and thalassotherapy pools, a dedicated beach and restaurant area, and the Secret Lobby Bar reserved from 20:00 to midnight. Children up to 12 stay free with complimentary kids' dining and snacks plus the full Grecoland programme.",
    score: 0.86,
  },
  {
    slug: 'luxme-oasis',
    title: 'Grecotel LUXME Oasis | Luxury All Inclusive Hotel, Peloponnese',
    url: 'https://www.grecotel.com/luxme-oasis',
    content:
      "Set on Olympia's legendary shores in West Peloponnese — where the Olympic Games were born — LUXME Oasis is part of the iconic Grecotel Olympia Riviera complex and home to the largest Aqua Park in Greece. Voted among the Top 10 Best Resorts in Greece by the 2024 Condé Nast Traveler Readers' Choice Awards. Six crystal-clear pools, the Elixir Spa Center (4,500 m² inspired by the rotunda of Ancient Olympia), and a 20,000 m² aqua park. Five à la carte restaurants combining Mediterranean and Asian flavours. 2 km Blue Flag sandy beach. Children up to 12 stay free in select room types and periods.",
    score: 0.88,
  },
  {
    slug: 'luxme-whitepalace',
    title: 'LUXME Grecotel White | Luxury All Inclusive Hotel, Crete',
    url: 'https://www.grecotel.com/luxme-whitepalace',
    content:
      "Grecotel LUXME White lies on Crete's stunning north coast in Rethymno and features open-style public spaces and generous light-filled accommodations. The hotel sits on a 1,000 m long sand and pebble coastline. The sea is of exceptional water quality verified by the vast posidonia meadows. Fabulous pool life, exquisite gastronomy, the chilling Hippie Spa, and a vast array of activities.",
    score: 0.83,
  },
  {
    slug: 'mandolarosa',
    title: 'Mandola Rosa | A Grecotel Resort to Live in Peloponnese',
    url: 'https://www.grecotel.com/mandolarosa',
    content:
      'A shining jewel on the Ionian coast, Mandola Rosa is an intimate boutique resort of timeless elegance. Its ethereal suites and beachfront villas invite you to experience the art of slow living. Set on a two-kilometre golden beach in the heart of the Riviera Olympia near Kyllini in Western Peloponnese. Surrounded by emerald gardens and embraced by the Ionian Sea. Just 52 suites and beachfront villas — 26 sumptuous suites and 25 reimagined beachfront villas — for discreet ultra-luxury. Inspired by the ideals of Ancient Greece, every detail reflects harmony and proportion.',
    score: 0.9,
  },
  {
    slug: 'marine-palace',
    title: 'Marine Palace & Aqua Park | All inclusive Hotel in Crete',
    url: 'https://www.grecotel.com/marine-palace',
    content:
      'Marine Palace & Aqua Park in Crete offers all-inclusive family fun with a seaside village vibe, lush gardens and a thrilling Aqua Park. Family bungalow accommodations feature cool crisp colors echoing the vibrant gardens, with two sleeping areas ideal for younger guests and their parents. Size 35 m² indoor with sea, side sea or garden views. Located in the garden area on ground or first floor. Family room layouts include king or twin beds plus two extra sofa beds, sleeping 2 adults and 2 children. Nespresso machine with complimentary pods per adult per day. All-inclusive resort on the north coast of Crete.',
    score: 0.88,
  },
  {
    slug: 'mykonos-lolita',
    title: 'Mykonos Lolita | Boutique Resort in Agios Sostis',
    url: 'https://www.grecotel.com/mykonos-lolita',
    content:
      'Mykonos Lolita offers a secluded escape with a private beach, stunning views and a dreamy luxury Cycladic setting for weddings. Located on the island of Mykonos in the tranquil Agios Sostis area, overlooking the Aegean Sea. A smaller, more intimate Grecotel address than Mykonos Blu, set away from the noisy core of the island and oriented toward couples and special occasions.',
    score: 0.76,
  },
  {
    slug: 'mykonosblu',
    title: 'Mykonos Blu | Luxury hotel in Mykonos, Psarou Beach',
    url: 'https://www.grecotel.com/mykonosblu',
    content:
      "Mykonos Blu, a 5-star Cycladic oasis on Psarou Beach, offers luxury, breathtaking Aegean views and elite ambiance. Three restaurants, a spa, a 2-level infinity pool, and luxurious sea-view accommodations. Stands on its private part of Psarou. Perfectly positioned 0.8 km from Psarou Beach, approximately 5 minutes' walk from Aegean Sea, 15 minutes' walk from Psarou village. Mykonos International Airport is 10 minutes' drive away. The Mykonos Blu has a \"Traveler's Choice\" distinction.",
    score: 0.85,
  },
  {
    slug: 'plazabeachhouse',
    title: 'Grecotel Plaza Beach House | Resort in Crete',
    url: 'https://www.grecotel.com/plazabeachhouse',
    content:
      "Grecotel Plaza Beach House is nestled on the sun-kissed northern coast of Crete in Rethymno. Set on a pristine beachfront, the resort blends breathtaking vistas of the azure Cretan Sea with the radiant charm of Rethymno town. Ideal for guests seeking luxurious accommodations with self-catering facilities combined with resort-style comforts, only minutes away from the city's nightlife. Perfectly positioned between the sparkling Aegean Sea and Crete's imposing mountains. Hosts 84 spacious apartments with a variety of family-friendly layouts. Pool House for relaxation, with a spa featuring a hammam and sauna, fitness room and pool. Studios, petit lofts, master lofts, and 2-bedroom maisonettes available.",
    score: 0.92,
  },
  {
    slug: 'resort-costabotanica',
    title: 'LUXME Grecotel Costa Botanica | Luxury All Inclusive Hotel, Corfu',
    url: 'https://www.grecotel.com/resort-costabotanica',
    content:
      'Grecotel LUXME Costa Botanica is an all-inclusive resort immersed in nature, spanning 350,000 square metres of land and canals, sitting along a 1,000-metre-long natural beach facing the Ionian Sea in Acharavi, Corfu. Designed as a childhood paradise in a stunning landscape, thoughtfully reimagined to offer endless fun and relaxation for all ages. Located near the Lake of Lilies, where otters glide through secret waterways. The on-site Aqua Park is open to guests. Children up to 12 enjoy free kids dining in the "Tasty Corner", free Grecoland kids\' programme, GrecoTeens, outdoor creative activities, unlimited access to the Aqua Park, and stay free in the parent\'s room in select room types and periods.',
    score: 0.92,
  },
  {
    slug: 'therocclub',
    title: 'Grecotel The Roc Club | Hotel in Vouliagmeni Athens Riviera',
    url: 'https://www.grecotel.com/therocclub',
    content:
      'The Roc Club is a sparkling, cool Club-Maison in the heart of the Athens Riviera, in Vouliagmeni. 34 rooms and suites face the Vouliagmeni peninsula and Marina, with the brand-new Rocket Bar & Restaurant opening May 2026. Indulge in the Roc Pool, carved into the Vouliagmeni Lake rocks. Steps away from the celebrated Vouliagmeni Lake, renowned for its lush nature, majestic caves, thermal springs and healing energy. Within walking proximity: buzzing cafés and restaurants, the new Astir Marina with its yacht club and ultra-luxury shopping, fascinating water sports, cosmopolitan sandy beaches. 4 restaurants and bars at the property.',
    score: 0.86,
  },
];

interface ExternalSourceEntry {
  readonly field: string;
  readonly value: string | Record<string, unknown>;
  readonly source: string;
  readonly source_url?: string;
  readonly confidence: 'high' | 'medium' | 'low';
  readonly collected_at: string;
}

async function fetchExternalSources(
  env: PostgrestEnv,
  slug: string,
): Promise<ReadonlyArray<ExternalSourceEntry> | null> {
  const url = `${env.restBase}/hotels?slug=eq.${encodeURIComponent(slug)}&select=external_sources`;
  const res = await fetch(url, { headers: pgHeaders(env) });
  if (!res.ok) {
    throw new Error(`GET ${slug} failed: ${res.status} ${await res.text()}`);
  }
  const rows = (await res.json()) as ReadonlyArray<{
    external_sources: unknown;
  }>;
  if (rows.length === 0) return null;
  const raw = rows[0]?.external_sources;
  if (!Array.isArray(raw)) return [];
  return raw as ReadonlyArray<ExternalSourceEntry>;
}

async function patchExternalSources(
  env: PostgrestEnv,
  slug: string,
  next: ReadonlyArray<ExternalSourceEntry>,
): Promise<void> {
  const url = `${env.restBase}/hotels?slug=eq.${encodeURIComponent(slug)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: pgHeaders(env, { Prefer: 'return=minimal' }),
    body: JSON.stringify({ external_sources: next }),
  });
  if (!res.ok) {
    throw new Error(`PATCH ${slug} failed: ${res.status} ${await res.text()}`);
  }
}

function isSameKey(a: ExternalSourceEntry, b: ExternalSourceEntry): boolean {
  return a.source === b.source && a.field === b.field;
}

async function main(): Promise<void> {
  const env = loadPostgrestEnv();
  const collectedAt = new Date().toISOString();

  console.log(`[seed-grecotel] persisting Tavily seeds for ${SEEDS.length} hotels…`);
  let okCount = 0;
  let skipCount = 0;
  let errCount = 0;

  for (const seed of SEEDS) {
    try {
      const existing = await fetchExternalSources(env, seed.slug);
      if (existing === null) {
        console.warn(`[seed-grecotel] ${seed.slug}: row not found, skipping`);
        skipCount += 1;
        continue;
      }
      const newEntry: ExternalSourceEntry = {
        field: 'description_seed',
        value: {
          title: seed.title,
          content: seed.content,
          url: seed.url,
          relevance_score: seed.score,
        },
        source: 'tavily',
        source_url: seed.url,
        confidence: 'high',
        collected_at: collectedAt,
      };
      const brandEntry: ExternalSourceEntry = {
        field: 'brand',
        value: 'grecotel',
        source: 'manual_curation',
        confidence: 'high',
        collected_at: collectedAt,
      };
      // Idempotent merge — replace any prior entry with the same (source, field).
      const filtered = existing.filter((e) => !isSameKey(e, newEntry) && !isSameKey(e, brandEntry));
      const next = [...filtered, newEntry, brandEntry];
      await patchExternalSources(env, seed.slug, next);
      console.log(`[seed-grecotel] ${seed.slug}: ok (${next.length} entries)`);
      okCount += 1;
    } catch (err) {
      console.error(`[seed-grecotel] ${seed.slug}: FAIL ${(err as Error).message}`);
      errCount += 1;
    }
  }

  console.log(`\n[seed-grecotel] DONE: ok=${okCount} skip=${skipCount} err=${errCount}`);
  if (errCount > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[seed-grecotel] FATAL', err);
  process.exit(1);
});
