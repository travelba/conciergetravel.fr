/**
 * extract-relais-chateaux.ts — extract metadata for every Relais & Châteaux
 * hotel member, one /fr/hotel/<slug>/ page at a time.
 *
 * Why individual hotel pages (vs destination listings)?
 *   - The destination listing pages lazy-load only ~10 cards before requiring
 *     a "Load more" click → Tavily basic/advanced extract both miss ~50% of
 *     members. The sitemap exposes the full ~476 hotel URLs.
 *   - Individual hotel pages render the full info (city, country via
 *     breadcrumb, michelin stars, number of rooms, restaurants, pool/spa,
 *     pet-friendly, parking) — far richer than the destination card.
 *
 * Pipeline:
 *   1. Read global-sources/rc-hotel-urls.json (output of parse-rc-sitemap.ts).
 *   2. Tavily extract `advanced` for each URL → cache global-sources/raw-rc-hotels/<sanitized>.md
 *      IMPORTANT: R&C uses Next.js client-side rendering. Tavily `basic` mode
 *      returns "Failed to fetch url" on ~90% of pages because it doesn't
 *      execute JS. `advanced` mode renders properly. Skill rule #12-quater
 *      (llm-output-robustness) — SPA JS-only pages REQUIRE advanced extract.
 *   3. LLM extract per page → strict typed metadata (name, city, country_fr,
 *      country_code, michelin_stars, number_of_rooms, has_pool, has_spa,
 *      pet_friendly, official_url, address).
 *   4. Aggregate → global-sources/rc-hotels.json.
 *
 * Usage:
 *   pnpm rc:sitemap            # first: parse sitemap (one-shot)
 *   pnpm rc:extract:smoke      # smoke-test on first 5 hotels
 *   pnpm rc:extract            # full run (~476 hotels, ~45-60 min, ~$5)
 *
 * Cost estimate (gpt-4o-mini + Tavily advanced):
 *   - Tavily extract: 476 × 2 credits × $0.005/cred ≈ $4.80
 *   - LLM: ~3 K input + ~300 output tokens/page × 476 ≈ $0.30
 *   - Total ≈ $5.10 for the full run.
 */

import { z } from 'zod';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tavilyExtract } from '../enrichment/tavily-client.js';
import { llmExtract } from '../enrichment/llm-extract.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../global-sources');
const RAW_DIR = resolve(ROOT, 'raw-rc-hotels');
mkdirSync(RAW_DIR, { recursive: true });

// ─── Country mapping (FR label as printed in R&C breadcrumb → ISO alpha-2) ────

interface CountryMeta {
  readonly code: string;
  readonly fr: string;
  readonly en: string;
}

