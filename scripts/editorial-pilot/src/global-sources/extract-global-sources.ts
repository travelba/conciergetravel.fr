/**
 * extract-global-sources.ts — pull premium award lists into a unified shape.
 *
 * Sources (one script handles all three to avoid 3× boilerplate) :
 *   - tl   = Travel + Leisure World's Best 2025 (top 100 hotels)
 *   - cn   = Condé Nast Traveler Gold List 2025/2026
 *   - w50  = The World's 50 Best Hotels 2025 + extended 51-100
 *
 * Pipeline (per source) :
 *   1. tavilyExtract on the canonical list URL(s), depth=advanced (JS-rendered).
 *   2. Cache raw markdown to global-sources/raw/<source>.<sanitized>.md
 *   3. Single llmExtract per page → array of {name, city, country_code, rank?}
 *   4. Aggregate to global-sources/hotels-<source>.json
 *
 * Usage:
 *   pnpm global:extract                # all 3 sources sequentially
 *   pnpm global:extract -- --source=tl # one source
 *
 * Cost: ~10 Tavily credits (advanced × ~6 URLs) + ~$0.15 LLM.
 */

import { z } from 'zod';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tavilyExtract } from '../enrichment/tavily-client.js';
import { llmExtract } from '../enrichment/llm-extract.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../global-sources');
const RAW_DIR = resolve(ROOT, 'raw');
mkdirSync(RAW_DIR, { recursive: true });

type SourceKey = 'tl' | 'cn' | 'w50';

interface SourceConfig {
  readonly key: SourceKey;
  readonly award_year: number;
  readonly award_tier: 'tl_worlds_best' | 'cn_gold_list' | 'world_50_best';
  readonly label: string;
  readonly urls: readonly string[];
  /** Specialised instruction to help the LLM understand what's "the list". */
  readonly llmContext: string;
  /**
   * Optional anchor strings: when present, the raw content is sliced from the
   * FIRST occurrence of any anchor. Lets us skip 30k chars of nav/cookies on
   * editorial sites that have huge boilerplate before the actual list.
   */
  readonly anchors?: readonly string[];
}

const SOURCES: readonly SourceConfig[] = [
  {
    key: 'tl',
    award_year: 2025,
    award_tier: 'tl_worlds_best',
    label: "Travel + Leisure World's Best 2025",
    urls: [
      'https://www.travelandleisure.com/worlds-best-awards-2025-top-100-hotels-11748686',
      'https://www.travelandleisure.com/worlds-best-awards-2025-hotels-spas-11747779',
      'https://www.travelandleisure.com/worlds-best-awards-2025-hotel-brands-11751883',
    ],
    llmContext:
      "Page from Travel + Leisure World's Best Awards 2025 — readers' favorite hotels worldwide. Extract every numbered/ranked hotel mention with its city + country. The list has 100 entries — EXTRACT THEM ALL.",
    anchors: ['andBeyond Bateleur', 'andBeyond', 'Bateleur Camp', 'No. 1', '100.', '100. '],
  },
  {
    key: 'cn',
    award_year: 2025,
    award_tier: 'cn_gold_list',
    label: 'Condé Nast Traveler Gold List 2025/2026',
    urls: [
      'https://www.cntraveler.com/category/hotel/gold-list/2025',
      'https://www.cntraveler.com/gallery/the-best-hotels-in-the-world',
      'https://www.cntraveller.com/gold-list-2026',
    ],
    llmContext:
      'Page from Condé Nast Traveler Gold List — editors-curated best hotels worldwide. Extract every hotel mentioned with its city + country.',
  },
  {
    key: 'w50',
    award_year: 2025,
    award_tier: 'world_50_best',
    label: "The World's 50 Best Hotels 2025 (+ 51-100)",
    urls: [
      // Note : `theworlds50best.com` (no "hotels" in domain) is the WORKING
      // path. The Tavily-extracted markdown from `theworlds50besthotels.com`
      // contains only the navigation menu — content is JS-rendered.
      'https://www.theworlds50best.com/hotels/list/1-50',
      'https://www.theworlds50best.com/hotels/list/51-100',
      // Belt-and-braces fallbacks (curated third-party articles that list
      // the full ranking in plain HTML).
      'https://thedotmagazine.com/the-worlds-50-best-hotels-2025-announced-and-the-no-1-is-in-asia-again/',
      'https://theluxurytravelexpert.com/the-worlds-50-best-hotels-list/',
      'https://robbreport.com/travel/hotels/lists/50-best-hotels-1236896449/',
    ],
    llmContext:
      "Page from The World's 50 Best Hotels 2025 — ranked list 1-100. Extract EVERY hotel name with its rank number (1-100), city, country.",
    anchors: [
      'Rosewood Hong Kong',
      'World’s 50 Best Hotels',
      "World's 50 Best Hotels",
      '1. Rosewood',
    ],
  },
] as const;

