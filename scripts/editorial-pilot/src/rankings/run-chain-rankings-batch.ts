/**
 * Chain-aware ranking BATCH runner — Phase 3 (cross-chain rankings, wave 2).
 *
 * The original `run-chain-ranking.ts` shipped the first 8 chains (Aman,
 * Four Seasons, Mandarin Oriental, Six Senses, Cheval Blanc, Belmond,
 * Rosewood, Park Hyatt) from pre-dumped `out/chain-hotels/<chain>.json`
 * files and left the Supabase push to the agent.
 *
 * This batch runner closes the remaining viable chains in the curated
 * catalogue. It is fully self-contained:
 *   - Reads the full catalogue from `out/hotels-catalog.json` (2219
 *     rows, refreshed 2026-05-31) and filters per chain by a name
 *     regex — no per-chain JSON dump needed.
 *   - Generates each ranking via `generateRankingV2` (with a per-slug
 *     cache in `data/rankings-cache/<slug>/`, same convention as the
 *     matrix bulk runner — re-runs skip cached slugs unless --force).
 *   - Pushes directly to Supabase via `pushRankingV2` (DATABASE_URL),
 *     same path the matrix bulk runner uses. The `is_published` ratchet
 *     in pushRankingV2 means a re-push never downgrades a live page.
 *
 * Usage:
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/rankings/run-chain-rankings-batch.ts \
 *     [--only=top-raffles-hotels-monde,top-bulgari-hotels-monde] \
 *     [--concurrency=2] \
 *     [--force] \
 *     [--dry-run] \
 *     [--draft] \
 *     [--no-push]
 */

import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateRankingV2, type GeneratedRankingV2 } from './generate-ranking-v2.js';
import { GeneratedRankingV2Schema } from './generate-ranking-v2.js';
import { loadHotelsCatalog, type HotelCatalogRow } from './load-hotels-catalog.js';
import { pushRankingV2 } from './push-ranking-v2.js';
import type { RankingSeed } from './rankings-catalog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PILOT_ROOT = path.resolve(__dirname, '../..');
const CACHE_ROOT = path.resolve(PILOT_ROOT, 'data/rankings-cache');
const RUNLOG_PATH = path.resolve(CACHE_ROOT, '_chain-batch-runlog.jsonl');

// ─── Chain specs (wave 2) ────────────────────────────────────────────

interface ChainSpec {
  readonly slug: string;
  /** Case-insensitive regex matched against `hotels.name`. */
  readonly nameRegex: RegExp;
  readonly titleFr: string;
  readonly titleEn: string;
  readonly targetLength: number;
  readonly keywordsFr: readonly string[];
}

