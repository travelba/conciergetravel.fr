/**
 * extract-grecotel.ts — extract structured metadata for every Grecotel
 * property listed in grecotel-hotel-urls.json.
 *
 * Why Tavily + LLM (instead of just curl + regex)?
 *   - The WordPress page renders the rich data we want (collection, room
 *     count, dining outlets, spa, kids club, location, MICE capacity)
 *     inside heavy markup with inline styles. Tavily strips noise to
 *     clean markdown which the LLM extracts deterministically.
 *   - Grecotel uses a CDN (Cloudfront) that occasionally serves a JS-
 *     hydrated variant. `extract_depth: 'basic'` is enough here because
 *     the WordPress server-side render is complete; `advanced` is reserved
 *     for SPA pages (cf. extract-relais-chateaux.ts which needs advanced).
 *
 * Pipeline:
 *   1. Read global-sources/grecotel-hotel-urls.json
 *   2. Tavily extract `basic` per URL → cache global-sources/raw-grecotel/<sanitized>.md
 *   3. LLM extract per page → strict typed metadata
 *   4. Aggregate → global-sources/grecotel-hotels.json
 *
 * Cost estimate (gpt-4o-mini + Tavily basic):
 *   - Tavily extract: ~28 × 1 credit = 28 credits ≈ $0.14
 *   - LLM: ~3 K input + ~400 output tokens/page × 28 ≈ $0.02
 *   - Total ≈ $0.16 for the full run.
 *
 * Usage:
 *   pnpm grecotel:extract                  # full run (~28 hotels, ~5 min)
 *   pnpm grecotel:extract --limit=3        # smoke test
 *   pnpm grecotel:extract --concurrency=4  # default 4
 *
 * Skill: api-integration, llm-output-robustness (rule-9 anchor-trim,
 * rule-12-quater SPA-vs-SSR Tavily depth heuristic).
 */

import { z } from 'zod';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tavilyExtract } from '../enrichment/tavily-client.js';
import { llmExtract } from '../enrichment/llm-extract.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../global-sources');
const RAW_DIR = resolve(ROOT, 'raw-grecotel');
mkdirSync(RAW_DIR, { recursive: true });

// ─── Greek destination → canonical city normalization ────────────────────────
//
// Grecotel uses both English ("Crete", "Corfu", "Mykonos", "Halkidiki") and
// French-flavored variants in their hreflang FR pages. We standardize to the
// English label here so the diff against the catalogue is deterministic (the
// catalogue already uses English labels for non-FR cities).

const CITY_FROM_DESTINATION: Readonly<Record<string, string>> = {
  // Crete (regions / resort areas)
  rethymno: 'Rethymno',
  rethymnon: 'Rethymno',
  heraklion: 'Heraklion',
  gouves: 'Gouves',
  chania: 'Chania',
  crete: 'Crete',
  'agios nikolaos': 'Agios Nikolaos',
  // Corfu
  corfu: 'Corfu',
  kommeno: 'Corfu',
  dassia: 'Corfu',
  // Mykonos
  mykonos: 'Mykonos',
  // Rhodes
  rhodes: 'Rhodes',
  rhodos: 'Rhodes',
  // Kos
  kos: 'Kos',
  // Halkidiki
  halkidiki: 'Halkidiki',
  chalkidiki: 'Halkidiki',
  // Peloponnese
  kyllini: 'Kyllini',
  killini: 'Kyllini',
  olympia: 'Olympia',
  messinia: 'Messinia',
  kalamata: 'Kalamata',
  peloponnese: 'Peloponnese',
  // Athens
  athens: 'Athens',
  athènes: 'Athens',
  'cape sounio': 'Cape Sounio',
  sounio: 'Cape Sounio',
  // Larissa
  larissa: 'Larissa',
  // Alexandroupoli
  alexandroupoli: 'Alexandroupoli',
  alexandroupolis: 'Alexandroupoli',
};

function normalizeCity(label: string | null | undefined): string | null {
  if (!label) return null;
  const lc = label.trim().toLowerCase();
  return CITY_FROM_DESTINATION[lc] ?? label.trim();
}