const HotelMention = z.object({
  name: z.string().min(2),
  hint_city: z.string().nullable(),
  hint_country: z.string().nullable(),
  hint_country_code: z
    .string()
    .transform((s) => s.toUpperCase().trim())
    .pipe(z.string().regex(/^[A-Z]{2}$/))
    .nullable(),
  // T+L uses decimal scores ("99.4", "99.1") AS the rank label — accept floats.
  rank: z.number().min(0).max(200).nullable(),
});

const PageExtraction = z.object({
  hotels: z.array(HotelMention).max(150),
});

const SCHEMA_DESC = `{
  "hotels": [
    {
      "name": string,
      "hint_city": string | null,
      "hint_country": string | null,    // English country name (e.g. "Italy", "Maldives", "South Africa")
      "hint_country_code": string | null, // ISO 3166-1 alpha-2 UPPERCASE
      "rank": number | null              // ranking position if the page lists ranks
    }
  ]
}

ISO codes cheat-sheet (use these): GB=United Kingdom, IT=Italy, ES=Spain, FR=France, DE=Germany, PT=Portugal, GR=Greece, CH=Switzerland, AT=Austria, HU=Hungary, CZ=Czechia, NL=Netherlands, BE=Belgium, US=United States, CA=Canada, MX=Mexico, BR=Brazil, AR=Argentina, JP=Japan, CN=China, HK=Hong Kong, KR=South Korea, IN=India, ID=Indonesia (Bali), TH=Thailand, VN=Vietnam, KH=Cambodia, MY=Malaysia, SG=Singapore, AE=UAE (Dubai), QA=Qatar, OM=Oman, TR=Turkey, MA=Morocco, EG=Egypt, ZA=South Africa, KE=Kenya, TZ=Tanzania, RW=Rwanda, NA=Namibia, BW=Botswana, MU=Mauritius, MV=Maldives, SC=Seychelles, AU=Australia, NZ=New Zealand, FJ=Fiji, PE=Peru, CO=Colombia, EC=Ecuador, CL=Chile, BS=Bahamas, BB=Barbados, JM=Jamaica, KY=Cayman, TC=Turks & Caicos, LC=Saint Lucia, BL=Saint Barthelemy, AG=Antigua, ME=Montenegro, HR=Croatia, AL=Albania, RO=Romania.

IMPORTANT:
- Include EVERY hotel name on the page. The lists are long (50-100 entries) — don't truncate.
- Skip brand-only mentions ("Four Seasons" without a location).
- Skip restaurants and spas unless they ARE the hotel (e.g. "Capella Bangkok" = hotel; "Le Normandy spa" = skip).
- If the page has a numbered rank ("1. Rosewood Hong Kong"), capture the rank.
- Deduplicate within the same page.
`;

function sanitize(source: SourceKey, url: string): string {
  const slug = url.replace(/^https?:\/\/(www\.)?/, '').replace(/[^a-zA-Z0-9._-]+/g, '_');
  return `${source}_${slug}`;
}

async function fetchRaw(source: SourceConfig): Promise<void> {
  const missing = source.urls.filter(
    (u) => !existsSync(resolve(RAW_DIR, `${sanitize(source.key, u)}.md`)),
  );
  if (missing.length === 0) {
    console.log(`[${source.key}] all ${source.urls.length} URLs cached`);
    return;
  }
  console.log(`[${source.key}] downloading ${missing.length} URL(s) (depth=advanced)`);
  // 5 URLs per call max for advanced extracts to stay under credit ceiling.
  for (let i = 0; i < missing.length; i += 5) {
    const batch = missing.slice(i, i + 5);
    try {
      const res = await tavilyExtract({
        urls: batch,
        extractDepth: 'advanced',
        format: 'markdown',
        timeoutSec: 60,
      });
      for (const r of res.results) {
        writeFileSync(resolve(RAW_DIR, `${sanitize(source.key, r.url)}.md`), r.rawContent);
        console.log(`  cached ${r.url} (${r.rawContent.length} chars)`);
      }
      for (const f of res.failedResults) {
        console.warn(`  failed ${f.url}: ${f.error}`);
      }
    } catch (e) {
      console.error(`[${source.key}] batch failed:`, e instanceof Error ? e.message : e);
    }
  }
}

