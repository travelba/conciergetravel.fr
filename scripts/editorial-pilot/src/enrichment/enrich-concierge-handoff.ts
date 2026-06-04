/**
 * enrich-concierge-handoff.ts — Wave A (golden template, dimension `golden`).
 *
 * Lifts `restaurant_info.venues[]` to the concierge-handoff contract that the
 * audit measures (`@mch/domain/editorial` → evaluateVenueHandoff):
 *
 *     venue complete = name + contact (website|reservation_url|phone) + tip
 *
 * Strategy (cheap, mostly fact-grounded — no Tavily):
 *   - CONTACT is deterministic and honest: an in-hotel venue shares the hotel's
 *     own contact path → website = hotel.official_url, phone = hotel.phone_e164.
 *     Never fabricated; only set when missing.
 *   - TIP is an editorial concierge one-liner, generated ONLY from facts already
 *     stored on the venue (name, type, chef, michelin_stars, features). If the
 *     venue carries no substantive fact, we skip it (honest, leave incomplete)
 *     rather than invent.
 *
 * Invariants (ADR-0029): I1 anti-leak, I2 EEAT (no invention), I4 per-field
 * idempotence (only fill missing fields), I5 never persist empty strings.
 *
 * Usage:
 *   npx tsx src/enrichment/enrich-concierge-handoff.ts --slugs=a,b,c [--dry-run] [--show]
 *   npx tsx src/enrichment/enrich-concierge-handoff.ts --auto --limit=50 [--concurrency=4]
 */

import path from 'node:path';
import { appendFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';

import { buildLlmClient } from '../llm.js';
import { loadEnv, resolveProvider } from '../env.js';
import { selectHotels, patchHotelById, type SupabaseRestConfig } from '../photos/supabase-rest.js';
import { hasLeak } from './scaffolding-gate.js';

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
  readonly official_url: string | null;
  readonly phone_e164: string | null;
  readonly restaurant_info: unknown;
}

type Venue = Record<string, unknown>;

interface VenueChange {
  readonly name: string;
  readonly status:
    | 'completed'
    | 'already_complete'
    | 'skipped_no_contact'
    | 'skipped_no_facts'
    | 'skipped_leak';
  readonly fieldsSet: readonly string[];
}

interface FicheResult {
  readonly slug: string;
  readonly changes: readonly VenueChange[];
  readonly venuesCompleted: number;
  readonly tokensIn: number;
  readonly tokensOut: number;
}

const HOTEL_COLS = 'id,slug,name,city,official_url,phone_e164,restaurant_info';

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

function anyNonEmpty(rec: Venue, keys: readonly string[]): boolean {
  return keys.some((k) => nonEmptyString(rec[k]));
}

/**
 * Third-party aggregators / editorial directories sometimes sit in `official_url`.
 * They are NOT the hotel's own contact path, so we must never present them as a
 * venue contact (it would be misleading). When one is already stored on a venue
 * website (a past mistake), we strip it.
 */
const AGGREGATOR_HOST_RE =
  /(?:petitpasseport|travelweekly|tripadvisor|booking\.|expedia|hotels\.com|agoda|airbnb|trivago|kayak|laterooms|hotelscombined|yelp|facebook\.|instagram\.|wikipedia\.)/iu;

function isUsableOfficialUrl(url: string | null): url is string {
  if (!nonEmptyString(url) || !url.startsWith('https')) return false;
  return !AGGREGATOR_HOST_RE.test(url);
}

function isAggregatorUrl(v: unknown): boolean {
  return nonEmptyString(v) && AGGREGATOR_HOST_RE.test(v);
}

function venuesOf(
  restaurantInfo: unknown,
): { rec: Record<string, unknown>; venues: Venue[] } | null {
  if (
    restaurantInfo === null ||
    typeof restaurantInfo !== 'object' ||
    Array.isArray(restaurantInfo)
  ) {
    return null;
  }
  const rec = restaurantInfo as Record<string, unknown>;
  if (!Array.isArray(rec['venues'])) return null;
  return { rec, venues: rec['venues'] as Venue[] };
}

/**
 * A venue carries a SPECIFIC fact (not just a generic type) to ground a unique,
 * non-vacuous concierge tip. `type_fr` alone produces filler ("a well-chosen
 * table"), so it is necessary context but not sufficient on its own.
 */
function hasSubstantiveFacts(v: Venue): boolean {
  return (
    anyNonEmpty(v, ['chef', 'pastry_chef', 'sommelier', 'cuisine', 'signature']) ||
    (typeof v['michelin_stars'] === 'number' && (v['michelin_stars'] as number) > 0) ||
    (Array.isArray(v['features']) && (v['features'] as unknown[]).filter(nonEmptyString).length > 0)
  );
}

