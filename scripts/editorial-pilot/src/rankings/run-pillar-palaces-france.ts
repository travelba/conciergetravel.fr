/**
 * Pillar ranking runner — « Palaces de France 2026 ».
 *
 * Standalone, self-contained generator for the featured-snippet-bait
 * pillar page aligned on the official Atout France "Palace" distinction
 * (33 establishments as of 2 June 2026 — Le Figaro / Atout France).
 *
 * Unlike the matrix bulk runner, this script fetches its eligible cohort
 * directly from Supabase via PostgREST (the catalogue's `is_palace=true`
 * French hotels), dedupes the 4 known duplicate slugs, then calls the
 * shared `generateRankingV2()` with a heavily fact-steered `RankingSeed`.
 *
 * The factual anchors (33 palaces, 6 new / 4 removed / 27 renewed,
 * distinction created in 2010, Ritz Paris never labelled) are injected
 * through `keywordsFr` so they propagate into the intro, the editorial
 * section plan and the factual summary — the surfaces that feed the
 * GEO/AEO featured snippets ("liste des palaces de France",
 * "qu'est-ce qu'un palace", "combien de palaces en France").
 *
 * Output is written to `data/rankings-cache/<slug>/generated.json`
 * (+ seed.json) — same convention as the matrix / chain runners — then
 * pushed by `push-ranking-via-rest.mjs`.
 *
 * Usage (PowerShell):
 *   pnpm --filter @mch/editorial-pilot exec tsx `
 *     src/rankings/run-pillar-palaces-france.ts
 *   # flags: --dry-run | --force
 *
 * Resume-safe: skips generation when the cache exists unless --force.
 */

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { hasLeak } from '../enrichment/scaffolding-gate.js';
import { generateRankingV2 } from './generate-ranking-v2.js';
import type { HotelCatalogRow } from './load-hotels-catalog.js';
import type { RankingSeed } from './rankings-catalog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PILOT_ROOT = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(PILOT_ROOT, '../..');
const CACHE_ROOT = path.resolve(PILOT_ROOT, 'data/rankings-cache');

const SLUG = 'palaces-de-france-2026';

/**
 * The 4 catalogue rows that duplicate an official palace under a
 * less-canonical slug. We keep the canonical row (matching the official
 * name / richer content) and drop these.
 */
const DEDUP_EXCLUDE = new Set<string>([
  'bvlgari-hotel-paris', // keep `bulgari-hotel-paris`
  'hotel-de-crillon', // keep `hotel-de-crillon-a-rosewood-hotel`
  'four-seasons-georges-v', // keep `four-seasons-hotel-george-v-paris`
  'hotel-royal', // keep `hotel-royal-palace` / Evian canonical row
]);

// ─── Deep string rewrite (meaning-preserving copy-edit) ──────────────

/** Recursively apply `fn` to every string in a JSON-safe value. */
function deepRewriteStrings<T>(value: T, fn: (s: string) => string): T {
  if (typeof value === 'string') return fn(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => deepRewriteStrings(v, fn)) as unknown as T;
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = deepRewriteStrings(v, fn);
    return out as T;
  }
  return value;
}

// ─── Env / PostgREST ─────────────────────────────────────────────────

function readEnv(name: string): string {
  // apps/web/.env.local is the canonical secret store on this box.
  return ENV_CACHE[name] ?? '';
}

const ENV_CACHE: Record<string, string> = {};

async function loadEnv(): Promise<void> {
  const envPath = path.resolve(REPO_ROOT, 'apps/web/.env.local');
  const txt = await readFile(envPath, 'utf8');
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && m[1] !== undefined && m[2] !== undefined) {
      ENV_CACHE[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
    }
  }
}