export const CHAIN_SPECS_WAVE2: readonly ChainSpec[] = [
  {
    slug: 'top-ritz-carlton-hotels-monde',
    nameRegex: /ritz.?carlton/iu,
    titleFr: 'Top Ritz-Carlton — les adresses signature de la collection mondiale',
    titleEn: 'Top Ritz-Carlton — the signature addresses of the worldwide collection',
    targetLength: 30,
    keywordsFr: [
      'Ritz-Carlton — référence du service luxe Marriott, héritage César Ritz',
      'flagships urbains et resorts balnéaires : Half Moon Bay, Abama Tenerife, Kyoto, Bali',
      'Club Level, Ritz-Carlton Spa, gastronomie locale et tables étoilées',
      'mariages, MICE, séjours famille avec Ritz Kids',
      'clientèle internationale fidèle, programme Marriott Bonvoy haut de gamme',
    ],
  },
  {
    slug: 'top-st-regis-hotels-monde',
    nameRegex: /st\.? ?regis/iu,
    titleFr: 'Top St. Regis — héritage Astor et service majordome dans le monde',
    titleEn: 'Top St. Regis — Astor heritage and butler service worldwide',
    targetLength: 25,
    keywordsFr: [
      'St. Regis — fondé par John Jacob Astor IV, New York 1904',
      'Butler Service signature disponible 24h/24 dans chaque suite',
      'rituels maison : champagne sabrage, afternoon tea, Bloody Mary (le Red Snapper)',
      'adresses iconiques : Rome, Venise, Bora Bora, Maldives, Aspen',
      "clientèle UHNWI, lunes de miel, événements d'apparat",
    ],
  },
  {
    slug: 'top-anantara-hotels-monde',
    nameRegex: /anantara/iu,
    titleFr: "Top Anantara — l'art de vivre asiatique et les resorts immersifs",
    titleEn: 'Top Anantara — Asian art de vivre and immersive resorts',
    targetLength: 20,
    keywordsFr: [
      'Anantara — du sanskrit "sans fin", immersion culturelle et nature',
      'destinations signature : Thaïlande, Maldives, Oman (désert), Émirats, Italie',
      'expériences : dîner Dining by Design, spa, safaris et excursions sur-mesure',
      'resorts desert (Qasr Al Sarab) et îles privées (Kihavah Maldives)',
      'clientèle quête de dépaysement, lunes de miel, familles aisées',
    ],
  },
  {
    slug: 'top-waldorf-astoria-hotels-monde',
    nameRegex: /waldorf/iu,
    titleFr: 'Top Waldorf Astoria — le grand luxe Hilton héritier de New York',
    titleEn: "Top Waldorf Astoria — Hilton's grand luxury, New York heritage",
    targetLength: 20,
    keywordsFr: [
      'Waldorf Astoria — institution new-yorkaise née en 1893, fleuron Hilton',
      'adresses landmark : Beverly Hills, Amsterdam, Maldives Ithaafushi, Dubaï',
      'service personnalisé, conciergerie, spa et gastronomie raffinée',
      'patrimoine Art déco et architecture iconique restaurée',
      'clientèle affaires premium, célébrations, voyageurs Hilton Honors élite',
    ],
  },
  {
    slug: 'top-jumeirah-hotels-monde',
    nameRegex: /jumeirah/iu,
    titleFr: 'Top Jumeirah — le luxe émirati et ses icônes architecturales',
    titleEn: 'Top Jumeirah — Emirati luxury and its architectural icons',
    targetLength: 15,
    keywordsFr: [
      'Jumeirah — groupe dubaïote, hospitalité arabe contemporaine',
      'icône mondiale : Burj Al Arab Jumeirah, la "voile" de Dubaï',
      'adresses : Madinat Jumeirah, Capri, Mallorca, Londres (Carlton Tower)',
      'plages privées, spa Talise, gastronomie multi-étoilée',
      'clientèle internationale fortunée, familles du Golfe, lunes de miel',
    ],
  },
  {
    slug: 'top-raffles-hotels-monde',
    nameRegex: /raffles/iu,
    titleFr: 'Top Raffles — légende coloniale et palaces intemporels (Accor)',
    titleEn: 'Top Raffles — colonial legend and timeless palaces (Accor)',
    targetLength: 15,
    keywordsFr: [
      'Raffles — né à Singapour en 1887, berceau du Singapore Sling',
      'service majordome Raffles signature, élégance intemporelle',
      'adresses légendaires : Singapour, Paris (Le Royal Monceau), Londres (OWO), Bali, Seychelles',
      'patrimoine littéraire (Maugham, Kipling) et architecture restaurée',
      'clientèle raffinée, lunes de miel, voyageurs en quête de légende',
    ],
  },
  {
    slug: 'top-bulgari-hotels-monde',
    nameRegex: /bulgari|bvlgari/iu,
    titleFr: 'Top Bulgari Hotels — le luxe joaillier italien (groupe LVMH)',
    titleEn: 'Top Bulgari Hotels — Italian jeweller luxury (LVMH group)',
    targetLength: 12,
    keywordsFr: [
      'Bulgari Hotels & Resorts — maison joaillière romaine, design Antonio Citterio',
      'adresses confidentielles : Milan, Rome, Paris, Londres, Dubaï, Tokyo, Bali',
      'spa Bulgari réputés, gastronomie italienne signée Niko Romito',
      'esprit dolce vita contemporain, intérieurs en marbre et bois précieux',
      'clientèle UHNWI, amateurs de design et de mode, séjours urbains',
    ],
  },
  {
    slug: 'top-peninsula-hotels-monde',
    nameRegex: /peninsula/iu,
    titleFr: 'Top The Peninsula — le grand luxe hongkongais et sa flotte de Rolls',
    titleEn: 'Top The Peninsula — Hong Kong grand luxury and its Rolls fleet',
    targetLength: 10,
    keywordsFr: [
      'The Peninsula — groupe HSH, flagship Hong Kong depuis 1928',
      'flotte de Rolls-Royce Phantom vert Peninsula et hélicoptère sur le toit',
      'adresses : Hong Kong, Paris, Tokyo, Beverly Hills, Chicago, Istanbul, Londres',
      'afternoon tea iconique, spa, technologie en chambre primée',
      "clientèle d'affaires haut de gamme, familles fortunées, voyageurs fidèles",
    ],
  },
  {
    slug: 'top-capella-hotels-monde',
    nameRegex: /capella/iu,
    titleFr: 'Top Capella — le luxe intimiste et le service personnel signature',
    titleEn: 'Top Capella — intimate luxury and signature personal assistant',
    targetLength: 10,
    keywordsFr: [
      'Capella — petites adresses ultra-luxe, Personal Assistant dédié',
      'flagships : Capella Singapore, Bangkok (Chao Phraya), Sydney, Ubud',
      'design soigné (Bill Bensley à Ubud), villas avec piscine privée',
      'Auriga Spa, gastronomie de destination, intimité et discrétion',
      'clientèle en quête de calme et de raffinement, lunes de miel',
    ],
  },
  {
    slug: 'top-auberge-resorts-monde',
    nameRegex: /auberge resorts/iu,
    titleFr: "Top Auberge Resorts Collection — le luxe nature à l'américaine",
    titleEn: 'Top Auberge Resorts Collection — American nature-led luxury',
    targetLength: 10,
    keywordsFr: [
      'Auberge Resorts Collection — luxe décontracté ancré dans son territoire',
      'berceau napa : Auberge du Soleil, Calistoga Ranch, vignobles californiens',
      'resorts nature : Mexique (Susurros del Corazón), Costa Rica, Fidji, Aspen',
      'spa, gastronomie locavore, expériences plein air haut de gamme',
      'clientèle américaine aisée, escapades bien-être, slow luxury',
    ],
  },
  {
    slug: 'top-shangri-la-hotels-monde',
    nameRegex: /shangri/iu,
    titleFr: "Top Shangri-La — l'hospitalité asiatique et ses tours panoramiques",
    titleEn: 'Top Shangri-La — Asian hospitality and its skyline towers',
    targetLength: 8,
    keywordsFr: [
      'Shangri-La — hospitalité asiatique chaleureuse, fondée à Singapour 1971',
      'adresses sky-high : Shangri-La The Shard Londres, Paris (ex-palais Iéna), Hong Kong',
      'spa CHI, restaurants cantonais réputés, suites panoramiques',
      'service attentionné inspiré du roman "Horizons perdus"',
      "clientèle d'affaires, familles asiatiques aisées, voyageurs urbains",
    ],
  },
  {
    slug: 'top-one-and-only-resorts-monde',
    nameRegex: /one.?only/iu,
    titleFr: 'Top One&Only — les resorts ultra-luxe pour les grandes occasions',
    titleEn: 'Top One&Only — ultra-luxury resorts for landmark occasions',
    targetLength: 5,
    keywordsFr: [
      "One&Only — resorts d'exception du groupe Kerzner, fait pour marquer",
      'adresses signature : Le Saint Géran (Maurice), Reethi Rah (Maldives), Cape Town, Dubaï',
      'villas privées, majordome, gastronomie de chefs étoilés résidents',
      'expériences sur-mesure, kids club KidsOnly, spa de destination',
      "clientèle UHNWI, lunes de miel d'exception, voyages multigénérationnels",
    ],
  },
  {
    slug: 'top-oberoi-hotels-monde',
    nameRegex: /oberoi/iu,
    titleFr: "Top The Oberoi — le service indien d'excellence, primé au monde",
    titleEn: 'Top The Oberoi — Indian service excellence, awarded worldwide',
    targetLength: 5,
    keywordsFr: [
      'The Oberoi — groupe indien régulièrement n°1 des classements voyageurs',
      'palaces et resorts : Udaipur (Udaivilas), Agra (Amarvilas, vue Taj Mahal), Bali, Maurice',
      "service personnalisé d'anthologie, architecture rajput et moghole",
      'spa Oberoi, gastronomie indienne raffinée, intimité absolue',
      "clientèle en quête d'Inde luxueuse, lunes de miel, circuits palaces",
    ],
  },
  {
    slug: 'top-soneva-resorts-monde',
    nameRegex: /soneva/iu,
    titleFr: "Top Soneva — le luxe pieds nus et l'éco-conception aux Maldives",
    titleEn: 'Top Soneva — barefoot luxury and eco-design in the Maldives',
    targetLength: 5,
    keywordsFr: [
      'Soneva — pionnier du "No News, No Shoes", luxe pieds nus et durable',
      'adresses : Soneva Fushi et Soneva Jani (Maldives), Soneva Kiri (Thaïlande)',
      'villas avec toboggan, observatoire, cinéma plein air, fromagerie maison',
      'éco-engagement fort (carbone, zéro déchet), Soneva Soul wellness',
      'clientèle famille fortunée, lunes de miel, voyageurs conscients',
    ],
  },
];

