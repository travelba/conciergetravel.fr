/**
 * source-dining-venues.ts — Wave A upstream: SOURCE restaurant venues for the
 * ~2130 published fiches that have no `restaurant_info.venues` yet.
 *
 * Uses the existing Tavily-driven `extractDining` (Michelin + official site),
 * which already enforces strict anti-hallucination (an outlet needs a name AND
 * a source URL, and the LLM is told to drop anything not explicitly tied to the
 * target hotel). We map each `DiningOutlet` onto the stored `RestaurantVenue`
 * shape and write `restaurant_info` only when ≥ 1 outlet is found.
 *
 * The downstream `enrich-concierge-handoff.ts` then completes contact + tip.
 *
 * Invariants (ADR-0029): I2 EEAT (extractor drops unsourced outlets; we skip
 * fiches with zero outlets), I4 idempotence (skip fiches that already carry a
 * venues array), I5 no empty strings (omit absent fields).
 *
 * Usage:
 *   npx tsx src/enrichment/source-dining-venues.ts --slugs=a,b,c [--dry-run]
 *   npx tsx src/enrichment/source-dining-venues.ts --auto --limit=50 [--concurrency=4]
 */

import path from 'node:path';
import { appendFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';

import { selectHotels, patchHotelById, type SupabaseRestConfig } from '../photos/supabase-rest.js';
import { extractDining, type DiningOutlet } from './dining-extractor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadDotenv({ path: path.resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: path.resolve(__dirname, '../../../../.env') });

interface HotelRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly city: string | null;
  readonly official_url: string | null;
  readonly restaurant_info: unknown;
  readonly stars: number | null;
  readonly is_palace: boolean | null;
}

const HOTEL_COLS = 'id,slug,name,city,official_url,restaurant_info,stars,is_palace';

const AGGREGATOR_HOST_RE =
  /(?:petitpasseport|travelweekly|tripadvisor|booking\.|expedia|hotels\.com|agoda|airbnb|trivago|kayak|laterooms|hotelscombined|yelp|facebook\.|instagram\.|wikipedia\.)/iu;

function nonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** A populated venues array already present → nothing to source. */
function hasVenues(restaurantInfo: unknown): boolean {
  if (
    restaurantInfo === null ||
    typeof restaurantInfo !== 'object' ||
    Array.isArray(restaurantInfo)
  ) {
    return false;
  }
  const v = (restaurantInfo as Record<string, unknown>)['venues'];
  return Array.isArray(v) && v.length > 0;
}

function officialDomain(url: string | null): string | null {
  if (!nonEmptyString(url) || !url.startsWith('https') || AGGREGATOR_HOST_RE.test(url)) return null;
  try {
    return new URL(url).hostname.replace(/^www\./u, '');
  } catch {
    return null;
  }
}

const TYPE_LABELS: Record<DiningOutlet['type'], { fr: string; en: string } | null> = {
  restaurant: { fr: 'Restaurant', en: 'Restaurant' },
  bar: { fr: 'Bar', en: 'Bar' },
  brasserie: { fr: 'Brasserie', en: 'Brasserie' },
  tea_room: { fr: 'Salon de thé', en: 'Tea room' },
  lounge: { fr: 'Lounge', en: 'Lounge' },
  other: null,
};

type Venue = Record<string, unknown>;

/** Normalised key for venue dedupe: lowercased, accents + leading article stripped. */
function venueKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/^(?:the|le|la|les|l['’])\s*/u, '')
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();
}

function keyTokens(key: string): Set<string> {
  return new Set(key.split(' ').filter(Boolean));
}

/** True when every token of `a` is also in `b` (a is a name-subset of b). */
function isTokenSubset(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || a.size >= b.size) return false;
  for (const t of a) if (!b.has(t)) return false;
  return true;
}

/**
 * Collapse near-duplicate items the extractor's name-merge missed. Two passes:
 *  1. exact normalised key ("Chelsea Bar" == "The Chelsea Bar");
 *  2. token-subset ("Stumptown coffee" ⊂ "Stumptown Coffee Roasters",
 *     "Mr. Maurice" ⊂ "Mr. Maurice's Italian").
 * The richest entry (most grounded facts) survives each merge; ties keep the
 * longer, more specific name.
 */
