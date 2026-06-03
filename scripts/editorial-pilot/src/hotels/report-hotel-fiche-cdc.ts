/**
 * report-hotel-fiche-cdc.ts — turns the exhaustive CDC audit JSON into a
 * human-readable markdown report: "tout le contenu à ajouter et à
 * restructurer" across the whole hotel catalogue, measured against the
 * Airelles Gordes golden template (golden + structure dimensions).
 *
 * Reads the latest `runs/hotel-fiche-cdc-audit-*.json` (or `--input=<path>`)
 * produced by `audit-hotel-fiche-cdc.ts` and writes
 * `runs/hotel-fiche-cdc-report-YYYY-MM-DD.md`.
 *
 * Usage:
 *   pnpm --filter @mch/editorial-pilot audit:hotel-fiches-cdc          # produce JSON
 *   pnpm --filter @mch/editorial-pilot report:hotel-fiches-cdc         # produce MD
 *   pnpm --filter @mch/editorial-pilot report:hotel-fiches-cdc -- --input=runs/foo.json
 *
 * Pure formatter — no DB access, no network. Deterministic given an input.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { AuditGap } from './hotel-fiche-gates.js';
import {
  type CdcCheck,
  type CdcDimension,
  type CdcHotelAuditResult,
  BLOCK_LABELS,
  CDC_COMPLETE_THRESHOLD,
  CDC_PARTIAL_THRESHOLD,
} from './hotel-fiche-cdc-gates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REFERENCE_SLUG = 'les-airelles-gordes';
const TOP_GAPS = 30;
const SAMPLE_SLUGS = 12;
const BACKLOG_ROWS = 60;

const DIMENSION_LABELS: Readonly<Record<CdcDimension, string>> = {
  cdc: 'CDC §2 (cible)',
  seo: 'SEO technique',
  geo: 'GEO / AEO',
  agent: 'Surfaces agentiques',
  faq: 'FAQ structurée',
  maille: 'Maillage / EEAT',
  photo: 'Photos',
  jsonld: 'Prérequis JSON-LD',
  golden: 'Golden template',
  structure: 'Restructuration',
};

/** Content-creation dimensions (what to ADD). */
const ADD_DIMENSIONS: readonly CdcDimension[] = [
  'cdc',
  'golden',
  'faq',
  'photo',
  'geo',
  'jsonld',
  'maille',
  'seo',
];
/** Re-shaping dimensions (what to RESTRUCTURE). */
const RESTRUCTURE_DIMENSIONS: readonly CdcDimension[] = ['structure'];

// ---------------------------------------------------------------------------
// Input loading
// ---------------------------------------------------------------------------

interface AuditPayload {
  readonly generated_at?: string;
  readonly hotels: readonly CdcHotelAuditResult[];
}

function runsDir(): string {
  return resolve(__dirname, '../../runs');
}

function parseInputArg(argv: readonly string[]): string | null {
  for (const a of argv) {
    if (a.startsWith('--input=')) return a.slice('--input='.length);
  }
  return null;
}

function latestAuditJson(): string {
  const dir = runsDir();
  const files = readdirSync(dir)
    .filter((f) => /^hotel-fiche-cdc-audit-.*\.json$/u.test(f))
    .sort();
  const last = files.at(-1);
  if (last === undefined) {
    throw new Error(
      `No hotel-fiche-cdc-audit-*.json found in ${dir}. Run \`pnpm --filter @mch/editorial-pilot audit:hotel-fiches-cdc\` first.`,
    );
  }
  return resolve(dir, last);
}

