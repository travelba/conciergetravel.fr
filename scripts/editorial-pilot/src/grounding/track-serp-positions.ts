/**
 * track-serp-positions.ts — recurring SERP position tracker (MCH vs yonder vs
 * travellers-society).
 *
 *   npx tsx src/grounding/track-serp-positions.ts
 *   npx tsx src/grounding/track-serp-positions.ts --basket=./my-basket.json
 *   npx tsx src/grounding/track-serp-positions.ts --out=../../docs/audits --no-overview
 *
 * Implements action #5 of `docs/audits/authority-visibility-plan.md`
 * ("suivi de positions récurrent automatisé") + the yonder benchmark rule
 * (`.cursor/rules/competitor-benchmark-yonder.mdc`): for every query in the
 * acquisition basket it records the absolute Google organic position of
 * `myconciergehotel.com`, `yonder.fr` and `travellers-society.com` (or
 * `absent` when outside the parsed depth), plus the top-3 occupants. It then
 * pulls `domain_rank_overview` (ranked keywords + ETV) for the three domains
 * as the macro authority metric.
 *
 * Output: a dated JSON snapshot + a markdown table written under `--out`
 * (default `scripts/editorial-pilot/runs/`), and the markdown echoed to
 * stdout. Re-run monthly and diff against the previous snapshot to see the
 * GSC-indexation effect.
 *
 * Reuses the repo DataForSEO client (`dfsLive`) and the pilot config loader
 * (`loadDfsConfig`). When `DATAFORSEO_*` is unset it exits cleanly with code 0
 * after printing a notice — DFS is an enhancer, never a hard dependency.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { dfsLive, type DataForSeoClientConfig } from '@mch/integrations/dataforseo';
import { z } from 'zod';

import { loadDfsConfig } from './env-dfs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PATHS = {
  serpOrganicAdvanced: '/v3/serp/google/organic/live/advanced',
  domainRankOverview: '/v3/dataforseo_labs/google/domain_rank_overview/live',
} as const;

/** Domains we track on every query (canonical apex form, no `www.`). */
const TRACKED_DOMAINS = ['myconciergehotel.com', 'yonder.fr', 'travellers-society.com'] as const;

type TrackedDomain = (typeof TRACKED_DOMAINS)[number];

interface BasketQuery {
  /** The exact search query. */
  readonly query: string;
  /** Monthly Google Ads volume (France) — context only, never sent to the API. */
  readonly volume: number | null;
  /** Live MCH page that targets this query, when one exists. */
  readonly mchPage?: string;
}

/**
 * Default acquisition basket — the §1.1 panier of the authority plan, ordered
 * by descending Google Ads volume (France). The 12 highest-volume queries that
 * also have a dedicated MCH `/classement/*` page (verified in the prod
 * `rankings.xml` sitemap) are kept; the long tail (`hôtel de luxe {nice,
 * courchevel, dubai, côte d'azur, saint-tropez, rome, venise}`, `meilleurs
 * hôtels {côte d'azur, saint-tropez, megève}`) is deferred to conserve quota.
 */
const DEFAULT_BASKET: readonly BasketQuery[] = [
  { query: 'palaces paris', volume: 12100, mchPage: '/classement/meilleurs-palaces-paris' },
  {
    query: 'hôtel romantique paris',
    volume: 1600,
    mchPage: '/classement/meilleurs-hotels-romantiques-paris',
  },
  {
    query: 'meilleurs hôtels marrakech',
    volume: 1300,
    mchPage: '/classement/meilleurs-hotels-marrakech',
  },
  {
    query: 'palaces courchevel',
    volume: 880,
    mchPage: '/classement/meilleurs-palaces-courchevel',
  },
  // No exact `/classement/meilleurs-hotels-paris`; the closest live target is
  // the "plus beaux" variant (plus the palaces page above).
  { query: 'meilleurs hôtels paris', volume: 590, mchPage: '/classement/plus-beaux-hotels-paris' },
  { query: 'hôtel de luxe paris', volume: 390, mchPage: '/classement/hotel-de-luxe-paris' },
  { query: 'meilleurs hôtels rome', volume: 320, mchPage: '/classement/meilleurs-hotels-rome' },
  { query: 'meilleurs hôtels dubai', volume: 320, mchPage: '/classement/meilleurs-hotels-dubai' },
  { query: 'meilleurs hôtels venise', volume: 210, mchPage: '/classement/meilleurs-hotels-venise' },
  { query: 'meilleurs hôtels nice', volume: 140, mchPage: '/classement/meilleurs-hotels-nice' },
  { query: 'hôtel de luxe megève', volume: 110, mchPage: '/classement/hotel-de-luxe-megeve' },
  {
    query: 'hôtel de luxe marrakech',
    volume: 90,
    mchPage: '/classement/hotel-de-luxe-marrakech',
  },
];

