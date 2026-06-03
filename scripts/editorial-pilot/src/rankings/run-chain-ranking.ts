/**
 * Chain-aware ranking runner — Phase 4.B (cross-chain rankings).
 *
 * Loads chain-filtered hotels from `out/chain-hotels/<chain>.json`
 * (pre-populated by `extract-chain-json.mjs` from MCP execute_sql
 * dumps), defines a RankingSeed per chain inline, calls
 * `generateRankingV2()`, and writes the output to
 * `data/rankings-cache/<slug>/generated.json` (same convention as the
 * matrix bulk runner).
 *
 * The push to Supabase is NOT done by this script — the orchestrator
 * (agent) is responsible for reading the generated JSON and applying
 * the upsert via Supabase MCP `execute_sql`. This avoids needing a
 * SUPABASE_DB_URL in `.env.local`.
 *
 * Usage:
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/rankings/run-chain-ranking.ts --slug=top-aman-hotels-monde
 *
 * Flags:
 *   --slug=<slug>      REQUIRED. One of the slugs in CHAIN_SPECS below.
 *   --dry-run          Just prints what would be generated.
 *   --force            Re-run even if cache exists.
 */

import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

import { generateRankingV2 } from './generate-ranking-v2.js';
import type { HotelCatalogRow } from './load-hotels-catalog.js';
import type { RankingSeed } from './rankings-catalog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PILOT_ROOT = path.resolve(__dirname, '../..');
const CHAIN_HOTELS_DIR = path.resolve(PILOT_ROOT, 'out/chain-hotels');
const CACHE_ROOT = path.resolve(PILOT_ROOT, 'data/rankings-cache');

// ─── Chain specs ─────────────────────────────────────────────────────

interface ChainSpec {
  readonly chainKey: string;
  readonly slug: string;
  readonly titleFr: string;
  readonly titleEn: string;
  readonly kind: RankingSeed['kind'];
  readonly targetLength: number;
  readonly keywordsFr: readonly string[];
  /** Optional extra filter (e.g. is_palace) on top of the chain file. */
  readonly extraFilter?: (h: HotelCatalogRow) => boolean;
}