function loadPayload(inputPath: string): AuditPayload {
  const raw = readFileSync(inputPath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  if (
    parsed === null ||
    typeof parsed !== 'object' ||
    !Array.isArray((parsed as { hotels?: unknown }).hotels)
  ) {
    throw new Error(`Malformed audit payload (missing hotels[]) in ${inputPath}`);
  }
  return parsed as AuditPayload;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function pct(part: number, whole: number): string {
  if (whole === 0) return '0%';
  return `${Math.round((part / whole) * 100)}%`;
}

function mdTable(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const head = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${r.join(' | ')} |`).join('\n');
  return [head, sep, body].join('\n');
}

function severityRank(s: AuditGap['severity']): number {
  return s === 'blocker' ? 0 : s === 'warn' ? 1 : 2;
}

function worstSeverity(set: ReadonlySet<AuditGap['severity']>): AuditGap['severity'] {
  if (set.has('blocker')) return 'blocker';
  if (set.has('warn')) return 'warn';
  return 'info';
}

function publishedOf(hotels: readonly CdcHotelAuditResult[]): CdcHotelAuditResult[] {
  return hotels.filter((h) => h.is_published);
}

// ---------------------------------------------------------------------------
// Aggregations
// ---------------------------------------------------------------------------

interface GapAgg {
  readonly field: string;
  count: number;
  readonly severities: Set<AuditGap['severity']>;
  message: string;
  readonly pipelines: Set<string>;
}

/** Aggregate gaps by field across hotels (dedup field+message per hotel). */
function aggregateGaps(hotels: readonly CdcHotelAuditResult[]): GapAgg[] {
  const map = new Map<string, GapAgg>();
  for (const h of hotels) {
    const seen = new Set<string>();
    for (const g of h.cdc_gaps) {
      const dedup = `${g.field}|${g.message.slice(0, 40)}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      const agg = map.get(g.field) ?? {
        field: g.field,
        count: 0,
        severities: new Set<AuditGap['severity']>(),
        message: g.message,
        pipelines: new Set<string>(),
      };
      agg.count += 1;
      agg.severities.add(g.severity);
      agg.pipelines.add(g.pipeline);
      map.set(g.field, agg);
    }
  }
  return [...map.values()].sort(
    (a, b) =>
      b.count - a.count ||
      severityRank(worstSeverity(a.severities)) - severityRank(worstSeverity(b.severities)),
  );
}

interface CheckAgg {
  readonly id: string;
  readonly block: string;
  readonly dimension: CdcDimension;
  failing: number;
  readonly severities: Set<AuditGap['severity']>;
}

/** Aggregate FAILING checks by (dimension,id) across hotels. */
function aggregateFailingChecks(
  hotels: readonly CdcHotelAuditResult[],
): Map<CdcDimension, CheckAgg[]> {
  const byDim = new Map<CdcDimension, Map<string, CheckAgg>>();
  for (const h of hotels) {
    for (const c of h.cdc_checks) {
      if (c.passed || c.phase === 'phase6_deferred') continue;
      const dimMap = byDim.get(c.dimension) ?? new Map<string, CheckAgg>();
      const agg = dimMap.get(c.id) ?? {
        id: c.id,
        block: c.block,
        dimension: c.dimension,
        failing: 0,
        severities: new Set<AuditGap['severity']>(),
      };
      agg.failing += 1;
      agg.severities.add(c.severity);
      dimMap.set(c.id, agg);
      byDim.set(c.dimension, dimMap);
    }
  }
  const out = new Map<CdcDimension, CheckAgg[]>();
  for (const [dim, dimMap] of byDim) {
    out.set(
      dim,
      [...dimMap.values()].sort((a, b) => b.failing - a.failing),
    );
  }
  return out;
}

function slugsFailingCheck(
  hotels: readonly CdcHotelAuditResult[],
  checkId: string,
): CdcHotelAuditResult[] {
  return hotels.filter((h) =>
    h.cdc_checks.some((c) => c.id === checkId && !c.passed && c.phase !== 'phase6_deferred'),
  );
}

function sampleSlugList(hotels: readonly CdcHotelAuditResult[], limit: number): string {
  const slugs = hotels.slice(0, limit).map((h) => `\`${h.slug}\``);
  const extra = hotels.length - slugs.length;
  return extra > 0 ? `${slugs.join(', ')} … (+${extra})` : slugs.join(', ');
}

// ---------------------------------------------------------------------------
// Report sections
// ---------------------------------------------------------------------------