const COUNTRY_BY_FR_LABEL: Readonly<Record<string, CountryMeta>> = {
  France: { code: 'FR', fr: 'France', en: 'France' },
  Italie: { code: 'IT', fr: 'Italie', en: 'Italy' },
  Espagne: { code: 'ES', fr: 'Espagne', en: 'Spain' },
  Portugal: { code: 'PT', fr: 'Portugal', en: 'Portugal' },
  Allemagne: { code: 'DE', fr: 'Allemagne', en: 'Germany' },
  Autriche: { code: 'AT', fr: 'Autriche', en: 'Austria' },
  Suisse: { code: 'CH', fr: 'Suisse', en: 'Switzerland' },
  Belgique: { code: 'BE', fr: 'Belgique', en: 'Belgium' },
  'Pays-Bas': { code: 'NL', fr: 'Pays-Bas', en: 'Netherlands' },
  Irlande: { code: 'IE', fr: 'Irlande', en: 'Ireland' },
  'Royaume-Uni': { code: 'GB', fr: 'Royaume-Uni', en: 'United Kingdom' },
  Grèce: { code: 'GR', fr: 'Grèce', en: 'Greece' },
  Turquie: { code: 'TR', fr: 'Turquie', en: 'Turkey' },
  Croatie: { code: 'HR', fr: 'Croatie', en: 'Croatia' },
  Slovénie: { code: 'SI', fr: 'Slovénie', en: 'Slovenia' },
  Pologne: { code: 'PL', fr: 'Pologne', en: 'Poland' },
  Roumanie: { code: 'RO', fr: 'Roumanie', en: 'Romania' },
  Bulgarie: { code: 'BG', fr: 'Bulgarie', en: 'Bulgaria' },
  Malte: { code: 'MT', fr: 'Malte', en: 'Malta' },
  Liechtenstein: { code: 'LI', fr: 'Liechtenstein', en: 'Liechtenstein' },
  Luxembourg: { code: 'LU', fr: 'Luxembourg', en: 'Luxembourg' },
  Lituanie: { code: 'LT', fr: 'Lituanie', en: 'Lithuania' },
  // R&C groups all Scandinavia under one page but the breadcrumb does say
  // each country individually on the hotel page itself.
  Suède: { code: 'SE', fr: 'Suède', en: 'Sweden' },
  Norvège: { code: 'NO', fr: 'Norvège', en: 'Norway' },
  Danemark: { code: 'DK', fr: 'Danemark', en: 'Denmark' },
  Finlande: { code: 'FI', fr: 'Finlande', en: 'Finland' },
  Islande: { code: 'IS', fr: 'Islande', en: 'Iceland' },
  // North America
  'États-Unis': { code: 'US', fr: 'États-Unis', en: 'United States' },
  Canada: { code: 'CA', fr: 'Canada', en: 'Canada' },
  Mexique: { code: 'MX', fr: 'Mexique', en: 'Mexico' },
  // Central / South America
  Belize: { code: 'BZ', fr: 'Belize', en: 'Belize' },
  'Costa Rica': { code: 'CR', fr: 'Costa Rica', en: 'Costa Rica' },
  Guatemala: { code: 'GT', fr: 'Guatemala', en: 'Guatemala' },
  Argentine: { code: 'AR', fr: 'Argentine', en: 'Argentina' },
  Brésil: { code: 'BR', fr: 'Brésil', en: 'Brazil' },
  Chili: { code: 'CL', fr: 'Chili', en: 'Chile' },
  Colombie: { code: 'CO', fr: 'Colombie', en: 'Colombia' },
  Équateur: { code: 'EC', fr: 'Équateur', en: 'Ecuador' },
  Pérou: { code: 'PE', fr: 'Pérou', en: 'Peru' },
  Uruguay: { code: 'UY', fr: 'Uruguay', en: 'Uruguay' },
  // Caribbean
  Anguilla: { code: 'AI', fr: 'Anguilla', en: 'Anguilla' },
  'Antigua-et-Barbuda': { code: 'AG', fr: 'Antigua-et-Barbuda', en: 'Antigua and Barbuda' },
  Bahamas: { code: 'BS', fr: 'Bahamas', en: 'Bahamas' },
  Dominique: { code: 'DM', fr: 'Dominique', en: 'Dominica' },
  Grenade: { code: 'GD', fr: 'Grenade', en: 'Grenada' },
  'République dominicaine': { code: 'DO', fr: 'République dominicaine', en: 'Dominican Republic' },
  'Saint-Barthélemy': { code: 'BL', fr: 'Saint-Barthélemy', en: 'Saint Barthélemy' },
  Guadeloupe: { code: 'GP', fr: 'Guadeloupe', en: 'Guadeloupe' },
  'Saint-Martin': { code: 'MF', fr: 'Saint-Martin', en: 'Saint Martin' },
  'Sainte-Lucie': { code: 'LC', fr: 'Sainte-Lucie', en: 'Saint Lucia' },
  'Îles Turques-et-Caïques': { code: 'TC', fr: 'Îles Turques-et-Caïques', en: 'Turks and Caicos' },
  // Asia
  Chine: { code: 'CN', fr: 'Chine', en: 'China' },
  Inde: { code: 'IN', fr: 'Inde', en: 'India' },
  Japon: { code: 'JP', fr: 'Japon', en: 'Japan' },
  'Sri Lanka': { code: 'LK', fr: 'Sri Lanka', en: 'Sri Lanka' },
  Thaïlande: { code: 'TH', fr: 'Thaïlande', en: 'Thailand' },
  // Africa & Middle East
  'Afrique du Sud': { code: 'ZA', fr: 'Afrique du Sud', en: 'South Africa' },
  Botswana: { code: 'BW', fr: 'Botswana', en: 'Botswana' },
  'Cap-Vert': { code: 'CV', fr: 'Cap-Vert', en: 'Cape Verde' },
  Maurice: { code: 'MU', fr: 'Maurice', en: 'Mauritius' },
  Kenya: { code: 'KE', fr: 'Kenya', en: 'Kenya' },
  Madagascar: { code: 'MG', fr: 'Madagascar', en: 'Madagascar' },
  Maroc: { code: 'MA', fr: 'Maroc', en: 'Morocco' },
  Namibie: { code: 'NA', fr: 'Namibie', en: 'Namibia' },
  'La Réunion': { code: 'RE', fr: 'La Réunion', en: 'Réunion' },
  Réunion: { code: 'RE', fr: 'La Réunion', en: 'Réunion' },
  Tanzanie: { code: 'TZ', fr: 'Tanzanie', en: 'Tanzania' },
  Zambie: { code: 'ZM', fr: 'Zambie', en: 'Zambia' },
  Zimbabwe: { code: 'ZW', fr: 'Zimbabwe', en: 'Zimbabwe' },
  Égypte: { code: 'EG', fr: 'Égypte', en: 'Egypt' },
  Israël: { code: 'IL', fr: 'Israël', en: 'Israel' },
  Liban: { code: 'LB', fr: 'Liban', en: 'Lebanon' },
  // Oceania
  Australie: { code: 'AU', fr: 'Australie', en: 'Australia' },
  'Nouvelle-Zélande': { code: 'NZ', fr: 'Nouvelle-Zélande', en: 'New Zealand' },
  'Polynésie française': { code: 'PF', fr: 'Polynésie française', en: 'French Polynesia' },
};