function collapseDuplicates<T>(
  items: readonly T[],
  getName: (i: T) => string,
  richness: (i: T) => number,
): T[] {
  const byKey = new Map<string, T>();
  for (const it of items) {
    const key = venueKey(getName(it));
    if (key.length === 0) continue;
    const cur = byKey.get(key);
    if (cur === undefined || richness(it) > richness(cur)) byKey.set(key, it);
  }
  const entries = [...byKey.entries()].map(([key, value]) => ({
    key,
    tokens: keyTokens(key),
    value,
  }));
  const dropped = new Set<number>();
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = 0; j < entries.length; j += 1) {
      if (i === j || dropped.has(i) || dropped.has(j)) continue;
      const a = entries[i]!;
      const b = entries[j]!;
      if (!isTokenSubset(a.tokens, b.tokens)) continue;
      // a ⊂ b: keep whichever is richer; on a tie keep b (longer name).
      if (richness(a.value) > richness(b.value)) dropped.add(j);
      else dropped.add(i);
    }
  }
  return entries.filter((_, idx) => !dropped.has(idx)).map((e) => e.value);
}

function outletRichness(o: DiningOutlet): number {
  return (
    (o.chef ? 1 : 0) +
    (o.cuisine ? 1 : 0) +
    (o.signature ? 1 : 0) +
    (typeof o.michelinStars === 'number' ? 1 : 0)
  );
}

function dedupeOutlets(outlets: readonly DiningOutlet[]): DiningOutlet[] {
  return collapseDuplicates(outlets, (o) => o.name, outletRichness);
}

/** Richness of an already-stored venue object (for the DB cleanup pass). */
function venueRichness(v: Venue): number {
  const features = v['features'];
  return (
    (nonEmptyString(v['chef']) ? 1 : 0) +
    (typeof v['michelin_stars'] === 'number' ? 1 : 0) +
    (Array.isArray(features) ? features.length : 0)
  );
}

function mapOutletToVenue(o: DiningOutlet): Venue {
  const v: Venue = { name: o.name };
  const label = TYPE_LABELS[o.type];
  if (label !== null) {
    v['type_fr'] = label.fr;
    v['type_en'] = label.en;
  }
  if (typeof o.michelinStars === 'number') v['michelin_stars'] = o.michelinStars;
  if (nonEmptyString(o.chef)) v['chef'] = o.chef;
  // Store cuisine + signature as `features` (the schema has no dedicated field)
  // so the downstream handoff tip generator has substantive facts to ground on.
  const features = [o.cuisine, o.signature].filter(nonEmptyString);
  if (features.length > 0) v['features'] = features;
  return v;
}

interface FicheResult {
  readonly slug: string;
  readonly status: 'written' | 'skipped_has_venues' | 'skipped_no_outlets' | 'error';
  readonly venueCount: number;
  readonly searchCount: number;
  readonly extractCount: number;
}