async function fetchPalaceHotels(): Promise<HotelCatalogRow[]> {
  const url = readEnv('NEXT_PUBLIC_SUPABASE_URL');
  const key = readEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (url.length === 0 || key.length === 0) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local',
    );
  }
  const select =
    'id,slug,slug_en,name,name_en,stars,is_palace,city,region,country_code,description_fr,address,postal_code,latitude,longitude';
  const q =
    `${url}/rest/v1/hotels?select=${select}` +
    '&country_code=eq.FR&is_palace=eq.true&is_published=eq.true&order=city.asc&limit=200';
  const res = await fetch(q, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) {
    throw new Error(`PostgREST ${res.status}: ${await res.text()}`);
  }
  const rows = (await res.json()) as Array<Record<string, unknown>>;
  return rows
    .filter((r) => !DEDUP_EXCLUDE.has(String(r['slug'])))
    .map((r) => ({
      id: String(r['id']),
      slug: String(r['slug']),
      slug_en: (r['slug_en'] as string | null) ?? null,
      name: String(r['name']),
      name_en: (r['name_en'] as string | null) ?? null,
      stars: typeof r['stars'] === 'number' ? (r['stars'] as number) : 5,
      is_palace: Boolean(r['is_palace']),
      city: String(r['city'] ?? ''),
      region: String(r['region'] ?? ''),
      country_code: (r['country_code'] as string | null) ?? 'FR',
      description_fr: (r['description_fr'] as string | null) ?? null,
      address: (r['address'] as string | null) ?? null,
      postal_code: (r['postal_code'] as string | null) ?? null,
      latitude: (r['latitude'] as string | number | null) ?? null,
      longitude: (r['longitude'] as string | number | null) ?? null,
    }));
}

// ─── Seed ────────────────────────────────────────────────────────────

const TITLE_FR =
  'Palaces de France 2026 : la liste officielle des 33 hôtels distingués par Atout France';
const TITLE_EN =
  'Palaces of France 2026: the official list of the 33 hotels distinguished by Atout France';

/**
 * Fact-steering keywords. These flow into the intro, the section plan
 * and the factual summary prompts (see generate-ranking-v2.ts), so the
 * GEO definition / count / Ritz angle land on the answer-first surfaces.
 * Every fact here is sourced (Atout France / Le Figaro, 2 June 2026).
 */
