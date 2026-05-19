/**
 * extract-yonder-intl.ts — pull international (non-France) hotel mentions
 * from yonder.fr editorial pages.
 *
 * Same shape as `extract-yonder.ts` but the LLM prompt is tuned for
 * international content : it must (a) NOT default to France, (b) emit a
 * `hint_country_code` ISO-2 alpha code, (c) recognise more luxury proxies
 * (LHW, R&C, Aman, Forbes 5★, Michelin Keys) since "Palace" is
 * France-only.
 *
 * Pipeline:
 *   1. Read yonder/raw-urls-intl.json (curated by tavily_map).
 *   2. tavilyExtract in batches of 10 → cache to yonder/raw-intl/<sanitized>.md
 *   3. llmExtract per page with IntlHotelMention schema
 *   4. Aggregate to yonder/hotels-intl.json
 *
 * Cost (gpt-4o-mini): ~200 pages × ~$0.002 ≈ $0.40 + Tavily ~200 credits.
 */

import { z } from 'zod';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tavilyExtract } from '../enrichment/tavily-client.js';
import { llmExtract } from '../enrichment/llm-extract.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../yonder');
const RAW_DIR = resolve(ROOT, 'raw-intl');
mkdirSync(RAW_DIR, { recursive: true });

const LUXURY_TIER_VALUES = [
  'palace_atout_france',
  'forbes_5_star',
  'michelin_3_keys',
  'lhw_member',
  'relais_chateaux',
  'small_luxury_hotels',
  'aman',
  'belmond',
  'rosewood',
  'four_seasons',
  'ritz_carlton_reserve',
  'mandarin_oriental',
  'park_hyatt',
  'st_regis',
  'fairmont',
  'world_50_best',
  'tl_worlds_best',
  'cn_gold_list',
  'self_5_star',
] as const;

/**
 * Skill rule #9 (llm-output-robustness) — accept loose values from the LLM at
 * the boundary, then post-validate against the allowlist. Otherwise GPT-4o-mini
 * invents tier strings that aren't in our enum (`ritz_carlton`, `kempinski`,
 * `hilton`, `design_hotels`, `como`, `six_senses`, `waldorf_astoria`, `hyatt`),
 * which destroys ~15% of pages.
 */
const HotelMention = z.object({
  name: z.string().min(2),
  hint_city: z.string().nullable(),
  hint_region: z.string().nullable(),
  hint_country: z.string().nullable(),
  hint_country_code: z
    .string()
    .transform((s) => s.toUpperCase().trim())
    .pipe(z.string().regex(/^[A-Z]{2}$/, { message: 'ISO 3166-1 alpha-2 uppercase' }))
    .nullable(),
  hint_stars: z.number().int().min(0).max(5).nullable(),
  is_palace: z.boolean().nullable(),
  luxury_tier: z.string().nullable(),
});

const LUXURY_TIER_SET = new Set<string>(LUXURY_TIER_VALUES);

/**
 * Tolerant brand-name normalisation. Maps common LLM-invented tiers to the
 * closest enum value. Anything else → null (we don't lose the hotel, just the
 * tier signal).
 */
function normaliseLuxuryTier(raw: string | null): (typeof LUXURY_TIER_VALUES)[number] | null {
  if (!raw) return null;
  const lc = raw.toLowerCase().trim();
  if (LUXURY_TIER_SET.has(lc)) return lc as (typeof LUXURY_TIER_VALUES)[number];

  const map: Record<string, (typeof LUXURY_TIER_VALUES)[number]> = {
    ritz_carlton: 'ritz_carlton_reserve',
    'ritz-carlton': 'ritz_carlton_reserve',
    hyatt: 'park_hyatt',
    waldorf_astoria: 'lhw_member',
    'waldorf-astoria': 'lhw_member',
    hilton: 'lhw_member',
    kempinski: 'lhw_member',
    como: 'lhw_member',
    six_senses: 'lhw_member',
    'six-senses': 'lhw_member',
    bulgari: 'lhw_member',
    edition: 'lhw_member',
    one_only: 'lhw_member',
    'one-only': 'lhw_member',
    oneandonly: 'lhw_member',
    anantara: 'lhw_member',
    raffles: 'lhw_member',
    peninsula: 'lhw_member',
    dorchester: 'lhw_member',
    design_hotels: 'self_5_star',
    'design-hotels': 'self_5_star',
    design: 'self_5_star',
    boutique: 'self_5_star',
    'luxury boutique': 'self_5_star',
    luxury: 'self_5_star',
  };

  return map[lc] ?? null;
}

