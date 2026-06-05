/**
 * enrich-spa-dossier.ts — Wave C (golden template, dimension `golden`).
 *
 * Lifts `spa_info` to the golden dossier contract the audit measures
 * (`@mch/domain/editorial` → evaluateSpaDossier):
 *
 *     spa dossier complete = description + hours + contact + tip
 *
 * The audit only fires `gold.spa_dossier` when `spa_info` is already a
 * populated object, so this writer NEVER invents a spa — it only completes
 * the dossier of hotels that already declare one. Most such fiches carry
 * just `name` + `features_fr/en`, so we:
 *   - SOURCE rich facts + literal opening hours from the official domain via
 *     the hardened Tavily wellness extractor (no hours invented — filled only
 *     when the page literally states them).
 *   - WRITE description_fr/en + tip_fr/en in one grounded LLM call, plus
 *     hours_fr/en as a faithful localisation of the sourced literal.
 *   - SET contact deterministically: an in-hotel spa shares the hotel's own
 *     contact path (website = official_url, phone = phone_e164).
 *   - PERSIST the rich facts (brand, surface, pool, treatments…) for EEAT.
 *
 * Invariants (ADR-0029): I1 anti-leak, I2 EEAT (no invention), I4 per-field
 * idempotence (only fill missing fields), I5 never persist empty strings.
 *
 * Usage:
 *   npx tsx src/enrichment/enrich-spa-dossier.ts --slugs=a,b,c [--dry-run]
 *   npx tsx src/enrichment/enrich-spa-dossier.ts --auto --limit=80 [--concurrency=2]
 */

import path from 'node:path';
import { appendFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';

import { buildLlmClient } from '../llm.js';
import { loadEnv, resolveProvider } from '../env.js';
import { selectHotels, patchHotelById, type SupabaseRestConfig } from '../photos/supabase-rest.js';
import { hasLeak } from './scaffolding-gate.js';
import { extractWellness, type WellnessFacts } from './wellness-extractor.js';

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
  readonly spa_info: unknown;
}

type SpaInfo = Record<string, unknown>;

interface FicheResult {
  readonly slug: string;
  readonly status:
    | 'completed'
    | 'partial'
    | 'already_complete'
    | 'skipped_no_facts'
    | 'skipped_leak'
    | 'error';
  readonly fieldsSet: readonly string[];
  readonly tokensIn: number;
  readonly tokensOut: number;
}

const HOTEL_COLS = 'id,slug,name,city,official_url,phone_e164,spa_info';

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

function anyNonEmpty(rec: SpaInfo, keys: readonly string[]): boolean {
  return keys.some((k) => nonEmptyString(rec[k]));
}

const AGGREGATOR_HOST_RE =
  /(?:petitpasseport|travelweekly|tripadvisor|booking\.|expedia|hotels\.com|agoda|airbnb|trivago|kayak|laterooms|hotelscombined|yelp|facebook\.|instagram\.|wikipedia\.)/iu;

function isUsableOfficialUrl(url: string | null): url is string {
  if (!nonEmptyString(url) || !url.startsWith('https')) return false;
  return !AGGREGATOR_HOST_RE.test(url);
}

function domainOf(url: string | null): string | null {
  if (!nonEmptyString(url)) return null;
  try {
    return new URL(url).hostname.replace(/^www\./u, '');
  } catch {
    return null;
  }
}

function spaInfoOf(value: unknown): SpaInfo | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as SpaInfo;
}

function featuresLine(spa: SpaInfo): string {
  const fr = Array.isArray(spa['features_fr'])
    ? (spa['features_fr'] as unknown[]).filter(nonEmptyString)
    : [];
  const en = Array.isArray(spa['features_en'])
    ? (spa['features_en'] as unknown[]).filter(nonEmptyString)
    : [];
  const list = fr.length > 0 ? fr : en;
  return list.join(', ');
}

