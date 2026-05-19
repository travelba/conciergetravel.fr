/**
 * extract-yonder.ts — pull all hotel mentions from yonder.fr editorial pages.
 *
 * Pipeline:
 *   1. Read yonder/raw-urls.json (curated by tavily_map).
 *   2. For each URL, call tavilyExtract (basic depth) in batches of 10.
 *   3. Save raw markdown to yonder/raw/<sanitized>.md  (cache → idempotent).
 *   4. For each saved page, run llmExtract with a Zod schema enumerating hotel
 *      mentions (name, hint_city, hint_region, hint_stars).
 *   5. Aggregate into yonder/hotels.json — one row per unique normalised name.
 *
 * The "normalised name" is a slug-style key (lowercase, no diacritics, dashes)
 * so we can fuzzy-match it against MyConciergeHotel `hotels.slug` later.
 *
 * Cost (gpt-4o-mini): ~120 listing pages × ~$0.002 ≈ $0.25 + Tavily ~120 credits.
 */

import { z } from 'zod';
import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tavilyExtract } from '../enrichment/tavily-client.js';
import { llmExtract } from '../enrichment/llm-extract.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../yonder');
const RAW_DIR = resolve(ROOT, 'raw');
mkdirSync(RAW_DIR, { recursive: true });

const HotelMention = z.object({
  name: z.string().min(2),
  hint_city: z.string().nullable(),
  hint_region: z.string().nullable(),
  hint_country: z.string().nullable(),
  hint_stars: z.number().int().min(0).max(5).nullable(),
  is_palace: z.boolean().nullable(),
});

const PageExtraction = z.object({
  hotels: z.array(HotelMention).max(60),
});

const SCHEMA_DESC = `{
  "hotels": [
    {
      "name": string,                  // full hotel name as printed on the page (e.g. "Le Bristol Paris", "Cheval Blanc St-Tropez")
      "hint_city": string | null,      // city/village mentioned next to the hotel
      "hint_region": string | null,    // French region if obvious (e.g. "Provence", "Bourgogne", "Côte d'Azur", "Corse")
      "hint_country": string | null,   // country (default null = France)
      "hint_stars": number | null,     // 0..5 if the page mentions stars (e.g. "4 étoiles" -> 4)
      "is_palace": boolean | null      // true if explicitly called "Palace" (French distinction)
    }
  ]
}

IMPORTANT:
- Only include hotels presented as individual lodging options (skip restaurants, bars unless they are a hotel restaurant featured as the hotel).
- Ignore "advertorial" / "tour operator" mentions and skip mentions of city names only.
- Do not invent hotels: if the page is a single-hotel review, you may return just 1 hotel.
- Deduplicate within the same page.
- Trim trailing tags like " - Paris", " (5 étoiles)" — keep just the hotel proper name.
`;

function sanitize(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?yonder\.fr\//, '').replace(/[^a-zA-Z0-9._-]+/g, '_');
}

async function fetchRawForUrls(urls: readonly string[]): Promise<void> {
  const missing = urls.filter((u) => !existsSync(resolve(RAW_DIR, `${sanitize(u)}.md`)));
  if (missing.length === 0) {
    console.log(`[fetch] all ${urls.length} URLs already cached`);
    return;
  }
  console.log(`[fetch] need to download ${missing.length}/${urls.length} URLs from Tavily`);
  for (let i = 0; i < missing.length; i += 10) {
    const batch = missing.slice(i, i + 10);
    console.log(`  batch ${i / 10 + 1}/${Math.ceil(missing.length / 10)}: ${batch.length} URLs`);
    try {
      const res = await tavilyExtract({ urls: batch, extractDepth: 'basic', format: 'markdown' });
      for (const r of res.results) {
        writeFileSync(resolve(RAW_DIR, `${sanitize(r.url)}.md`), r.rawContent);
      }
      for (const f of res.failedResults) {
        console.warn(`    failed ${f.url}: ${f.error}`);
      }
    } catch (e) {
      console.error(`  batch failed:`, e instanceof Error ? e.message : e);
    }
  }
}

async function parsePages(
  urls: readonly string[],
): Promise<
  Array<{
    url: string;
    hotels: z.infer<typeof HotelMention>[];
    usage: { inputTokens: number; outputTokens: number };
  }>