// ─── Cache + runlog helpers ──────────────────────────────────────────

function cacheDirFor(slug: string): string {
  return path.resolve(CACHE_ROOT, slug);
}

async function readCachedGeneration(slug: string): Promise<GeneratedRankingV2 | null> {
  try {
    const raw = await readFile(path.join(cacheDirFor(slug), 'generated.json'), 'utf-8');
    const parsed = GeneratedRankingV2Schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function writeCachedGeneration(slug: string, ranking: GeneratedRankingV2): Promise<void> {
  const dir = cacheDirFor(slug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'generated.json'), JSON.stringify(ranking, null, 2), 'utf-8');
}

interface RunLogEntry {
  readonly ts: string;
  readonly slug: string;
  readonly status: 'cached' | 'generated' | 'pushed' | 'skipped' | 'failed';
  readonly eligibleCount: number;
  readonly targetLength: number;
  readonly durationMs: number;
  readonly entriesCount?: number;
  readonly faqCount?: number;
  readonly error?: string;
}

async function appendRunLog(entry: RunLogEntry): Promise<void> {
  await mkdir(CACHE_ROOT, { recursive: true });
  await appendFile(RUNLOG_PATH, JSON.stringify(entry) + '\n', 'utf-8');
}

// ─── CLI ─────────────────────────────────────────────────────────────

interface Args {
  readonly only: ReadonlySet<string> | null;
  readonly concurrency: number;
  readonly force: boolean;
  readonly dryRun: boolean;
  readonly publish: boolean;
  readonly noPush: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let only: Set<string> | null = null;
  let concurrency = 2;
  let force = false;
  let dryRun = false;
  let publish = true;
  let noPush = false;
  for (const a of argv) {
    if (a === '--force') force = true;
    else if (a === '--dry-run') dryRun = true;
    else if (a === '--draft') publish = false;
    else if (a === '--no-push') noPush = true;
    else if (a.startsWith('--only=')) {
      const v = a.slice('--only='.length).trim();
      only = new Set(
        v
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
      );
    } else if (a.startsWith('--concurrency=')) {
      const v = Number(a.slice('--concurrency='.length));
      if (Number.isFinite(v) && v > 0 && v <= 6) concurrency = Math.floor(v);
    }
  }
  return { only, concurrency, force, dryRun, publish, noPush };
}

// ─── Concurrency primitive ───────────────────────────────────────────

async function runWithConcurrency<T, R>(
  items: ReadonlyArray<T>,
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const total = items.length;
  const worker = async (): Promise<void> => {
    while (cursor < total) {
      const i = cursor;
      cursor += 1;
      out[i] = await fn(items[i] as T, i);
    }
  };
  const workers: Promise<void>[] = [];
  const n = Math.min(limit, total);
  for (let w = 0; w < n; w += 1) workers.push(worker());
  await Promise.all(workers);
  return out;
}

// ─── Single-chain driver ─────────────────────────────────────────────

interface ChainResult {
  readonly slug: string;
  readonly ok: boolean;
  readonly status: RunLogEntry['status'];
  readonly error?: string;
}

async function processChain(
  spec: ChainSpec,
  catalog: readonly HotelCatalogRow[],
  args: Args,
  index: number,
  total: number,
): Promise<ChainResult> {
  const tag = `[${index + 1}/${total} ${spec.slug}]`;
  const t0 = Date.now();

  const eligible = catalog.filter((h) => spec.nameRegex.test(h.name));
  if (eligible.length < 3) {
    console.log(`${tag} ⤬ skipped: only ${eligible.length} eligible (need ≥ 3).`);
    await appendRunLog({
      ts: new Date().toISOString(),
      slug: spec.slug,
      status: 'skipped',
      eligibleCount: eligible.length,
      targetLength: spec.targetLength,
      durationMs: 0,
    });
    return { slug: spec.slug, ok: true, status: 'skipped' };
  }

  const seed: RankingSeed = {
    slug: spec.slug,
    titleFr: spec.titleFr,
    titleEn: spec.titleEn,
    kind: 'thematic',
    targetLength: Math.min(spec.targetLength, eligible.length),
    keywordsFr: spec.keywordsFr,
    eligibility: () => true,
  };

  let ranking: GeneratedRankingV2 | null = null;
  let cached = false;
  if (!args.force) {
    ranking = await readCachedGeneration(spec.slug);
    if (ranking !== null) {
      cached = true;
      console.log(`${tag} ↻ cached (skipping LLM)`);
    }
  }

  if (ranking === null) {
    if (args.dryRun) {
      console.log(
        `${tag} (dry-run) would generate from ${eligible.length} eligible (target ${seed.targetLength}).`,
      );
      return { slug: spec.slug, ok: true, status: 'skipped' };
    }
    try {
      console.log(
        `${tag} generating (target=${seed.targetLength} from ${eligible.length} eligible)…`,
      );
      ranking = await generateRankingV2(seed, eligible);
      await writeCachedGeneration(spec.slug, ranking);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`${tag} ✗ generation failed: ${msg}`);
      await appendRunLog({
        ts: new Date().toISOString(),
        slug: spec.slug,
        status: 'failed',
        eligibleCount: eligible.length,
        targetLength: seed.targetLength,
        durationMs: Date.now() - t0,
        error: msg,
      });
      return { slug: spec.slug, ok: false, status: 'failed', error: msg };
    }
  }

  if (args.dryRun) {
    console.log(`${tag} (dry-run) would ${cached ? 'reuse cached' : 'push'} — no DB write.`);
    return { slug: spec.slug, ok: true, status: cached ? 'cached' : 'generated' };
  }

  if (!args.noPush) {
    try {
      await pushRankingV2(seed, ranking, { publish: args.publish });
      console.log(
        `${tag} ✓ ${cached ? 'cached + ' : ''}pushed (entries=${ranking.entries.length}, faq=${ranking.faq.length})`,
      );
      await appendRunLog({
        ts: new Date().toISOString(),
        slug: spec.slug,
        status: 'pushed',
        eligibleCount: eligible.length,
        targetLength: seed.targetLength,
        durationMs: Date.now() - t0,
        entriesCount: ranking.entries.length,
        faqCount: ranking.faq.length,
      });
      return { slug: spec.slug, ok: true, status: 'pushed' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`${tag} ✗ push failed: ${msg}`);
      await appendRunLog({
        ts: new Date().toISOString(),
        slug: spec.slug,
        status: 'failed',
        eligibleCount: eligible.length,
        targetLength: seed.targetLength,
        durationMs: Date.now() - t0,
        entriesCount: ranking.entries.length,
        faqCount: ranking.faq.length,
        error: msg,
      });
      return { slug: spec.slug, ok: false, status: 'failed', error: msg };
    }
  }

  console.log(`${tag} ✓ ${cached ? 'cached' : 'generated'} (no-push)`);
  return { slug: spec.slug, ok: true, status: cached ? 'cached' : 'generated' };
}