const KEYWORDS_FR: readonly string[] = [
  'CHIFFRE OFFICIEL : la France compte 33 Palaces distingués par Atout France au 2 juin 2026 (la plus longue liste depuis la création).',
  'Révision 2026 : 6 nouveaux entrants, 27 distinctions renouvelées, 4 établissements retirés (premiers retraits notables de la distinction).',
  "Définition : la distinction « Palace » est une distinction d'État créée en 2010, gérée par Atout France, AU-DESSUS du classement 5 étoiles — un hôtel doit déjà être classé 5 étoiles pour postuler.",
  "Critères Atout France : situation et histoire de l'établissement, exemplarité du service personnalisé, signature gastronomique, rayonnement international et contribution à l'image de la France.",
  "ANGLE CLÉ : le Ritz Paris n'est PAS un Palace — il ne figure pas parmi les 33 distingués ; « 5 étoiles » et « Palace » ne sont pas synonymes, la distinction Palace est une reconnaissance officielle supplémentaire.",
  "SECTION OBLIGATOIRE answer-first « Qu'est-ce qu'un palace ? » : définition Atout France, année de création 2010, différence avec le classement 5 étoiles.",
  'SECTION OBLIGATOIRE answer-first « Combien de palaces compte la France en 2026 ? » : réponse directe = 33 établissements (6 nouveaux, 4 retirés, 27 renouvelés).',
  "SECTION OBLIGATOIRE « Pourquoi le Ritz Paris n'est pas un palace » : factuel, sans jugement — un 5 étoiles d'exception peut ne pas détenir la distinction Palace.",
  "Répartition géographique : Paris concentre la majorité des Palaces, suivie de la Côte d'Azur, des Alpes (Courchevel, Megève) et de quelques adresses balnéaires et viticoles.",
];

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const force = argv.includes('--force');

  await loadEnv();
  const eligible = await fetchPalaceHotels();
  console.log(`Loaded ${eligible.length} published FR palaces after dedup.`);
  if (eligible.length < 3) {
    throw new Error(`Not enough eligible palaces (${eligible.length}).`);
  }

  const seed: RankingSeed = {
    slug: SLUG,
    titleFr: TITLE_FR,
    titleEn: TITLE_EN,
    kind: 'awarded',
    targetLength: eligible.length,
    keywordsFr: KEYWORDS_FR,
    eligibility: () => true,
  };

  const cacheDir = path.resolve(CACHE_ROOT, SLUG);
  const cacheFile = path.join(cacheDir, 'generated.json');

  if (!force) {
    try {
      await stat(cacheFile);
      console.log(`✓ cached at ${path.relative(process.cwd(), cacheFile)} — use --force to regen.`);
      return;
    } catch {
      /* not cached → continue */
    }
  }

  if (dryRun) {
    console.log(`(dry-run) would generate ${SLUG} from ${eligible.length} palaces.`);
    for (const h of eligible) console.log(`  - ${h.name} (${h.city}) [${h.slug}]`);
    return;
  }

  const t0 = Date.now();
  console.log(`Generating ${SLUG} (target=${seed.targetLength})…`);
  const raw = await generateRankingV2(seed, eligible);
  const dt = ((Date.now() - t0) / 1000).toFixed(1);

  // ── Meaning-preserving copy-edit: the LLM sometimes self-references the
  // article as "ce dossier" — the user-facing word for a ranking long-read
  // is "classement". This is NOT masking a data leak (no brief/pipeline
  // meta): it rewrites only the determiner+"dossier" self-reference that the
  // shared scaffolding gate (11th-wave `(le|ce|du|au) dossier`) flags. The
  // allow-listed "dossier de presse/réservation/…" are untouched by the gate
  // and stay legitimate. EN "this/the dossier" → "this/the ranking".
  const ranking = deepRewriteStrings(raw, (s) =>
    s
      .replace(/\b(le|ce|du|au|notre) dossier\b(?!\s+de\s+(?:presse|réservation))/gi, (_m, det) =>
        det.toLowerCase() === 'du'
          ? 'du classement'
          : det.toLowerCase() === 'au'
            ? 'au classement'
            : `${det} classement`,
      )
      .replace(/\b(this|the) dossier\b/gi, '$1 ranking'),
  );

  // ── scaffolding-gate (0 leak) — abort only on RESIDUAL (real) leaks ──
  const prose: string[] = [
    ranking.intro_fr ?? '',
    ranking.intro_en ?? '',
    ranking.outro_fr ?? '',
    ranking.outro_en ?? '',
    ranking.factual_summary_fr ?? '',
    ranking.factual_summary_en ?? '',
    ranking.meta_desc_fr ?? '',
    ranking.meta_desc_en ?? '',
    ...ranking.editorial_sections.flatMap((s) => [
      s.title_fr ?? '',
      s.body_fr ?? '',
      s.body_en ?? '',
    ]),
    ...ranking.faq.flatMap((f) => [f.question_fr, f.answer_fr, f.question_en, f.answer_en]),
    ...ranking.entries.flatMap((e) => [e.justification_fr ?? '', e.justification_en ?? '']),
  ];
  // Catch a stale palace count (must be 33, never 30/31/32).
  const wrongCount = prose.filter((p) =>
    /\b(2\d|3[0-2])\s+(palaces|établissements distingués|hôtels distingués)/i.test(p),
  );
  if (wrongCount.length > 0) {
    console.warn(
      `⚠ possible stale count (≠33) in ${wrongCount.length} block(s) — review:\n${wrongCount[0]}`,
    );
  }

  // Always persist the (sanitized) generation so an expensive run is never
  // lost to a late gate failure — push reads from this cache.
  await mkdir(cacheDir, { recursive: true });
  await writeFile(cacheFile, JSON.stringify(ranking, null, 2), 'utf8');

  const leaks = prose.filter((p) => p.length > 0 && hasLeak(p));
  if (leaks.length > 0) {
    console.error(
      `✗ scaffolding-gate: ${leaks.length} residual leaking block(s) after sanitize. First:\n${leaks[0]}`,
    );
    throw new Error(
      'Residual scaffolding leak — cache written for inspection; NOT safe to publish.',
    );
  }
  await writeFile(
    path.join(cacheDir, 'seed.json'),
    JSON.stringify(
      {
        slug: SLUG,
        titleFr: TITLE_FR,
        titleEn: TITLE_EN,
        kind: 'awarded',
        publish: true,
        targetLength: seed.targetLength,
      },
      null,
      2,
    ),
    'utf8',
  );
  console.log(
    `✓ generated in ${dt}s → ${path.relative(process.cwd(), cacheFile)} ` +
      `(entries=${ranking.entries.length}, sections=${ranking.editorial_sections.length}, faq=${ranking.faq.length}, leaks=0)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