function factsBlock(spa: SpaInfo, w: WellnessFacts | null): string {
  const bits: string[] = [];
  const name = nonEmptyString(spa['name']) ? spa['name'] : (w?.spaName ?? null);
  if (nonEmptyString(name)) bits.push(`nom du spa: ${name}`);
  const feats = featuresLine(spa);
  if (feats.length > 0) bits.push(`équipements: ${feats}`);
  if (w) {
    if (w.partnerBrand) bits.push(`marque partenaire: ${w.partnerBrand}`);
    if (w.surfaceM2 !== null) bits.push(`surface: ${w.surfaceM2} m²`);
    if (w.hasPool === true) bits.push(`piscine: oui${w.poolType ? ` (${w.poolType})` : ''}`);
    if (w.hasHammam === true) bits.push('hammam: oui');
    if (w.hasSauna === true) bits.push('sauna: oui');
    if (w.hasFitness === true) bits.push('fitness: oui');
    if (w.numberOfTreatmentRooms !== null)
      bits.push(`cabines de soin: ${w.numberOfTreatmentRooms}`);
    if (w.signatureTreatments.length > 0)
      bits.push(`soins signature: ${w.signatureTreatments.slice(0, 6).join(', ')}`);
  }
  return bits.join(' · ');
}

// ─── Consolidated editorial LLM call (description + tip + localised hours) ───

const SYSTEM_PROMPT = `Tu es le Concierge de MyConciergeHotel.com. À partir UNIQUEMENT des faits fournis sur le spa d'un hôtel de luxe, tu produis le contenu éditorial d'un dossier spa.

Règles strictes (anti-hallucination) :
- N'invente AUCUN fait : pas de marque, surface, soin, équipement, prix ni horaire non listés.
- "description_fr"/"description_en" : 1 à 3 phrases factuelles décrivant le spa à partir des équipements et faits fournis. Pas de superlatif ("incontournable", "exceptionnel"), pas de première personne ("nous"), pas d'injonction ("réservez").
- "tip_fr"/"tip_en" : UNE phrase concierge complice (tutoiement autorisé), ≤ 25 mots, un angle concret (pour qui, quel moment), ancrée sur les faits.
- "hours_fr"/"hours_en" : UNIQUEMENT une reformulation fidèle des horaires LITTÉRAUX fournis dans "horaires sourcés". Si aucun horaire n'est fourni → chaîne vide "". N'invente JAMAIS d'horaire.
- Réponds en JSON strict : {"description_fr","description_en","tip_fr","tip_en","hours_fr","hours_en"}`;

interface Editorial {
  description_fr: string;
  description_en: string;
  tip_fr: string;
  tip_en: string;
  hours_fr: string;
  hours_en: string;
}

function parseEditorial(content: string): Editorial | null {
  const cleaned = content
    .replace(/^```(?:json)?/u, '')
    .replace(/```$/u, '')
    .trim();
  try {
    const o = JSON.parse(cleaned) as Record<string, unknown>;
    const get = (k: string): string => (nonEmptyString(o[k]) ? (o[k] as string).trim() : '');
    const description_fr = get('description_fr');
    const tip_fr = get('tip_fr');
    if (description_fr.length === 0 || tip_fr.length === 0) return null;
    return {
      description_fr,
      description_en: get('description_en'),
      tip_fr,
      tip_en: get('tip_en'),
      hours_fr: get('hours_fr'),
      hours_en: get('hours_en'),
    };
  } catch {
    return null;
  }
}

async function generateEditorial(
  llm: LlmClientLike,
  hotelName: string,
  spa: SpaInfo,
  w: WellnessFacts | null,
): Promise<{ ed: Editorial | null; tokensIn: number; tokensOut: number }> {
  const facts = factsBlock(spa, w);
  const userPrompt = `Hôtel : ${hotelName}
Faits spa disponibles : ${facts}
horaires sourcés : ${w?.hours ?? 'aucun'}

Rédige le JSON éditorial (description_fr, description_en, tip_fr, tip_en, hours_fr, hours_en) ancré sur ces faits.`;
  let tokensIn = 0;
  let tokensOut = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await llm.call({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.4,
      maxOutputTokens: 600,
      responseFormat: 'json',
    });
    tokensIn += res.usage.inputTokens;
    tokensOut += res.usage.outputTokens;
    const ed = parseEditorial(res.content);
    if (ed === null) continue;
    if (hasLeak(ed.description_fr) || hasLeak(ed.tip_fr)) continue;
    return { ed, tokensIn, tokensOut };
  }
  return { ed: null, tokensIn, tokensOut };
}