function sectionHeader(payload: AuditPayload, inputPath: string, stamp: string): string {
  const hotels = payload.hotels;
  const published = publishedOf(hotels).length;
  const lines: string[] = [];
  lines.push('# Audit CDC des fiches hôtel — contenu à ajouter & à restructurer');
  lines.push('');
  lines.push(
    `> Mesure de **chaque fiche hôtel** contre le *golden template* « Airelles Gordes » (dimensions **Golden template** + **Restructuration** ajoutées à l'audit CDC §2).`,
  );
  lines.push('');
  lines.push(`- **Généré le** : ${stamp}`);
  lines.push(`- **Source** : \`${inputPath.replace(/\\/gu, '/')}\``);
  if (payload.generated_at !== undefined)
    lines.push(`- **Audit daté du** : ${payload.generated_at}`);
  lines.push(`- **Fiches auditées** : ${hotels.length} (publiées : ${published})`);
  lines.push(
    `- **Seuils CDC** : complète ≥ ${CDC_COMPLETE_THRESHOLD}% · partielle ≥ ${CDC_PARTIAL_THRESHOLD}% · gap < ${CDC_PARTIAL_THRESHOLD}%`,
  );
  lines.push(`- **Fiche de référence** : \`${REFERENCE_SLUG}\``);
  return lines.join('\n');
}

function sectionExecutiveSummary(hotels: readonly CdcHotelAuditResult[]): string {
  const pub = publishedOf(hotels);
  const dimRows: string[][] = [];
  const pickers: Array<[CdcDimension | 'global', (r: CdcHotelAuditResult) => number]> = [
    ['global', (r) => r.score_global],
    ['cdc', (r) => r.score_cdc],
    ['seo', (r) => r.score_seo],
    ['geo', (r) => r.score_geo],
    ['faq', (r) => r.score_faq],
    ['maille', (r) => r.score_maille],
    ['photo', (r) => r.score_photo],
    ['jsonld', (r) => r.score_jsonld],
    ['golden', (r) => r.score_golden],
    ['structure', (r) => r.score_structure],
    ['agent', (r) => r.score_agent],
  ];
  for (const [dim, pick] of pickers) {
    const label = dim === 'global' ? '**Global (10 dim.)**' : DIMENSION_LABELS[dim];
    dimRows.push([label, `${mean(pub.map(pick))}%`]);
  }

  let complete = 0;
  let partial = 0;
  let gap = 0;
  for (const r of pub) {
    if (r.score_cdc >= CDC_COMPLETE_THRESHOLD) complete += 1;
    else if (r.score_cdc >= CDC_PARTIAL_THRESHOLD) partial += 1;
    else gap += 1;
  }

  const lines: string[] = [];
  lines.push('## 1. Synthèse exécutive');
  lines.push('');
  lines.push('### Scores moyens (fiches publiées)');
  lines.push('');
  lines.push(mdTable(['Dimension', 'Score moyen'], dimRows));
  lines.push('');
  lines.push('### Statut CDC (score_cdc)');
  lines.push('');
  lines.push(
    mdTable(
      ['Statut', 'Fiches', '%'],
      [
        [`Complète (≥ ${CDC_COMPLETE_THRESHOLD}%)`, String(complete), pct(complete, pub.length)],
        [
          `Partielle (${CDC_PARTIAL_THRESHOLD}–${CDC_COMPLETE_THRESHOLD - 1}%)`,
          String(partial),
          pct(partial, pub.length),
        ],
        [`Gap (< ${CDC_PARTIAL_THRESHOLD}%)`, String(gap), pct(gap, pub.length)],
      ],
    ),
  );
  lines.push('');
  lines.push(
    `**Lecture** : la dimension **Golden template** (${mean(pub.map((r) => r.score_golden))}%) et la **Restructuration** (${mean(pub.map((r) => r.score_structure))}%) sont les deux chantiers majeurs : c'est l'écart entre le catalogue et la fiche exemplaire.`,
  );
  return lines.join('\n');
}

function dimensionScorecard(ref: CdcHotelAuditResult): string {
  const rows: string[][] = [];
  for (const dim of Object.keys(DIMENSION_LABELS) as CdcDimension[]) {
    const d = ref.dimensions[dim];
    rows.push([DIMENSION_LABELS[dim], `${d.score}%`, `${d.passed}/${d.total}`]);
  }
  return mdTable(['Dimension', 'Score', 'Checks OK'], rows);
}