export const CHAIN_SPECS: readonly ChainSpec[] = [
  {
    chainKey: 'aman',
    slug: 'top-aman-hotels-monde',
    titleFr: 'Top Aman — les plus belles adresses de la collection dans le monde',
    titleEn: 'Top Aman — the finest addresses in the worldwide collection',
    kind: 'thematic',
    targetLength: 25,
    keywordsFr: [
      'collection Aman — Adrian Zecha, philosophie discrétion + intimité',
      'destinations signature : Bhoutan, Japon, Indonésie, Italie, Maroc',
      'pavillons et villas privées, spa Aman, gastronomie locale revisitée',
      'clientèle quête de retraite, lune de miel, voyage initiatique',
      'service ratio personnel / chambre élevé, expériences sur-mesure',
    ],
  },
  {
    chainKey: 'four_seasons',
    slug: 'top-four-seasons-palaces-monde',
    titleFr: 'Top Four Seasons — les palaces et flagships de la collection mondiale',
    titleEn: 'Top Four Seasons — palaces and flagships from the worldwide collection',
    kind: 'thematic',
    targetLength: 30,
    keywordsFr: [
      'Four Seasons — référence service luxe global depuis 1961',
      'flagships et adresses palace : George V Paris, Cap-Ferrat, Firenze, Bora Bora',
      'spa, restaurants étoilés Michelin, kids program, business amenities',
      'Four Seasons Private Retreats — villas privées exceptionnelles',
      "mariages, événements MICE, lunes de miel, voyages d'affaires premium",
    ],
  },
  {
    chainKey: 'mandarin_oriental',
    slug: 'top-mandarin-oriental-hotels-monde',
    titleFr: "Top Mandarin Oriental — la collection hôtelière asiatique d'exception",
    titleEn: 'Top Mandarin Oriental — the finest hotels from the Asian luxury collection',
    kind: 'thematic',
    targetLength: 20,
    keywordsFr: [
      'Mandarin Oriental — hospitalité asiatique adaptée à chaque destination',
      'flagships : Hong Kong, Bangkok, Tokyo, Paris, Londres, Genève',
      'spa Mandarin Oriental signature, gastronomie étoilée Michelin (Pierre Gagnaire, Heston Blumenthal, Daniel Boulud)',
      'design intérieur — souvent par Tony Chi, Adam D. Tihany, Christophe Pillet',
      "clientèle internationale fortunée, lunes de miel, voyages d'affaires haut de gamme",
    ],
  },
  {
    chainKey: 'six_senses',
    slug: 'top-six-senses-wellness-monde',
    titleFr: 'Top Six Senses — la collection wellness et sustainability dans le monde',
    titleEn: 'Top Six Senses — the finest wellness and sustainability resorts worldwide',
    kind: 'thematic',
    targetLength: 20,
    keywordsFr: [
      "Six Senses — pionnier du wellness intégré et de l'éco-conception",
      'destinations signature : Maldives, Oman, Bhoutan, Portugal, Suisse',
      'spa programs (Yoga, sleep, cleanse, longevity), Wellness Screening',
      'architecture sustainability, zero waste, biophilic design',
      'clientèle quête de retraite bien-être, slow travel, voyageurs conscients',
    ],
  },
  {
    chainKey: 'cheval_blanc',
    slug: 'cheval-blanc-toutes-les-maisons',
    titleFr: 'Cheval Blanc — toutes les Maisons LVMH dans le monde',
    titleEn: 'Cheval Blanc — every LVMH Maison in the worldwide collection',
    kind: 'thematic',
    targetLength: 5,
    keywordsFr: [
      'Cheval Blanc — Maisons LVMH, art de recevoir français contemporain',
      'Courchevel (ski-in / ski-out 1850), Saint-Tropez, Paris (La Samaritaine), Maldives (Randheli), Saint-Barth (Isle de France)',
      'gastronomie étoilée — Yannick Alléno, Arnaud Donckele',
      'spa Cheval Blanc partenariat Guerlain et Dior',
      "patrimoine LVMH — collections d'art, design d'auteur (Peter Marino, Patrick Jouin)",
    ],
  },
  {
    chainKey: 'belmond',
    slug: 'top-belmond-hotels-monde',
    titleFr: 'Top Belmond — palaces et resorts emblématiques (LVMH)',
    titleEn: 'Top Belmond — iconic palaces and resorts (LVMH)',
    kind: 'thematic',
    targetLength: 15,
    keywordsFr: [
      'Belmond — depuis 2019 dans le giron LVMH, héritage Orient-Express',
      "palaces signature : Hotel Cipriani Venise, Splendido Portofino, Caruso Ravello, Reid's Palace Madère",
      'trains de luxe Belmond — Venice Simplon-Orient-Express, Eastern & Oriental Express',
      'croisières fluviales en France (Afloat in France) et Birmanie (Road to Mandalay)',
      'art de vivre méditerranéen et britannique, clientèle internationale fortunée et collectionneurs',
    ],
  },
  {
    chainKey: 'rosewood',
    slug: 'top-rosewood-hotels-monde',
    titleFr: 'Top Rosewood — la collection ultra-luxe sino-américaine',
    titleEn: 'Top Rosewood — the ultra-luxury Sino-American collection',
    kind: 'thematic',
    targetLength: 15,
    keywordsFr: [
      'Rosewood — philosophie "A Sense of Place", chaque hôtel reflète l\'esprit du lieu',
      'flagships urbains : Mansion on Turtle Creek Dallas, Carlyle New York, Hong Kong, Sao Paulo',
      'resorts signature : Mayakoba (Mexique), Phuket, Le Guanahani (Saint-Barth)',
      'Asaya — programme wellness signature avec coachs experts',
      'clientèle UHNWI internationale, événements privés, mariages exclusifs',
    ],
  },
  {
    chainKey: 'park_hyatt',
    slug: 'top-park-hyatt-hotels-monde',
    titleFr: 'Top Park Hyatt — le luxe contemporain Hyatt dans le monde',
    titleEn: "Top Park Hyatt — Hyatt's contemporary luxury collection worldwide",
    kind: 'thematic',
    targetLength: 20,
    keywordsFr: [
      "Park Hyatt — flagship luxe du groupe Hyatt, design contemporain d'auteur",
      'destinations urbaines : Tokyo (Lost in Translation), Paris-Vendôme, New York, Sydney, Vienna, Milan',
      'Spas Park Hyatt — souvent rooftop ou centre-ville premium',
      'Park Hyatt Niseko Hanazono, Saint-Kitts, Maldives — escapades resort de la collection',
      "clientèle business haut de gamme, voyageurs d'affaires premium, lunes de miel urbaines",
    ],
  },
];

// ─── Loader ──────────────────────────────────────────────────────────

const HotelDumpSchema = z.array(
  z.object({
    id: z.string(),
    slug: z.string(),
    slug_en: z.string().nullable().optional(),
    name: z.string(),
    name_en: z.string().nullable().optional(),
    stars: z.number().int(),
    is_palace: z.boolean(),
    city: z.string(),
    region: z.string(),
    country_code: z.string().nullable().optional(),
    description_fr: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    postal_code: z.string().nullable().optional(),
    latitude: z.union([z.string(), z.number()]).nullable().optional(),
    longitude: z.union([z.string(), z.number()]).nullable().optional(),
  }),
);