// ─── Main ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs();
  const catalog = await loadHotelsCatalog();
  console.log(`Loaded ${catalog.length} hotels from catalogue.`);

  let specs: ChainSpec[] = [...CHAIN_SPECS_WAVE2];
  if (args.only !== null) {
    const wanted = args.only;
    specs = specs.filter((s) => wanted.has(s.slug));
  }

  console.log(
    `\n→ Will process ${specs.length} chain ranking(s) — concurrency=${args.concurrency}, force=${args.force}, dry-run=${args.dryRun}, publish=${args.publish}, push=${!args.noPush}\n`,
  );

  const t0 = Date.now();
  const results = await runWithConcurrency(specs, args.concurrency, (spec, idx) =>
    processChain(spec, catalog, args, idx, specs.length),
  );
  const dt = Date.now() - t0;

  const pushed = results.filter((r) => r.status === 'pushed').length;
  const generated = results.filter((r) => r.status === 'generated').length;
  const cached = results.filter((r) => r.status === 'cached').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  const fail = results.filter((r) => !r.ok).length;

  console.log('\n━━━ Summary ━━━');
  console.log(`Wall-clock: ${(dt / 1000).toFixed(1)} s (concurrency=${args.concurrency})`);
  console.log(
    `OK: ${results.filter((r) => r.ok).length} (pushed=${pushed}, generated-only=${generated}, cached=${cached}, skipped=${skipped})`,
  );
  console.log(`FAIL: ${fail}`);
  if (fail > 0) {
    console.log('\nFailures:');
    for (const r of results.filter((x) => !x.ok)) {
      console.log(`  - ${r.slug}: ${r.error ?? 'unknown error'}`);
    }
    process.exitCode = 1;
  }
  console.log(`\nRun log: ${RUNLOG_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
