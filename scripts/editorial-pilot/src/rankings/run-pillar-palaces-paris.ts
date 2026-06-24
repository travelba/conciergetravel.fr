/**
 * Pillar ranking runner — « Les meilleurs Palaces de Paris ».
 *
 * Reinforces the highest-volume acquisition page of the project
 * (`/classement/meilleurs-palaces-paris` — "palaces paris" ≈ 12 100
 * searches/month, where yonder AND travellers-society are BOTH absent
 * from the top-20; see `docs/audits/authority-visibility-plan.md` §1).
 *
 * Mirrors `run-pillar-palaces-france.ts` but scoped to the **13 Paris
 * Palaces** officially distinguished by Atout France (Collection Palace
 * 2026, unveiled 2 June 2026). Eligibility comes straight from the DB
 * (`is_palace=true`, `country_code='FR'`, `city='Paris'`), which the
 * 2026-06-24 data-quality reconciliation (`fix-is-palace-flag.ts`)
 * cleaned to exactly 13 (was 16 with 3 duplicate rows).
 *
 * EXACTITUDE: "Palace" is an official French state distinction (Atout
 * France, created 2010, above the 5-star classification). Every factual
 * anchor injected via `keywordsFr` is sourced (Atout France official list
 * + Guide Michelin "Full List of 33", June 2026). No invention. The
 * justifications are grounded by the generator on each hotel's own DB
 * content and gated by `hasLeak()`.
 *
 * Output → `data/rankings-cache/meilleurs-palaces-paris/{generated,seed}.json`.
 * Push with: `node src/rankings/push-ranking-via-rest.mjs --slug=meilleurs-palaces-paris`
 *
 * Usage (PowerShell):
 *   pnpm --filter @mch/editorial-pilot exec tsx src/rankings/run-pillar-palaces-paris.ts
 *   # flags: --dry-run | --force
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

const SLUG = 'meilleurs-palaces-paris';

// ─── Deep string rewrite (meaning-preserving copy-edit) ──────────────

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

const ENV_CACHE: Record<string, string> = {};

function readEnv(name: string): string {
  return ENV_CACHE[name] ?? '';
}

async function loadEnv(): Promise<void> {
  // apps/web/.env.local holds the publishable key — enough for a
  // read of the published catalogue (the push step reads the real
  // service key from the repo-root .env.local).
  const envPath = path.resolve(REPO_ROOT, 'apps/web/.env.local');
  const txt = await readFile(envPath, 'utf8');
  for (const line of txt.split(/\r?\n/u)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/u);
    const k = m?.[1];
    const v = m?.[2];
    if (k !== undefined && v !== undefined) {
      ENV_CACHE[k] = v.trim().replace(/^['"]|['"]$/gu, '');
    }
  }
}

async function fetchParisPalaces(): Promise<HotelCatalogRow[]> {
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
    `${url.replace(/\/$/u, '')}/rest/v1/hotels?select=${select}` +
    '&country_code=eq.FR&is_palace=eq.true&is_published=eq.true&city=eq.Paris&order=name.asc&limit=50';
  const res = await fetch(q, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`PostgREST ${res.status}: ${await res.text()}`);
  const json: unknown = await res.json();
  if (!Array.isArray(json)) throw new Error('SELECT did not return an array.');
  return json.map((r): HotelCatalogRow => {
    const o = r as Record<string, unknown>;
    return {
      id: String(o['id']),
      slug: String(o['slug']),
      slug_en: typeof o['slug_en'] === 'string' ? o['slug_en'] : null,
      name: String(o['name']),
      name_en: typeof o['name_en'] === 'string' ? o['name_en'] : null,
      stars: typeof o['stars'] === 'number' ? o['stars'] : 5,
      is_palace: Boolean(o['is_palace']),
      city: String(o['city'] ?? ''),
      region: typeof o['region'] === 'string' ? o['region'] : null,
      country_code: typeof o['country_code'] === 'string' ? o['country_code'] : 'FR',
      description_fr: typeof o['description_fr'] === 'string' ? o['description_fr'] : null,
      address: typeof o['address'] === 'string' ? o['address'] : null,
      postal_code: typeof o['postal_code'] === 'string' ? o['postal_code'] : null,
      latitude:
        typeof o['latitude'] === 'string' || typeof o['latitude'] === 'number'
          ? o['latitude']
          : null,
      longitude:
        typeof o['longitude'] === 'string' || typeof o['longitude'] === 'number'
          ? o['longitude']
          : null,
    };
  });
}

// ─── Seed ────────────────────────────────────────────────────────────

const TITLE_FR = 'Les meilleurs Palaces de Paris';
const TITLE_EN = 'The best Palaces in Paris';

/**
 * Fact-steering keywords. Every fact is sourced (Atout France official
 * list "Connaître les établissements distingués Palace" + "Carte Palaces
 * 2 juin 2026" + Guide Michelin "Full List of 33", June 2026). They flow
 * into the intro, the section plan and the factual summary so the GEO/AEO
 * answer-first surfaces ("combien de palaces à Paris", "qu'est-ce qu'un
 * palace", "le Ritz est-il un palace") land the verbatim Atout France
 * citation.
 */