async function loadChainHotels(chainKey: string): Promise<HotelCatalogRow[]> {
  const fp = path.join(CHAIN_HOTELS_DIR, `${chainKey}.json`);
  const raw = await readFile(fp, 'utf8');
  const parsed = HotelDumpSchema.parse(JSON.parse(raw));
  return parsed.map((h) => ({
    id: h.id,
    slug: h.slug,
    slug_en: h.slug_en ?? null,
    name: h.name,
    name_en: h.name_en ?? null,
    stars: h.stars,
    is_palace: h.is_palace,
    city: h.city,
    region: h.region,
    country_code: h.country_code ?? null,
    description_fr: h.description_fr ?? null,
    address: h.address ?? null,
    postal_code: h.postal_code ?? null,
    latitude: h.latitude ?? null,
    longitude: h.longitude ?? null,
    luxury_tier: null,
  }));
}

// ─── CLI ─────────────────────────────────────────────────────────────

interface Args {
  readonly slug: string;
  readonly dryRun: boolean;
  readonly force: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let slug = '';
  let dryRun = false;
  let force = false;
  for (const a of argv) {
    if (a === '--dry-run') dryRun = true;
    else if (a === '--force') force = true;
    else if (a.startsWith('--slug=')) slug = a.slice('--slug='.length);
  }
  if (slug.length === 0) {
    console.error('Missing --slug=<slug>. Available slugs:');
    for (const c of CHAIN_SPECS) console.error(`  - ${c.slug}`);
    process.exit(1);
  }
  return { slug, dryRun, force };
}

// ─── Main ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs();
  const spec = CHAIN_SPECS.find((c) => c.slug === args.slug);
  if (!spec) {
    console.error(`Unknown slug "${args.slug}". Available:`);
    for (const c of CHAIN_SPECS) console.error(`  - ${c.slug}`);
    process.exit(1);
  }

  const hotels = await loadChainHotels(spec.chainKey);
  const eligible = spec.extraFilter ? hotels.filter(spec.extraFilter) : hotels;
  console.log(
    `Chain ${spec.chainKey}: loaded ${hotels.length} hotels, eligible ${eligible.length} after filter.`,
  );

  if (eligible.length < 3) {
    throw new Error(`Not enough eligible hotels (${eligible.length}).`);
  }
  if (eligible.length < spec.targetLength) {
    console.warn(
      `  ⚠ Only ${eligible.length} eligible — will truncate target ${spec.targetLength} to ${eligible.length}.`,
    );
  }

  const seed: RankingSeed = {
    slug: spec.slug,
    titleFr: spec.titleFr,
    titleEn: spec.titleEn,
    kind: spec.kind,
    targetLength: Math.min(spec.targetLength, eligible.length),
    keywordsFr: spec.keywordsFr,
    eligibility: () => true,
  };

  const cacheDir = path.resolve(CACHE_ROOT, spec.slug);
  const cacheFile = path.join(cacheDir, 'generated.json');

  if (!args.force) {
    try {
      await stat(cacheFile);
      console.log(`✓ cached at ${path.relative(process.cwd(), cacheFile)} — use --force to regen.`);
      return;
    } catch {
      // not cached → continue
    }
  }

  if (args.dryRun) {
    console.log(`(dry-run) would generate ${spec.slug} from ${eligible.length} hotels.`);
    return;
  }

  const t0 = Date.now();
  console.log(`Generating ${spec.slug} (target=${seed.targetLength} from ${eligible.length})…`);
  const ranking = await generateRankingV2(seed, eligible);
  const dt = ((Date.now() - t0) / 1000).toFixed(1);

  await mkdir(cacheDir, { recursive: true });
  await writeFile(cacheFile, JSON.stringify(ranking, null, 2), 'utf8');
  await writeFile(
    path.join(cacheDir, 'seed.json'),
    JSON.stringify(
      {
        slug: spec.slug,
        titleFr: spec.titleFr,
        titleEn: spec.titleEn,
        kind: spec.kind,
        publish: true,
        chainKey: spec.chainKey,
        targetLength: spec.targetLength,
      },
      null,
      2,
    ),
    'utf8',
  );
  console.log(
    `✓ generated in ${dt}s → ${path.relative(process.cwd(), cacheFile)} (entries=${ranking.entries.length}, faq=${ranking.faq.length})`,
  );
  console.log(
    `\nNext: agent should push via Supabase MCP execute_sql. Source: ${path.relative(process.cwd(), cacheFile)}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
