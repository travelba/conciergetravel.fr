/**
 * CLI — re-anchor the FAQ of a CURATED `editorial_rankings` row on real
 * search demand (DataForSEO People-Also-Ask) WITHOUT touching its
 * curated `editorial_ranking_entries`.
 *
 * Mission P1-4 + P1-5 of the SEO/GEO backlog ("battre yonder.fr"):
 * strategic FR rankings (palaces / grandes villes / régions phares)
 * must answer the questions French travellers actually type into Google
 * and ChatGPT — not LLM-invented ones. This pulls the PAA via the
 * existing grounding layer (`grounding/keyword-grounding.ts`, disk-cached
 * in `data/dfs-cache/`), injects them into the canonical FAQ prompt, and
 * PATCHes ONLY the `faq` column.
 *
 * What it does:
 *   1. Loads the existing row by slug (id, title, kind, axes,
 *      editorial_sections) — including drafts (for safety; we only run
 *      published strategic slugs in practice).
 *   2. Derives grounding seeds from the title scope + theme, grounds them
 *      via DataForSEO (PAA + related searches + top keywords).
 *   3. Calls Call FAQ (single LLM call) with the canonical 10-theme block
 *      + the real PAA injected as priority questions.
 *   4. Validates: postValidateFaq (clamp 10-15, canonical coverage log),
 *      the shared scaffolding-gate (drop any leaking entry), a soft
 *      ≤25-words/sentence check (Concierge voice), and remaps any
 *      contextual `section_anchor` not present on the row to `null` (so
 *      the Q&A renders globally instead of vanishing).
 *   5. PATCHes ONLY `faq` (curated entries / sections / intro / outro all
 *      preserved). Writes a resume-safe done-marker.
 *
 * What it does NOT do:
 *   - Touch `editorial_ranking_entries` (separate table — never queried).
 *   - Regenerate `editorial_sections` / `intro` / `outro` / `meta_*`.
 *   - Create any new slug (out of scope — another worker owns that).
 *
 * Quota discipline (shared OpenAI budget): concurrency capped at 2,
 * exponential backoff on HTTP 429, resume-safe done-markers
 * (`data/rankings-faq-grounded/<slug>.json`), DFS disk cache reused.
 * On a persistent 429 (or hard `insufficient_quota`) it stops cleanly,
 * leaving every already-patched slug persisted, and reports where it
 * stopped.
 *
 * Modes:
 *   --slugs=a,b,c            explicit slug list (required unless --slugs-file)
 *   --slugs-file=<path>      newline-separated slug list
 *   --concurrency=<N>        parallel slugs (default 2, HARD max 2)
 *   --dry-run                generate + print, do NOT PATCH / mark done
 *   --force                  ignore done-markers (re-run cached slugs)
 *   --location=<name>        DFS location (default "France")
 *   --language=<code>        DFS language (default "fr")
 *
 * Examples:
 *   pnpm tsx src/rankings/enrich-ranking-faq-grounded.ts --slugs=meilleurs-palaces-paris --dry-run
 *   pnpm tsx src/rankings/enrich-ranking-faq-grounded.ts --slugs-file=tmp-strategic-slugs.txt
 *
 * Skill: keyword-grounding-dataforseo, editorial-rankings-matrix,
 * concierge-voice-pipeline, llm-output-robustness.
 */

import { config as loadDotenv } from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

import { loadEnv, resolveProvider } from '../env.js';
import { buildLlmClient, type LlmClient } from '../llm.js';
import { loadDfsConfig } from '../grounding/env-dfs.js';
import {
  groundKeywords,
  renderGroundingForPrompt,
  type GroundingLocale,
  type KeywordGrounding,
} from '../grounding/keyword-grounding.js';
import { hasLeak, maxSentenceWords } from '../enrichment/scaffolding-gate.js';
import type { RankingSeed, RankingKind } from './rankings-catalog.js';
import type { HotelCatalogRow } from './load-hotels-catalog.js';
import {
  CallFaqSchema,
  FaqSchema,
  SYSTEM_PROMPT,
  buildPromptCallFaq,
  callLlm,
  postValidateFaq,
} from './generate-ranking-v2.js';
import { updateRankingFaq, type SupabaseRestConfig } from './supabase-rankings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

const DONE_DIR = resolve(__dirname, '../../data/rankings-faq-grounded');

const SupabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(40),
});

const KIND_VALUES: readonly RankingKind[] = ['best_of', 'awarded', 'thematic', 'geographic'];
const isRankingKind = (s: string): s is RankingKind =>
  (KIND_VALUES as readonly string[]).includes(s);

