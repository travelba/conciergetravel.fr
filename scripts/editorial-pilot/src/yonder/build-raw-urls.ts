/**
 * build-raw-urls.ts — assemble the exhaustive list of yonder.fr hotel-ranking
 * URLs to feed `extract-yonder.ts`.
 *
 * Sources merged (deduplicated, order-preserving):
 *   1. The full `/les-tops/hotels` archive captured by
 *      `scrape-yonder-tops-index.ts` → `data/yonder-tops-fr-index.json`
 *      (its `all` array, FR + international — Phase A wants the INTEGRALITY
 *      of yonder rankings, not just the FR subset).
 *   2. The curated cityguide / `hotels-du-mois` pages from `yonder-pages.ts`
 *      — these live OUTSIDE `/les-tops/hotels` and are therefore invisible to
 *      the Tops archive sweep, yet they list FR luxury hotels we must diff.
 *
 * Output: `yonder/raw-urls.json` ({ urls: string[] }) — the input contract of
 * `extract-yonder.ts`.
 *
 * Run:
 *   pnpm --filter @mch/editorial-pilot exec tsx src/yonder/build-raw-urls.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { YONDER_PAGES } from './yonder-pages.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../../data');
const YONDER_DIR = resolve(__dirname, '../../yonder');
mkdirSync(YONDER_DIR, { recursive: true });

const IndexSchema = z.object({
  all: z.array(
    z.object({
      slug: z.string(),
      title: z.string(),
      url: z.string(),
    }),
  ),
});

function main(): void {
  const indexPath = resolve(DATA_DIR, 'yonder-tops-fr-index.json');
  const raw = readFileSync(indexPath, 'utf8');
  const index = IndexSchema.parse(JSON.parse(raw));

  const urls = new Set<string>();
  for (const e of index.all) urls.add(e.url);
  for (const p of YONDER_PAGES) urls.add(p.url);

  const out = { urls: Array.from(urls) };
  const outPath = resolve(YONDER_DIR, 'raw-urls.json');
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(
    `[build-raw-urls] ${index.all.length} tops + ${YONDER_PAGES.length} curated → ${out.urls.length} unique URLs`,
  );
  console.log(`[done] wrote ${outPath}`);
}

main();