const PageExtraction = z.object({
  hotels: z.array(HotelMention).max(60),
});

const SCHEMA_DESC = `{
  "hotels": [
    {
      "name": string,                  // full hotel name as printed (e.g. "Mandarin Oriental Hyde Park", "Aman Tokyo")
      "hint_city": string | null,
      "hint_region": string | null,
      "hint_country": string | null,   // FR country label, e.g. "Royaume-Uni", "Italie", "Japon"
      "hint_country_code": string | null, // ISO 3166-1 alpha-2 UPPERCASE: GB, IT, JP, US, MA, CH, etc. null if unsure
      "hint_stars": number | null,     // 0..5 ONLY if the page explicitly mentions the star rating
      "is_palace": boolean | null,     // ONLY true if the page explicitly uses "Palace" (Atout France label, France only). Foreign luxury hotels → use luxury_tier instead.
      "luxury_tier": string | null     // one of: palace_atout_france | forbes_5_star | michelin_3_keys | lhw_member | relais_chateaux | small_luxury_hotels | aman | belmond | rosewood | four_seasons | ritz_carlton_reserve | mandarin_oriental | park_hyatt | st_regis | fairmont | world_50_best | tl_worlds_best | cn_gold_list | self_5_star
    }
  ]
}

IMPORTANT:
- Default to international content. DO NOT assume France.
- If the URL contains a city like /barcelone/, /londres/, /new-york/, /tokyo/, /dubai/ — that's the hotel's city. Set hint_city accordingly.
- ISO country codes: Royaume-Uni=GB, Italie=IT, Espagne=ES, Allemagne=DE, Portugal=PT, Grece=GR, Suisse=CH, Autriche=AT, Hongrie=HU, Tcheque=CZ, Pays-Bas=NL, Belgique=BE, Etats-Unis=US, Canada=CA, Mexique=MX, Bresil=BR, Japon=JP, Chine=CN, Hong Kong=HK, Turquie=TR, Maroc=MA, Egypte=EG, Maurice=MU, Maldives=MV, Bali/Indonesie=ID, Thailande=TH, Vietnam=VN, Cambodge=KH, Inde=IN, Australie=AU, Nouvelle-Zelande=NZ, Sainte-Lucie=LC, Saint-Barthelemy=BL, Hongrie=HU.
- luxury_tier inference rules:
   * "Aman ..." in name → "aman"
   * "Belmond ..." in name → "belmond"
   * "Rosewood ..." in name → "rosewood"
   * "Four Seasons ..." in name → "four_seasons"
   * "Mandarin Oriental ..." in name → "mandarin_oriental"
   * "Park Hyatt ..." in name → "park_hyatt"
   * "St. Regis ..." or "St Regis" → "st_regis"
   * "Fairmont ..." → "fairmont"
   * Mentions "Relais & Châteaux" → "relais_chateaux"
   * Mentions "Leading Hotels of the World" or "LHW" → "lhw_member"
   * Mentions "Small Luxury Hotels" or "SLH" → "small_luxury_hotels"
   * Mentions "Forbes Five-Star" or "Forbes 5 étoiles" → "forbes_5_star"
   * Mentions "Michelin Keys" or "3 Clés Michelin" → "michelin_3_keys"
   * Mentions "World's 50 Best Hotels" → "world_50_best"
   * Mentions "Condé Nast Gold List" → "cn_gold_list"
   * Mentions "Travel + Leisure World's Best" → "tl_worlds_best"
   * If page says "5 étoiles" or "5-star" with no brand → "self_5_star"
   * Otherwise → null
- Trim trailing tags like " - Londres", " (5 étoiles)" — keep just the hotel proper name.
- Deduplicate within the same page.
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

/**
 * Shape after `normaliseLuxuryTier()` post-processing — luxury_tier
 * is guaranteed to be a member of the enum or null (skill rule
 * #12-quinquies: relax LLM enum at the boundary, narrow inside).
 */
type NormalisedHotelMention = Omit<z.infer<typeof HotelMention>, 'luxury_tier'> & {
  luxury_tier: (typeof LUXURY_TIER_VALUES)[number] | null;
};

async function parsePages(urls: readonly string[]): Promise<
  Array<{
    url: string;
    hotels: NormalisedHotelMention[];
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
      context: `Yonder.fr international hotel page — extract mentions. URL: ${url}`,
      schemaDescription: SCHEMA_DESC,
      schema: PageExtraction,
    });
    if (!res) {
      console.warn(`[parse] llm-extract returned null for ${url}`);
      continue;
    }
    const normalisedHotels: NormalisedHotelMention[] = res.data.hotels.map((h) => ({
      ...h,
      luxury_tier: normaliseLuxuryTier(h.luxury_tier),
    }));
    console.log(`  ${url} → ${normalisedHotels.length} hotels`);
    out.push({ url, hotels: normalisedHotels, usage: res.usage });
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
    readFileSync(resolve(ROOT, 'raw-urls-intl.json'), 'utf8'),
  );
  const urls = Array.from(new Set(rawUrls.urls));
  console.log(`[start] ${urls.length} unique URLs (international)`);

  await fetchRawForUrls(urls);

  const sliceArg = process.argv.find((a) => a.startsWith('--slice='))?.slice(8);
  const slice = sliceArg ? Number(sliceArg) : urls.length;
  const sliceUrls = urls.slice(0, slice);
  console.log(`[parse] LLM-parsing ${sliceUrls.length}/${urls.length} pages`);

  const pages = await parsePages(sliceUrls);

  type Aggregated = {
    key: string;
    name: string;
    sources: string[];
    hint_city: string | null;
    hint_region: string | null;
    hint_country: string | null;
    hint_country_code: string | null;
    hint_stars: number | null;
    is_palace: boolean | null;
    luxury_tier: (typeof LUXURY_TIER_VALUES)[number] | null;
  };
  const byKey = new Map<string, Aggregated>();
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
        existing.hint_country_code = existing.hint_country_code ?? h.hint_country_code;
        existing.hint_stars = existing.hint_stars ?? h.hint_stars;
        existing.is_palace = existing.is_palace ?? h.is_palace;
        existing.luxury_tier = existing.luxury_tier ?? h.luxury_tier;
      } else {
        byKey.set(key, {
          key,
          name: h.name,
          sources: [p.url],
          hint_city: h.hint_city,
          hint_region: h.hint_region,
          hint_country: h.hint_country,
          hint_country_code: h.hint_country_code,
          hint_stars: h.hint_stars,
          is_palace: h.is_palace,
          luxury_tier: h.luxury_tier,
        });
      }
    }
  }

  const aggregated = Array.from(byKey.values()).sort((a, b) => b.sources.length - a.sources.length);
  const outFile = resolve(ROOT, 'hotels-intl.json');
  writeFileSync(outFile, JSON.stringify(aggregated, null, 2));
  console.log(`\n[done] ${aggregated.length} unique international hotels → ${outFile}`);
  console.log(`Top 15 most-cited:`);
  for (const h of aggregated.slice(0, 15)) {
    console.log(
      `  ${h.sources.length.toString().padStart(2, ' ')}× ${h.name}${h.hint_country_code ? ` [${h.hint_country_code}]` : ''}`,
    );
  }

  writeFileSync(
    resolve(ROOT, 'pages-intl.json'),
    JSON.stringify(
      pages.map((p) => ({
        url: p.url,
        count: p.hotels.length,
        hotels: p.hotels.map((h) => ({
          name: h.name,
          cc: h.hint_country_code,
          tier: h.luxury_tier,
        })),
      })),
      null,
      2,
    ),
  );

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