function sectionReference(hotels: readonly CdcHotelAuditResult[]): string {
  const ref = hotels.find((h) => h.slug === REFERENCE_SLUG);
  const lines: string[] = [];
  lines.push(`## 2. Fiche de référence — \`${REFERENCE_SLUG}\``);
  lines.push('');
  if (ref === undefined) {
    lines.push(`_Fiche \`${REFERENCE_SLUG}\` absente du jeu de données audité._`);
    return lines.join('\n');
  }
  lines.push(
    `Score global **${ref.score_global}%** · CDC **${ref.score_cdc}%** · Golden **${ref.score_golden}%** · Restructuration **${ref.score_structure}%**.`,
  );
  lines.push('');
  lines.push(
    `> ✅ Le contenu « golden » (handoff restaurants/POI, dossier spa, Instagram, concierge_pick/hook) est **promu en base** (script \`promote:airelles-golden\`, source partagée \`@mch/domain/editorial/airelles-golden.ts\`). La fiche de référence score donc le nouveau standard **sans** le flag local \`MCH_LOCAL_FIXTURE\` : Golden ≈ 90 %, Restructuration 100 %.`,
  );
  lines.push('');
  lines.push('### Scorecard par dimension');
  lines.push('');
  lines.push(dimensionScorecard(ref));
  lines.push('');
  const failingBlocks = [...ref.blocks]
    .filter((b) => b.score < 100)
    .sort((a, b) => a.score - b.score);
  if (failingBlocks.length > 0) {
    lines.push('### Blocs CDC < 100%');
    lines.push('');
    lines.push(
      mdTable(
        ['Bloc', 'Libellé', 'Score', 'OK'],
        failingBlocks.map((b) => [b.block, b.label, `${b.score}%`, `${b.passed}/${b.total}`]),
      ),
    );
    lines.push('');
  }
  if (ref.cdc_gaps.length > 0) {
    lines.push('### Gaps restants de la fiche de référence');
    lines.push('');
    lines.push(
      mdTable(
        ['Champ', 'Sév.', 'Message'],
        [...ref.cdc_gaps]
          .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
          .map((g) => [`\`${g.field}\``, g.severity, g.message]),
      ),
    );
  }
  return lines.join('\n');
}

function sectionCohorts(hotels: readonly CdcHotelAuditResult[]): string {
  const pub = publishedOf(hotels);

  const byTier = new Map<string, CdcHotelAuditResult[]>();
  for (const r of pub) {
    const key = r.luxury_tier ?? '— non classé —';
    byTier.set(key, [...(byTier.get(key) ?? []), r]);
  }
  const tierRows = [...byTier.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([tier, rs]) => [
      tier,
      String(rs.length),
      `${mean(rs.map((r) => r.score_global))}%`,
      `${mean(rs.map((r) => r.score_cdc))}%`,
      `${mean(rs.map((r) => r.score_golden))}%`,
      `${mean(rs.map((r) => r.score_structure))}%`,
    ]);

  const byCountry = new Map<string, CdcHotelAuditResult[]>();
  for (const r of pub) {
    const key = r.country_code ?? '—';
    byCountry.set(key, [...(byCountry.get(key) ?? []), r]);
  }
  const countryRows = [...byCountry.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 12)
    .map(([cc, rs]) => [
      cc,
      String(rs.length),
      `${mean(rs.map((r) => r.score_global))}%`,
      `${mean(rs.map((r) => r.score_golden))}%`,
    ]);

  const bands: Array<[string, (n: number) => boolean]> = [
    ['90–100%', (n) => n >= 90],
    ['70–89%', (n) => n >= 70 && n < 90],
    ['50–69%', (n) => n >= 50 && n < 70],
    ['< 50%', (n) => n < 50],
  ];
  const bandRows = bands.map(([label, test]) => {
    const n = pub.filter((r) => test(r.score_global)).length;
    return [label, String(n), pct(n, pub.length)];
  });

  const lines: string[] = [];
  lines.push('## 3. Cohortes');
  lines.push('');
  lines.push('### Par palier de luxe (`luxury_tier`)');
  lines.push('');
  lines.push(mdTable(['Tier', 'Fiches', 'Global', 'CDC', 'Golden', 'Restruct.'], tierRows));
  lines.push('');
  lines.push('### Par pays (top 12)');
  lines.push('');
  lines.push(mdTable(['Pays', 'Fiches', 'Global', 'Golden'], countryRows));
  lines.push('');
  lines.push('### Distribution du score global');
  lines.push('');
  lines.push(mdTable(['Tranche', 'Fiches', '%'], bandRows));
  return lines.join('\n');
}