function resolveCountry(label: string | null): CountryMeta | null {
  if (!label) return null;
  return COUNTRY_BY_FR_LABEL[label.trim()] ?? null;
}

// ─── LLM extraction schema ────────────────────────────────────────────────────

const HotelMetadata = z.object({
  /** Hotel name as printed in the page H1 (e.g. "Baumanière Hôtel & Spa"). */
  name: z.string().min(2),
  /** City as printed in the under-H1 location line (e.g. "Les Baux-de-Provence"). */
  city: z.string().min(1).nullable(),
  /** Country FR label exactly as printed in the breadcrumb ("France", "Italie", "Royaume-Uni"). */
  country_fr_label: z.string().min(2).nullable(),
  /** Michelin stars in the bullet "X étoiles Michelin YYYY", 0..3. null if not mentioned. */
  michelin_stars: z.number().int().min(0).max(3).nullable(),
  /** True if "étoile verte" / "green star" is mentioned. */
  michelin_green_star: z.boolean().nullable(),
  /** Number of rooms from "Nos N chambres", 1..999. null if not mentioned. */
  number_of_rooms: z.number().int().min(1).max(999).nullable(),
  /** Number of meeting rooms from "M Salle(s) de réunion". null if no event capacity. */
  number_of_meeting_rooms: z.number().int().min(0).max(50).nullable(),
  /** Max event guest capacity from "Capacité d'accueil : N". null if absent. */
  mice_max_capacity: z.number().int().min(0).max(5000).nullable(),
  /** Pet-friendly mention. */
  pet_friendly: z.boolean().nullable(),
  /** Pool / wellness mention. */
  has_pool: z.boolean().nullable(),
  has_spa: z.boolean().nullable(),
  /** Trim short marketing tagline (first bullets line, after Michelin/green star). */
  short_tagline_fr: z.string().max(500).nullable(),
});
type HotelMetadataT = z.infer<typeof HotelMetadata>;

const SCHEMA_DESC = `{
  "name": string,                       // hotel proper name from H1 / breadcrumb tail (e.g. "Baumanière Hôtel & Spa")
  "city": string | null,                // city as printed under H1 ("Les Baux-de-Provence"). The line that looks like "<city>,<country>" — keep only the city part.
  "country_fr_label": string | null,    // country label EXACTLY as printed in the breadcrumb (e.g. "France", "Italie", "Royaume-Uni", "États-Unis", "Polynésie française"). NOT the city. NOT the region.
  "michelin_stars": number | null,      // integer 0..3. From a bullet like "3 étoiles Michelin 2026" or "1 étoile Michelin 2026". null if the page does not mention any Michelin star.
  "michelin_green_star": boolean | null, // true if "étoile verte 2026" or "green star" is mentioned anywhere in the bullets.
  "number_of_rooms": number | null,     // from "## Nos N chambres et suites" — integer 1..999. null if no rooms count is shown.
  "number_of_meeting_rooms": number | null, // from "N Salle(s) de réunion" in the events block. 0..50. null if not mentioned.
  "mice_max_capacity": number | null,   // from "Capacité d'accueil : N" in the events block. 0..5000. null if not mentioned.
  "pet_friendly": boolean | null,       // true if the page says the property accepts animals (typical phrase: "Pet friendly", "Animaux acceptés").
  "has_pool": boolean | null,           // true if "Piscine" is mentioned in the equipment list.
  "has_spa": boolean | null,            // true if "Spa" or "Hammam" is mentioned in the equipment list.
  "short_tagline_fr": string | null     // concatenated first 1-2 bullets that describe the property style (e.g. "maison familiale depuis 4 générations aux pied des Baux séjour au calme la Provence par excellence"). 500 chars max.
}

EXTRACTION RULES:
- The H1 of the page is the canonical hotel name. The page title looks like "<name> | Hôtel de luxe <city> | Relais & Châteaux" — use the bit before the first "|".
- The location line under H1 looks like "<City>,<Country>" or "<City>, <Country>" — split on the comma. The country_fr_label MUST be the FR label of the country (e.g. "France", "Royaume-Uni", "États-Unis", "Polynésie française", "Maurice"), not the city.
- Strict numeric extraction: only quote numbers that are literally present in the source. Do not infer "Nos chambres" without a count as a number_of_rooms — return null in that case.
- short_tagline_fr is a denormalised concat of the bullets just below the price+rating block. Keep punctuation intact, ≤ 500 chars.
- If a field is absent or ambiguous → return null. Do not invent.
- If the page is a 404 or a login wall (very little content) → return all-null. The caller will skip.
`;

