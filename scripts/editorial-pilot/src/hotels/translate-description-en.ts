/**
 * translate-description-en.ts — EN parity backfill for `hotels.description_en`.
 *
 * Why this exists: a 2026-06-20 catalogue audit found 172 published fiches with
 * a rich `description_fr` but NULL/empty `description_en`, so the `/en` hotel
 * page falls back to French prose (the `pickLocalizedText` fallback). English is
 * a V1 locale → a real GEO/SEO hole. The comprehensive `i18n/translate-hotels-en.ts`
 * tool covers this field but talks to Postgres over `pg` (direct host, IPv6-only)
 * which doesn't resolve on the Windows dev box; this sibling uses PostgREST over
 * HTTPS like `translate-sections-en.ts` so it runs anywhere.
 *
 * It translates the FR canonical into a faithful British-English rewrite
 * (numbers / prices / proper nouns preserved, no invented facts), one LLM call
 * per hotel, and PATCHes ONLY `description_en` — disjoint from `concierge_advice`
 * and `long_description_sections`, so it is safe to run in parallel with the
 * concierge-advice and sections-EN backfills.
 *
 * Anti-scaffolding: the EN output runs through the shared `hasLeak()` gate.
 *
 * CLI:
 *   --slug=foo                 single hotel
 *   --slugs=a,b,c              explicit list
 *   --all                      every published fiche with FR desc but missing EN
 *   --limit=N                  cap the --all selection (default 0 = no cap)
 *   --concurrency=4            parallel hotels (default 4, max 8)
 *   --dry-run                  generate + validate, do NOT persist
 *
 * Skill: editorial-voice, llm-output-robustness, typescript-strict-zod-interop.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import OpenAI from 'openai';
import { z } from 'zod';

import { hasLeak } from '../enrichment/scaffolding-gate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

const MODEL = 'gpt-4o-mini-2024-07-18';

/** Description below this many chars counts as "missing EN" (stubs included). */
const EN_MIN_CHARS = 80;
/** A French description shorter than this isn't worth translating. */
const FR_MIN_CHARS = 50;

interface HotelRow {
  slug: string;
  name: string;
  city: string | null;
  region: string | null;
  description_fr: string | null;
  description_en: string | null;
}

function needsEn(h: HotelRow): boolean {
  return (
    (h.description_fr ?? '').trim().length >= FR_MIN_CHARS &&
    (h.description_en ?? '').trim().length < EN_MIN_CHARS
  );
}

/* ── PostgREST ──────────────────────────────────────────────────────────── */

interface PostgrestEnv {
  readonly restBase: string;
  readonly apikey: string;
}

function loadPostgrestEnv(): PostgrestEnv {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
  if (url.length === 0 || key.length === 0) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env.local');
  }
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
  return { restBase: `${url.replace(/\/+$/u, '')}/rest/v1`, apikey: key };
}

function pgHeaders(env: PostgrestEnv, extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: env.apikey,
    Authorization: `Bearer ${env.apikey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...extra,
  };
}

const SELECT = 'slug,name,city,region,description_fr,description_en';

async function fetchHotelsBySlug(env: PostgrestEnv, slugs: readonly string[]): Promise<HotelRow[]> {
  const params = new URLSearchParams();
  params.set('select', SELECT);
  params.set('slug', `in.(${slugs.join(',')})`);
  const r = await fetch(`${env.restBase}/hotels?${params.toString()}`, { headers: pgHeaders(env) });
  if (!r.ok)
    throw new Error(`PostgREST GET hotels failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return (await r.json()) as HotelRow[];
}

async function fetchAllNeedingEn(env: PostgrestEnv, limit: number): Promise<HotelRow[]> {
  const PAGE = 400;
  let from = 0;
  const out: HotelRow[] = [];
  for (;;) {
    const r = await fetch(
      `${env.restBase}/hotels?is_published=eq.true&description_fr=not.is.null&select=${SELECT}&order=slug.asc`,
      { headers: pgHeaders(env, { Range: `${from}-${from + PAGE - 1}` }) },
    );
    if (!r.ok) throw new Error(`PostgREST page failed: ${r.status}`);
    const batch = (await r.json()) as HotelRow[];
    for (const h of batch) {
      if (needsEn(h)) out.push(h);
      if (limit > 0 && out.length >= limit) return out;
    }
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

async function patchHotel(
  env: PostgrestEnv,
  slug: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const r = await fetch(`${env.restBase}/hotels?slug=eq.${encodeURIComponent(slug)}`, {
    method: 'PATCH',
    headers: pgHeaders(env, { Prefer: 'return=minimal' }),
    body: JSON.stringify(patch),
  });
  if (!r.ok)
    throw new Error(
      `PostgREST PATCH ${slug} failed: ${r.status} ${(await r.text()).slice(0, 200)}`,
    );
}

/* ── LLM ────────────────────────────────────────────────────────────────── */

const DescEnSchema = z.object({ description_en: z.string().min(50) });

const SYSTEM = `Tu es traductrice-éditrice senior pour MyConciergeHotel.com, agence IATA de palaces.
On te donne la description éditoriale d'une fiche d'hôtel, en français. Tu produis la version ANGLAISE.

Règles strictes :
- Ce n'est PAS une traduction littérale mot-à-mot : c'est une réécriture native en anglais britannique (en-GB), fluide et élégante, dans le MÊME registre éditorial, fidèle au sens et au ton du français.
- Préserve EXACTEMENT tous les chiffres, prix (en euros TTC), horaires, distances, noms propres, noms de chefs, distinctions (Michelin, Atout France, Relais & Châteaux).
- N'invente AUCUN fait absent du français. Si le français ne dit pas, l'anglais ne dit pas.
- Conserve une longueur comparable au français (ne résume pas, ne tronque pas).
- AUCUN méta-commentaire de pipeline : jamais "the brief", "AUTO_DRAFT", "pending", "confidence level", d'identifiant Wikidata, ni de backticks. Prose publiable uniquement.
- Aucune balise HTML, aucun emoji.

JSON STRICT : { "description_en": "..." }.`;

async function callJson(openai: OpenAI, user: string): Promise<unknown> {
  const res = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 4000,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: user },
    ],
  });
  return JSON.parse(res.choices[0]?.message.content ?? '') as unknown;
}

