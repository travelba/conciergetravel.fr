/**
 * classify-scaffold-axes.ts — deterministic classifier for the
 * `yonder/scaffold-plans.json` set scraped overnight on May 19, 2026.
 *
 * Unlike `classify-yonder-axes.ts` (which calls the LLM because Yonder
 * titles are noisy free-form), the scaffold slugs are already
 * normalised to our matrice naming convention
 * (`meilleurs-hotels-<lieu|theme|occasion>-<scope>`), so we can pull
 * the axes deterministically with a small lookup table.
 *
 * Output: `data/yonder-scaffold-classified.json` — fed into the
 * combinator as `yonderScaffoldClassified` with `slugOverride: y.slug`,
 * so the original Yonder URL slug becomes the canonical matrice slug
 * (instead of the slug rendered by `templates.ts`).
 *
 * No LLM, no cost, no rate limits. Run:
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/yonder/classify-scaffold-axes.ts
 *
 * See ADR-rankings-axes / A2 (May 19, 2026).
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  RankingAxesSchema,
  resolveLieu,
  type HotelType,
  type Occasion,
  type RankingAxes,
  type Theme,
} from '../rankings/axes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCAFFOLD_IN_PATH = resolve(__dirname, '../../yonder/scaffold-plans.json');
const OUT_DIR = resolve(__dirname, '../../data');
const OUT_PATH = resolve(OUT_DIR, 'yonder-scaffold-classified.json');

// ─── Input shape (one entry per planned scaffold) ────────────────────────

interface ScaffoldPlanEntry {
  readonly type: 'ranking' | 'guide' | string;
  readonly kind?: 'geographic' | 'thematic' | 'best_of' | string;
  readonly slug: string;
  readonly title: string;
  readonly city?: string;
  readonly region?: string;
  readonly country?: string;
  readonly yonder_url?: string;
}

interface ScaffoldClassifiedEntry {
  readonly slug: string;
  readonly titleFr: string;
  readonly titleEn: string;
  readonly axes: RankingAxes;
  readonly kind: 'best_of' | 'awarded' | 'thematic' | 'geographic';
  readonly yonderUrl: string | null;
}

interface ClassifiedFile {
  readonly classifiedAt: string;
  readonly total: number;
  readonly resolved: number;
  readonly unresolved: number;
  readonly entries: readonly ScaffoldClassifiedEntry[];
}

// ─── Slug parsing helpers ────────────────────────────────────────────────

const SLUG_PREFIX = 'meilleurs-hotels-';

interface ParsedTail {
  /** Tail of the slug after `meilleurs-hotels-`. */
  readonly tail: string;
  /** True when the tail explicitly ends with `-france`. */
  readonly endsWithFrance: boolean;
  /** Tail without trailing `-france` suffix. */
  readonly tailCore: string;
}

function parseTail(slug: string): ParsedTail {
  const tail = slug.startsWith(SLUG_PREFIX) ? slug.slice(SLUG_PREFIX.length) : slug;
  const endsWithFrance = /-france$/u.test(tail);
  const tailCore = endsWithFrance ? tail.replace(/-france$/u, '') : tail;
  return { tail, endsWithFrance, tailCore };
}

// Theme aliases — left side = Yonder vernacular, right side = our enum.
const THEME_MAP: Readonly<Record<string, Theme>> = {
  amoureux: 'romantique',
  romantique: 'romantique',
  'bien-etre': 'spa-bienetre',
  'bien-etre-france': 'spa-bienetre',
  spa: 'spa-bienetre',
  'bord-de-mer': 'mer',
  'vue-mer': 'mer',
  'vue-sur-seine': 'urbain',
  charme: 'patrimoine',
  design: 'design',
  'hotel-lifestyle': 'design',
  lifestyle: 'design',
  famille: 'famille',
  family: 'famille',
  kids: 'kids-friendly',
  'suite-familiale': 'famille',
  oenotourisme: 'vignobles',
  piscine: 'piscine',
  rooftop: 'rooftop',
};

const TYPE_MAP: Readonly<Record<string, HotelType>> = {
  '4-etoiles': '4-etoiles',
  '5-etoiles': '5-etoiles',
  chateau: 'chateau',
  palace: 'palace',
  luxe: 'palace', // soft proxy — palaces are our luxe definition
};

