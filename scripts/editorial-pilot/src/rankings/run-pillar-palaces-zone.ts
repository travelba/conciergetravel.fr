/**
 * Pillar ranking runner — regional Palace pages (Côte d'Azur / Alpes).
 *
 * Generalises `run-pillar-palaces-paris.ts` to any French region whose
 * palace cohort is an explicit, sourced allow-list of slugs. It injects
 * the verbatim Atout France distinction (Collection Palace 2026, unveiled
 * 2 June 2026) the same way the Paris pillar does, instead of relying on
 * the generic `combinator.ts` keywords.
 *
 * EXACTITUDE — "Palace" is the official French state distinction (Atout
 * France, created 2010, above the 5-star classification). The per-zone
 * cohort is the intersection of:
 *   1. the official Atout France "Collection Palace 2026" list, cross-
 *      checked against the Guide Michelin "33 Palaces" (June 2026), and
 *   2. the MCH catalogue rows that are actually `is_palace=true` AND
 *      `is_published=true` (the fetch below re-asserts this server-side,
 *      so a slug that is not a published palace is silently dropped).
 * No invention: every fact in `keywordsFr` is sourced; the justifications
 * are grounded by the generator on each hotel's own DB content and gated
 * by `hasLeak()`.
 *
 * Sources (verified 2026-06-24):
 *   - Atout France, "Connaître les établissements distingués Palace" +
 *     "Collection Palace 2026" (2 June 2026).
 *   - Guide Michelin, "Full List of 33 Palaces" (June 2026).
 *   - Le Figaro, "La France compte désormais 33 palaces" (2 June 2026).
 *
 * Output → `data/rankings-cache/<slug>/{generated,seed}.json`.
 * Push with:
 *   node src/rankings/push-ranking-via-rest.mjs --slug=meilleurs-palaces-cote-d-azur
 *
 * Usage (PowerShell):
 *   pnpm --filter @mch/editorial-pilot exec tsx `
 *     src/rankings/run-pillar-palaces-zone.ts --zone=cote-d-azur
 *   # flags: --zone=cote-d-azur | --zone=alpes  (required) | --dry-run | --force
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

interface ZoneConfig {
  readonly slug: string;
  readonly titleFr: string;
  readonly titleEn: string;
  /** Official Atout France palace slugs present + published in MCH. */
  readonly palaceSlugs: readonly string[];
  readonly keywordsFr: readonly string[];
  /**
   * Regional nouns (lowercased) used by the soft anti-regression check to
   * flag a zone-TOTAL palace count other than 7. Sub-counts ("5 Palaces à
   * Courchevel", "2 Palaces de Saint-Tropez") and the national "33 Palaces"
   * must NOT trip it — only a wrong total adjacent to the zone label.
   */
  readonly zoneNounRegex: string;
}

