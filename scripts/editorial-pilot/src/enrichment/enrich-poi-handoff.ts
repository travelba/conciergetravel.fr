/**
 * enrich-poi-handoff.ts — Wave B (golden template, dimension `golden`).
 *
 * Lifts `points_of_interest[]` to the concierge-handoff contract the audit
 * measures (`@mch/domain/editorial` → evaluatePoiHandoff):
 *
 *     POI complete = name + bucket + distance + description + tip
 *
 * Most catalogue fiches already carry POIs with name/bucket/distance/coords
 * (sourced via `sync-hotel-pois.ts`) but NO `description_fr` and NO `tip_fr`,
 * so they never reach `complete`. This writer enriches those two missing
 * fields IN PLACE — it never re-sources, never re-classifies, never touches
 * coords/distance. (The legacy `run-humanizer-pois.ts` talks raw Postgres,
 * which the Windows dev env cannot reach, and emits `bucket_tip_fr` — a field
 * the golden predicate does not read.)
 *
 * Strategy (cheap, EEAT-safe — no Tavily):
 *   - DESCRIPTION: reuse `describePoisBatch` (gpt-4o-mini, anti-hallucination
 *     prompt, no invented facts). Generated only for POIs missing one.
 *   - TIP: a concierge one-liner grounded ONLY on the POI's own facts
 *     (name, type, category, city, distance, freshly-written description).
 *     Generated for `visit`/`do` POIs (a "shop" pharmacy needs no nudge).
 *
 * Invariants (ADR-0029): I1 anti-leak, I2 EEAT (no invention), I4 per-field
 * idempotence (only fill missing fields), I5 never persist empty strings.
 *
 * Usage:
 *   npx tsx src/enrichment/enrich-poi-handoff.ts --slugs=a,b,c [--dry-run] [--show]
 *   npx tsx src/enrichment/enrich-poi-handoff.ts --auto --limit=50 [--concurrency=4]
 */

import path from 'node:path';
import { appendFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';

import { buildLlmClient } from '../llm.js';
import { loadEnv, resolveProvider } from '../env.js';
import { selectHotels, patchHotelById, type SupabaseRestConfig } from '../photos/supabase-rest.js';
import { hasLeak } from './scaffolding-gate.js';
import { describePoisBatch, type DescribePoiInput } from '../pois/llm-describe-pois.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadDotenv({ path: path.resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: path.resolve(__dirname, '../../../../.env') });

// ─── Types ───────────────────────────────────────────────────────────────

interface HotelRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly city: string | null;
  readonly points_of_interest: unknown;
}

type Poi = Record<string, unknown>;

type PoiStatus =
  | 'completed'
  | 'description_only'
  | 'already_complete'
  | 'skipped_no_bucket'
  | 'skipped_no_facts'
  | 'skipped_leak';

interface FicheResult {
  readonly slug: string;
  readonly poisDescribed: number;
  readonly poisTipped: number;
  readonly poisComplete: number;
  readonly status: 'written' | 'skipped_nothing' | 'error';
  readonly tokensIn: number;
  readonly tokensOut: number;
}

const HOTEL_COLS = 'id,slug,name,city,points_of_interest';