async function parseSource(source: SourceConfig): Promise<
  Array<{
    name: string;
    hint_city: string | null;
    hint_country: string | null;
    hint_country_code: string | null;
    rank: number | null;
    award_year: number;
    award_tier: SourceConfig['award_tier'];
    sources: string[];
  }>
> {
  const aggregated = new Map<
    string,
    {
      name: string;
      hint_city: string | null;
      hint_country: string | null;
      hint_country_code: string | null;
      rank: number | null;
      award_year: number;
      award_tier: SourceConfig['award_tier'];
      sources: string[];
    }
  >();

  for (const url of source.urls) {
    const file = resolve(RAW_DIR, `${sanitize(source.key, url)}.md`);
    if (!existsSync(file)) {
      console.warn(`[${source.key}] missing raw file for ${url}`);
      continue;
    }
    const content = readFileSync(file, 'utf8');
    if (content.trim().length < 300) {
      console.warn(`[${source.key}] content too short for ${url} (${content.length} chars)`);
      continue;
    }
    // Trim prelude using anchors when present (skips 30k+ chars of nav/cookies).
    let start = 0;
    if (source.anchors && source.anchors.length > 0) {
      for (const anchor of source.anchors) {
        const idx = content.indexOf(anchor);
        if (idx >= 0) {
          start = Math.max(0, idx - 200);
          break;
        }
      }
    }
    // 90k chars ≈ 22k tokens, well within gpt-4o-mini's 128k context.
    const trimmed = content.slice(start, start + 90000);
    const res = await llmExtract({
      content: trimmed,
      context: `${source.llmContext} URL: ${url}`,
      schemaDescription: SCHEMA_DESC,
      schema: PageExtraction,
      // 100 hotels × ~60 chars JSON each ≈ 12K tokens. 16K leaves headroom.
      maxOutputTokens: 16000,
    });
    if (!res) {
      console.warn(`[${source.key}] llm-extract returned null for ${url}`);
      continue;
    }
    console.log(`[${source.key}] ${url} → ${res.data.hotels.length} hotels`);

    for (const h of res.data.hotels) {
      const key = h.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/['’`]/g, ' ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      if (key.length < 3) continue;
      const existing = aggregated.get(key);
      if (existing) {
        if (!existing.sources.includes(url)) existing.sources.push(url);
        existing.hint_city = existing.hint_city ?? h.hint_city;
        existing.hint_country = existing.hint_country ?? h.hint_country;
        existing.hint_country_code = existing.hint_country_code ?? h.hint_country_code;
        existing.rank = existing.rank ?? h.rank;
      } else {
        aggregated.set(key, {
          name: h.name,
          hint_city: h.hint_city,
          hint_country: h.hint_country,
          hint_country_code: h.hint_country_code,
          rank: h.rank,
          award_year: source.award_year,
          award_tier: source.award_tier,
          sources: [url],
        });
      }
    }
  }

  return Array.from(aggregated.values()).sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
}

async function runSource(source: SourceConfig): Promise<void> {
  console.log(`\n=== ${source.label} ===`);
  await fetchRaw(source);
  const hotels = await parseSource(source);
  const outFile = resolve(ROOT, `hotels-${source.key}.json`);
  writeFileSync(outFile, JSON.stringify(hotels, null, 2));
  console.log(`[${source.key}] done — ${hotels.length} unique hotels → ${outFile}`);
  console.log(`[${source.key}] top 10:`);
  for (const h of hotels.slice(0, 10)) {
    const rank = h.rank ? `#${h.rank.toString().padStart(3, ' ')} ` : '     ';
    const cc = h.hint_country_code ? ` [${h.hint_country_code}]` : '';
    console.log(`  ${rank}${h.name}${cc}`);
  }
}

async function main(): Promise<void> {
  const sourceArg = process.argv.find((a) => a.startsWith('--source='))?.slice(9) as
    | SourceKey
    | undefined;
  const targets = sourceArg ? SOURCES.filter((s) => s.key === sourceArg) : SOURCES;
  if (targets.length === 0) {
    console.error(`unknown --source. valid: ${SOURCES.map((s) => s.key).join(', ')}`);
    process.exit(1);
  }
  for (const s of targets) {
    await runSource(s);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