async function processFiche(
  cfg: SupabaseRestConfig,
  hotel: HotelRow,
  dryRun: boolean,
): Promise<FicheResult> {
  if (hasVenues(hotel.restaurant_info)) {
    return {
      slug: hotel.slug,
      status: 'skipped_has_venues',
      venueCount: 0,
      searchCount: 0,
      extractCount: 0,
    };
  }

  const result = await extractDining({
    hotelName: hotel.name,
    city: hotel.city ?? '',
    officialDomain: officialDomain(hotel.official_url),
  });

  if (result.outlets.length === 0) {
    return {
      slug: hotel.slug,
      status: 'skipped_no_outlets',
      venueCount: 0,
      searchCount: result.searchCount,
      extractCount: result.extractCount,
    };
  }

  const outlets = dedupeOutlets(result.outlets);
  const venues = outlets.map(mapOutletToVenue);
  const starTotal = outlets.reduce(
    (acc, o) => acc + (typeof o.michelinStars === 'number' ? o.michelinStars : 0),
    0,
  );
  const info: Record<string, unknown> = { count: venues.length, venues };
  if (starTotal > 0) info['michelin_stars'] = starTotal;

  // Preserve any non-venue keys already on restaurant_info (e.g. a summary).
  const existing =
    hotel.restaurant_info !== null &&
    typeof hotel.restaurant_info === 'object' &&
    !Array.isArray(hotel.restaurant_info)
      ? (hotel.restaurant_info as Record<string, unknown>)
      : {};
  const nextInfo = { ...existing, ...info };

  if (!dryRun) {
    await patchHotelById(cfg, hotel.id, { restaurant_info: nextInfo });
  }

  return {
    slug: hotel.slug,
    status: 'written',
    venueCount: venues.length,
    searchCount: result.searchCount,
    extractCount: result.extractCount,
  };
}

function loadRestConfig(): SupabaseRestConfig {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (typeof url !== 'string' || url.length === 0)
    throw new Error('NEXT_PUBLIC_SUPABASE_URL missing');
  if (typeof key !== 'string' || key.length < 40)
    throw new Error('SUPABASE_SERVICE_ROLE_KEY missing');
  return { url, serviceRoleKey: key };
}

async function fetchExplicit(
  cfg: SupabaseRestConfig,
  slugs: readonly string[],
): Promise<HotelRow[]> {
  return selectHotels<HotelRow>(cfg, {
    columns: HOTEL_COLS,
    filters: [`slug=in.(${slugs.join(',')})`],
  });
}

async function fetchAuto(
  cfg: SupabaseRestConfig,
  limit: number,
  palace5: boolean,
): Promise<HotelRow[]> {
  const filters = ['is_published=eq.true'];
  // Palace OR 5-star — high dining-venue yield, where golden parity matters most.
  if (palace5) filters.push('or=(is_palace.eq.true,stars.eq.5)');
  const pool = await selectHotels<HotelRow>(cfg, {
    columns: HOTEL_COLS,
    filters,
    // High-value fiches first when targeting the luxury segment.
    order: palace5 ? 'priority.desc.nullslast,slug.asc' : 'slug.asc',
    limit: 5000,
  });
  return pool.filter((h) => !hasVenues(h.restaurant_info)).slice(0, limit);
}

interface Args {
  readonly slugs: readonly string[];
  readonly auto: boolean;
  readonly limit: number;
  readonly concurrency: number;
  readonly dryRun: boolean;
  readonly palace5: boolean;
  readonly rededupe: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let slugs: string[] = [];
  let auto = false;
  let limit = 10;
  let concurrency = 3;
  let dryRun = false;
  let palace5 = false;
  let rededupe = false;
  for (const a of argv) {
    if (a === '--auto') auto = true;
    else if (a === '--palace5') palace5 = true;
    else if (a === '--rededupe') rededupe = true;
    else if (a === '--dry-run') dryRun = true;
    else if (a.startsWith('--slugs='))
      slugs = a
        .slice('--slugs='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    else if (a.startsWith('--limit=')) {
      const n = Number(a.slice('--limit='.length));
      if (Number.isFinite(n) && n > 0) limit = Math.floor(n);
    } else if (a.startsWith('--concurrency=')) {
      const n = Number(a.slice('--concurrency='.length));
      if (Number.isFinite(n) && n > 0) concurrency = Math.floor(n);
    }
  }
  return { slugs, auto, limit, concurrency, dryRun, palace5, rededupe };
}

async function runWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) break;
      results[i] = await fn(items[i] as T, i);
    }
  });
  await Promise.all(workers);
  return results;
}

