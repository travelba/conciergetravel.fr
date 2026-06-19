/**
 * translate-sections-en.ts — EN parity backfill for `long_description_sections`.
 *
 * Why this exists: `enrich-hotel-content.ts` generates the long-read story FR-
 * first and leaves `_en` optional ("Tu peux laisser `_en` vides si tu n'es pas
 * sûr"). A 2026-06-19 catalogue audit found 747 published fiches with ZERO
 * English section bodies and 417 with partial EN — i.e. ~52 % of the catalogue
 * serves French prose on the `/en` hotel page (the FR fallback in
 * `pickLocalizedText`). English is a V1 locale, so this is a real GEO/SEO hole.
 *
 * This pass translates the missing `title_en` / `body_en` of each section from
 * the FR canonical, faithfully (numbers / proper nouns / prices preserved, no
 * invented facts), in British English, preserving every existing field and the
 * section order. Idempotent: a section already carrying non-empty EN is skipped.
 *
 * Anti-scaffolding: the EN output runs through the shared `hasLeak()` gate — a
 * translation that re-introduces pipeline meta-commentary is dropped, never
 * persisted (see ADR-0029 / enrich-hotel-content leak gate).
 *
 * CLI:
 *   --slug=foo                 single hotel
 *   --slugs=a,b,c              explicit list
 *   --all                      every published fiche missing EN sections
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

interface Section {
  anchor?: unknown;
  title_fr?: unknown;
  title_en?: unknown;
  body_fr?: unknown;
  body_en?: unknown;
  [k: string]: unknown;
}

interface HotelRow {
  slug: string;
  name: string;
  city: string | null;
  region: string | null;
  long_description_sections: Section[] | null;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const nonEmpty = (v: unknown): boolean => typeof v === 'string' && v.trim().length > 0;

/** A section needs EN work if it has FR body but is missing EN title or body. */
function sectionNeedsEn(s: Section): boolean {
  return nonEmpty(s.body_fr) && (!nonEmpty(s.body_en) || !nonEmpty(s.title_en));
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

async function fetchHotelsBySlug(env: PostgrestEnv, slugs: readonly string[]): Promise<HotelRow[]> {
  const params = new URLSearchParams();
  params.set('select', 'slug,name,city,region,long_description_sections');
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
      `${env.restBase}/hotels?is_published=eq.true&long_description_sections=not.is.null&select=slug,name,city,region,long_description_sections&order=slug.asc`,
      { headers: pgHeaders(env, { Range: `${from}-${from + PAGE - 1}` }) },
    );
    if (!r.ok) throw new Error(`PostgREST page failed: ${r.status}`);
    const batch = (await r.json()) as HotelRow[];
    for (const h of batch) {
      if ((h.long_description_sections ?? []).some(sectionNeedsEn)) out.push(h);
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

/** Clamp an over-long LLM title to `max` chars at a word boundary (self-heal
 * the deterministic shape rather than reject the whole batch — llm-output-
 * robustness §post-validation). */
function clampTitle(v: unknown): unknown {
  if (typeof v !== 'string' || v.length <= 140) return v;
  const slice = v.slice(0, 140);
  const sp = slice.lastIndexOf(' ');
  return (sp > 60 ? slice.slice(0, sp) : slice).trim();
}

const SectionEnSchema = z.object({
  anchor: z.string().min(1),
  title_en: z.preprocess(clampTitle, z.string().min(3).max(140)),
  body_en: z.string().min(80),
});

/** Defensively pull the section array out of whatever shape the model returned
 * ({sections:[…]} | {items:[…]} | bare array) without throwing. */
function extractSections(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw !== null && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o['sections'])) return o['sections'];
    if (Array.isArray(o['items'])) return o['items'];
  }
  return [];
}

const SYSTEM = `Tu es traductrice-éditrice senior pour MyConciergeHotel.com, agence IATA de palaces.
On te donne des sections éditoriales longues d'une fiche d'hôtel, en français. Tu produis la version ANGLAISE.

Règles strictes :
- Ce n'est PAS une traduction littérale mot-à-mot : c'est une réécriture native en anglais britannique (en-GB), fluide et élégante, dans le MÊME registre "long-read Condé Nast Traveler", fidèle au sens et au ton du français.
- Préserve EXACTEMENT tous les chiffres, prix (en euros TTC), horaires, distances, noms propres, noms de chefs, distinctions (Michelin, Atout France, Relais & Châteaux).
- N'invente AUCUN fait absent du français. Si le français ne dit pas, l'anglais ne dit pas.
- Conserve une longueur comparable au français (ne résume pas, ne tronque pas).
- AUCUN méta-commentaire de pipeline : jamais "the brief", "AUTO_DRAFT", "pending", "confidence level", d'identifiant Wikidata, ni de backticks. Prose publiable uniquement.
- Aucune balise HTML, aucun emoji.

Pour CHAQUE section reçue, renvoie l'anchor à l'identique + title_en + body_en.
JSON STRICT : { "sections": [{ "anchor": "<anchor à l'identique>", "title_en": "...", "body_en": "..." }] }.`;