async function runWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (t: T, i: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, concurrency) }).map(async () => {
      for (;;) {
        const i = next++;
        if (i >= items.length) return;
        results[i] = await fn(items[i] as T, i);
      }
    }),
  );
  return results;
}

/* ── Per-hotel ──────────────────────────────────────────────────────────── */

interface OneResult {
  readonly slug: string;
  readonly chars: number;
  readonly leakDropped: boolean;
  readonly ok: boolean;
}

async function translateOne(
  openai: OpenAI,
  env: PostgrestEnv,
  hotel: HotelRow,
  dryRun: boolean,
): Promise<OneResult> {
  const fr = (hotel.description_fr ?? '').trim();
  if (fr.length < FR_MIN_CHARS) return { slug: hotel.slug, chars: 0, leakDropped: false, ok: true };

  const user = `Hôtel : ${hotel.name} (${hotel.city ?? '?'}, ${hotel.region ?? '?'}).\nTraduis en anglais cette description :\n\n${fr}`;

  let parsed: z.infer<typeof DescEnSchema> | null = null;
  for (let attempt = 0; attempt < 3 && parsed === null; attempt += 1) {
    try {
      const raw = await callJson(openai, user);
      const ok = DescEnSchema.safeParse(raw);
      if (ok.success) parsed = ok.data;
    } catch {
      parsed = null;
    }
  }
  if (parsed === null) return { slug: hotel.slug, chars: 0, leakDropped: false, ok: false };

  if (hasLeak(parsed.description_en)) {
    return { slug: hotel.slug, chars: 0, leakDropped: true, ok: false };
  }

  if (!dryRun) {
    await patchHotel(env, hotel.slug, { description_en: parsed.description_en });
  }
  return { slug: hotel.slug, chars: parsed.description_en.length, leakDropped: false, ok: true };
}

/* ── CLI ────────────────────────────────────────────────────────────────── */

interface CliArgs {
  readonly slugs: readonly string[];
  readonly all: boolean;
  readonly limit: number;
  readonly concurrency: number;
  readonly dryRun: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let slugs: string[] = [];
  let all = false;
  let limit = 0;
  let concurrency = 4;
  let dryRun = false;
  for (const a of argv) {
    if (a === '--dry-run') dryRun = true;
    else if (a === '--all') all = true;
    else if (a.startsWith('--slug=')) slugs = [a.slice('--slug='.length)];
    else if (a.startsWith('--slugs=')) {
      slugs = a
        .slice('--slugs='.length)
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    } else if (a.startsWith('--limit=')) {
      const n = Number(a.slice('--limit='.length));
      if (Number.isFinite(n) && n >= 0) limit = Math.floor(n);
    } else if (a.startsWith('--concurrency=')) {
      const n = Number(a.slice('--concurrency='.length));
      if (Number.isFinite(n) && n > 0) concurrency = Math.min(8, Math.floor(n));
    }
  }
  return { slugs, all, limit, concurrency, dryRun };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.all && args.slugs.length === 0)
    throw new Error('Pass --slug=foo, --slugs=a,b,c or --all.');
  if (!process.env['OPENAI_API_KEY']) throw new Error('OPENAI_API_KEY missing in .env.local');

  const env = loadPostgrestEnv();
  const openai = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] });

  let hotels = args.all
    ? await fetchAllNeedingEn(env, args.limit)
    : await fetchHotelsBySlug(env, args.slugs);
  if (!args.all) hotels = hotels.filter(needsEn);
  console.log(
    `[translate-description-en] hotels=${hotels.length} concurrency=${args.concurrency} dryRun=${args.dryRun}`,
  );
  if (hotels.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  let done = 0;
  const results = await runWithConcurrency(hotels, args.concurrency, async (hotel) => {
    const t0 = Date.now();
    let r: OneResult;
    try {
      r = await translateOne(openai, env, hotel, args.dryRun);
    } catch (err) {
      r = { slug: hotel.slug, chars: 0, leakDropped: false, ok: false };
      console.error(`  ✗ ${hotel.slug}: ${err instanceof Error ? err.message : String(err)}`);
    }
    done += 1;
    console.log(
      `  [${done}/${hotels.length}] ${r.ok ? '✓' : '✗'} ${r.slug} — EN ${r.chars}c` +
        (r.leakDropped ? ' (leak-dropped)' : '') +
        ` (${((Date.now() - t0) / 1000).toFixed(1)}s)`,
    );
    return r;
  });

  const okCount = results.filter((r) => r.ok).length;
  const totalLeak = results.filter((r) => r.leakDropped).length;
  console.log(
    `[translate-description-en] Done — ${okCount}/${hotels.length} fiches translated, ${totalLeak} leak-dropped.`,
  );

  const RUNLOG_DIR = resolve(__dirname, '../../runs');
  mkdirSync(RUNLOG_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  writeFileSync(
    resolve(RUNLOG_DIR, `translate-description-en-${ts}.json`),
    `${JSON.stringify({ finishedAt: new Date().toISOString(), args, results }, null, 2)}\n`,
  );
}

main().catch((err: unknown) => {
  console.error(
    '[translate-description-en] FATAL',
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});