const ZONES: Record<string, ZoneConfig> = {
  'cote-d-azur': {
    slug: 'meilleurs-palaces-cote-d-azur',
    titleFr: "Les meilleurs Palaces de la Côte d'Azur",
    titleEn: 'The best Palaces on the French Riviera',
    // 7 official Atout France palaces on the Riviera (Alpes-Maritimes + Var
    // côtier), all published in MCH. Verified 2026-06-24 (Atout France +
    // Michelin "33 Palaces"). Byblos Saint-Tropez lost the distinction in
    // 2026; Cap-Estel and Hôtel du Couvent (Nice) are NOT palaces.
    palaceSlugs: [
      'hotel-du-cap-eden-roc', // Antibes
      'hotel-martinez', // Cannes
      'grand-hotel-cap-ferrat', // Saint-Jean-Cap-Ferrat (Four Seasons)
      'chateau-saint-martin-vence', // Vence
      'la-reserve-ramatuelle', // Ramatuelle
      'les-airelles-saint-tropez', // Saint-Tropez (Château de la Messardière)
      'cheval-blanc-saint-tropez', // Saint-Tropez
    ],
    keywordsFr: [
      "CHIFFRE OFFICIEL : la Côte d'Azur compte 7 Palaces distingués par Atout France (Collection Palace 2026, dévoilée le 2 juin 2026) — sur 33 Palaces en France au total. C'est la 2e concentration après Paris.",
      "DÉFINITION (à citer) : la distinction « Palace » est une distinction d'État française créée en 2010, gérée par Atout France, qui se situe AU-DESSUS du classement 5 étoiles — un hôtel doit déjà être classé 5 étoiles pour pouvoir y prétendre. Elle est attribuée pour 3 ans après instruction et visite d'une commission nommée par le ministre chargé du Tourisme.",
      "LES 7 PALACES DE LA CÔTE D'AZUR (liste Atout France, à couvrir intégralement) : Hôtel du Cap-Eden-Roc (Antibes), Hôtel Martinez (Cannes), Grand-Hôtel du Cap-Ferrat, A Four Seasons Hotel (Saint-Jean-Cap-Ferrat), Château Saint-Martin & Spa (Vence), La Réserve Ramatuelle (Ramatuelle), Airelles Saint-Tropez Château de la Messardière (Saint-Tropez) et Cheval Blanc St-Tropez (Saint-Tropez).",
      "ACTUALITÉ 2026 (factuel, sans jugement) : le Byblos Saint-Tropez a perdu la distinction Palace lors de la révision 2026. Le Cap-Estel et l'Hôtel du Couvent (Nice) ne figurent PAS parmi les Palaces distingués — à ne pas présenter comme palaces.",
      "ANGLE CLÉ : « 5 étoiles » et « Palace » ne sont pas synonymes — de nombreux 5 étoiles d'exception de la Riviera (Monaco, Cap-d'Ail, Beaulieu) ne détiennent pas la distinction Palace, qui est une reconnaissance officielle supplémentaire d'Atout France.",
      "SECTION OBLIGATOIRE answer-first « Combien de Palaces compte la Côte d'Azur ? » : réponse directe = 7 établissements distingués par Atout France (Collection Palace 2026).",
      "SECTION OBLIGATOIRE answer-first « Quels sont les Palaces de Saint-Tropez ? » : réponse directe = 2, le Cheval Blanc St-Tropez et l'Airelles Saint-Tropez Château de la Messardière.",
      "SECTION OBLIGATOIRE answer-first « Qu'est-ce qu'un Palace ? » : définition Atout France, distinction d'État créée en 2010, au-dessus du classement 5 étoiles.",
      "Critères Atout France : situation et histoire de l'établissement, exemplarité du service personnalisé, signature gastronomique (souvent une table étoilée au Guide Michelin), rayonnement international et contribution à l'image de la France.",
    ],
    zoneNounRegex: "côte d'azur|riviera|azuréens?",
  },
  alpes: {
    slug: 'meilleurs-palaces-alpes',
    titleFr: 'Les plus beaux Palaces des Alpes',
    titleEn: 'The most beautiful Palaces in the French Alps',
    // 7 official Atout France palaces in the French Alps (Savoie +
    // Haute-Savoie), all published in MCH. Verified 2026-06-24.
    palaceSlugs: [
      'cheval-blanc-courchevel', // Courchevel
      'lapogee-courchevel', // Courchevel
      'fouquets-courchevel', // Courchevel
      'le-k2-palace', // Courchevel
      'les-airelles-courchevel', // Courchevel
      'four-seasons-megeve', // Megève
      'hotel-royal-evian', // Évian-les-Bains (Haute-Savoie, lac Léman)
    ],
    keywordsFr: [
      'CHIFFRE OFFICIEL : les Alpes françaises comptent 7 Palaces distingués par Atout France (Collection Palace 2026, dévoilée le 2 juin 2026) — sur 33 Palaces en France au total.',
      "DÉFINITION (à citer) : la distinction « Palace » est une distinction d'État française créée en 2010, gérée par Atout France, qui se situe AU-DESSUS du classement 5 étoiles — un hôtel doit déjà être classé 5 étoiles pour pouvoir y prétendre. Elle est attribuée pour 3 ans après instruction et visite d'une commission nommée par le ministre chargé du Tourisme.",
      "LES 7 PALACES DES ALPES (liste Atout France, à couvrir intégralement) : Cheval Blanc Courchevel, L'Apogée Courchevel, Fouquet's Courchevel, Le K2 Palace (Courchevel), Airelles Courchevel (Les Airelles), Four Seasons Resort Megève (Megève) et l'Hôtel Royal (Évian-les-Bains).",
      'POINT CLÉ : Courchevel concentre à elle seule 5 des 33 Palaces de France — la plus forte densité de Palaces hors Paris, ce qui en fait la capitale mondiale du ski de Palace.',
      "REPÈRE GÉOGRAPHIQUE (factuel) : l'Hôtel Royal est situé à Évian-les-Bains, en Haute-Savoie sur les rives du lac Léman (Alpes du Nord) — c'est le Palace alpin le plus septentrional et le seul hors station de ski.",
      'SECTION OBLIGATOIRE answer-first « Combien de Palaces comptent les Alpes ? » : réponse directe = 7 établissements distingués par Atout France (Collection Palace 2026).',
      "SECTION OBLIGATOIRE answer-first « Combien de Palaces à Courchevel ? » : réponse directe = 5 (Cheval Blanc, L'Apogée, Fouquet's, Le K2 Palace, Les Airelles).",
      "SECTION OBLIGATOIRE answer-first « Qu'est-ce qu'un Palace ? » : définition Atout France, distinction d'État créée en 2010, au-dessus du classement 5 étoiles.",
      "Critères Atout France : situation et histoire de l'établissement, exemplarité du service personnalisé, signature gastronomique (souvent une table étoilée au Guide Michelin), rayonnement international et contribution à l'image de la France.",
    ],
    zoneNounRegex: 'alpes|alpins?',
  },
};

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