async function callJson(openai: OpenAI, user: string): Promise<unknown> {
  const res = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 16000,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: user },
    ],
  });
  return JSON.parse(res.choices[0]?.message.content ?? '') as unknown;
}

function chunk<T>(arr: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Sections per LLM call — small enough that 16k output tokens never truncate
 * a fiche with 350-word EN bodies (the 2026-06-19 failures were 9-10 section
 * fiches whose single-call output overflowed and failed JSON.parse 3×). */
const SECTIONS_PER_CALL = 4;

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
  readonly translated: number;
  readonly leakDropped: number;
  readonly total: number;
  readonly ok: boolean;
}

async function translateOne(
  openai: OpenAI,
  env: PostgrestEnv,
  hotel: HotelRow,
  dryRun: boolean,
): Promise<OneResult> {
  const sections = Array.isArray(hotel.long_description_sections)
    ? hotel.long_description_sections.map((s) => ({ ...s }))
    : [];
  const missing = sections.filter(sectionNeedsEn);
  if (missing.length === 0) {
    return { slug: hotel.slug, translated: 0, leakDropped: 0, total: sections.length, ok: true };
  }

  const byAnchor = new Map<string, Section>();
  for (const s of sections) if (nonEmpty(s.anchor)) byAnchor.set(str(s.anchor), s);

  let translated = 0;
  let leakDropped = 0;
  let parseFails = 0;
  // Batch sections so a single LLM response never overflows 16k output tokens.
  const batches = chunk(missing, SECTIONS_PER_CALL);
  for (let b = 0; b < batches.length; b += 1) {
    const batch = batches[b] as Section[];
    const payload = batch.map((s) => ({
      anchor: str(s.anchor),
      title_fr: str(s.title_fr),
      body_fr: str(s.body_fr),
    }));
    const user = `Hôtel : ${hotel.name} (${hotel.city ?? '?'}, ${hotel.region ?? '?'}).\nTraduis en anglais ces ${payload.length} section(s) :\n${JSON.stringify(payload, null, 2)}`;

    // Tolerant parse: get whatever sections the model returned, then validate
    // each one INDIVIDUALLY — one malformed section must not sink the batch.
    let rawSections: unknown[] = [];
    for (let attempt = 0; attempt < 3 && rawSections.length === 0; attempt += 1) {
      try {
        rawSections = extractSections(await callJson(openai, user));
      } catch {
        rawSections = [];
      }
    }
    if (rawSections.length === 0) {
      parseFails += 1;
      continue;
    }
    rawSections.forEach((rawItem, i) => {
      const ok = SectionEnSchema.safeParse(rawItem);
      if (!ok.success) return;
      const out = ok.data;
      // Match by anchor; fall back to positional index when the model alters it.
      const target = byAnchor.get(out.anchor) ?? (batch[i] as Section | undefined);
      if (target === undefined) return;
      // Anti-scaffolding gate — never persist a leaking EN translation.
      if (hasLeak(out.title_en) || hasLeak(out.body_en)) {
        leakDropped += 1;
        return;
      }
      target.title_en = out.title_en;
      target.body_en = out.body_en;
      translated += 1;
    });
  }

  if (!dryRun && translated > 0) {
    await patchHotel(env, hotel.slug, { long_description_sections: sections });
  }
  return {
    slug: hotel.slug,
    translated,
    leakDropped,
    total: sections.length,
    ok: translated > 0 && parseFails === 0,
  };
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

  const hotels = args.all
    ? await fetchAllNeedingEn(env, args.limit)
    : await fetchHotelsBySlug(env, args.slugs);
  console.log(
    `[translate-sections-en] hotels=${hotels.length} concurrency=${args.concurrency} dryRun=${args.dryRun}`,
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
      r = { slug: hotel.slug, translated: 0, leakDropped: 0, total: 0, ok: false };
      console.error(`  ✗ ${hotel.slug}: ${err instanceof Error ? err.message : String(err)}`);
    }
    done += 1;
    console.log(
      `  [${done}/${hotels.length}] ${r.ok ? '✓' : '✗'} ${r.slug} — EN+${r.translated}/${r.total}` +
        (r.leakDropped > 0 ? ` (leak-dropped ${r.leakDropped})` : '') +
        ` (${((Date.now() - t0) / 1000).toFixed(1)}s)`,
    );
    return r;
  });

  const okCount = results.filter((r) => r.ok).length;
  const totalTranslated = results.reduce((a, b) => a + b.translated, 0);
  const totalLeak = results.reduce((a, b) => a + b.leakDropped, 0);
  console.log(
    `[translate-sections-en] Done — ${okCount}/${hotels.length} fiches, ${totalTranslated} sections translated, ${totalLeak} leak-dropped.`,
  );

  const RUNLOG_DIR = resolve(__dirname, '../../runs');
  mkdirSync(RUNLOG_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  writeFileSync(
    resolve(RUNLOG_DIR, `translate-sections-en-${ts}.json`),
    `${JSON.stringify({ finishedAt: new Date().toISOString(), args, results }, null, 2)}\n`,
  );
}

main().catch((err: unknown) => {
  console.error('[translate-sections-en] FATAL', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