// ─── Filesystem helpers ───────────────────────────────────────────────────────

function sanitize(url: string): string {
  return url
    .replace(/^https?:\/\/(www\.)?relaischateaux\.com\//, '')
    .replace(/\/+$/, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_');
}

function slugFromUrl(url: string): string {
  const m = url.match(/\/fr\/hotel\/([^/?#]+)/);
  return m?.[1] ?? '';
}

async function fetchRawForUrls(urls: readonly string[]): Promise<void> {
  // R&C URLs in the sitemap have trailing slash already, but Tavily seems to
  // 500 unless we include it. Force trailing slash.
  const withSlash = urls.map((u) => (u.endsWith('/') ? u : `${u}/`));
  const missing = withSlash.filter((u) => !existsSync(resolve(RAW_DIR, `${sanitize(u)}.md`)));
  if (missing.length === 0) {
    console.log(`[fetch] all ${urls.length} URLs already cached in ${RAW_DIR}`);
    return;
  }
  console.log(`[fetch] need to download ${missing.length}/${urls.length} hotel pages from Tavily`);

  // Tavily accepts up to 20 URLs per call. Use batches of 10 to stay friendly
  // with their rate limits (skill rule: avoid hammering paid APIs in tight loops).
  // `advanced` mode is REQUIRED for R&C — see skill rule #12-quater.
  for (let i = 0; i < missing.length; i += 10) {
    const batch = missing.slice(i, i + 10);
    const batchNum = Math.floor(i / 10) + 1;
    const totalBatches = Math.ceil(missing.length / 10);
    console.log(`  batch ${batchNum}/${totalBatches}: ${batch.length} URLs`);
    try {
      const res = await tavilyExtract({
        urls: batch,
        extractDepth: 'advanced',
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
  readonly url_slug: string;
  readonly metadata: HotelMetadataT;
  readonly country: CountryMeta | null;
  readonly usage: { readonly inputTokens: number; readonly outputTokens: number };
}

async function parsePage(url: string): Promise<ExtractedHotel | null> {
  const file = resolve(RAW_DIR, `${sanitize(`${url.replace(/\/+$/, '')}/`)}.md`);
  if (!existsSync(file)) {
    console.warn(`[parse] missing raw file for ${url}`);
    return null;
  }
  const content = readFileSync(file, 'utf8');
  if (content.trim().length < 500) {
    console.warn(`[parse] content too short for ${url} (${content.length} chars)`);
    return null;
  }
  // Skill rule #12-ter (llm-output-robustness): anchor-trim. The hotel page
  // includes a giant footer with the country picker, ~3 KB of nav noise, etc.
  // We slice the first 12 KB which captures H1 + city + breadcrumb + bullets +
  // rooms + restaurants block (everything we need).
  const trimmed = content.slice(0, 12000);
  const res = await llmExtract({
    content: trimmed,
    context: `Relais & Châteaux individual hotel page. URL: ${url}`,
    schemaDescription: SCHEMA_DESC,
    schema: HotelMetadata,
  });
  if (!res) {
    console.warn(`[parse] llm-extract returned null for ${url}`);
    return null;
  }
  const country = resolveCountry(res.data.country_fr_label);
  return {
    url,
    url_slug: slugFromUrl(url),
    metadata: res.data,
    country,
    usage: res.usage,
  };
}

// ─── Concurrency helper (small p-limit clone, no extra dep) ───────────────────

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
  url_slug: string;
  rc_url: string;
  name: string;
  city: string | null;
  country_code: string | null;
  country_fr: string | null;
  country_en: string | null;
  michelin_stars: number | null;
  michelin_green_star: boolean | null;
  number_of_rooms: number | null;
  number_of_meeting_rooms: number | null;
  mice_max_capacity: number | null;
  pet_friendly: boolean | null;
  has_pool: boolean | null;
  has_spa: boolean | null;
  short_tagline_fr: string | null;
}

function aggregate(parsed: readonly ExtractedHotel[]): AggregatedHotel[] {
  return parsed.map((p) => ({
    url_slug: p.url_slug,
    rc_url: p.url,
    name: p.metadata.name,
    city: p.metadata.city,
    country_code: p.country?.code ?? null,
    country_fr: p.country?.fr ?? null,
    country_en: p.country?.en ?? null,
    michelin_stars: p.metadata.michelin_stars,
    michelin_green_star: p.metadata.michelin_green_star,
    number_of_rooms: p.metadata.number_of_rooms,
    number_of_meeting_rooms: p.metadata.number_of_meeting_rooms,
    mice_max_capacity: p.metadata.mice_max_capacity,
    pet_friendly: p.metadata.pet_friendly,
    has_pool: p.metadata.has_pool,
    has_spa: p.metadata.has_spa,
    short_tagline_fr: p.metadata.short_tagline_fr,
  }));
}

// ─── Main ────────────────────────────────────────────────────────────────────

interface HotelUrlsFile {
  readonly urls: readonly string[];
}

async function main(): Promise<void> {
  const file = resolve(ROOT, 'rc-hotel-urls.json');
  const parsed: HotelUrlsFile = JSON.parse(readFileSync(file, 'utf8'));
  const urls = Array.from(new Set(parsed.urls));
  console.log(`[start] ${urls.length} hotel URLs from sitemap`);

  // CLI flags
  const limitArg = process.argv.find((a) => a.startsWith('--limit='))?.slice(8);
  const limit = limitArg ? Number(limitArg) : urls.length;
  const concurrencyArg = process.argv.find((a) => a.startsWith('--concurrency='))?.slice(14);
  const concurrency = concurrencyArg ? Number(concurrencyArg) : 4;
  const sliceUrls = urls.slice(0, limit);
  console.log(`[plan] processing ${sliceUrls.length} hotels with concurrency=${concurrency}`);

  await fetchRawForUrls(sliceUrls);

  // LLM-parse with concurrency (LLM calls are I/O-bound, ~2-3 s each).
  const parsedPages: Array<ExtractedHotel | null> = await withConcurrency(
    sliceUrls,
    concurrency,
    async (url) => parsePage(url),
  );
  const valid = parsedPages.filter((p): p is ExtractedHotel => p !== null);
  console.log(`\n[parse] ${valid.length}/${sliceUrls.length} pages parsed successfully`);

  const aggregated = aggregate(valid);
  const withCountry = aggregated.filter((h) => h.country_code !== null);
  const withoutCountry = aggregated.filter((h) => h.country_code === null);

  writeFileSync(resolve(ROOT, 'rc-hotels.json'), JSON.stringify(aggregated, null, 2));
  if (withoutCountry.length > 0) {
    writeFileSync(
      resolve(ROOT, 'rc-hotels-uncountry.json'),
      JSON.stringify(withoutCountry, null, 2),
    );
  }

  console.log(`\n[done] aggregated ${aggregated.length} hotels:`);
  console.log(`       with country  : ${withCountry.length}`);
  console.log(`       without country : ${withoutCountry.length}`);

  const byCountry = new Map<string, number>();
  for (const h of withCountry) {
    const k = h.country_code as string;
    byCountry.set(k, (byCountry.get(k) ?? 0) + 1);
  }
  const top = Array.from(byCountry.entries()).sort((a, b) => b[1] - a[1]);
  console.log(`\nTop 20 countries (hotels):`);
  for (const [cc, n] of top.slice(0, 20)) {
    console.log(`  ${cc.padEnd(3)} ${n}`);
  }

  const inputTokens = valid.reduce((s, p) => s + p.usage.inputTokens, 0);
  const outputTokens = valid.reduce((s, p) => s + p.usage.outputTokens, 0);
  // gpt-4o-mini pricing as of 2026-05: $0.15 / 1M input, $0.60 / 1M output.
  const cost = (inputTokens / 1e6) * 0.15 + (outputTokens / 1e6) * 0.6;
  console.log(
    `\nLLM usage: ${inputTokens} input + ${outputTokens} output tokens → ~$${cost.toFixed(4)}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