function sectionToAdd(hotels: readonly CdcHotelAuditResult[]): string {
  const pub = publishedOf(hotels);
  const failingByDim = aggregateFailingChecks(pub);
  const lines: string[] = [];
  lines.push('## 4. Tout le contenu à AJOUTER');
  lines.push('');
  lines.push(
    `Checks en échec par dimension de contenu (fiches publiées, ${pub.length}). Chaque ligne = un contenu manquant à produire ou enrichir.`,
  );
  lines.push('');
  for (const dim of ADD_DIMENSIONS) {
    const aggs = failingByDim.get(dim);
    if (aggs === undefined || aggs.length === 0) continue;
    lines.push(`### ${DIMENSION_LABELS[dim]}`);
    lines.push('');
    lines.push(
      mdTable(
        ['Check', 'Bloc', 'Sév.', 'Fiches', '%'],
        aggs.map((a) => [
          `\`${a.id}\``,
          BLOCK_LABELS[a.block] ?? a.block,
          worstSeverity(a.severities),
          String(a.failing),
          pct(a.failing, pub.length),
        ]),
      ),
    );
    lines.push('');
  }

  const gaps = aggregateGaps(pub).slice(0, TOP_GAPS);
  lines.push(`### Top ${TOP_GAPS} champs manquants (catalogue)`);
  lines.push('');
  lines.push(
    mdTable(
      ['Champ', 'Fiches', 'Sév.', 'Exemple de message'],
      gaps.map((g) => [
        `\`${g.field}\``,
        String(g.count),
        worstSeverity(g.severities),
        g.message.replace(/\|/gu, '\\|'),
      ]),
    ),
  );
  return lines.join('\n');
}

function sectionToRestructure(hotels: readonly CdcHotelAuditResult[]): string {
  const pub = publishedOf(hotels);
  const failingByDim = aggregateFailingChecks(pub);
  const lines: string[] = [];
  lines.push("## 5. Tout ce qu'il faut RESTRUCTURER");
  lines.push('');
  lines.push(
    'Réorganisations (pas de création de contenu neuf) : anti-cannibalisation des sections long-read, distinctions fabriquées à retirer, prérequis structurels du JSON-LD.',
  );
  lines.push('');
  for (const dim of RESTRUCTURE_DIMENSIONS) {
    const aggs = failingByDim.get(dim) ?? [];
    for (const a of aggs) {
      const affected = slugsFailingCheck(pub, a.id);
      lines.push(
        `### \`${a.id}\` — ${affected.length} fiches (${pct(affected.length, pub.length)})`,
      );
      lines.push('');
      lines.push(
        `Sévérité : **${worstSeverity(a.severities)}** · bloc ${BLOCK_LABELS[a.block] ?? a.block}.`,
      );
      lines.push('');
      lines.push(sampleSlugList(affected, SAMPLE_SLUGS));
      lines.push('');
    }
  }
  // JSON-LD structural prerequisites that are about shape, not new content.
  const jsonldStructural = ['contained_in_place', 'image_provenance', 'google_rating_scale'];
  const jsonldAggs = (failingByDim.get('jsonld') ?? []).filter((a) =>
    jsonldStructural.includes(a.id),
  );
  if (jsonldAggs.length > 0) {
    lines.push('### Prérequis structurels JSON-LD');
    lines.push('');
    lines.push(
      mdTable(
        ['Check', 'Fiches', '%'],
        jsonldAggs.map((a) => [`\`${a.id}\``, String(a.failing), pct(a.failing, pub.length)]),
      ),
    );
  }
  return lines.join('\n');
}

function pipelinesFor(
  hotels: readonly CdcHotelAuditResult[],
  pred: (g: AuditGap) => boolean,
): Set<string> {
  const out = new Set<string>();
  for (const h of hotels) {
    for (const g of h.cdc_gaps) {
      if (pred(g)) out.add(g.pipeline);
    }
  }
  return out;
}

/**
 * Since EVERY fiche currently carries at least one blocker gap, a simple
 * "blocker first" wave swallows the whole catalogue. We instead frame the
 * remediation as one prioritised CONTENT track (by editorial priority) plus
 * two TRANSVERSAL tracks (Golden, Restructuration) that are largely
 * scriptable across the whole catalogue.
 */