// ─── Collection labels — Grecotel's own segmentation ─────────────────────────
//
// Grecotel groups its inventory into four published collections. We capture
// the raw label as a free-form string and normalize it client-side. This
// classification feeds the future `/marque/grecotel` facet sub-tiering and
// the editorial priority (Iconic > Luxe Me > Boutique > Family).

type GrecotelCollection =
  | 'luxe-me-exclusive' // 5★ Luxe Me Exclusive Resorts (flagships)
  | 'iconic' // The Iconic Collection (signature/heritage)
  | 'luxme-all-inclusive' // Luxe Me All-Inclusive Resorts
  | 'boutique' // Boutique Resorts
  | 'family' // Family Resorts (4★)
  | 'city' // City Hotels (Athens, Larissa)
  | 'unknown';

// ─── LLM extraction schema ────────────────────────────────────────────────────

const HotelMetadata = z.object({
  /** Hotel name as printed in the H1 / page title (e.g. "Amirandes"). */
  name: z.string().min(2),
  /** Marketing tagline below H1 (e.g. "A Grecotel Resort to Live in Crete"). */
  tagline: z.string().max(300).nullable(),
  /** Destination / region label as printed (e.g. "Crete", "Corfu", "Halkidiki"). */
  destination: z.string().min(2).nullable(),
  /** Resort area / closest city (e.g. "Gouves, Heraklion"). */
  resort_area: z.string().max(200).nullable(),
  /** Star rating (4 or 5). null if not explicitly stated. */
  stars: z.number().int().min(3).max(5).nullable(),
  /** Grecotel collection bucket — see GrecotelCollection union. */
  collection: z.enum([
    'luxe-me-exclusive',
    'iconic',
    'luxme-all-inclusive',
    'boutique',
    'family',
    'city',
    'unknown',
  ]),
  /** Number of rooms / accommodations, 1..999. null if absent. */
  number_of_rooms: z.number().int().min(1).max(999).nullable(),
  /** Number of restaurants / dining outlets, 0..30. null if absent. */
  number_of_restaurants: z.number().int().min(0).max(30).nullable(),
  /** Has spa / wellness center. */
  has_spa: z.boolean().nullable(),
  /** Has pool. */
  has_pool: z.boolean().nullable(),
  /** Has dedicated kids club. */
  has_kids_club: z.boolean().nullable(),
  /** All-inclusive offering. */
  is_all_inclusive: z.boolean().nullable(),
  /** Distance to the nearest airport (e.g. "20 km from Heraklion airport"). */
  airport_distance: z.string().max(200).nullable(),
  /** Open year-round (true) or seasonal (false, typically April-October). */
  year_round: z.boolean().nullable(),
  /** Short editorial paragraph (first 1-2 sentences of the hero block, max 600 chars). */
  short_description: z.string().max(800).nullable(),
});
type HotelMetadataT = z.infer<typeof HotelMetadata>;

