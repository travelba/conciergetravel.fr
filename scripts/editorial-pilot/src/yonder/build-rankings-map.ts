/**
 * build-rankings-map.ts — join the per-page hotel extraction (`yonder/pages.json`,
 * produced by extract-yonder.ts) with the Tops index (`data/yonder-tops-fr-index.json`)
 * to produce the canonical `ranking → [hotels]` map required by Phase A.
 *
 * Each ranking row carries: yonder slug, title, url, a coarse SCOPE classification
 * inferred from slug+title keywords (palace / 5-etoiles / 4-etoiles / relais-chateaux
 * / luxe / charme / theme / city / intl), the FR/non-FR flag, and the list of hotel
 * names extracted from that page (normalised key + raw name).
 *
 * Output: `yonder/rankings-map.json`.
 *
 * Run (after extract-yonder.ts):
 *   pnpm --filter @mch/editorial-pilot exec tsx src/yonder/build-rankings-map.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PILOT_ROOT = resolve(__dirname, '../..');
const YONDER_DIR = resolve(PILOT_ROOT, 'yonder');
const DATA_DIR = resolve(PILOT_ROOT, 'data');

const PagesSchema = z.array(
  z.object({ url: z.string(), count: z.number(), hotels: z.array(z.string()) }),
);
const IndexSchema = z.object({
  all: z.array(z.object({ slug: z.string(), title: z.string(), url: z.string() })),
});

function normaliseKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

/** Coarse scope from slug + title keywords. Order = priority. */
export type YonderScope =
  | 'palace'
  | 'relais-chateaux'
  | '5-etoiles'
  | 'luxe'
  | '4-etoiles'
  | 'charme-budget'
  | 'theme'
  | 'geo'
  | 'autre';

function classifyScope(slug: string, title: string): YonderScope {
  const h = `${slug} ${title}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (/\bpalace/.test(h)) return 'palace';
  if (/relais[\s-]?(et[\s-]?)?chateaux/.test(h)) return 'relais-chateaux';
  if (/5[\s-]?(etoiles?|star)|cinq[\s-]?etoiles/.test(h)) return '5-etoiles';
  if (/\bluxe\b|luxury|ultra[\s-]?luxe|grand[\s-]?luxe/.test(h)) return 'luxe';
  if (/4[\s-]?(etoiles?|star)|quatre[\s-]?etoiles/.test(h)) return '4-etoiles';
  if (/charme|abordable|pas[\s-]?cher|budget|insolite|auberge|chambre[\s-]?d[\s-]?hotes/.test(h))
    return 'charme-budget';
  if (
    /romantique|spa|bien[\s-]?etre|wellness|golf|famille|kids|gastronomi|design|piscine|rooftop|ski|montagne|mer|plage|vignoble/.test(
      h,
    )
  )
    return 'theme';
  return 'geo';
}

const QUALIFYING_SCOPES: ReadonlySet<YonderScope> = new Set([
  'palace',
  'relais-chateaux',
  '5-etoiles',
  'luxe',
]);

function main(): void {
  const pages = PagesSchema.parse(
    JSON.parse(readFileSync(resolve(YONDER_DIR, 'pages.json'), 'utf8')),
  );
  const index = IndexSchema.parse(
    JSON.parse(readFileSync(resolve(DATA_DIR, 'yonder-tops-fr-index.json'), 'utf8')),
  );

  const metaByUrl = new Map<string, { slug: string; title: string }>();
  for (const e of index.all) {
    metaByUrl.set(e.url, { slug: e.slug, title: e.title });
  }

  const rankings = pages.map((p) => {
    const meta = metaByUrl.get(p.url);
    const slug = meta?.slug ?? p.url.replace(/^https?:\/\/[^/]+\//u, '').replace(/\/$/u, '');
    const title = meta?.title ?? slug;
    const scope = classifyScope(slug, title);
    return {
      yonder_slug: slug,
      title,
      url: p.url,
      scope,
      qualifying: QUALIFYING_SCOPES.has(scope),
      hotel_count: p.hotels.length,
      hotels: p.hotels.map((name) => ({ key: normaliseKey(name), name })),
    };
  });

  rankings.sort((a, b) => b.hotel_count - a.hotel_count);

  const byScope: Record<string, number> = {};
  for (const r of rankings) byScope[r.scope] = (byScope[r.scope] ?? 0) + 1;

  writeFileSync(
    resolve(YONDER_DIR, 'rankings-map.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalRankings: rankings.length,
        rankingsWithHotels: rankings.filter((r) => r.hotel_count > 0).length,
        byScope,
        rankings,
      },
      null,
      2,
    ),
  );

  console.log(`[rankings-map] ${rankings.length} rankings, byScope=${JSON.stringify(byScope)}`);
  console.log(`[done] wrote yonder/rankings-map.json`);
}

main();