interface LlmClientLike {
  call(input: {
    systemPrompt: string;
    userPrompt: string;
    temperature: number;
    maxOutputTokens: number;
    responseFormat: 'text' | 'json';
  }): Promise<{ content: string; usage: { inputTokens: number; outputTokens: number } }>;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function nonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function anyNonEmpty(rec: Poi, keys: readonly string[]): boolean {
  return keys.some((k) => nonEmptyString(rec[k]));
}

type Bucket = 'visit' | 'do' | 'shop';

function readBucket(p: Poi): Bucket | null {
  const b = p['bucket'];
  return b === 'visit' || b === 'do' || b === 'shop' ? b : null;
}

function poiName(p: Poi): string | null {
  if (nonEmptyString(p['name'])) return p['name'];
  if (nonEmptyString(p['name_fr'])) return p['name_fr'];
  return null;
}

function hasDistance(p: Poi): boolean {
  return (
    typeof p['distance_meters'] === 'number' ||
    typeof p['distance_km'] === 'number' ||
    typeof p['walk_minutes'] === 'number' ||
    nonEmptyString(p['distance_fr'])
  );
}

function hasDescription(p: Poi): boolean {
  return anyNonEmpty(p, ['description_fr', 'description_en', 'description']);
}

function hasTip(p: Poi): boolean {
  return anyNonEmpty(p, ['tip_fr', 'tip_en', 'tip']);
}

function isComplete(p: Poi): boolean {
  return (
    poiName(p) !== null &&
    readBucket(p) !== null &&
    hasDistance(p) &&
    hasDescription(p) &&
    hasTip(p)
  );
}

function poisOf(value: unknown): Poi[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((v): v is Poi => v !== null && typeof v === 'object' && !Array.isArray(v));
}

function distanceMeters(p: Poi): number {
  if (typeof p['distance_meters'] === 'number') return p['distance_meters'];
  if (typeof p['distance_km'] === 'number') return Math.round((p['distance_km'] as number) * 1000);
  return Number.MAX_SAFE_INTEGER;
}

// ─── Tip generation (concierge voice, grounded on the POI's own facts) ──────

const TIP_SYSTEM_PROMPT = `Tu es le Concierge de MyConciergeHotel.com. Tu écris UNE recommandation courte et complice sur un lieu proche d'un hôtel de luxe, à partir UNIQUEMENT des faits fournis.

Règles strictes :
- N'invente AUCUN fait précis (pas d'œuvre, d'horaire, de prix, de plat, d'année, de nom propre non listé).
- Tu te bases sur le type, la catégorie et la description fournie pour formuler un angle concierge utile (quand y aller, pour qui, quelle parenthèse).
- Pas de superlatif ("incontournable", "mythique"), pas de phrase publicitaire ("à ne pas manquer", "réservez").
- Pas de première personne du pluriel ("nous", "notre"). Tutoiement de connivence autorisé.
- Mentionne la distance UNIQUEMENT si elle est fournie et < 800 m, sous la forme "à X min à pied".
- 1 seule phrase, ≤ 25 mots pour tip_fr, et son équivalent anglais naturel pour tip_en.
- Réponds en JSON strict : {"tip_fr": "...", "tip_en": "..."}`;

function tipFactsLine(p: Poi, city: string | null): string {
  const bits: string[] = [];
  const name = poiName(p);
  if (name !== null) bits.push(`nom: ${name}`);
  if (nonEmptyString(p['type'])) bits.push(`type: ${String(p['type'])}`);
  if (nonEmptyString(p['category_fr'])) bits.push(`catégorie: ${String(p['category_fr'])}`);
  if (nonEmptyString(city)) bits.push(`ville: ${city}`);
  const dist = distanceMeters(p);
  if (dist < 800) {
    const walk =
      typeof p['walk_minutes'] === 'number' ? ` (~${String(p['walk_minutes'])} min à pied)` : '';
    bits.push(`distance: ${dist} m${walk}`);
  }
  if (nonEmptyString(p['description_fr'])) bits.push(`description: ${String(p['description_fr'])}`);
  return bits.join(' · ');
}

interface Tip {
  tip_fr: string;
  tip_en: string;
}

function parseTip(content: string): Tip | null {
  const cleaned = content
    .replace(/^```(?:json)?/u, '')
    .replace(/```$/u, '')
    .trim();
  try {
    const o = JSON.parse(cleaned) as Record<string, unknown>;
    const fr = o['tip_fr'];
    const en = o['tip_en'];
    if (!nonEmptyString(fr)) return null;
    return { tip_fr: fr.trim(), tip_en: nonEmptyString(en) ? en.trim() : '' };
  } catch {
    return null;
  }
}

async function generateTip(
  llm: LlmClientLike,
  city: string | null,
  p: Poi,
): Promise<{ tip: Tip | null; tokensIn: number; tokensOut: number }> {
  let tokensIn = 0;
  let tokensOut = 0;
  const userPrompt = `Lieu : ${poiName(p) ?? ''}
Faits disponibles : ${tipFactsLine(p, city)}

Rédige un conseil concierge (tip_fr + tip_en) ancré sur ces faits.`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await llm.call({
      systemPrompt: TIP_SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.5,
      maxOutputTokens: 220,
      responseFormat: 'json',
    });
    tokensIn += res.usage.inputTokens;
    tokensOut += res.usage.outputTokens;
    const tip = parseTip(res.content);
    if (tip === null) continue;
    if (hasLeak(tip.tip_fr) || (tip.tip_en.length > 0 && hasLeak(tip.tip_en))) continue;
    return { tip, tokensIn, tokensOut };
  }
  return { tip: null, tokensIn, tokensOut };
}