const SCHEMA_DESC = `{
  "name": string,                       // hotel proper name from H1 / title (e.g. "Amirandes", "Cape Sounio", "Mykonos Blu", "LUX ME White Palace")
  "tagline": string | null,             // marketing strapline ("A Grecotel Resort to Live in Crete"), max 300 chars
  "destination": string | null,         // Greek destination / region label as printed: "Crete", "Corfu", "Mykonos", "Rhodes", "Kos", "Halkidiki", "Peloponnese", "Athens", "Larissa"
  "resort_area": string | null,         // closest city or resort area (e.g. "Gouves, Heraklion", "Cape Sounio", "Kommeno Bay"), max 200 chars
  "stars": number | null,               // integer 4 or 5 (Grecotel uses 4★ for family resorts, 5★ for Luxe Me / Boutique / Exclusive)
  "collection": "luxe-me-exclusive" | "iconic" | "luxme-all-inclusive" | "boutique" | "family" | "city" | "unknown",
                                        // Grecotel's own segmentation. Map per these rules:
                                        // - "Luxe Me Exclusive Resort" / "Exclusive Resort" → luxe-me-exclusive
                                        // - "Iconic" / "Signature Collection" / heritage 5★ → iconic
                                        // - "LUX ME" + "All Inclusive" / "Luxe Me All-Inclusive" → luxme-all-inclusive
                                        // - "Boutique Resort" 5★ → boutique
                                        // - "Family Resort" / 4★ family → family
                                        // - city hotels in Athens or Larissa (Pallas Athena, Larissa Imperial, Astir Egnatia) → city
                                        // - if unclear → unknown
  "number_of_rooms": number | null,     // integer 1..999. From "Accommodation" section. null if absent.
  "number_of_restaurants": number | null, // integer 0..30. From "Dining" or "Restaurants" section. null if absent.
  "has_spa": boolean | null,            // true if Elixir Alchemy Spa / spa center / wellness is mentioned
  "has_pool": boolean | null,           // true if pool / pools / lagoon-pool is mentioned
  "has_kids_club": boolean | null,      // true if "Grecoland" or kids club is mentioned
  "is_all_inclusive": boolean | null,   // true for LUX ME resorts (All-Inclusive offering)
  "airport_distance": string | null,    // verbatim distance phrase ("20 km from Heraklion airport"). max 200 chars
  "year_round": boolean | null,         // true if open year-round (city hotels typically year-round); false if seasonal beach resort
  "short_description": string | null    // 1-2 sentences from the hero/intro block. Max 800 chars.
}

EXTRACTION RULES:
- The hotel name is the H1 (e.g. "Amirandes", "Cape Sounio", "Caramel Boutique Resort", "Mandola Rosa", "Corfu Imperial", "Mykonos Blu", "LUX ME White Palace", "Casa Marron", "Pallas Athena Athens Grecotel Boutique Hotel"). Strip the "| A Grecotel Resort ..." suffix from the <title>. Apply standard title-case capitalization (e.g. "ASTIR PALACE, ALEXANDROUPOLIS" → "Astir Palace, Alexandroupolis").
- The destination is the BROAD Greek region for editorial bucketing: Crete, Corfu, Mykonos, Rhodes, Kos, Halkidiki, Peloponnese, Athens, Larissa, Alexandroupoli. If the page mentions "Costa Botanica" → destination = "Corfu". If "Mandola Rosa" → destination = "Peloponnese". If "Athens Riviera" → destination = "Athens".
- The resort_area is the MOST SPECIFIC location of the hotel — the closest town, beach, or named area. Always populate this field when the page mentions a specific place (e.g. "Cape Sounio" → resort_area = "Cape Sounio", NOT just "Athens"; "Mandola Rosa" → resort_area = "Kyllini" or "Peloponnese Riviera"; "Daphnila Bay" → resort_area = "Dassia, Corfu"; "Gouves" → resort_area = "Gouves, Heraklion"). resort_area MUST be more specific than destination — if you'd put the same value in both, prefer the named beach/town/cape over the broad region.
- For stars: 5 for everything labeled "Luxe Me", "Exclusive", "Boutique", "Iconic", or with explicit 5★. 4 for "Family Resort", "Casa Marron", "Filoxenia Kalamata". null if ambiguous.
- For collection: use the FIRST matching rule from the schema. When in doubt → unknown.
- short_description: extract from the hero block, NOT from the SEO meta description (which is often fluffier). Keep verbatim phrasing.
- Strict null discipline: if a field is not stated → return null. Never infer (e.g. number_of_rooms = null if the page doesn't print an explicit count).
`;

// ─── Filesystem helpers ───────────────────────────────────────────────────────