function sectionWaves(hotels: readonly CdcHotelAuditResult[]): string {
  const pub = publishedOf(hotels);
  const byScore = (a: CdcHotelAuditResult, b: CdcHotelAuditResult): number =>
    a.score_global - b.score_global;

  const p0 = pub.filter((r) => r.priority === 'P0').sort(byScore);
  const p1 = pub.filter((r) => r.priority === 'P1').sort(byScore);
  const rest = pub.filter((r) => r.priority !== 'P0' && r.priority !== 'P1').sort(byScore);

  const lines: string[] = [];
  lines.push('## 6. Plan de remédiation (1 track contenu + 2 tracks transversaux)');
  lines.push('');
  lines.push(
    `> Chaque fiche publiée porte au moins un \`blocker\` : un simple tri "blockers d'abord" prendrait tout le catalogue. On séquence donc le **contenu par priorité éditoriale**, et on traite **Golden** et **Restructuration** comme deux chantiers transversaux largement scriptables.`,
  );
  lines.push('');

  lines.push('### Track A — Contenu CDC, par priorité éditoriale');
  lines.push('');
  lines.push(
    mdTable(
      ['Vague', 'Périmètre', 'Fiches', 'Global moyen', 'CDC moyen'],
      [
        [
          'A1',
          'Priorité **P0** (flagship)',
          String(p0.length),
          `${mean(p0.map((r) => r.score_global))}%`,
          `${mean(p0.map((r) => r.score_cdc))}%`,
        ],
        [
          'A2',
          'Priorité **P1**',
          String(p1.length),
          `${mean(p1.map((r) => r.score_global))}%`,
          `${mean(p1.map((r) => r.score_cdc))}%`,
        ],
        [
          'A3',
          'P2 / non prioritaire (long tail)',
          String(rest.length),
          `${mean(rest.map((r) => r.score_global))}%`,
          `${mean(rest.map((r) => r.score_cdc))}%`,
        ],
      ],
    ),
  );
  lines.push('');
  if (p0.length > 0) {
    lines.push(`**A1 (P0)** — ${sampleSlugList(p0, SAMPLE_SLUGS)}`);
    lines.push('');
  }
  if (p1.length > 0) {
    lines.push(`**A2 (P1)** — ${sampleSlugList(p1, SAMPLE_SLUGS)}`);
    lines.push('');
  }
  lines.push(
    `**A3 (long tail)** — les ${rest.length} fiches restantes, à traiter par lots via les pipelines ci-dessous.`,
  );
  lines.push('');
  const contentPipelines = pipelinesFor(pub, (g) => g.severity !== 'info');
  if (contentPipelines.size > 0) {
    lines.push(
      `Pipelines contenu : ${[...contentPipelines]
        .sort()
        .map((p) => `\`${p}\``)
        .join(', ')}`,
    );
    lines.push('');
  }

  // Track B — Golden (transversal)
  const goldenLow = pub.filter((r) => r.score_golden < 50);
  lines.push('### Track B — Golden template (transversal, automatisable)');
  lines.push('');
  lines.push(
    `${goldenLow.length} fiches (${pct(goldenLow.length, pub.length)}) sous 50% Golden. Chantiers : handoff restaurants/POI (contact + tip), buckets POI visit/do/shop, dossier spa, \`upcoming_events\` + image, Instagram, \`concierge_pick\`/\`concierge_hook\`.`,
  );
  lines.push('');
  lines.push(
    'Pipelines : `pois:sync` (handoff + buckets), `events:sync` (+image), `concierge:humanize:*`, `photos:sync` (provenance/credit), seed `instagram`/`concierge_pick`/`concierge_hook` (migration 0068).',
  );
  lines.push('');

  // Track C — Restructuration (transversal)
  const fabricated = slugsFailingCheck(pub, 'struct.no_fabricated_star');
  const duplicate = slugsFailingCheck(pub, 'struct.no_duplicate_sections');
  lines.push('### Track C — Restructuration (transversal)');
  lines.push('');
  lines.push(
    mdTable(
      ['Chantier', 'Sév.', 'Fiches', '%', 'Pipeline'],
      [
        [
          'Retirer les distinctions Michelin fabriquées (`no_fabricated_star`)',
          'blocker',
          String(fabricated.length),
          pct(fabricated.length, pub.length),
          '`editorial sanitiser`',
        ],
        [
          'Dédoublonner les sections long-read (`no_duplicate_sections`)',
          'warn',
          String(duplicate.length),
          pct(duplicate.length, pub.length),
          '`dropDuplicateCategorySections`',
        ],
      ],
    ),
  );
  lines.push('');
  lines.push(
    `Priorité C : les **${fabricated.length}** fiches avec distinction fabriquée sont des \`blocker\` EEAT (Hard Rule 7) — à traiter avant indexation.`,
  );
  return lines.join('\n');
}