// ─── Per-fiche processing ──────────────────────────────────────────────────

/** A POI eligible for description sourcing (needs the bare classified facts). */
function canDescribe(p: Poi): p is Poi & { bucket: Bucket } {
  return poiName(p) !== null && readBucket(p) !== null && hasDistance(p);
}

async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) break;
      out[i] = await fn(items[i] as T);
    }
  });
  await Promise.all(workers);
  return out;
}

async function processFiche(
  llm: LlmClientLike,
  cfg: SupabaseRestConfig,
  hotel: HotelRow,
  dryRun: boolean,
): Promise<FicheResult> {
  const pois = poisOf(hotel.points_of_interest);
  if (pois === null || pois.length === 0) {
    return {
      slug: hotel.slug,
      poisDescribed: 0,
      poisTipped: 0,
      poisComplete: 0,
      status: 'skipped_nothing',
      tokensIn: 0,
      tokensOut: 0,
    };
  }

  let tokensIn = 0;
  let tokensOut = 0;

  // 1. Descriptions for POIs that lack one (reuse the EEAT-safe describer).
  const describeTargets: { idx: number; input: DescribePoiInput }[] = [];
  pois.forEach((p, idx) => {
    if (hasDescription(p) || !canDescribe(p)) return;
    describeTargets.push({
      idx,
      input: {
        name: poiName(p) ?? '',
        type: nonEmptyString(p['type']) ? p['type'] : 'place',
        bucket: readBucket(p) as Bucket,
        category: nonEmptyString(p['category_fr']) ? p['category_fr'] : null,
        city: hotel.city ?? '',
        distanceMeters: distanceMeters(p),
        walkMinutes: typeof p['walk_minutes'] === 'number' ? (p['walk_minutes'] as number) : null,
        factAnchor: null,
      },
    });
  });

  let poisDescribed = 0;
  if (describeTargets.length > 0) {
    const descs = await describePoisBatch(
      describeTargets.map((t) => t.input),
      { concurrency: 4 },
    );
    descs.forEach((d, k) => {
      if (d === null) return;
      const target = describeTargets[k];
      if (target === undefined) return;
      const p = pois[target.idx];
      if (p === undefined) return;
      p['description_fr'] = d.descriptionFr;
      p['description_en'] = d.descriptionEn;
      poisDescribed += 1;
    });
  }

  // 2. Tips for visit/do POIs that now have a description but no tip.
  const tipTargets = pois.filter((p) => {
    const b = readBucket(p);
    return (b === 'visit' || b === 'do') && !hasTip(p) && hasDescription(p);
  });
  let poisTipped = 0;
  if (tipTargets.length > 0) {
    const tipResults = await mapPool(tipTargets, 4, (p) => generateTip(llm, hotel.city, p));
    tipResults.forEach((r, k) => {
      tokensIn += r.tokensIn;
      tokensOut += r.tokensOut;
      const p = tipTargets[k];
      if (p === undefined || r.tip === null) return;
      p['tip_fr'] = r.tip.tip_fr;
      if (r.tip.tip_en.length > 0) p['tip_en'] = r.tip.tip_en;
      poisTipped += 1;
    });
  }

  const poisComplete = pois.filter((p) => isComplete(p)).length;

  if (poisDescribed === 0 && poisTipped === 0) {
    return {
      slug: hotel.slug,
      poisDescribed: 0,
      poisTipped: 0,
      poisComplete,
      status: 'skipped_nothing',
      tokensIn,
      tokensOut,
    };
  }

  if (!dryRun) {
    await patchHotelById(cfg, hotel.id, { points_of_interest: pois });
  }
  return {
    slug: hotel.slug,
    poisDescribed,
    poisTipped,
    poisComplete,
    status: 'written',
    tokensIn,
    tokensOut,
  };
}