/** Hard sentinel: a persistent rate-limit / quota stop. Aborts the batch. */
class RateLimitAbort extends Error {}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

interface ParsedArgs {
  readonly slugs: readonly string[];
  readonly concurrency: number;
  readonly dryRun: boolean;
  readonly force: boolean;
  readonly locale: GroundingLocale;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const map = new Map<string, string | true>();
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq === -1) map.set(arg.slice(2), true);
    else map.set(arg.slice(2, eq), arg.slice(eq + 1));
  }

  const splitList = (raw: string): string[] =>
    raw
      .split(/[\s,]+/u)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

  let slugs: string[] = [];
  const slugsRaw = map.get('slugs');
  if (typeof slugsRaw === 'string') slugs = splitList(slugsRaw);
  const fileRaw = map.get('slugs-file');
  if (typeof fileRaw === 'string') {
    try {
      const txt = readFileSync(resolve(process.cwd(), fileRaw), 'utf8');
      slugs.push(...splitList(txt));
    } catch {
      console.error(`Cannot read --slugs-file=${fileRaw}`);
      process.exit(1);
    }
  }
  slugs = [...new Set(slugs)];
  if (slugs.length === 0) {
    console.error(
      'Usage: --slugs=a,b,c | --slugs-file=path [--dry-run] [--force] [--concurrency=2]',
    );
    process.exit(1);
  }

  const concRaw = map.get('concurrency');
  // HARD cap at 2 — shared OpenAI quota with two other workers.
  const concurrency = typeof concRaw === 'string' ? Math.min(2, Math.max(1, Number(concRaw))) : 2;

  const locationRaw = map.get('location');
  const languageRaw = map.get('language');
  const locale: GroundingLocale = {
    locationName:
      typeof locationRaw === 'string' && locationRaw.length > 0 ? locationRaw : 'France',
    languageCode: typeof languageRaw === 'string' && languageRaw.length > 0 ? languageRaw : 'fr',
  };

  return {
    slugs,
    concurrency,
    dryRun: map.get('dry-run') === true,
    force: map.get('force') === true,
    locale,
  };
}

// ─── DB row (custom select incl. axes + faq) ──────────────────────────

interface StrategicRow {
  readonly id: string;
  readonly slug: string;
  readonly title_fr: string;
  readonly title_en: string;
  readonly kind: string;
  readonly axes: unknown;
  readonly editorial_sections: unknown;
  readonly is_published: boolean;
}

async function fetchRow(cfg: SupabaseRestConfig, slug: string): Promise<StrategicRow | null> {
  const select = 'id,slug,title_fr,title_en,kind,axes,editorial_sections,is_published';
  const url = `${cfg.url}/rest/v1/editorial_rankings?select=${select}&slug=eq.${encodeURIComponent(slug)}&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[fetchRow ${slug}] ${res.status}: ${body.slice(0, 200)}`);
  }
  const arr = (await res.json()) as StrategicRow[];
  return Array.isArray(arr) && arr.length > 0 ? (arr[0] ?? null) : null;
}

function sectionKeys(sections: unknown): readonly string[] {
  if (!Array.isArray(sections)) return [];
  const out: string[] = [];
  for (const s of sections) {
    if (typeof s === 'object' && s !== null) {
      const k = (s as Record<string, unknown>)['key'];
      if (typeof k === 'string' && k.length > 0) out.push(k);
    }
  }
  return out;
}

function lieuLabelFromAxes(axes: unknown): string | null {
  if (typeof axes !== 'object' || axes === null) return null;
  const lieu = (axes as Record<string, unknown>)['lieu'];
  if (typeof lieu !== 'object' || lieu === null) return null;
  const label = (lieu as Record<string, unknown>)['label'];
  return typeof label === 'string' && label.length > 0 ? label : null;
}