function factsLine(v: Venue): string {
  const bits: string[] = [];
  if (nonEmptyString(v['name'])) bits.push(`nom: ${String(v['name'])}`);
  if (nonEmptyString(v['type_fr'])) bits.push(`type: ${String(v['type_fr'])}`);
  if (typeof v['michelin_stars'] === 'number' && (v['michelin_stars'] as number) > 0) {
    bits.push(`étoiles Michelin: ${String(v['michelin_stars'])}`);
  }
  if (nonEmptyString(v['chef'])) bits.push(`chef: ${String(v['chef'])}`);
  if (nonEmptyString(v['pastry_chef'])) bits.push(`chef pâtissier: ${String(v['pastry_chef'])}`);
  if (Array.isArray(v['features'])) {
    const feats = (v['features'] as unknown[]).filter(nonEmptyString).slice(0, 6);
    if (feats.length > 0) bits.push(`atouts: ${feats.join(', ')}`);
  }
  return bits.join(' · ');
}

const SYSTEM_PROMPT = `Tu es le Concierge de MyConciergeHotel.com. Tu écris UNE recommandation courte, complice et concrète sur une table d'hôtel, à partir UNIQUEMENT des faits fournis.

Règles strictes :
- N'invente AUCUN fait (pas de plat, prix, horaire ou récompense non listés).
- Pas de mention de source, de brief, de "manque d'information".
- Voix concierge : tutoiement de connivence professionnelle, élégant, jamais publicitaire.
- 1 seule phrase, ≤ 25 mots, en français pour tip_fr et son équivalent anglais naturel pour tip_en.
- Réponds en JSON strict : {"tip_fr": "...", "tip_en": "..."}`;

