/**
 * Build a unified action matrix from hotel + ranking DataSEO audit JSON files.
 *
 * Usage:
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/grounding/build-dataseo-actions-report.ts \
 *     --hotels=scripts/editorial-pilot/runs/dataseo-hotel-wave-100-....json \
 *     --rankings=scripts/editorial-pilot/runs/dataseo-ranking-wave-100-....json
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../../../..');

const ChangePlanSchema = z.object({
  modify: z.array(z.string()),
  create: z.array(z.string()),
  remove: z.array(z.string()),
});

const HotelItemSchema = z.object({
  slug: z.string(),
  name: z.string(),
  city: z.string().nullable(),
  score: z.number(),
  reasons: z.array(z.string()),
  grounding: z.object({
    paaUseful: z.number(),
    topKeywords: z.array(z.object({ keyword: z.string(), searchVolume: z.number().nullable() })),
  }),
  changes: ChangePlanSchema,
});

const RankingItemSchema = z.object({
  slug: z.string(),
  titleFr: z.string(),
  score: z.number(),
  reasons: z.array(z.string()),
  grounding: z.object({
    paaUseful: z.number(),
    topKeywords: z.array(z.object({ keyword: z.string(), searchVolume: z.number().nullable() })),
  }),
  changes: ChangePlanSchema,
});

const HotelReportSchema = z.object({
  generatedAt: z.string(),
  items: z.array(HotelItemSchema),
});

const RankingReportSchema = z.object({
  generatedAt: z.string(),
  items: z.array(RankingItemSchema),
});

type HotelItem = z.infer<typeof HotelItemSchema>;
type RankingItem = z.infer<typeof RankingItemSchema>;

interface Args {
  readonly hotelsPath: string;
  readonly rankingsPath: string;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const hotelsPath = argv.find((a) => a.startsWith('--hotels='))?.slice('--hotels='.length);
  const rankingsPath = argv.find((a) => a.startsWith('--rankings='))?.slice('--rankings='.length);
  if (hotelsPath === undefined || rankingsPath === undefined) {
    throw new Error('Missing --hotels=... or --rankings=...');
  }
  return { hotelsPath, rankingsPath };
}

function resolveInput(path: string): string {
  return resolve(REPO_ROOT, path);
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(resolveInput(path), 'utf8')) as unknown;
}

function topKeyword(item: HotelItem | RankingItem): string {
  const top = item.grounding.topKeywords[0];
  if (top === undefined) return '-';
  return top.searchVolume === null ? top.keyword : `${top.keyword} (${top.searchVolume}/mo)`;
}

function firstOrDash(values: readonly string[]): string {
  return values[0] ?? '-';
}

function actionCount(
  items: readonly (HotelItem | RankingItem)[],
  key: keyof z.infer<typeof ChangePlanSchema>,
): number {
  return items.reduce((sum, item) => sum + item.changes[key].length, 0);
}

function renderHotelTable(items: readonly HotelItem[]): string[] {
  const lines: string[] = [];
  lines.push(
    '| # | Fiche hotel | Ville | Score | Top keyword | À modifier | À créer | À retirer |',
  );
  lines.push('| ---: | --- | --- | ---: | --- | --- | --- | --- |');
  items.forEach((item, index) => {
    lines.push(
      `| ${index + 1} | \`${item.slug}\` | ${item.city ?? '-'} | ${item.score} | ${topKeyword(item)} | ${firstOrDash(item.changes.modify)} | ${firstOrDash(item.changes.create)} | ${firstOrDash(item.changes.remove)} |`,
    );
  });
  return lines;
}

function renderRankingTable(items: readonly RankingItem[]): string[] {
  const lines: string[] = [];
  lines.push('| # | Classement | Score | Top keyword | À modifier | À créer | À retirer |');
  lines.push('| ---: | --- | ---: | --- | --- | --- | --- |');
  items.forEach((item, index) => {
    lines.push(
      `| ${index + 1} | \`${item.slug}\` | ${item.score} | ${topKeyword(item)} | ${firstOrDash(item.changes.modify)} | ${firstOrDash(item.changes.create)} | ${firstOrDash(item.changes.remove)} |`,
    );
  });
  return lines;
}

function renderDetails(title: string, items: readonly (HotelItem | RankingItem)[]): string[] {
  const lines: string[] = [];
  lines.push(`## ${title}`);
  for (const item of items) {
    lines.push('');
    lines.push(`### ${item.slug}`);
    lines.push('');
    lines.push(`- **Score** : ${item.score} — ${item.reasons.join(', ') || 'stable'}`);
    lines.push(
      `- **Top keyword** : ${topKeyword(item)} ; PAA utiles : ${item.grounding.paaUseful}`,
    );
    lines.push(`- **À modifier** : ${item.changes.modify.join(' ; ') || 'Rien en priorite.'}`);
    lines.push(`- **À créer** : ${item.changes.create.join(' ; ') || 'Rien en priorite.'}`);
    lines.push(`- **À retirer** : ${item.changes.remove.join(' ; ') || 'Rien en priorite.'}`);
  }
  return lines;
}

function renderReport(
  hotels: readonly HotelItem[],
  rankings: readonly RankingItem[],
  hotelsGeneratedAt: string,
  rankingsGeneratedAt: string,
  generatedAt: string,
): string {
  const allItems = [...hotels, ...rankings];
  const lines: string[] = [];
  lines.push('# Matrice DataSEO — modifier / créer / retirer');
  lines.push('');
  lines.push(`**Date** : ${generatedAt}`);
  lines.push(`**Sources** : hôtels ${hotelsGeneratedAt}, classements ${rankingsGeneratedAt}.`);
  lines.push(
    '**Mode** : lecture seule. Les corrections restent à exécuter dans des vagues séparées avec gates `hasLeak()` + `dfs_paa_coverage`.',
  );
  lines.push('');
  lines.push('## Synthese');
  lines.push('');
  lines.push(
    `- Entités auditées : ${allItems.length} (${hotels.length} fiches hôtel, ${rankings.length} classements).`,
  );
  lines.push(`- Actions à modifier : ${actionCount(allItems, 'modify')}.`);
  lines.push(`- Actions à créer : ${actionCount(allItems, 'create')}.`);
  lines.push(`- Actions à retirer : ${actionCount(allItems, 'remove')}.`);
  lines.push(
    `- PAA utiles : ${allItems.reduce((sum, item) => sum + item.grounding.paaUseful, 0)}.`,
  );
  lines.push('');
  lines.push('## Priorité hôtels');
  lines.push('');
  lines.push(...renderHotelTable(hotels.slice(0, 30)));
  lines.push('');
  lines.push('## Priorité classements');
  lines.push('');
  lines.push(...renderRankingTable(rankings.slice(0, 30)));
  lines.push('');
  lines.push('## Benchmark yonder.fr');
  lines.push('');
  lines.push(
    '- **MCH gagne côté machine** : JSON-LD, FAQPage, ItemList, hreflang et maillage interne sont plus structurés.',
  );
  lines.push(
    '- **Yonder garde l’avance éditoriale visible** : justifications plus concrètes par hôtel, angles plus incarnés, photos mieux choisies, autorité/indexation plus forte.',
  );
  lines.push(
    '- **Delta actionnable** : pour chaque classement prioritaire, renforcer les preuves par hôtel, compléter EN, ajouter sources EEAT, retirer les angles Phase 6 et créer les sections qui répondent aux PAA réelles.',
  );
  lines.push(
    '- **Différenciation MCH** : conserver l’avantage catalogue, le Conseil du Concierge, la FAQ PAA-grounded et les liens vers fiches/lieux, plutôt que copier le format magazine Yonder.',
  );
  lines.push('');
  lines.push(...renderDetails('Détail hôtels', hotels));
  lines.push('');
  lines.push(...renderDetails('Détail classements', rankings));
  lines.push('');
  lines.push('## Règles d’exécution');
  lines.push('');
  lines.push(
    '- Corriger d’abord les erreurs factuelles, claims non sourcés, langues mélangées et PAA bruitées.',
  );
  lines.push(
    '- Créer ensuite les blocs manquants : FAQ grounded, geo_qa, sources EEAT, sections, tables et photos.',
  );
  lines.push(
    '- Retirer sans attendre les angles Phase 6 : disponibilité, paiement, refund, promo, prix live.',
  );
  lines.push(
    '- Comparer les pages stratégiques à yonder.fr avant réécriture des classements pour identifier les angles manquants.',
  );
  lines.push('');
  return `${lines.join('\n')}\n`;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const hotels = HotelReportSchema.parse(await readJson(args.hotelsPath));
  const rankings = RankingReportSchema.parse(await readJson(args.rankingsPath));
  const generatedAt = new Date().toISOString();
  const stamp = generatedAt.replace(/[:.]/gu, '-');
  const outDir = resolve(REPO_ROOT, 'scripts/editorial-pilot/runs');
  await mkdir(outDir, { recursive: true });
  const outPath = resolve(outDir, `dataseo-actions-unified-${stamp}.md`);
  await writeFile(
    outPath,
    renderReport(
      hotels.items,
      rankings.items,
      hotels.generatedAt,
      rankings.generatedAt,
      generatedAt,
    ),
    'utf8',
  );
  console.log(`[dataseo-actions] wrote ${outPath}`);
}

main().catch((err: unknown) => {
  console.error('[dataseo-actions] FATAL', err);
  process.exit(1);
});