/** Strip the leading editorial framing from a title for a clean place anchor. */
function scopeLabelFromTitle(title: string): string {
  return title
    .replace(
      /^(les\s+)?(meilleurs|meilleures|plus\s+beaux|plus\s+belles|top|notre\s+sélection)\s+/iu,
      '',
    )
    .replace(
      /^(palaces?|hôtels?|villas?|chalets?|resorts?|châteaux[-\s]?hôtels?|maisons?\s+d['’]hôtes?)\s+/iu,
      '',
    )
    .replace(/^(de\s+la|de\s+l['’]|du|des|de|d['’]|en|à|au|aux)\s+/iu, '')
    .trim();
}

/** Theme term used as a grounding seed prefix, derived from the slug. */
function themeTermFromSlug(slug: string): string {
  const t: ReadonlyArray<readonly [RegExp, string]> = [
    [/palace/u, 'palaces'],
    [/5-etoiles|cinq-etoiles/u, 'hôtels 5 étoiles'],
    [/chateaux/u, 'châteaux-hôtels'],
    [/maisons-hotes/u, "maisons d'hôtes"],
    [/chalet/u, 'chalets de luxe'],
    [/villa/u, 'villas de luxe'],
    [/resort/u, 'resorts de luxe'],
    [/spa/u, 'hôtels spa'],
    [/romantique/u, 'hôtels romantiques'],
    [/famille|kids/u, 'hôtels famille'],
    [/gastronomie/u, 'hôtels gastronomiques'],
    [/piscine/u, 'hôtels avec piscine'],
    [/bord-de-mer/u, 'hôtels bord de mer'],
    [/ski|montagne/u, 'hôtels montagne'],
    [/design/u, 'hôtels design'],
    [/charme/u, 'hôtels de charme'],
    [/golf/u, 'hôtels golf'],
    [/rooftop/u, 'hôtels rooftop'],
    [/vignoble/u, 'hôtels vignoble'],
  ];
  for (const [re, term] of t) if (re.test(slug)) return term;
  return 'hôtels de luxe';
}

function buildSeeds(row: StrategicRow): string[] {
  const lieu = lieuLabelFromAxes(row.axes) ?? scopeLabelFromTitle(row.title_fr);
  const theme = themeTermFromSlug(row.slug);
  const seeds = [`meilleurs hôtels ${lieu}`, `${theme} ${lieu}`, `hôtel ${lieu}`].map((s) =>
    s.replace(/\s+/gu, ' ').trim(),
  );
  return [...new Set(seeds)];
}

/** Append the real-demand grounding block + answer-first GEO directive. */
function buildGroundedFaqPrompt(
  seed: RankingSeed,
  anchors: readonly string[],
  grounding: KeywordGrounding,
): string {
  const base = buildPromptCallFaq(seed, anchors);
  const groundingBlock = renderGroundingForPrompt(grounding);
  if (groundingBlock.length === 0) return base;
  const directive = [
    '',
    '### ANCRAGE SUR LA DEMANDE RÉELLE (PRIORITÉ)',
    '- Garde les 10 thèmes canoniques, mais REFORMULE leurs `question_fr` pour matcher mot-pour-mot les People-Also-Ask ci-dessous quand le thème recoupe une question réelle.',
    '- Utilise les entrées CONTEXTUELLES (jusqu’à 5) pour répondre aux People-Also-Ask réels NON couverts par le canonique.',
    '- Chaque `answer_fr` commence par la réponse directe (answer-first, citable par un LLM), puis 1-2 phrases de contexte. Aucune phrase > 25 mots.',
    '- N’intègre QUE les questions pertinentes pour ce classement. N’invente aucun fait pour matcher un mot-clé.',
    '',
    groundingBlock,
  ].join('\n');
  return `${base}\n${directive}`;
}

interface FaqEntry {
  question_fr: string;
  question_en: string;
  answer_fr: string;
  answer_en: string;
  section_anchor?: string | null;
}

/**
 * Drop FAQ entries carrying a scaffolding leak; remap unknown
 * `section_anchor` to null; report soft ≤25-words violations.
 */
function sanitizeFaq(
  faq: ReadonlyArray<z.infer<typeof FaqSchema>>,
  anchors: readonly string[],
  slug: string,
): FaqEntry[] {
  const anchorSet = new Set(anchors);
  const out: FaqEntry[] = [];
  let dropped = 0;
  let longSentences = 0;
  for (const f of faq) {
    const blob = `${f.question_fr}\n${f.answer_fr}\n${f.question_en}\n${f.answer_en}`;
    if (hasLeak(blob)) {
      dropped += 1;
      continue;
    }
    if (maxSentenceWords(f.answer_fr) > 25 || maxSentenceWords(f.question_fr) > 25) {
      longSentences += 1;
    }
    const anchor =
      typeof f.section_anchor === 'string' && anchorSet.has(f.section_anchor)
        ? f.section_anchor
        : null;
    out.push({
      question_fr: f.question_fr,
      question_en: f.question_en,
      answer_fr: f.answer_fr,
      answer_en: f.answer_en,
      section_anchor: anchor,
    });
  }
  if (dropped > 0)
    console.warn(`  ⚠ [${slug}] dropped ${dropped} FAQ entr(y/ies) for scaffolding leak.`);
  if (longSentences > 0)
    console.warn(
      `  ⚠ [${slug}] ${longSentences} FAQ entr(y/ies) carry a >25-word sentence (soft).`,
    );
  return out;
}

interface SlugResult {
  readonly slug: string;
  readonly status: 'patched' | 'dry-run' | 'skipped' | 'not-found' | 'aborted' | 'error';
  readonly paa: number;
  readonly faqCount: number;
  readonly note?: string;
}

async function isDone(slug: string): Promise<boolean> {
  return existsSync(resolve(DONE_DIR, `${slug}.json`));
}

async function markDone(slug: string, meta: Record<string, unknown>): Promise<void> {
  try {
    await mkdir(DONE_DIR, { recursive: true });
    await writeFile(
      resolve(DONE_DIR, `${slug}.json`),
      JSON.stringify({ slug, ...meta, at: new Date().toISOString() }, null, 2),
      'utf8',
    );
  } catch {
    // best-effort
  }
}

/** Single Call FAQ with exponential backoff on transient 429s. */
async function callFaqWithBackoff(
  llm: LlmClient,
  prompt: string,
  label: string,
): Promise<z.infer<typeof CallFaqSchema>> {
  const delays = [15_000, 30_000, 60_000, 120_000];
  let attempt = 0;
  for (;;) {
    try {
      return await callLlm(llm, SYSTEM_PROMPT, prompt, CallFaqSchema, label);
    } catch (err) {
      const msg = (err as Error).message;
      if (/insufficient_quota|exceeded your current quota/iu.test(msg)) {
        throw new RateLimitAbort(`hard quota: ${msg}`);
      }
      const is429 = /\b429\b|rate.?limit|too many requests/iu.test(msg);
      if (!is429) throw err; // schema/JSON failure already retried 3× inside callLlm
      if (attempt >= delays.length) {
        throw new RateLimitAbort(`persistent 429 after ${delays.length} backoffs: ${msg}`);
      }
      const d = delays[attempt]!;
      console.warn(
        `  ⏳ [${label}] 429 — backoff ${d / 1000}s (try ${attempt + 1}/${delays.length})`,
      );
      await sleep(d);
      attempt += 1;
    }
  }
}

async function processSlug(
  ctx: {
    readonly cfg: SupabaseRestConfig;
    readonly llm: LlmClient;
    readonly dfsCfg: ReturnType<typeof loadDfsConfig>;
    readonly args: ParsedArgs;
  },
  slug: string,
): Promise<SlugResult> {
  const { cfg, llm, dfsCfg, args } = ctx;

  if (!args.force && (await isDone(slug))) {
    console.log(`[${slug}] ⏭  done-marker present — skip (use --force to rerun).`);
    return { slug, status: 'skipped', paa: 0, faqCount: 0 };
  }

  const row = await fetchRow(cfg, slug);
  if (row === null) {
    console.warn(`[${slug}] ✗ not found in editorial_rankings.`);
    return { slug, status: 'not-found', paa: 0, faqCount: 0 };
  }
  if (!isRankingKind(row.kind)) {
    console.warn(`[${slug}] ✗ unexpected kind="${row.kind}".`);
    return { slug, status: 'error', paa: 0, faqCount: 0, note: `kind=${row.kind}` };
  }

  const anchors = sectionKeys(row.editorial_sections);
  const seeds = buildSeeds(row);
  console.log(`[${slug}] kind=${row.kind} • seeds=[${seeds.join(' | ')}]`);

  // ── DataForSEO grounding (disk-cached) ──
  const grounding = await groundKeywords(dfsCfg, seeds, args.locale);
  const paaCount = grounding.peopleAlsoAsk.length;
  console.log(
    `[${slug}]    grounded=${grounding.grounded} • PAA=${paaCount} • related=${grounding.relatedSearches.length} • kw=${grounding.topKeywords.length}`,
  );

  const seed: RankingSeed = {
    slug: row.slug,
    titleFr: row.title_fr,
    titleEn: row.title_en,
    kind: row.kind,
    targetLength: anchors.length > 0 ? anchors.length : 10,
    keywordsFr: grounding.topKeywords.slice(0, 8).map((k) => k.keyword),
    eligibility: (_h: HotelCatalogRow) => false,
  };

  const prompt = buildGroundedFaqPrompt(seed, anchors, grounding);
  console.log(`[${slug}] → Call FAQ (grounded)…`);
  const callFaq = await callFaqWithBackoff(llm, prompt, `faq-grounded ${slug}`);

  const cleaned = postValidateFaq(callFaq.faq, slug);
  const sanitized = sanitizeFaq(cleaned, anchors, slug);
  console.log(`[${slug}]    faq: ${sanitized.length} entries (post-gate).`);

  if (sanitized.length < 8) {
    // Safety: never overwrite a healthy FAQ with a thin one.
    console.warn(
      `[${slug}] ✗ only ${sanitized.length} clean entries — refusing to PATCH (kept existing).`,
    );
    return { slug, status: 'error', paa: paaCount, faqCount: sanitized.length, note: 'too-thin' };
  }

  if (args.dryRun) {
    console.log(`— DRY RUN [${slug}] — first 2 entries:`);
    console.log(JSON.stringify(sanitized.slice(0, 2), null, 2));
    return { slug, status: 'dry-run', paa: paaCount, faqCount: sanitized.length };
  }

  await updateRankingFaq(cfg, row.id, sanitized);
  await markDone(slug, {
    paa: paaCount,
    faqCount: sanitized.length,
    seeds,
    grounded: grounding.grounded,
  });
  console.log(`[${slug}] ✓ PATCHed faq (${sanitized.length} entries, ${paaCount} PAA grounded).`);
  return { slug, status: 'patched', paa: paaCount, faqCount: sanitized.length };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const env = loadEnv();
  const provider = resolveProvider(env);
  const llm = buildLlmClient(env, provider);

  const supaParsed = SupabaseEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env['NEXT_PUBLIC_SUPABASE_URL'],
    SUPABASE_SERVICE_ROLE_KEY: process.env['SUPABASE_SERVICE_ROLE_KEY'],
  });
  if (!supaParsed.success) {
    console.error('Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
    process.exit(1);
  }
  const cfg: SupabaseRestConfig = {
    url: supaParsed.data.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: supaParsed.data.SUPABASE_SERVICE_ROLE_KEY,
  };

  const dfsCfg = loadDfsConfig();
  if (dfsCfg === null) {
    console.warn(
      '⚠ DataForSEO is OFF/unconfigured — FAQ will regenerate WITHOUT real PAA grounding. Set DATAFORSEO_ENABLED=true to ground.',
    );
  }

  console.log(
    `\n=== Grounded FAQ enricher — ${args.slugs.length} slug(s), concurrency=${args.concurrency}${args.dryRun ? ' [DRY RUN]' : ''}${args.force ? ' [FORCE]' : ''} ===\n`,
  );

  const ctx = { cfg, llm, dfsCfg, args } as const;
  const results: SlugResult[] = [];
  let aborted = false;
  let abortNote = '';
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (!aborted && cursor < args.slugs.length) {
      const i = cursor;
      cursor += 1;
      const slug = args.slugs[i]!;
      try {
        results.push(await processSlug(ctx, slug));
      } catch (err) {
        if (err instanceof RateLimitAbort) {
          aborted = true;
          abortNote = err.message;
          results.push({ slug, status: 'aborted', paa: 0, faqCount: 0, note: err.message });
          console.error(`\n🛑 [${slug}] RATE-LIMIT ABORT — stopping cleanly. ${err.message}`);
          return;
        }
        console.error(`[${slug}] ✗ error: ${(err as Error).message}`);
        results.push({ slug, status: 'error', paa: 0, faqCount: 0, note: (err as Error).message });
      }
    }
  };

  const n = Math.min(args.concurrency, args.slugs.length);
  await Promise.all(Array.from({ length: n }, () => worker()));

  // ── Summary ──
  console.log('\n=== SUMMARY ===');
  const by = (s: SlugResult['status']): SlugResult[] => results.filter((r) => r.status === s);
  const patched = by('patched');
  const dry = by('dry-run');
  console.log(`patched:   ${patched.length}`);
  console.log(`dry-run:   ${dry.length}`);
  console.log(`skipped:   ${by('skipped').length}`);
  console.log(`not-found: ${by('not-found').length}`);
  console.log(`error:     ${by('error').length}`);
  console.log(`aborted:   ${by('aborted').length}`);
  for (const r of results) {
    if (r.status === 'patched' || r.status === 'dry-run') {
      console.log(`  ✓ ${r.slug} — faq=${r.faqCount}, PAA=${r.paa}`);
    } else if (r.status !== 'skipped') {
      console.log(`  • ${r.slug} — ${r.status}${r.note ? ` (${r.note})` : ''}`);
    }
  }
  const totalPaa = [...patched, ...dry].reduce((a, r) => a + r.paa, 0);
  console.log(`\nTotal PAA grounded across treated slugs: ${totalPaa}`);
  if (aborted) {
    console.error(`\n🛑 Batch aborted on rate limit: ${abortNote}`);
    console.error(
      'Re-run the SAME command to resume — done-markers skip the already-patched slugs.',
    );
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