interface RunOptions {
  readonly locationName: string;
  readonly languageCode: string;
  readonly device: string;
  readonly depth: number;
  readonly outDir: string;
  readonly withOverview: boolean;
  readonly basketPath: string | null;
}

// ---------------------------------------------------------------------------
// Zod schemas (subset, vendor-drift safe — every object passthrough)
// ---------------------------------------------------------------------------

const SerpItemSchema = z
  .object({
    type: z.string(),
    rank_absolute: z.number().nullish(),
    domain: z.string().nullish(),
  })
  .passthrough();

const SerpResultSchema = z
  .object({
    items: z.array(z.unknown()).nullish(),
  })
  .passthrough();

const OrganicMetricsSchema = z
  .object({
    count: z.number().nullish(),
    etv: z.number().nullish(),
    pos_1: z.number().nullish(),
    pos_2_3: z.number().nullish(),
    pos_4_10: z.number().nullish(),
  })
  .passthrough();

const OverviewItemSchema = z
  .object({
    target: z.string().nullish(),
    metrics: z.object({ organic: OrganicMetricsSchema.nullish() }).passthrough().nullish(),
  })
  .passthrough();

const OverviewResultSchema = z
  .object({
    items: z.array(z.unknown()).nullish(),
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Result shapes
// ---------------------------------------------------------------------------

/** A position is the absolute rank (number) or `null` when absent from depth. */
type Position = number | null;

interface SerpOccupant {
  readonly rank: number;
  readonly domain: string;
}

interface QueryResult {
  readonly query: string;
  readonly volume: number | null;
  readonly mchPage: string | null;
  readonly positions: Readonly<Record<TrackedDomain, Position>>;
  readonly top3: readonly SerpOccupant[];
  readonly error: string | null;
}

interface DomainOverview {
  readonly domain: string;
  readonly rankedKeywords: number | null;
  readonly etv: number | null;
  readonly pos1: number | null;
  readonly pos2to3: number | null;
  readonly pos4to10: number | null;
  readonly error: string | null;
}

interface Snapshot {
  readonly collectedAt: string;
  readonly engine: string;
  readonly locationName: string;
  readonly languageCode: string;
  readonly device: string;
  readonly depth: number;
  readonly trackedDomains: readonly string[];
  readonly queries: readonly QueryResult[];
  readonly overview: readonly DomainOverview[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Lowercase + strip a leading `www.` so `www.yonder.fr` matches `yonder.fr`. */
function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^www\./u, '');
}

/** True when a SERP result domain belongs to the tracked apex domain. */
function domainMatches(resultDomain: string, tracked: TrackedDomain): boolean {
  const d = normalizeDomain(resultDomain);
  return d === tracked || d.endsWith(`.${tracked}`);
}

function getFlag(name: string): string | undefined {
  const prefix = `--${name}=`;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith(prefix)) return arg.slice(prefix.length);
  }
  return undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(`--${name}`);
}

function parseOptions(): RunOptions {
  const depthRaw = getFlag('depth');
  const depthParsed = depthRaw === undefined ? 20 : Number.parseInt(depthRaw, 10);
  const depth = Number.isFinite(depthParsed) ? Math.min(Math.max(depthParsed, 10), 700) : 20;
  const outFlag = getFlag('out');
  const outDir =
    outFlag === undefined
      ? resolve(__dirname, '../../runs')
      : isAbsolute(outFlag)
        ? outFlag
        : resolve(process.cwd(), outFlag);
  const basketFlag = getFlag('basket');
  const basketPath =
    basketFlag === undefined
      ? null
      : isAbsolute(basketFlag)
        ? basketFlag
        : resolve(process.cwd(), basketFlag);
  return {
    locationName: getFlag('location') ?? 'France',
    languageCode: getFlag('language') ?? 'fr',
    device: getFlag('device') ?? 'desktop',
    depth,
    outDir,
    withOverview: !hasFlag('no-overview'),
    basketPath,
  };
}

const BasketFileSchema = z.array(
  z.object({
    query: z.string().min(1),
    volume: z.number().nullable().optional(),
    mchPage: z.string().optional(),
  }),
);

