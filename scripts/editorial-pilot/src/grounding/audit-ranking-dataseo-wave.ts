/**
 * Read-only DataForSEO audit for editorial rankings.
 *
 * Produces a modify/create/remove matrix per ranking. No database write.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

import { isEditoriallyRelevantPaa } from '../hotels/faq-perplexity-gates.js';
import { loadDfsConfig } from './env-dfs.js';
import {
  GROUNDING_LOCALE_EN_US,
  GROUNDING_LOCALE_FR,
  groundKeywords,
} from './keyword-grounding.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../../../..');

loadDotenv({ path: resolve(REPO_ROOT, '.env.local') });
loadDotenv({ path: resolve(REPO_ROOT, '.env') });

const DEFAULT_LIMIT = 100;
const DEFAULT_CANDIDATES = 180;
const DEFAULT_CONCURRENCY = 2;

const SupabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(40),
});

const RankingRowSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title_fr: z.string(),
  title_en: z.string().nullable(),
  kind: z.string().nullable(),
  intro_fr: z.string().nullable(),
  intro_en: z.string().nullable(),
  meta_title_fr: z.string().nullable(),
  meta_title_en: z.string().nullable(),
  meta_desc_fr: z.string().nullable(),
  meta_desc_en: z.string().nullable(),
  factual_summary_fr: z.string().nullable(),
  factual_summary_en: z.string().nullable(),
  editorial_sections: z.unknown().nullable(),
  faq: z.unknown().nullable(),
  tables: z.unknown().nullable(),
  glossary: z.unknown().nullable(),
  editorial_callouts: z.unknown().nullable(),
  external_sources: z.unknown().nullable(),
  toc_anchors: z.unknown().nullable(),
  axes: z.unknown().nullable(),
  is_published: z.boolean(),
  updated_at: z.string().nullable(),
});

type RankingRow = z.infer<typeof RankingRowSchema>;

interface Args {
  readonly limit: number;
  readonly candidateLimit: number;
  readonly concurrency: number;
  readonly refresh: boolean;
}

interface RankingQuality {
  readonly sectionsCount: number;
  readonly faqCount: number;
  readonly tablesCount: number;
  readonly sourcesCount: number;
  readonly tocCount: number;
  readonly metaTitleFrLen: number;
  readonly metaTitleEnLen: number;
  readonly metaDescFrLen: number;
  readonly metaDescEnLen: number;
  readonly factualFrLen: number;
  readonly factualEnLen: number;
  readonly introFrLen: number;
  readonly introEnLen: number;
}

interface ScoredRanking {
  readonly row: RankingRow;
  readonly score: number;
  readonly reasons: readonly string[];
  readonly quality: RankingQuality;
}

interface ChangePlan {
  readonly modify: readonly string[];
  readonly create: readonly string[];
  readonly remove: readonly string[];
}

interface ClassifiedPaa {
  readonly question: string;
  readonly action: 'keep_faq' | 'keep_section' | 'keep_linking' | 'reject_noise' | 'reject_phase6';
}

interface RankingAuditItem {
  readonly slug: string;
  readonly titleFr: string;
  readonly score: number;
  readonly reasons: readonly string[];
  readonly quality: RankingQuality;
  readonly grounding: {
    readonly frSeeds: readonly string[];
    readonly enSeeds: readonly string[];
    readonly paaTotal: number;
    readonly paaUseful: number;
    readonly topKeywords: readonly {
      readonly keyword: string;
      readonly searchVolume: number | null;
    }[];
  };
  readonly paa: readonly ClassifiedPaa[];
  readonly changes: ChangePlan;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const readNumber = (name: string, fallback: number): number => {
    const raw = argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
    if (raw === undefined) return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  return {
    limit: readNumber('limit', DEFAULT_LIMIT),
    candidateLimit: readNumber('candidates', DEFAULT_CANDIDATES),
    concurrency: readNumber('concurrency', DEFAULT_CONCURRENCY),
    refresh: argv.includes('--refresh'),
  };
}

function asArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function quality(row: RankingRow): RankingQuality {
  return {
    sectionsCount: asArray(row.editorial_sections).length,
    faqCount: asArray(row.faq).length,
    tablesCount: asArray(row.tables).length,
    sourcesCount: asArray(row.external_sources).length,
    tocCount: asArray(row.toc_anchors).length,
    metaTitleFrLen: row.meta_title_fr?.length ?? 0,
    metaTitleEnLen: row.meta_title_en?.length ?? 0,
    metaDescFrLen: row.meta_desc_fr?.length ?? 0,
    metaDescEnLen: row.meta_desc_en?.length ?? 0,
    factualFrLen: row.factual_summary_fr?.length ?? 0,
    factualEnLen: row.factual_summary_en?.length ?? 0,
    introFrLen: row.intro_fr?.length ?? 0,
    introEnLen: row.intro_en?.length ?? 0,
  };
}

function scoreRanking(row: RankingRow): ScoredRanking {
  const q = quality(row);
  const reasons: string[] = [];
  let score = 0;

  if (/paris|londres|new-york|dubai|dubaï|rome|venise|tokyo|monaco|cannes|nice/iu.test(row.slug)) {
    score += 18;
    reasons.push('priority_destination');
  }
  if (/meilleurs|best|luxe|luxury|palace|spa|romantique|famille|vue|plage/iu.test(row.slug)) {
    score += 12;
    reasons.push('high_intent_axis');
  }
  if (q.sectionsCount < 6) {
    score += 15;
    reasons.push('sections_lt_6');
  }
  if (q.faqCount < 10) {
    score += 14;
    reasons.push('faq_lt_10');
  }
  if (q.sourcesCount < 3) {
    score += 12;
    reasons.push('sources_lt_3');
  }
  if (q.tablesCount < 1) {
    score += 8;
    reasons.push('missing_comparison_table');
  }
  if (q.tocCount < 5) {
    score += 6;
    reasons.push('toc_lt_5');
  }
  if (
    q.metaDescFrLen < 140 ||
    q.metaDescFrLen > 170 ||
    q.metaDescEnLen < 140 ||
    q.metaDescEnLen > 170
  ) {
    score += 10;
    reasons.push('meta_desc_outside_band');
  }
  if (
    q.factualFrLen < 110 ||
    q.factualFrLen > 165 ||
    q.factualEnLen < 110 ||
    q.factualEnLen > 165
  ) {
    score += 8;
    reasons.push('factual_outside_envelope');
  }
  if (q.introEnLen < 200) {
    score += 6;
    reasons.push('intro_en_thin');
  }

  return { row, score, reasons, quality: q };
}

function classifyPaa(question: string): ClassifiedPaa {
  const q = question.toLowerCase();
  if (!isEditoriallyRelevantPaa(question)) return { question, action: 'reject_noise' };
  if (
    /\b(net worth|worth|fortune|richest|celebrity|celebrities|salary|salaire|booking|book|availability|payment|refund)\b/iu.test(
      q,
    )
  ) {
    return { question, action: 'reject_noise' };
  }
  if (/\b(price|prix|tarif|disponible|available)\b/iu.test(q)) {
    return { question, action: 'reject_phase6' };
  }
  if (/\b(best|meilleurs|luxury|luxe|palace|top|ranking|classement)\b/iu.test(q)) {
    return { question, action: 'keep_linking' };
  }
  if (
    /\b(spa|restaurant|family|famille|romantic|romantique|beach|plage|view|vue|district|quartier|airport|aeroport)\b/iu.test(
      q,
    )
  ) {
    return { question, action: 'keep_section' };
  }
  return { question, action: 'keep_faq' };
}

function buildSeeds(row: RankingRow): {
  readonly fr: readonly string[];
  readonly en: readonly string[];
} {
  const titleFr = row.title_fr.replace(/[|·]/gu, ' ').replace(/\s+/gu, ' ').trim();
  const titleEn = (row.title_en ?? '').replace(/[|·]/gu, ' ').replace(/\s+/gu, ' ').trim();
  const slugWords = row.slug.replace(/-/gu, ' ');
  return {
    fr: [titleFr, slugWords].filter((s) => s.length > 0).slice(0, 2),
    en: [titleEn, slugWords].filter((s) => s.length > 0).slice(0, 2),
  };
}

function buildChanges(
  scored: ScoredRanking,
  classified: readonly ClassifiedPaa[],
  topKeyword: string | null,
): ChangePlan {
  const modify: string[] = [];
  const create: string[] = [];
  const remove: string[] = [];
  const q = scored.quality;

  if (scored.reasons.includes('meta_desc_outside_band'))
    modify.push('Reviser meta_desc FR/EN dans la bande 140-170.');
  if (scored.reasons.includes('factual_outside_envelope'))
    modify.push('Reviser factual_summary FR/EN dans l’enveloppe 110-165.');
  if (scored.reasons.includes('intro_en_thin')) modify.push('Renforcer intro_en pour parite EN.');
  if (topKeyword !== null)
    modify.push(`Verifier title/H1/meta contre le top keyword "${topKeyword}".`);

  if (q.faqCount < 10) create.push('Créer ou regénérer FAQ DataSEO-grounded.');
  if (q.sectionsCount < 6)
    create.push(
      'Créer sections editoriales manquantes : methode, quartiers, criteres, cas d’usage.',
    );
  if (q.tablesCount < 1) create.push('Créer tableau comparatif.');
  if (q.sourcesCount < 3) create.push('Ajouter sources EEAT externes.');
  if (q.tocCount < 5) create.push('Créer/compléter TOC anchors.');

  if (classified.some((p) => p.action.startsWith('reject'))) {
    remove.push('Retirer des FAQ/sections les PAA bruitées ou Phase 6.');
  }
  if (
    /\bpas cher|cheap|promo|discount\b/iu.test(
      scored.row.title_fr + ' ' + (scored.row.title_en ?? ''),
    )
  ) {
    remove.push('Retirer angle prix/promo incompatible avec positionnement luxe.');
  }
  if (modify.length === 0 && create.length === 0 && remove.length === 0) {
    modify.push('Classement stable : garder en observation.');
  }
  return { modify, create, remove };
}

async function fetchRankings(url: string, key: string, limit: number): Promise<RankingRow[]> {
  const columns = [
    'id',
    'slug',
    'title_fr',
    'title_en',
    'kind',
    'intro_fr',
    'intro_en',
    'meta_title_fr',
    'meta_title_en',
    'meta_desc_fr',
    'meta_desc_en',
    'factual_summary_fr',
    'factual_summary_en',
    'editorial_sections',
    'faq',
    'tables',
    'glossary',
    'editorial_callouts',
    'external_sources',
    'toc_anchors',
    'axes',
    'is_published',
    'updated_at',
  ].join(',');
  const endpoint = new URL('/rest/v1/editorial_rankings', url);
  endpoint.searchParams.set('select', columns);
  endpoint.searchParams.set('is_published', 'eq.true');
  endpoint.searchParams.set('order', 'updated_at.desc.nullslast,slug.asc');
  endpoint.searchParams.set('limit', String(limit));
  const res = await fetch(endpoint, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `[audit-ranking-dataseo] Supabase fetch failed (${res.status}): ${body.slice(0, 300)}`,
    );
  }
  return z.array(RankingRowSchema).parse(await res.json());
}

function selectRankings(rows: readonly RankingRow[], limit: number): readonly ScoredRanking[] {
  return rows
    .map(scoreRanking)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.row.slug.localeCompare(b.row.slug);
    })
    .slice(0, limit);
}

async function mapConcurrent<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  let next = 0;
  async function run(): Promise<void> {
    for (;;) {
      const index = next;
      next += 1;
      const item = items[index];
      if (item === undefined) return;
      out[index] = await worker(item, index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()));
  return out;
}

async function auditOne(
  scored: ScoredRanking,
  index: number,
  total: number,
  refresh: boolean,
): Promise<RankingAuditItem> {
  const dfs = loadDfsConfig();
  if (dfs === null) throw new Error('DataForSEO is disabled or unconfigured.');
  console.log(`[audit-ranking-dataseo] ${index + 1}/${total} ${scored.row.slug}`);
  const seeds = buildSeeds(scored.row);
  const fr = await groundKeywords(dfs, seeds.fr, GROUNDING_LOCALE_FR, {
    refresh,
    maxSerpSeeds: 2,
    maxRelatedSeeds: 2,
    keepTopKeywords: 12,
  });
  const en = await groundKeywords(dfs, seeds.en, GROUNDING_LOCALE_EN_US, {
    refresh,
    maxSerpSeeds: 1,
    maxRelatedSeeds: 1,
    keepTopKeywords: 8,
  });
  const paa = [...fr.peopleAlsoAsk, ...en.peopleAlsoAsk].map(classifyPaa);
  const useful = paa.filter((p) => !p.action.startsWith('reject'));
  const topKeywords = [...fr.topKeywords, ...en.topKeywords]
    .sort((a, b) => (b.searchVolume ?? -1) - (a.searchVolume ?? -1))
    .slice(0, 8);
  return {
    slug: scored.row.slug,
    titleFr: scored.row.title_fr,
    score: scored.score,
    reasons: scored.reasons,
    quality: scored.quality,
    grounding: {
      frSeeds: fr.seeds,
      enSeeds: en.seeds,
      paaTotal: paa.length,
      paaUseful: useful.length,
      topKeywords,
    },
    paa: paa.slice(0, 16),
    changes: buildChanges(scored, paa, topKeywords[0]?.keyword ?? null),
  };
}

function renderMarkdown(
  items: readonly RankingAuditItem[],
  args: Args,
  generatedAt: string,
): string {
  const lines: string[] = [];
  lines.push('# Audit DataSEO — classements');
  lines.push('');
  lines.push(`**Date** : ${generatedAt}`);
  lines.push('**Mode** : lecture seule, DataForSEO live avec cache disque, aucune ecriture DB.');
  lines.push(
    `**Parametres** : limit=${args.limit}, candidates=${args.candidateLimit}, concurrency=${args.concurrency}, refresh=${args.refresh ? 'on' : 'off'}.`,
  );
  lines.push('');
  lines.push('## Synthese');
  lines.push('');
  lines.push(`- Classements audites : ${items.length}`);
  lines.push(`- PAA utiles : ${items.reduce((sum, item) => sum + item.grounding.paaUseful, 0)}`);
  lines.push(
    `- Classements FAQ < 10 : ${items.filter((item) => item.quality.faqCount < 10).length}`,
  );
  lines.push(
    `- Classements sections < 6 : ${items.filter((item) => item.quality.sectionsCount < 6).length}`,
  );
  lines.push(
    `- Classements sources < 3 : ${items.filter((item) => item.quality.sourcesCount < 3).length}`,
  );
  lines.push('');
  lines.push('## Tableau prioritaire');
  lines.push('');
  lines.push('| # | Slug | Score | PAA utiles | Top keyword | Modifier | Créer | Retirer |');
  lines.push('| ---: | --- | ---: | ---: | --- | --- | --- | --- |');
  items.forEach((item, index) => {
    lines.push(
      `| ${index + 1} | \`${item.slug}\` | ${item.score} | ${item.grounding.paaUseful} | ${item.grounding.topKeywords[0]?.keyword ?? '-'} | ${item.changes.modify.length} | ${item.changes.create.length} | ${item.changes.remove.length} |`,
    );
  });
  lines.push('');
  lines.push('## Detail classement par classement');
  for (const item of items) {
    lines.push('');
    lines.push(`### ${item.slug}`);
    lines.push('');
    lines.push(`- **Titre** : ${item.titleFr}`);
    lines.push(`- **Score / raisons** : ${item.score} — ${item.reasons.join(', ') || 'stable'}`);
    lines.push(
      `- **Qualite actuelle** : sections ${item.quality.sectionsCount}, FAQ ${item.quality.faqCount}, tables ${item.quality.tablesCount}, sources ${item.quality.sourcesCount}, meta FR/EN ${item.quality.metaDescFrLen}/${item.quality.metaDescEnLen}`,
    );
    lines.push(
      `- **DataSEO** : PAA ${item.grounding.paaUseful}/${item.grounding.paaTotal} utiles, top keywords ${
        item.grounding.topKeywords
          .slice(0, 5)
          .map((k) => `${k.keyword}${k.searchVolume === null ? '' : ` (${k.searchVolume}/mo)`}`)
          .join(', ') || '-'
      }`,
    );
    const kept = item.paa.filter((p) => p.action.startsWith('keep')).slice(0, 5);
    const rejected = item.paa.filter((p) => p.action.startsWith('reject')).slice(0, 4);
    if (kept.length > 0)
      lines.push(
        `- **PAA utiles** : ${kept.map((p) => `${p.question} [${p.action}]`).join(' ; ')}`,
      );
    if (rejected.length > 0)
      lines.push(
        `- **PAA rejetees** : ${rejected.map((p) => `${p.question} [${p.action}]`).join(' ; ')}`,
      );
    lines.push(`- **À modifier** : ${item.changes.modify.join(' ; ') || 'Rien en priorite.'}`);
    lines.push(`- **À créer** : ${item.changes.create.join(' ; ') || 'Rien en priorite.'}`);
    lines.push(`- **À retirer** : ${item.changes.remove.join(' ; ') || 'Rien en priorite.'}`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const env = SupabaseEnvSchema.parse(process.env);
  const rows = await fetchRankings(
    env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/u, ''),
    env.SUPABASE_SERVICE_ROLE_KEY,
    args.candidateLimit,
  );
  const selected = selectRankings(rows, args.limit);
  console.log(`[audit-ranking-dataseo] selected=${selected.length} candidates=${rows.length}`);
  const items = await mapConcurrent(selected, args.concurrency, (item, index) =>
    auditOne(item, index, selected.length, args.refresh),
  );
  const generatedAt = new Date().toISOString();
  const stamp = generatedAt.replace(/[:.]/gu, '-');
  const outDir = resolve(REPO_ROOT, 'scripts/editorial-pilot/runs');
  await mkdir(outDir, { recursive: true });
  const jsonPath = resolve(outDir, `dataseo-ranking-wave-${args.limit}-${stamp}.json`);
  const mdPath = resolve(outDir, `dataseo-ranking-wave-${args.limit}-${stamp}.md`);
  await writeFile(jsonPath, JSON.stringify({ generatedAt, args, items }, null, 2), 'utf8');
  await writeFile(mdPath, renderMarkdown(items, args, generatedAt), 'utf8');
  console.log(`[audit-ranking-dataseo] wrote ${jsonPath}`);
  console.log(`[audit-ranking-dataseo] wrote ${mdPath}`);
}

main().catch((err: unknown) => {
  console.error('[audit-ranking-dataseo] FATAL', err);
  process.exit(1);
});