const KEYWORDS_FR: readonly string[] = [
  'CHIFFRE OFFICIEL : Paris compte exactement 13 Palaces distingués par Atout France (Collection Palace 2026, dévoilée le 2 juin 2026) — sur 33 Palaces en France au total. Paris en concentre la majorité.',
  "DÉFINITION (à citer) : la distinction « Palace » est une distinction d'État française créée en 2010, gérée par Atout France, qui se situe AU-DESSUS du classement 5 étoiles — un hôtel doit déjà être classé 5 étoiles pour pouvoir y prétendre. Elle est attribuée pour 3 ans après instruction et visite d'une commission nommée par le ministre chargé du Tourisme.",
  "LES 13 PALACES DE PARIS (liste Atout France, à couvrir intégralement) : Le Bristol Paris, Le Meurice (Dorchester Collection), Hôtel Plaza Athénée (Dorchester Collection), Le Royal Monceau-Raffles, Shangri-La Paris, The Peninsula Paris, Four Seasons Hotel George V, Hôtel de Crillon (A Rosewood Hotel), La Réserve Paris, Mandarin Oriental Lutetia Paris, Bvlgari Hotel Paris, Cheval Blanc Paris, Hôtel Barrière Le Fouquet's Paris.",
  "ACTUALITÉ 2026 : trois nouveaux Palaces parisiens ont été distingués lors de la Collection Palace 2026 — Bvlgari Hotel Paris, Cheval Blanc Paris et Le Fouquet's Paris.",
  'ACTUALITÉ 2026 (factuel, sans jugement) : deux adresses parisiennes ont perdu la distinction Palace — le Mandarin Oriental Paris (rue Saint-Honoré, à ne pas confondre avec le Mandarin Oriental Lutetia qui la conserve) et le Park Hyatt Paris-Vendôme. Ce sont les premiers retraits de la distinction depuis sa création.',
  "ANGLE CLÉ : le Ritz Paris n'est PAS un Palace au sens d'Atout France — c'est un 5 étoiles d'exception qui ne figure pas parmi les 13 Palaces parisiens distingués. « 5 étoiles » et « Palace » ne sont pas synonymes : la distinction Palace est une reconnaissance officielle supplémentaire.",
  'SECTION OBLIGATOIRE answer-first « Combien de Palaces compte Paris ? » : réponse directe = 13 établissements distingués par Atout France (Collection Palace 2026).',
  "SECTION OBLIGATOIRE answer-first « Qu'est-ce qu'un Palace ? » : définition Atout France, distinction d'État créée en 2010, au-dessus du classement 5 étoiles.",
  "SECTION OBLIGATOIRE answer-first « Le Ritz Paris est-il un Palace ? » : non, factuel — un 5 étoiles d'exception peut ne pas détenir la distinction Palace.",
  "Critères Atout France : situation et histoire de l'établissement, exemplarité du service personnalisé, signature gastronomique (souvent une table étoilée au Guide Michelin), rayonnement international et contribution à l'image de la France.",
];

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const force = argv.includes('--force');

  await loadEnv();
  const eligible = await fetchParisPalaces();
  console.log(`Loaded ${eligible.length} published Paris palaces (is_palace=true).`);
  for (const h of eligible) console.log(`  - ${h.name} <${h.slug}>`);
  if (eligible.length < 3)
    throw new Error(`Not enough eligible Paris palaces (${eligible.length}).`);
  if (eligible.length !== 13) {
    console.warn(
      `⚠ expected 13 Paris palaces (official Atout France count), got ${eligible.length}. Continuing — review the DB flag.`,
    );
  }

  const seed: RankingSeed = {
    slug: SLUG,
    titleFr: TITLE_FR,
    titleEn: TITLE_EN,
    kind: 'geographic',
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
    return;
  }

  const t0 = Date.now();
  console.log(`Generating ${SLUG} (target=${seed.targetLength})…`);
  const raw = await generateRankingV2(seed, eligible);
  const dt = ((Date.now() - t0) / 1000).toFixed(1);

  // Meaning-preserving copy-edit: rewrite the "ce/le/du/au dossier"
  // self-reference (flagged by the shared scaffolding gate) to
  // "classement" — NOT masking a data leak (no brief/pipeline meta).
  const ranking = deepRewriteStrings(raw, (s) =>
    s
      .replace(
        /\b(le|ce|du|au|notre) dossier\b(?!\s+de\s+(?:presse|réservation))/giu,
        (_m, det: string) =>
          det.toLowerCase() === 'du'
            ? 'du classement'
            : det.toLowerCase() === 'au'
              ? 'au classement'
              : `${det} classement`,
      )
      .replace(/\b(this|the) dossier\b/giu, '$1 ranking'),
  );

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

  // Soft check: a Paris-count claim other than 13 is a red flag.
  const wrongParisCount = prose.filter((p) =>
    /\b(1[0-24-9]|[2-9])\s+(palaces|établissements distingués)\b[^.]{0,40}paris/iu.test(p),
  );
  if (wrongParisCount.length > 0) {
    console.warn(`⚠ possible wrong Paris count (≠13) — review:\n${wrongParisCount[0]}`);
  }

  await mkdir(cacheDir, { recursive: true });
  await writeFile(cacheFile, JSON.stringify(ranking, null, 2), 'utf8');

  const leaks = prose.filter((p) => p.length > 0 && hasLeak(p));
  if (leaks.length > 0) {
    console.error(
      `✗ scaffolding-gate: ${leaks.length} residual leaking block(s). First:\n${leaks[0]}`,
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
        kind: 'geographic',
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