async function loadBasket(path: string | null): Promise<readonly BasketQuery[]> {
  if (path === null) return DEFAULT_BASKET;
  const raw = await readFile(path, 'utf8');
  const parsed = BasketFileSchema.parse(JSON.parse(raw));
  return parsed.map((q) => ({
    query: q.query,
    volume: q.volume ?? null,
    ...(q.mchPage === undefined ? {} : { mchPage: q.mchPage }),
  }));
}

// ---------------------------------------------------------------------------
// Collection
// ---------------------------------------------------------------------------

async function collectQuery(
  cfg: DataForSeoClientConfig,
  q: BasketQuery,
  opts: RunOptions,
): Promise<QueryResult> {
  const base: Pick<QueryResult, 'query' | 'volume' | 'mchPage'> = {
    query: q.query,
    volume: q.volume,
    mchPage: q.mchPage ?? null,
  };
  const absent: Record<TrackedDomain, Position> = {
    'myconciergehotel.com': null,
    'yonder.fr': null,
    'travellers-society.com': null,
  };

  const res = await dfsLive(cfg, PATHS.serpOrganicAdvanced, {
    keyword: q.query,
    location_name: opts.locationName,
    language_code: opts.languageCode,
    device: opts.device,
    depth: opts.depth,
  });
  if (!res.ok) {
    return { ...base, positions: absent, top3: [], error: JSON.stringify(res.error) };
  }
  const result = SerpResultSchema.safeParse(res.value[0]);
  if (!result.success || result.data.items === undefined || result.data.items === null) {
    return { ...base, positions: absent, top3: [], error: 'no serp items' };
  }

  const positions: Record<TrackedDomain, Position> = { ...absent };
  const organic: SerpOccupant[] = [];
  for (const rawItem of result.data.items) {
    const item = SerpItemSchema.safeParse(rawItem);
    if (!item.success) continue;
    if (item.data.type !== 'organic') continue;
    const domain = item.data.domain;
    const rank = item.data.rank_absolute;
    if (domain === undefined || domain === null || rank === undefined || rank === null) continue;
    organic.push({ rank, domain: normalizeDomain(domain) });
    for (const tracked of TRACKED_DOMAINS) {
      if (positions[tracked] === null && domainMatches(domain, tracked)) {
        positions[tracked] = rank;
      }
    }
  }
  const top3 = [...organic].sort((a, b) => a.rank - b.rank).slice(0, 3);
  return { ...base, positions, top3, error: null };
}