async function fetchZonePalaces(palaceSlugs: readonly string[]): Promise<HotelCatalogRow[]> {
  const url = readEnv('NEXT_PUBLIC_SUPABASE_URL');
  const key = readEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (url.length === 0 || key.length === 0) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local',
    );
  }
  const select =
    'id,slug,slug_en,name,name_en,stars,is_palace,city,region,country_code,description_fr,address,postal_code,latitude,longitude';
  // Re-assert the palace + published gate server-side: a requested slug that
  // is not a published palace is dropped, never put on the page.
  const inList = palaceSlugs.join(',');
  const q =
    `${url.replace(/\/$/u, '')}/rest/v1/hotels?select=${select}` +
    `&country_code=eq.FR&is_palace=eq.true&is_published=eq.true&slug=in.(${encodeURIComponent(inList)})` +
    '&order=name.asc&limit=50';
  const res = await fetch(q, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`PostgREST ${res.status}: ${await res.text()}`);
  const json: unknown = await res.json();
  if (!Array.isArray(json)) throw new Error('SELECT did not return an array.');
  return json.map((r): HotelCatalogRow => {
    const o = r as Record<string, unknown>;
    const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
    return {
      id: String(o['id']),
      slug: String(o['slug']),
      slug_en: str(o['slug_en']),
      name: String(o['name']),
      name_en: str(o['name_en']),
      stars: typeof o['stars'] === 'number' ? o['stars'] : 5,
      is_palace: Boolean(o['is_palace']),
      city: String(o['city'] ?? ''),
      region: str(o['region']),
      country_code: str(o['country_code']) ?? 'FR',
      description_fr: str(o['description_fr']),
      address: str(o['address']),
      postal_code: str(o['postal_code']),
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

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const force = argv.includes('--force');
  const zoneArg = argv.find((a) => a.startsWith('--zone='))?.slice('--zone='.length) ?? '';
  const zone = ZONES[zoneArg];
  if (zone === undefined) {
    throw new Error(`Missing/unknown --zone. Expected one of: ${Object.keys(ZONES).join(', ')}.`);
  }

  await loadEnv();
  const eligible = await fetchZonePalaces(zone.palaceSlugs);
  console.log(`Loaded ${eligible.length} published palaces for zone "${zoneArg}".`);
  for (const h of eligible) console.log(`  - ${h.name} (${h.city}) <${h.slug}>`);

  const missing = zone.palaceSlugs.filter((s) => !eligible.some((h) => h.slug === s));
  if (missing.length > 0) {
    console.warn(`⚠ requested slugs not returned as published palaces: ${missing.join(', ')}`);
  }
  if (eligible.length < 4) {
    throw new Error(
      `Not enough eligible palaces for zone "${zoneArg}" (${eligible.length} < 4) — skip the page.`,
    );
  }

  const seed: RankingSeed = {
    slug: zone.slug,
    titleFr: zone.titleFr,
    titleEn: zone.titleEn,
    kind: 'geographic',
    targetLength: eligible.length,
    keywordsFr: zone.keywordsFr,
    eligibility: () => true,
  };

  const cacheDir = path.resolve(CACHE_ROOT, zone.slug);
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
    console.log(`(dry-run) would generate ${zone.slug} from ${eligible.length} palaces.`);
    return;
  }

  const t0 = Date.now();
  console.log(`Generating ${zone.slug} (target=${seed.targetLength})…`);
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

  // Soft check: a zone-TOTAL palace count other than 7 (digit) sitting next
  // to the zone label is a red flag. 7/"sept" are excluded; sub-counts and
  // the national "33 Palaces" are not adjacent to the zone noun so they pass.
  const wrongCountRe = new RegExp(
    `\\b([0-689])\\s+(?:palaces|établissements distingués)[^.]{0,40}?(?:${zone.zoneNounRegex})`,
    'iu',
  );
  const wrongCount = prose.filter((p) => wrongCountRe.test(p));
  if (wrongCount.length > 0) {
    console.warn(`⚠ possible wrong zone palace total (≠7) — review:\n${wrongCount[0]}`);
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
        slug: zone.slug,
        titleFr: zone.titleFr,
        titleEn: zone.titleEn,
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