function buildUserPrompt(hotelName: string, v: Venue): string {
  return `Hôtel : ${hotelName}
Table : ${String(v['name'])}
Faits disponibles : ${factsLine(v)}

Rédige un conseil concierge (tip_fr + tip_en) ancré sur ces faits.`;
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
  hotelName: string,
  v: Venue,
): Promise<{ tip: Tip | null; tokensIn: number; tokensOut: number }> {
  let tokensIn = 0;
  let tokensOut = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await llm.call({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(hotelName, v),
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

async function processFiche(
  llm: LlmClientLike,
  cfg: SupabaseRestConfig,
  hotel: HotelRow,
  dryRun: boolean,
): Promise<FicheResult> {
  const parsed = venuesOf(hotel.restaurant_info);
  if (parsed === null) {
    return { slug: hotel.slug, changes: [], venuesCompleted: 0, tokensIn: 0, tokensOut: 0 };
  }
  const { rec, venues } = parsed;

  const website = isUsableOfficialUrl(hotel.official_url) ? hotel.official_url : null;
  const phone = nonEmptyString(hotel.phone_e164) ? hotel.phone_e164 : null;

  const changes: VenueChange[] = [];
  let tokensIn = 0;
  let tokensOut = 0;
  let dirty = false;
  const nextVenues: Venue[] = [];

  for (const original of venues) {
    const v: Venue = { ...original };
    const name = nonEmptyString(v['name']) ? String(v['name']) : '(sans nom)';

    // Self-heal: a previously-stored aggregator website is not a real contact.
    if (isAggregatorUrl(v['website'])) {
      delete v['website'];
      dirty = true;
    }

    const hasName = anyNonEmpty(v, ['name']);
    const hasContact = anyNonEmpty(v, ['website', 'reservation_url', 'phone']);
    const hasTip = anyNonEmpty(v, ['tip_fr', 'tip_en', 'tip']);
    const fieldsSet: string[] = [];

    if (hasName && hasContact && hasTip) {
      changes.push({ name, status: 'already_complete', fieldsSet: [] });
      nextVenues.push(v);
      continue;
    }

    // Determine completability upfront — never write a half-handoff.
    const canContact = hasContact || website !== null || phone !== null;
    const canTip = hasTip || hasSubstantiveFacts(v);

    if (!hasName || !canContact) {
      changes.push({ name, status: 'skipped_no_contact', fieldsSet: [] });
      nextVenues.push(v); // keep aggregator-strip if any
      continue;
    }
    if (!canTip) {
      changes.push({ name, status: 'skipped_no_facts', fieldsSet: [] });
      nextVenues.push(v);
      continue;
    }

    // Tip first (it can fail the leak gate; if so, don't bother writing contact).
    if (!hasTip) {
      const gen = await generateTip(llm, hotel.name, v);
      tokensIn += gen.tokensIn;
      tokensOut += gen.tokensOut;
      if (gen.tip === null) {
        changes.push({ name, status: 'skipped_leak', fieldsSet: [] });
        nextVenues.push(v);
        continue;
      }
      v['tip_fr'] = gen.tip.tip_fr;
      fieldsSet.push('tip_fr');
      if (gen.tip.tip_en.length > 0) {
        v['tip_en'] = gen.tip.tip_en;
        fieldsSet.push('tip_en');
      }
    }

    // Contact (deterministic, honest) — only when missing.
    if (!hasContact) {
      if (website !== null) {
        v['website'] = website;
        fieldsSet.push('website');
      } else if (phone !== null) {
        v['phone'] = phone;
        fieldsSet.push('phone');
      }
    }

    dirty = true;
    changes.push({ name, status: 'completed', fieldsSet });
    nextVenues.push(v);
  }

  const venuesCompleted = changes.filter((c) => c.status === 'completed').length;

  if (dirty && !dryRun) {
    const nextInfo = { ...rec, venues: nextVenues };
    await patchHotelById(cfg, hotel.id, { restaurant_info: nextInfo });
  }

  return { slug: hotel.slug, changes, venuesCompleted, tokensIn, tokensOut };
}

// ─── Fiche selection ─────────────────────────────────────────────────────

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

/** Published fiches whose restaurant_info has at least one incomplete venue. */
async function fetchAuto(cfg: SupabaseRestConfig, limit: number): Promise<HotelRow[]> {
  const pool = await selectHotels<HotelRow>(cfg, {
    columns: HOTEL_COLS,
    filters: ['is_published=eq.true', 'restaurant_info=not.is.null'],
    order: 'slug.asc',
    limit: 5000,
  });
  const eligible = pool.filter((h) => {
    const parsed = venuesOf(h.restaurant_info);
    if (parsed === null) return false;
    return parsed.venues.some((v) => {
      const complete =
        anyNonEmpty(v, ['name']) &&
        anyNonEmpty(v, ['website', 'reservation_url', 'phone']) &&
        anyNonEmpty(v, ['tip_fr', 'tip_en', 'tip']);
      return !complete;
    });
  });
  return eligible.slice(0, limit);
}

// ─── CLI ─────────────────────────────────────────────────────────────────

interface Args {
  readonly slugs: readonly string[];
  readonly auto: boolean;
  readonly limit: number;
  readonly concurrency: number;
  readonly dryRun: boolean;
  readonly show: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let slugs: string[] = [];
  let auto = false;
  let limit = 12;
  let concurrency = 3;
  let dryRun = false;
  let show = false;
  for (const a of argv) {
    if (a === '--auto') auto = true;
    else if (a === '--dry-run') dryRun = true;
    else if (a === '--show') show = true;
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
  return { slugs, auto, limit, concurrency, dryRun, show };
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
    console.error(
      'Usage: tsx enrich-concierge-handoff.ts --slugs=a,b,c | --auto --limit=N [--dry-run] [--show]',
    );
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
    `\n[handoff] ${fiches.length} fiche(s) — ${args.dryRun ? 'DRY-RUN' : 'WRITE'} — concurrency=${args.concurrency}\n`,
  );

  const outDir = path.resolve(process.cwd(), 'out');
  await mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const runlog = path.resolve(outDir, `handoff-runlog-${stamp}.jsonl`);

  let totalCompleted = 0;
  let totalIn = 0;
  let totalOut = 0;

  const results = await runWithConcurrency(fiches, args.concurrency, async (hotel, idx) => {
    const tag = `[${idx + 1}/${fiches.length} ${hotel.slug}]`;
    try {
      const r = await processFiche(llm, cfg, hotel, args.dryRun);
      const summary = r.changes.map((c) => `${c.name}:${c.status}`).join(' | ');
      console.log(
        `${tag} ✓ completed=${r.venuesCompleted}/${r.changes.length} — ${summary || 'no venues'}`,
      );
      if (args.show) {
        for (const c of r.changes) {
          if (c.status === 'completed') console.log(`   + ${c.name} → ${c.fieldsSet.join(', ')}`);
        }
      }
      await appendFile(
        runlog,
        JSON.stringify({ slug: r.slug, completed: r.venuesCompleted, changes: r.changes }) + '\n',
        'utf8',
      );
      return r;
    } catch (err) {
      console.error(`${tag} ✗ ${err instanceof Error ? err.message : String(err)}`);
      return {
        slug: hotel.slug,
        changes: [],
        venuesCompleted: 0,
        tokensIn: 0,
        tokensOut: 0,
      } satisfies FicheResult;
    }
  });

  for (const r of results) {
    totalCompleted += r.venuesCompleted;
    totalIn += r.tokensIn;
    totalOut += r.tokensOut;
  }

  console.log(
    `\nDone — venues completed=${totalCompleted}, tokens in/out=${totalIn}/${totalOut}. Runlog → ${runlog}`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