// ─── Selection + CLI ─────────────────────────────────────────────────────

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

async function fetchAuto(cfg: SupabaseRestConfig, limit: number): Promise<HotelRow[]> {
  const pool = await selectHotels<HotelRow>(cfg, {
    columns: HOTEL_COLS,
    filters: ['is_published=eq.true', 'points_of_interest=not.is.null'],
    order: 'slug.asc',
    limit: 5000,
  });
  // Keep only fiches with at least one POI still missing description or tip.
  return pool
    .filter((h) => {
      const pois = poisOf(h.points_of_interest);
      if (pois === null) return false;
      return pois.some(
        (p) =>
          (!hasDescription(p) && canDescribe(p)) ||
          ((readBucket(p) === 'visit' || readBucket(p) === 'do') && !hasTip(p)),
      );
    })
    .slice(0, limit);
}

interface Args {
  readonly slugs: readonly string[];
  readonly auto: boolean;
  readonly limit: number;
  readonly concurrency: number;
  readonly dryRun: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let slugs: string[] = [];
  let auto = false;
  let limit = 10;
  let concurrency = 3;
  let dryRun = false;
  for (const a of argv) {
    if (a === '--auto') auto = true;
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
  return { slugs, auto, limit, concurrency, dryRun };
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

async function main(): Promise<void> {
  const args = parseArgs();
  if (args.slugs.length === 0 && !args.auto) {
    console.error('Usage: tsx enrich-poi-handoff.ts --slugs=a,b,c | --auto --limit=N [--dry-run]');
    process.exit(1);
  }
  const cfg = loadRestConfig();
  const env = loadEnv();
  const provider = resolveProvider(env);
  const llm = buildLlmClient(env, provider) as unknown as LlmClientLike;

  const fiches = args.auto
    ? await fetchAuto(cfg, args.limit)
    : await fetchExplicit(cfg, args.slugs);
  console.log(
    `\n[poi-handoff] ${fiches.length} fiche(s) — ${args.dryRun ? 'DRY-RUN' : 'WRITE'} — concurrency=${args.concurrency}\n`,
  );

  const outDir = path.resolve(process.cwd(), 'out');
  await mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const runlog = path.resolve(outDir, `poi-handoff-runlog-${stamp}.jsonl`);

  let written = 0;
  let described = 0;
  let tipped = 0;
  let totalIn = 0;
  let totalOut = 0;

  const results = await runWithConcurrency(fiches, args.concurrency, async (hotel, idx) => {
    const tag = `[${idx + 1}/${fiches.length} ${hotel.slug}]`;
    try {
      const r = await processFiche(llm, cfg, hotel, args.dryRun);
      console.log(
        `${tag} ${r.status === 'written' ? '✓' : '·'} ${r.status} desc=${r.poisDescribed} tip=${r.poisTipped} complete=${r.poisComplete}`,
      );
      await appendFile(runlog, JSON.stringify(r) + '\n', 'utf8');
      return r;
    } catch (err) {
      console.error(`${tag} ✗ ${err instanceof Error ? err.message : String(err)}`);
      return {
        slug: hotel.slug,
        poisDescribed: 0,
        poisTipped: 0,
        poisComplete: 0,
        status: 'error',
        tokensIn: 0,
        tokensOut: 0,
      } satisfies FicheResult;
    }
  });

  for (const r of results) {
    if (r.status === 'written') written += 1;
    described += r.poisDescribed;
    tipped += r.poisTipped;
    totalIn += r.tokensIn;
    totalOut += r.tokensOut;
  }

  console.log(
    `\nDone — fiches written=${written}/${fiches.length}, POIs described=${described}, tipped=${tipped}, tokens in/out=${totalIn}/${totalOut}. Runlog → ${runlog}`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