function sectionBacklog(hotels: readonly CdcHotelAuditResult[]): string {
  const pub = publishedOf(hotels);
  const sorted = [...pub].sort((a, b) => a.score_global - b.score_global).slice(0, BACKLOG_ROWS);
  const rows = sorted.map((r) => {
    const worst = [...r.blocks].sort((a, b) => a.score - b.score)[0];
    return [
      `\`${r.slug}\``,
      r.luxury_tier ?? '—',
      r.country_code ?? '—',
      `${r.score_global}%`,
      `${r.score_cdc}%`,
      `${r.score_golden}%`,
      `${r.score_structure}%`,
      worst !== undefined ? `${worst.label} (${worst.score}%)` : '—',
      String(r.cdc_gaps.length),
    ];
  });
  const lines: string[] = [];
  lines.push(`## 7. Backlog par fiche (${BACKLOG_ROWS} plus faibles)`);
  lines.push('');
  lines.push(
    mdTable(
      ['Slug', 'Tier', 'Pays', 'Global', 'CDC', 'Golden', 'Restruct.', 'Pire bloc', 'Gaps'],
      rows,
    ),
  );
  lines.push('');
  lines.push(
    '_Backlog exhaustif (toutes les fiches) : voir le CSV `hotel-fiche-cdc-backlog-*.csv` du même run._',
  );
  return lines.join('\n');
}

function sectionMigration(): string {
  const lines: string[] = [];
  lines.push('## 8. Schéma & promotion en base');
  lines.push('');
  lines.push(
    '- **Migration `0068`** (appliquée) : colonnes jsonb `instagram`, `concierge_pick`, `concierge_hook` sur `public.hotels` + champs Payload (`apps/admin`) + lecture dans `get-hotel-by-slug.ts` (`HOTEL_COLUMNS`).',
  );
  lines.push(
    '- **Promotion Airelles** (faite) : `promote:airelles-golden` écrit le golden de `@mch/domain/editorial/airelles-golden.ts` dans la ligne `les-airelles-gordes` (24 champs) ; la page lit `concierge_pick`/`concierge_hook`/hero golden depuis la ligne (`readConciergePick`/`readConciergeHook`/`hasGoldenHero`).',
  );
  lines.push(
    '- **Production du contenu Golden** : les pipelines existants (`pois:sync`, `events:sync`, `concierge:humanize:*`, `photos:*`) alimentent la plupart des champs ; le handoff (contact + tip par lieu) et les buckets POI (visit/do/shop) sont les ajouts spécifiques au golden template.',
  );
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function buildReport(payload: AuditPayload, inputPath: string, stamp: string): string {
  const hotels = payload.hotels;
  return [
    sectionHeader(payload, inputPath, stamp),
    sectionExecutiveSummary(hotels),
    sectionReference(hotels),
    sectionCohorts(hotels),
    sectionToAdd(hotels),
    sectionToRestructure(hotels),
    sectionWaves(hotels),
    sectionBacklog(hotels),
    sectionMigration(),
  ].join('\n\n');
}

function main(): void {
  const argv = process.argv.slice(2).filter((a) => a !== '--');
  const inputPath = parseInputArg(argv) ?? latestAuditJson();
  const payload = loadPayload(inputPath);
  const stamp = new Date().toISOString().slice(0, 10);
  const report = buildReport(payload, inputPath, stamp);
  const outPath = resolve(runsDir(), `hotel-fiche-cdc-report-${stamp}.md`);
  writeFileSync(outPath, `${report}\n`, 'utf8');
  // eslint-disable-next-line no-console
  console.log(`Report → ${outPath}`);
}

main();