/** DB-only pass: re-collapse near-duplicate venues already stored, no Tavily. */
async function rededupeExisting(
  cfg: SupabaseRestConfig,
  limit: number,
  dryRun: boolean,
): Promise<void> {
  const pool = await selectHotels<HotelRow>(cfg, {
    columns: HOTEL_COLS,
    filters: ['is_published=eq.true'],
    order: 'slug.asc',
    limit: 5000,
  });
  const withVenues = pool.filter((h) => hasVenues(h.restaurant_info)).slice(0, limit);
  console.log(
    `\n[rededupe] ${withVenues.length} fiche(s) with venues — ${dryRun ? 'DRY-RUN' : 'WRITE'}\n`,
  );

  let changed = 0;
  let removed = 0;
  for (const h of withVenues) {
    const info = h.restaurant_info as Record<string, unknown>;
    const venues = info['venues'];
    if (!Array.isArray(venues)) continue;
    const typed = venues.filter(
      (v): v is Venue => v !== null && typeof v === 'object' && !Array.isArray(v),
    );
    const deduped = collapseDuplicates(
      typed,
      (v) => (nonEmptyString(v['name']) ? v['name'] : ''),
      venueRichness,
    );
    if (deduped.length === typed.length) continue;
    changed += 1;
    removed += typed.length - deduped.length;
    const nextInfo: Record<string, unknown> = { ...info, venues: deduped, count: deduped.length };
    const starTotal = deduped.reduce(
      (acc, v) =>
        acc + (typeof v['michelin_stars'] === 'number' ? (v['michelin_stars'] as number) : 0),
      0,
    );
    if (starTotal > 0) nextInfo['michelin_stars'] = starTotal;
    console.log(`[rededupe] ${h.slug}: ${typed.length} → ${deduped.length} venues`);
    if (!dryRun) await patchHotelById(cfg, h.id, { restaurant_info: nextInfo });
  }
  console.log(`\nDone — fiches changed=${changed}, duplicate venues removed=${removed}.`);
}

async function main(): Promise<void> {
  const args = parseArgs();
  if (args.rededupe) {
    await rededupeExisting(loadRestConfig(), args.limit, args.dryRun);
    return;
  }
  if (args.slugs.length === 0 && !args.auto) {
    console.error(
      'Usage: tsx source-dining-venues.ts --slugs=a,b,c | --auto --limit=N [--dry-run]',
    );
    process.exit(1);
  }
  const cfg = loadRestConfig();
  const fiches = args.auto
    ? await fetchAuto(cfg, args.limit, args.palace5)
    : await fetchExplicit(cfg, args.slugs);
  console.log(
    `\n[source-dining] ${fiches.length} fiche(s)${args.palace5 ? ' [palace+5★]' : ''} — ${args.dryRun ? 'DRY-RUN' : 'WRITE'} — concurrency=${args.concurrency}\n`,
  );

  const outDir = path.resolve(process.cwd(), 'out');
  await mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const runlog = path.resolve(outDir, `source-dining-runlog-${stamp}.jsonl`);

  let written = 0;
  let venuesTotal = 0;
  let searches = 0;
  let extracts = 0;

  const results = await runWithConcurrency(fiches, args.concurrency, async (hotel, idx) => {
    const tag = `[${idx + 1}/${fiches.length} ${hotel.slug}]`;
    try {
      const r = await processFiche(cfg, hotel, args.dryRun);
      console.log(
        `${tag} ${r.status === 'written' ? '✓' : '·'} ${r.status} venues=${r.venueCount} (tavily s${r.searchCount}/x${r.extractCount})`,
      );
      await appendFile(runlog, JSON.stringify(r) + '\n', 'utf8');
      return r;
    } catch (err) {
      console.error(`${tag} ✗ ${err instanceof Error ? err.message : String(err)}`);
      return {
        slug: hotel.slug,
        status: 'error',
        venueCount: 0,
        searchCount: 0,
        extractCount: 0,
      } satisfies FicheResult;
    }
  });

  for (const r of results) {
    if (r.status === 'written') written += 1;
    venuesTotal += r.venueCount;
    searches += r.searchCount;
    extracts += r.extractCount;
  }

  console.log(
    `\nDone — fiches written=${written}/${fiches.length}, venues=${venuesTotal}, tavily searches=${searches} extracts=${extracts}. Runlog → ${runlog}`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