async function collectOverview(
  cfg: DataForSeoClientConfig,
  domain: TrackedDomain,
  opts: RunOptions,
): Promise<DomainOverview> {
  const empty: DomainOverview = {
    domain,
    rankedKeywords: null,
    etv: null,
    pos1: null,
    pos2to3: null,
    pos4to10: null,
    error: null,
  };
  const res = await dfsLive(cfg, PATHS.domainRankOverview, {
    target: domain,
    location_name: opts.locationName,
    language_code: opts.languageCode,
  });
  if (!res.ok) return { ...empty, error: JSON.stringify(res.error) };
  const result = OverviewResultSchema.safeParse(res.value[0]);
  if (!result.success || result.data.items === undefined || result.data.items === null) {
    return { ...empty, error: 'no overview items' };
  }
  const first = result.data.items[0];
  const item = OverviewItemSchema.safeParse(first);
  if (!item.success) return { ...empty, error: 'overview parse failed' };
  const organic = item.data.metrics?.organic ?? null;
  if (organic === null) return empty;
  return {
    domain,
    rankedKeywords: organic.count ?? null,
    etv: organic.etv ?? null,
    pos1: organic.pos_1 ?? null,
    pos2to3: organic.pos_2_3 ?? null,
    pos4to10: organic.pos_4_10 ?? null,
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function fmtPos(p: Position): string {
  return p === null ? 'absent' : `#${String(p)}`;
}

function fmtNum(n: number | null): string {
  if (n === null) return 'n/d';
  return Math.round(n).toLocaleString('fr-FR');
}

function fmtTop3(top3: readonly SerpOccupant[]): string {
  if (top3.length === 0) return '—';
  return top3.map((o) => `${o.domain} (#${String(o.rank)})`).join(', ');
}

function renderMarkdown(snap: Snapshot): string {
  const lines: string[] = [];
  const date = snap.collectedAt.slice(0, 10);
  lines.push(`# Suivi de positions SERP — baseline ${date}`);
  lines.push('');
  lines.push(
    `> Moteur ${snap.engine} · location ${snap.locationName} · langue ${snap.languageCode} · ` +
      `${snap.device} · depth ${String(snap.depth)} · source DataForSEO \`serp/organic/live/advanced\`.`,
  );
  lines.push('');
  lines.push('## Positions par requête');
  lines.push('');
  lines.push('| Requête | Vol. | MCH | yonder | travellers | Top 3 organique |');
  lines.push('| --- | ---: | --- | --- | --- | --- |');
  for (const q of snap.queries) {
    const cells = [
      q.query,
      q.volume === null ? 'n/d' : fmtNum(q.volume),
      q.error === null ? fmtPos(q.positions['myconciergehotel.com']) : `err`,
      fmtPos(q.positions['yonder.fr']),
      fmtPos(q.positions['travellers-society.com']),
      fmtTop3(q.top3),
    ];
    lines.push(`| ${cells.join(' | ')} |`);
  }
  lines.push('');
  lines.push('## Macro — domain rank overview');
  lines.push('');
  lines.push('| Domaine | Mots-clés classés | ETV (trafic estimé) | Top 1 | Top 3 | Top 10 |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: |');
  for (const o of snap.overview) {
    const top10 = o.pos4to10 === null ? null : (o.pos1 ?? 0) + (o.pos2to3 ?? 0) + o.pos4to10;
    const cells = [
      o.domain,
      fmtNum(o.rankedKeywords),
      fmtNum(o.etv),
      fmtNum(o.pos1),
      fmtNum(o.pos1 === null || o.pos2to3 === null ? null : o.pos1 + o.pos2to3),
      fmtNum(top10),
    ];
    lines.push(`| ${cells.join(' | ')} |`);
  }
  lines.push('');
  const mchAbsent = snap.queries.filter(
    (q) => q.error === null && q.positions['myconciergehotel.com'] === null,
  ).length;
  const withPage = snap.queries.filter((q) => q.mchPage !== null).length;
  lines.push(
    `_MCH absent du top ${String(snap.depth)} sur ${String(mchAbsent)}/${String(snap.queries.length)} requêtes. ` +
      `${String(withPage)}/${String(snap.queries.length)} requêtes ont une page MCH dédiée recensée dans le sitemap prod._`,
  );
  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const opts = parseOptions();
  const cfg = loadDfsConfig();
  if (cfg === null) {
    console.error(
      '[track-serp] DataForSEO disabled/unconfigured — set DATAFORSEO_ENABLED=1 + ' +
        'DATAFORSEO_USERNAME/PASSWORD in .env.local to run live. Nothing collected.',
    );
    return;
  }
  const basket = await loadBasket(opts.basketPath);
  console.error(
    `[track-serp] ${String(basket.length)} queries · ${opts.locationName}/${opts.languageCode} · ` +
      `depth ${String(opts.depth)} · overview=${String(opts.withOverview)}`,
  );

  const queries: QueryResult[] = [];
  for (const q of basket) {
    const r = await collectQuery(cfg, q, opts);
    const mch = fmtPos(r.positions['myconciergehotel.com']);
    console.error(`  "${q.query}" → MCH ${r.error === null ? mch : `ERR ${r.error}`}`);
    queries.push(r);
  }

  const overview: DomainOverview[] = [];
  if (opts.withOverview) {
    for (const d of TRACKED_DOMAINS) {
      const o = await collectOverview(cfg, d, opts);
      console.error(`  overview ${d} → ${fmtNum(o.rankedKeywords)} kw, ETV ${fmtNum(o.etv)}`);
      overview.push(o);
    }
  }

  const snap: Snapshot = {
    collectedAt: new Date().toISOString(),
    engine: 'google',
    locationName: opts.locationName,
    languageCode: opts.languageCode,
    device: opts.device,
    depth: opts.depth,
    trackedDomains: [...TRACKED_DOMAINS],
    queries,
    overview,
  };

  await mkdir(opts.outDir, { recursive: true });
  const date = snap.collectedAt.slice(0, 10);
  const jsonPath = resolve(opts.outDir, `serp-positions-${date}.json`);
  const mdPath = resolve(opts.outDir, `serp-positions-${date}.md`);
  const markdown = renderMarkdown(snap);
  await writeFile(jsonPath, `${JSON.stringify(snap, null, 2)}\n`, 'utf8');
  await writeFile(mdPath, `${markdown}\n`, 'utf8');
  console.error(`[track-serp] wrote ${jsonPath}`);
  console.error(`[track-serp] wrote ${mdPath}`);
  console.log(markdown);
}

main().catch((e: unknown) => {
  console.error('[track-serp] fatal:', e instanceof Error ? e.message : e);
  process.exit(1);
});