function sanitize(url: string): string {
  return url
    .replace(/^https?:\/\/(www\.)?grecotel\.com\//, '')
    .replace(/\/+$/, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_');
}

function slugFromUrl(url: string): string {
  const m = url.match(/grecotel\.com\/([a-z0-9-]+)\/?$/);
  return m?.[1] ?? '';
}

async function fetchRawForUrls(urls: readonly string[]): Promise<void> {
  const missing = urls.filter((u) => !existsSync(resolve(RAW_DIR, `${sanitize(u)}.md`)));
  if (missing.length === 0) {
    console.log(`[fetch] all ${urls.length} URLs already cached in ${RAW_DIR}`);
    return;
  }
  console.log(`[fetch] need to download ${missing.length}/${urls.length} pages from Tavily`);

  // Tavily accepts up to 20 URLs per call. Use batches of 10. `basic` mode
  // is sufficient here — Grecotel is WordPress with server-side rendering,
  // unlike R&C which requires `advanced` because of Next.js CSR.
  for (let i = 0; i < missing.length; i += 10) {
    const batch = missing.slice(i, i + 10);
    const batchNum = Math.floor(i / 10) + 1;
    const totalBatches = Math.ceil(missing.length / 10);
    console.log(`  batch ${batchNum}/${totalBatches}: ${batch.length} URLs`);
    try {
      const res = await tavilyExtract({
        urls: batch,
        extractDepth: 'basic',
        format: 'markdown',
        timeoutSec: 60,
      });
      for (const r of res.results) {
        writeFileSync(resolve(RAW_DIR, `${sanitize(r.url)}.md`), r.rawContent);
      }
      for (const f of res.failedResults) {
        console.warn(`    failed ${f.url}: ${f.error}`);
      }
    } catch (e) {
      console.error(`  batch ${batchNum} failed:`, e instanceof Error ? e.message : e);
    }
  }
}

// ─── Per-page LLM parse ───────────────────────────────────────────────────────

interface ExtractedHotel {
  readonly url: string;
  readonly slug: string;
  readonly metadata: HotelMetadataT;
  readonly normalized_city: string | null;
  readonly usage: { readonly inputTokens: number; readonly outputTokens: number };
}

async function parsePage(url: string): Promise<ExtractedHotel | null> {
  const file = resolve(RAW_DIR, `${sanitize(url)}.md`);
  if (!existsSync(file)) {
    console.warn(`[parse] missing raw file for ${url}`);
    return null;
  }
  const content = readFileSync(file, 'utf8');
  if (content.trim().length < 500) {
    console.warn(`[parse] content too short for ${url} (${content.length} chars)`);
    return null;
  }
  // llm-output-robustness rule-9 (anchor-trim): the hero + intro + accommodation
  // teaser + dining teaser sit in the first ~12 KB of Grecotel markdown. The
  // tail is the giant footer (newsletter, social, other resorts) — useless noise.
  const trimmed = content.slice(0, 12000);
  const res = await llmExtract({
    content: trimmed,
    context: `Grecotel hotel page. URL: ${url}`,
    schemaDescription: SCHEMA_DESC,
    schema: HotelMetadata,
  });
  if (!res) {
    console.warn(`[parse] llm-extract returned null for ${url}`);
    return null;
  }
  // Derive a clean city: prefer the resort_area (specific town/beach/cape)
  // and fall back to the destination (broad region). Cape Sounio is the
  // canonical example — the hotel sits in "Cape Sounio" 70km from Athens,
  // so destination='Athens' must NOT shadow resort_area='Cape Sounio'.
  const cityRaw = res.data.resort_area ?? res.data.destination;
  return {
    url,
    slug: slugFromUrl(url),
    metadata: res.data,
    normalized_city: normalizeCity(cityRaw),
    usage: res.usage,
  };
}

// ─── Concurrency helper ───────────────────────────────────────────────────────

async function withConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const idx = cursor++;
      const item = items[idx] as T;
      out[idx] = await fn(item, idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

// ─── Aggregation ─────────────────────────────────────────────────────────────

interface AggregatedHotel {
  readonly grecotel_slug: string;
  readonly grecotel_url: string;
  readonly name: string;
  readonly tagline: string | null;
  readonly destination: string | null;
  readonly resort_area: string | null;
  readonly normalized_city: string | null;
  readonly stars: number | null;
  readonly collection: GrecotelCollection;
  readonly number_of_rooms: number | null;
  readonly number_of_restaurants: number | null;
  readonly has_spa: boolean | null;
  readonly has_pool: boolean | null;
  readonly has_kids_club: boolean | null;
  readonly is_all_inclusive: boolean | null;
  readonly airport_distance: string | null;
  readonly year_round: boolean | null;
  readonly short_description: string | null;
}

function aggregate(parsed: readonly ExtractedHotel[]): AggregatedHotel[] {
  return parsed.map((p) => ({
    grecotel_slug: p.slug,
    grecotel_url: p.url,
    name: p.metadata.name,
    tagline: p.metadata.tagline,
    destination: p.metadata.destination,
    resort_area: p.metadata.resort_area,
    normalized_city: p.normalized_city,
    stars: p.metadata.stars,
    collection: p.metadata.collection,
    number_of_rooms: p.metadata.number_of_rooms,
    number_of_restaurants: p.metadata.number_of_restaurants,
    has_spa: p.metadata.has_spa,
    has_pool: p.metadata.has_pool,
    has_kids_club: p.metadata.has_kids_club,
    is_all_inclusive: p.metadata.is_all_inclusive,
    airport_distance: p.metadata.airport_distance,
    year_round: p.metadata.year_round,
    short_description: p.metadata.short_description,
  }));
}

// ─── Main ────────────────────────────────────────────────────────────────────

interface HotelUrlsFile {
  readonly hotels: ReadonlyArray<{ readonly slug: string; readonly url: string }>;
}

async function main(): Promise<void> {
  const file = resolve(ROOT, 'grecotel-hotel-urls.json');
  if (!existsSync(file)) {
    console.error(`[start] missing ${file}. Run \`pnpm grecotel:list\` first.`);
    process.exit(1);
  }
  const parsed: HotelUrlsFile = JSON.parse(readFileSync(file, 'utf8'));
  const urls = Array.from(new Set(parsed.hotels.map((h) => h.url)));
  console.log(`[start] ${urls.length} hotel URLs from grecotel-hotel-urls.json`);

  const limitArg = process.argv.find((a) => a.startsWith('--limit='))?.slice(8);
  const limit = limitArg ? Number(limitArg) : urls.length;
  const concurrencyArg = process.argv.find((a) => a.startsWith('--concurrency='))?.slice(14);
  const concurrency = concurrencyArg ? Number(concurrencyArg) : 4;
  const sliceUrls = urls.slice(0, limit);
  console.log(`[plan] processing ${sliceUrls.length} hotels with concurrency=${concurrency}`);

  await fetchRawForUrls(sliceUrls);

  const parsedPages: Array<ExtractedHotel | null> = await withConcurrency(
    sliceUrls,
    concurrency,
    async (url) => parsePage(url),
  );
  const valid = parsedPages.filter((p): p is ExtractedHotel => p !== null);
  console.log(`\n[parse] ${valid.length}/${sliceUrls.length} pages parsed successfully`);

  const aggregated = aggregate(valid);
  writeFileSync(resolve(ROOT, 'grecotel-hotels.json'), JSON.stringify(aggregated, null, 2));

  console.log(`\n[done] aggregated ${aggregated.length} hotels`);
  const byCollection = new Map<string, number>();
  for (const h of aggregated) {
    byCollection.set(h.collection, (byCollection.get(h.collection) ?? 0) + 1);
  }
  console.log(`\nBy collection:`);
  for (const [c, n] of Array.from(byCollection.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${c.padEnd(22)} ${n}`);
  }
  const byCity = new Map<string, number>();
  for (const h of aggregated) {
    const k = h.normalized_city ?? '??';
    byCity.set(k, (byCity.get(k) ?? 0) + 1);
  }
  console.log(`\nBy destination (normalized):`);
  for (const [c, n] of Array.from(byCity.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${c.padEnd(22)} ${n}`);
  }

  const inputTokens = valid.reduce((s, p) => s + p.usage.inputTokens, 0);
  const outputTokens = valid.reduce((s, p) => s + p.usage.outputTokens, 0);
  // gpt-4o-mini pricing: $0.15 / 1M input, $0.60 / 1M output.
  const cost = (inputTokens / 1e6) * 0.15 + (outputTokens / 1e6) * 0.6;
  console.log(
    `\nLLM usage: ${inputTokens} input + ${outputTokens} output tokens → ~$${cost.toFixed(4)}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