> {
  const out: Awaited<ReturnType<typeof parsePages>> = [];
  for (const url of urls) {
    const file = resolve(RAW_DIR, `${sanitize(url)}.md`);
    if (!existsSync(file)) {
      console.warn(`[parse] missing raw file for ${url}`);
      continue;
    }
    const content = readFileSync(file, 'utf8');
    if (content.trim().length < 200) {
      console.warn(`[parse] content too short for ${url} (${content.length} chars)`);
      continue;
    }
    const trimmed = content.slice(0, 24000);
    const res = await llmExtract({
      content: trimmed,
      context: `Yonder.fr listing — extract every hotel mentioned. URL: ${url}`,
      schemaDescription: SCHEMA_DESC,
      schema: PageExtraction,
    });
    if (!res) {
      console.warn(`[parse] llm-extract returned null for ${url}`);
      continue;
    }
    console.log(`  ${url} → ${res.data.hotels.length} hotels`);
    out.push({ url, hotels: res.data.hotels, usage: res.usage });
  }
  return out;
}

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

async function main(): Promise<void> {
  const rawUrls: { urls: string[] } = JSON.parse(
    readFileSync(resolve(ROOT, 'raw-urls.json'), 'utf8'),
  );
  const urls = Array.from(
    new Set(rawUrls.urls.map((u) => u.replace(/\/Les-tops\//, '/les-tops/'))),
  );
  console.log(`[start] ${urls.length} unique URLs`);

  await fetchRawForUrls(urls);

  // Limit per-run if a slice arg is passed
  const sliceArg = process.argv.find((a) => a.startsWith('--slice='))?.slice(8);
  const slice = sliceArg ? Number(sliceArg) : urls.length;
  const sliceUrls = urls.slice(0, slice);
  console.log(`[parse] LLM-parsing ${sliceUrls.length}/${urls.length} pages`);

  const pages = await parsePages(sliceUrls);

  // Aggregate
  const byKey = new Map<
    string,
    {
      key: string;
      name: string;
      sources: string[];
      hint_city: string | null;
      hint_region: string | null;
      hint_country: string | null;
      hint_stars: number | null;
      is_palace: boolean | null;
    }
  >();
  for (const p of pages) {
    for (const h of p.hotels) {
      const key = normaliseKey(h.name);
      if (key.length < 3) continue;
      const existing = byKey.get(key);
      if (existing) {
        if (!existing.sources.includes(p.url)) existing.sources.push(p.url);
        existing.hint_city = existing.hint_city ?? h.hint_city;
        existing.hint_region = existing.hint_region ?? h.hint_region;
        existing.hint_country = existing.hint_country ?? h.hint_country;
        existing.hint_stars = existing.hint_stars ?? h.hint_stars;
        existing.is_palace = existing.is_palace ?? h.is_palace;
      } else {
        byKey.set(key, {
          key,
          name: h.name,
          sources: [p.url],
          hint_city: h.hint_city,
          hint_region: h.hint_region,
          hint_country: h.hint_country,
          hint_stars: h.hint_stars,
          is_palace: h.is_palace,
        });
      }
    }
  }

  const aggregated = Array.from(byKey.values()).sort((a, b) => b.sources.length - a.sources.length);
  const outFile = resolve(ROOT, 'hotels.json');
  writeFileSync(outFile, JSON.stringify(aggregated, null, 2));
  console.log(`\n[done] ${aggregated.length} unique hotels → ${outFile}`);
  console.log(`Top 10 most-cited:`);
  for (const h of aggregated.slice(0, 10)) {
    console.log(`  ${h.sources.length.toString().padStart(2, ' ')}× ${h.name}`);
  }

  // Per-page log for debug
  writeFileSync(
    resolve(ROOT, 'pages.json'),
    JSON.stringify(
      pages.map((p) => ({
        url: p.url,
        count: p.hotels.length,
        hotels: p.hotels.map((h) => h.name),
      })),
      null,
      2,
    ),
  );

  // Token usage summary
  const inputTokens = pages.reduce((s, p) => s + p.usage.inputTokens, 0);
  const outputTokens = pages.reduce((s, p) => s + p.usage.outputTokens, 0);
  console.log(
    `LLM usage: ${inputTokens} input + ${outputTokens} output tokens → ~$${(
      (inputTokens / 1e6) * 0.15 +
      (outputTokens / 1e6) * 0.6
    ).toFixed(4)}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