const OCCASION_MAP: Readonly<Record<string, Occasion>> = {
  seminaire: 'seminaire',
  'week-end': 'week-end',
  'lune-de-miel': 'lune-de-miel',
};

// Quartier / arrondissement names that should resolve to a specific
// Paris-N (or named-quartier) LieuDef defined in axes.ts.
const PARIS_QUARTIER_TO_LIEU: Readonly<Record<string, string>> = {
  bastille: 'bastille',
  bercy: 'bercy',
  'champs-elysees': 'champs-elysees',
  'gare-de-lyon': 'gare-de-lyon',
  marais: 'marais',
  montmartre: 'montmartre',
  'quartier-latin': 'quartier-latin',
  'tour-eiffel': 'tour-eiffel',
};

// Yonder spelling variations that should map to canonical lieu slugs.
// Keep this short — only add an entry when the slug is too far from
// our canonical taxonomy for resolveLieu's heuristics to bridge.
const LIEU_SLUG_ALIASES: Readonly<Record<string, string>> = {
  'cote-azur': 'cote-d-azur',
  'cap-ferret': 'cote-atlantique',
};

// ─── Classification ──────────────────────────────────────────────────────

function classify(entry: ScaffoldPlanEntry): ScaffoldClassifiedEntry | null {
  if (entry.type !== 'ranking') return null;

  const { tail, endsWithFrance, tailCore } = parseTail(entry.slug);

  const types: HotelType[] = [];
  const themes: Theme[] = [];
  const occasions: Occasion[] = [];

  // Detect type tokens at the start of the tail core.
  for (const token of Object.keys(TYPE_MAP)) {
    if (tailCore === token || tailCore.startsWith(`${token}-`)) {
      types.push(TYPE_MAP[token]!);
      break;
    }
  }

  // Detect occasion tokens anywhere in the tail.
  for (const token of Object.keys(OCCASION_MAP)) {
    if (tailCore.includes(token)) {
      const occ = OCCASION_MAP[token]!;
      if (!occasions.includes(occ)) occasions.push(occ);
    }
  }

  // Detect theme tokens anywhere in the tail.
  for (const token of Object.keys(THEME_MAP)) {
    if (tailCore === token || tailCore.includes(token)) {
      const th = THEME_MAP[token]!;
      if (!themes.includes(th)) themes.push(th);
    }
  }

  // Resolve lieu.
  let lieuSlug = 'france';
  let lieuLabel = 'France';
  let lieuScope:
    | 'france'
    | 'region'
    | 'departement'
    | 'cluster'
    | 'ville'
    | 'arrondissement'
    | 'station'
    | 'monde'
    | 'pays' = 'france';

  // Priority 1: explicit Paris arrondissement (paris-N).
  const arrdtMatch = /^paris-(\d{1,2})$/u.exec(tailCore);
  if (arrdtMatch !== null) {
    const n = Number(arrdtMatch[1]);
    const arrdtLieu = resolveLieu(`paris-${n}`);
    if (arrdtLieu !== null) {
      lieuSlug = arrdtLieu.slug;
      lieuLabel = arrdtLieu.label;
      lieuScope = arrdtLieu.scope;
    } else {
      // Fallback: use base "paris" lieu, slug preserved via override
      const paris = resolveLieu('paris');
      if (paris !== null) {
        lieuSlug = paris.slug;
        lieuLabel = paris.label;
        lieuScope = paris.scope;
      }
    }
  }
  // Priority 2: explicit Paris quartier alias.
  else if (PARIS_QUARTIER_TO_LIEU[tailCore] !== undefined) {
    const quartierLieuSlug = PARIS_QUARTIER_TO_LIEU[tailCore]!;
    const quartierLieu = resolveLieu(quartierLieuSlug);
    if (quartierLieu !== null) {
      lieuSlug = quartierLieu.slug;
      lieuLabel = quartierLieu.label;
      lieuScope = quartierLieu.scope;
    }
  }
  // Priority 3: city / region from the input entry.
  else {
    const rawCandidates = [entry.city, entry.region, tailCore].filter(
      (s): s is string => typeof s === 'string' && s.length > 0,
    );
    // Inject aliased candidates so e.g. `cote-azur` resolves to `cote-d-azur`.
    const lieuCandidates: string[] = [];
    for (const cand of rawCandidates) {
      lieuCandidates.push(cand);
      const alias = LIEU_SLUG_ALIASES[cand];
      if (alias !== undefined) lieuCandidates.push(alias);
    }
    let resolved = false;
    for (const cand of lieuCandidates) {
      const r = resolveLieu(cand);
      if (r !== null) {
        lieuSlug = r.slug;
        lieuLabel = r.label;
        lieuScope = r.scope;
        resolved = true;
        break;
      }
    }
    // National-scope themes / occasions / types — explicit "-france" suffix.
    if (!resolved && endsWithFrance) {
      lieuSlug = 'france';
      lieuLabel = 'France';
      lieuScope = 'france';
    }
  }

  // Decide kind from final axes shape.
  let kind: ScaffoldClassifiedEntry['kind'] = 'geographic';
  if (lieuSlug === 'france') {
    if (types.length > 0 && themes.length === 0 && occasions.length === 0) {
      kind = 'best_of';
    } else if (themes.length > 0 || occasions.length > 0) {
      kind = 'thematic';
    } else {
      kind = 'best_of';
    }
  } else if (themes.length > 0 || occasions.length > 0) {
    kind = 'thematic';
  }

  // Backfill from the plan's `kind` hint when present.
  if (entry.kind === 'best_of' || entry.kind === 'thematic' || entry.kind === 'geographic') {
    if (entry.kind === 'thematic' && themes.length === 0 && occasions.length === 0) {
      // Plan claims thematic but slug yields nothing — keep entry.kind.
      kind = entry.kind;
    } else if (entry.kind === 'best_of' && lieuSlug === 'france') {
      kind = 'best_of';
    }
  }

  const axesParse = RankingAxesSchema.safeParse({
    types,
    lieu: { scope: lieuScope, slug: lieuSlug, label: lieuLabel },
    themes,
    occasions,
    saison: 'toute-annee',
  });
  if (!axesParse.success) {
    // Should never happen with deterministic input but stay defensive.
    return null;
  }

  // Bilingual title — quick FR/EN scaffold, the LLM rewrites it later.
  const titleFr = entry.title;
  const titleEn = entry.title
    .replace(/Les meilleurs hôtels/giu, 'The best hotels')
    .replace(/Les meilleurs/giu, 'The best')
    .replace(/à/gu, 'in')
    .replace(/en France/giu, 'in France');

  return {
    slug: entry.slug,
    titleFr,
    titleEn,
    axes: axesParse.data,
    kind,
    yonderUrl: entry.yonder_url ?? null,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const raw = await readFile(SCAFFOLD_IN_PATH, 'utf-8');
  const plans = JSON.parse(raw) as readonly ScaffoldPlanEntry[];
  const rankings = plans.filter((p) => p.type === 'ranking');

  const classified: ScaffoldClassifiedEntry[] = [];
  const skipped: string[] = [];
  for (const r of rankings) {
    const c = classify(r);
    if (c === null) {
      skipped.push(r.slug);
      continue;
    }
    classified.push(c);
  }

  // Deduplicate by slug (defensive — scaffold-plans.json shouldn't
  // contain duplicates but be explicit).
  const bySlug = new Map<string, ScaffoldClassifiedEntry>();
  for (const c of classified) bySlug.set(c.slug, c);
  const finalEntries = [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));

  const resolved = finalEntries.filter(
    (e) => e.axes.lieu.slug !== '' && e.axes.lieu.slug !== 'france',
  ).length;
  const file: ClassifiedFile = {
    classifiedAt: new Date().toISOString(),
    total: finalEntries.length,
    resolved,
    unresolved: finalEntries.length - resolved,
    entries: finalEntries,
  };
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(file, null, 2), 'utf-8');

  console.log(`[classify-scaffold-axes] ${plans.length} plans, ${rankings.length} rankings`);
  console.log(`[classify-scaffold-axes] classified: ${finalEntries.length}`);
  console.log(`[classify-scaffold-axes]   lieu resolved (non-france): ${resolved}`);
  console.log(
    `[classify-scaffold-axes]   lieu=france (themes / occasions / types): ${finalEntries.length - resolved}`,
  );
  if (skipped.length > 0) {
    console.log(`[classify-scaffold-axes] skipped (non-ranking or unclassifiable):`);
    for (const s of skipped) console.log(`  - ${s}`);
  }
  console.log(`\n✓ Wrote ${OUT_PATH}`);
}

main().catch((err) => {
  console.error('[classify-scaffold-axes] FAILED:', err);
  process.exit(1);
});