// ─── Per-fiche processing ──────────────────────────────────────────────────

async function processFiche(
  llm: LlmClientLike,
  cfg: SupabaseRestConfig,
  hotel: HotelRow,
  dryRun: boolean,
): Promise<FicheResult> {
  const spa = spaInfoOf(hotel.spa_info);
  if (spa === null) {
    return {
      slug: hotel.slug,
      status: 'skipped_no_facts',
      fieldsSet: [],
      tokensIn: 0,
      tokensOut: 0,
    };
  }

  const hasDesc = anyNonEmpty(spa, ['description_fr', 'description_en', 'description']);
  const hasHours = anyNonEmpty(spa, ['hours_fr', 'hours_en', 'hours']);
  const hasContact = anyNonEmpty(spa, ['website', 'phone']);
  const hasTip = anyNonEmpty(spa, ['tip_fr', 'tip_en', 'tip']);
  if (hasDesc && hasHours && hasContact && hasTip) {
    return {
      slug: hotel.slug,
      status: 'already_complete',
      fieldsSet: [],
      tokensIn: 0,
      tokensOut: 0,
    };
  }

  // 1. Source rich facts + literal hours from the official domain (Tavily).
  let wellness: WellnessFacts | null = null;
  if (!hasDesc || !hasHours) {
    try {
      const run = await extractWellness({
        hotelName: hotel.name,
        city: hotel.city ?? '',
        officialDomain: domainOf(hotel.official_url),
      });
      wellness = run.wellness;
    } catch (err) {
      console.warn(`  [tavily] ${hotel.slug}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const fieldsSet: string[] = [];
  let tokensIn = 0;
  let tokensOut = 0;

  // 2. Editorial copy (description + tip + localised hours) in one grounded call.
  if (!hasDesc || !hasTip || (!hasHours && wellness?.hours)) {
    const gen = await generateEditorial(llm, hotel.name, spa, wellness);
    tokensIn += gen.tokensIn;
    tokensOut += gen.tokensOut;
    if (gen.ed === null) {
      // LLM failed/leaked — fall through to deterministic contact only.
    } else {
      if (!hasDesc && gen.ed.description_fr.length > 0) {
        spa['description_fr'] = gen.ed.description_fr;
        if (gen.ed.description_en.length > 0) spa['description_en'] = gen.ed.description_en;
        fieldsSet.push('description');
      }
      if (!hasTip && gen.ed.tip_fr.length > 0) {
        spa['tip_fr'] = gen.ed.tip_fr;
        if (gen.ed.tip_en.length > 0) spa['tip_en'] = gen.ed.tip_en;
        fieldsSet.push('tip');
      }
      if (!hasHours && gen.ed.hours_fr.length > 0) {
        spa['hours_fr'] = gen.ed.hours_fr;
        if (gen.ed.hours_en.length > 0) spa['hours_en'] = gen.ed.hours_en;
        fieldsSet.push('hours');
      }
    }
  }

  // 3. Contact — deterministic, honest (in-hotel spa shares the hotel path).
  if (!hasContact) {
    if (isUsableOfficialUrl(hotel.official_url)) {
      spa['website'] = hotel.official_url;
      fieldsSet.push('website');
    }
    if (nonEmptyString(hotel.phone_e164)) {
      spa['phone'] = hotel.phone_e164;
      fieldsSet.push('phone');
    }
  }

  // 4. Persist rich facts (EEAT) when newly sourced and not already present.
  if (wellness) {
    const setIfMissing = (k: string, v: unknown): void => {
      if (v === null || v === undefined) return;
      if (spa[k] === undefined || spa[k] === null) {
        spa[k] = v;
        fieldsSet.push(k);
      }
    };
    setIfMissing('partner_brand', wellness.partnerBrand);
    setIfMissing('surface_m2', wellness.surfaceM2);
    setIfMissing('has_pool', wellness.hasPool === true ? true : undefined);
    setIfMissing('pool_type', wellness.poolType);
    setIfMissing('treatment_rooms', wellness.numberOfTreatmentRooms);
    if (wellness.signatureTreatments.length > 0 && spa['signature_treatments'] === undefined) {
      spa['signature_treatments'] = wellness.signatureTreatments;
      fieldsSet.push('signature_treatments');
    }
    if (nonEmptyString(wellness.sourceUrl) && spa['source_url'] === undefined) {
      spa['source_url'] = wellness.sourceUrl;
      fieldsSet.push('source_url');
    }
  }

  if (fieldsSet.length === 0) {
    return { slug: hotel.slug, status: 'skipped_no_facts', fieldsSet: [], tokensIn, tokensOut };
  }

  const nowComplete =
    anyNonEmpty(spa, ['description_fr', 'description_en', 'description']) &&
    anyNonEmpty(spa, ['hours_fr', 'hours_en', 'hours']) &&
    anyNonEmpty(spa, ['website', 'phone']) &&
    anyNonEmpty(spa, ['tip_fr', 'tip_en', 'tip']);

  if (!dryRun) {
    await patchHotelById(cfg, hotel.id, { spa_info: spa });
  }
  return {
    slug: hotel.slug,
    status: nowComplete ? 'completed' : 'partial',
    fieldsSet,
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
    filters: ['is_published=eq.true', 'spa_info=not.is.null'],
    order: 'slug.asc',
    limit: 5000,
  });
  return pool
    .filter((h) => {
      const spa = spaInfoOf(h.spa_info);
      if (spa === null) return false;
      const complete =
        anyNonEmpty(spa, ['description_fr', 'description_en', 'description']) &&
        anyNonEmpty(spa, ['hours_fr', 'hours_en', 'hours']) &&
        anyNonEmpty(spa, ['website', 'phone']) &&
        anyNonEmpty(spa, ['tip_fr', 'tip_en', 'tip']);
      return !complete;
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
  let limit = 80;
  let concurrency = 2;
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
    console.error('Usage: tsx enrich-spa-dossier.ts --slugs=a,b,c | --auto --limit=N [--dry-run]');
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
    `\n[spa-dossier] ${fiches.length} fiche(s) — ${args.dryRun ? 'DRY-RUN' : 'WRITE'} — concurrency=${args.concurrency}\n`,
  );

  const outDir = path.resolve(process.cwd(), 'out');
  await mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const runlog = path.resolve(outDir, `spa-dossier-runlog-${stamp}.jsonl`);

  let completed = 0;
  let partial = 0;
  let totalIn = 0;
  let totalOut = 0;

  const results = await runWithConcurrency(fiches, args.concurrency, async (hotel, idx) => {
    const tag = `[${idx + 1}/${fiches.length} ${hotel.slug}]`;
    try {
      const r = await processFiche(llm, cfg, hotel, args.dryRun);
      console.log(
        `${tag} ${r.status === 'completed' ? '✓' : '·'} ${r.status} [${r.fieldsSet.join(',')}]`,
      );
      await appendFile(runlog, JSON.stringify(r) + '\n', 'utf8');
      return r;
    } catch (err) {
      console.error(`${tag} ✗ ${err instanceof Error ? err.message : String(err)}`);
      return {
        slug: hotel.slug,
        status: 'error',
        fieldsSet: [],
        tokensIn: 0,
        tokensOut: 0,
      } satisfies FicheResult;
    }
  });

  for (const r of results) {
    if (r.status === 'completed') completed += 1;
    if (r.status === 'partial') partial += 1;
    totalIn += r.tokensIn;
    totalOut += r.tokensOut;
  }

  console.log(
    `\nDone — completed=${completed}, partial=${partial}, fiches=${fiches.length}, tokens in/out=${totalIn}/${totalOut}. Runlog → ${runlog}`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
