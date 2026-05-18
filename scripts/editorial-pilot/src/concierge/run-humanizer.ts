/**
 * Vague 1 humanizer-pass — applique uniquement le Pass 8 voix Concierge
 * sur les hôtels déjà enrichis (sans rejouer les passes 1-7).
 *
 * Stratégie ADR-0011 Phase 3 : on conserve le corps factuel existant
 * (`long_description_sections`, `faq_content`, `signature_experiences`),
 * on génère uniquement le bloc `concierge_advice` (FR + EN) en feedant
 * au LLM un brief synthétique reconstruit depuis Supabase + le lead
 * actuel (description_fr).
 *
 * Usage:
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/concierge/run-humanizer.ts --slug le-bristol-paris
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/concierge/run-humanizer.ts --all --concurrency 4
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/concierge/run-humanizer.ts --missing --concurrency 4
 *
 * Flags:
 *   --slug <s>       cible un seul hôtel
 *   --all            tous les hôtels publiés (avec ou sans concierge_advice)
 *   --missing        seulement les hôtels publiés sans concierge_advice
 *   --concurrency N  parallélisme (défaut: 1 — séquentiel)
 *   --dry-run        affiche sans écrire en base
 *   --no-en          ne demande pas la traduction EN (FR uniquement)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';

import { buildLlmClient } from '../llm.js';
import { loadEnv, resolveProvider } from '../env.js';
import { ConciergePass8OutputSchema, type ConciergePass8Output } from '../schemas.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadDotenv({ path: path.resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: path.resolve(__dirname, '../../../../.env') });

const PROMPT_PATH = path.resolve(__dirname, '../../prompts/08-concierge-voice.md');

interface CliArgs {
  readonly slug: string | null;
  readonly slugs: readonly string[];
  readonly all: boolean;
  readonly missing: boolean;
  readonly invalid: boolean;
  readonly concurrency: number;
  readonly dryRun: boolean;
  readonly noEn: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let slug: string | null = null;
  let slugs: string[] = [];
  let all = false;
  let missing = false;
  let invalid = false;
  let concurrency = 1;
  let dryRun = false;
  let noEn = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--slug') {
      slug = argv[i + 1] ?? null;
      i += 1;
    } else if (a === '--slugs') {
      slugs = (argv[i + 1] ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      i += 1;
    } else if (a === '--all') {
      all = true;
    } else if (a === '--missing') {
      missing = true;
    } else if (a === '--invalid') {
      invalid = true;
    } else if (a === '--concurrency') {
      const n = Number(argv[i + 1] ?? '');
      if (Number.isFinite(n) && n >= 1 && n <= 16) concurrency = Math.floor(n);
      i += 1;
    } else if (a === '--dry-run') {
      dryRun = true;
    } else if (a === '--no-en') {
      noEn = true;
    }
  }
  return { slug, slugs, all, missing, invalid, concurrency, dryRun, noEn };
}

const ADVICE_MIN_WORDS = 50;
const ADVICE_MAX_WORDS = 110;

// Subset of `linter.ts` BANNED_BLOCKERS — kept local so the humanizer
// doesn't have to import the full lint module (which would pull in
// the markdown-specific helpers it doesn't need).
const VOICE_BANNED_REGEXES: readonly RegExp[] = [
  /\bniché[se]?\s+(?:au\s+cœur|entre)\b/iu,
  /^(\s*)découvrez\b/imu,
  /^(\s*)bienvenue\s+dans\b/imu,
  /^(\s*)plongez\s+dans\b/imu,
  /\bvues?\s+imprenables?\b/giu,
  /\bvues?\s+spectaculaires?\b/giu,
  /\bexpériences?\s+inoubliables?\b/giu,
  /\bcocons?\b/giu,
  /\bjoyaux?\b/giu,
  /\bécrins?\b/giu,
  /\bart\s+de\s+(?:recevoir|vivre)\b/giu,
];

function voiceViolates(body: string, maxWordsPerSentence = 25): boolean {
  for (const re of VOICE_BANNED_REGEXES) {
    if (new RegExp(re.source, re.flags).test(body)) return true;
  }
  const sentences = body
    .replace(/\.\.\./g, '.')
    .split(/(?<=[.!?…])\s+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const s of sentences) {
    const words = s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
    if (words > maxWordsPerSentence) return true;
  }
  return false;
}

function countWordsLocal(s: unknown): number {
  if (typeof s !== 'string') return 0;
  const t = s.trim();
  if (!t.length) return 0;
  return t.split(/[^\p{L}\p{N}]+/u).filter((x) => x.length > 0).length;
}

interface HotelRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly name_en: string | null;
  readonly city: string;
  readonly stars: number;
  readonly is_palace: boolean;
  readonly description_fr: string | null;
  readonly opened_at: string | null;
  readonly long_description_sections: unknown;
  readonly signature_experiences: unknown;
  readonly faq_content: unknown;
  readonly restaurant_info: unknown;
  readonly spa_info: unknown;
  readonly policies: unknown;
  readonly amenities: unknown;
  readonly concierge_advice: unknown;
}

async function connectPg(): Promise<import('pg').Client> {
  const connStr =
    process.env['DATABASE_URL'] ??
    process.env['SUPABASE_DB_POOLER_URL'] ??
    process.env['SUPABASE_DB_URL'];
  if (connStr === undefined) {
    throw new Error('Set DATABASE_URL or SUPABASE_DB_POOLER_URL in .env.local.');
  }
  const pgModule = (await import('pg')) as typeof import('pg');
  const cleaned = connStr.replace(/[?&]sslmode=[^&]*/giu, '');
  const isLocal = cleaned.includes('localhost') || cleaned.includes('127.0.0.1');
  const client = new pgModule.Client({
    connectionString: cleaned,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}

async function listSlugs(client: import('pg').Client, args: CliArgs): Promise<readonly string[]> {
  if (args.slug !== null) return [args.slug];
  if (args.slugs.length > 0) return args.slugs;
  if (args.invalid) {
    const r = await client.query<{ slug: string; concierge_advice: unknown }>(
      `select slug, concierge_advice from public.hotels where is_published = true order by slug`,
    );
    return r.rows
      .filter((row) => {
        const adv = row.concierge_advice as {
          fr?: { body?: unknown };
          en?: { body?: unknown };
        } | null;
        if (adv === null || adv === undefined) return true;
        const frBody = typeof adv.fr?.body === 'string' ? adv.fr.body : '';
        const enBody = typeof adv.en?.body === 'string' ? adv.en.body : '';
        const frWords = countWordsLocal(frBody);
        const enWords = countWordsLocal(enBody);
        const frBad = frWords < ADVICE_MIN_WORDS || frWords > ADVICE_MAX_WORDS;
        const enBad = enWords < ADVICE_MIN_WORDS || enWords > ADVICE_MAX_WORDS;
        // Phase 5: --invalid also targets advice that violates the
        // strict Concierge voice contract (sentences ≤ 25 words,
        // no banned phrases). The pre-Phase 4 humanizer didn't
        // enforce these as blockers, so legacy hotels can be in
        // envelope yet contain 30-word paragraphs.
        const frVoiceBad = frBody.length > 0 && voiceViolates(frBody);
        const enVoiceBad = enBody.length > 0 && voiceViolates(enBody);
        return frBad || enBad || frVoiceBad || enVoiceBad;
      })
      .map((row) => row.slug);
  }
  const where = args.missing
    ? 'is_published = true and concierge_advice is null'
    : 'is_published = true';
  const r = await client.query<{ slug: string }>(
    `select slug from public.hotels where ${where} order by slug`,
  );
  return r.rows.map((row) => row.slug);
}

async function fetchHotel(client: import('pg').Client, slug: string): Promise<HotelRow | null> {
  const r = await client.query<HotelRow>(
    `select id, slug, name, name_en, city, stars, is_palace, description_fr,
            opened_at::text as opened_at, long_description_sections,
            signature_experiences, faq_content, restaurant_info,
            spa_info, policies, amenities, concierge_advice
     from public.hotels where slug = $1 limit 1`,
    [slug],
  );
  return r.rows[0] ?? null;
}

/**
 * Build a synthetic "brief context" from a published hotel row so the
 * Pass 8 prompt has enough anchored facts to produce a Concierge advice
 * without hallucinating.
 *
 * We DON'T need the full 7-pass-grade brief — Pass 8 only needs:
 *  - identity (name, stars, palace, city, opened year)
 *  - rooms / suites names (from long_description_sections / restaurant_info)
 *  - amenities / services to anchor "tip_for" choices
 *  - existing FAQ + signature experiences (already curated)
 */
function buildContext(row: HotelRow): unknown {
  return {
    slug: row.slug,
    name: row.name,
    name_en: row.name_en,
    city: row.city,
    stars: row.stars,
    is_palace: row.is_palace,
    history: {
      opened_at: row.opened_at,
    },
    description_fr: row.description_fr,
    long_description_sections: row.long_description_sections,
    signature_experiences: row.signature_experiences,
    faq_content: row.faq_content,
    restaurant_info: row.restaurant_info,
    spa_info: row.spa_info,
    amenities: row.amenities,
    policies: row.policies,
  };
}

function extractJsonObject(content: string): unknown {
  const trimmed = content.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/);
  const inner = fenceMatch?.[1]?.trim() ?? trimmed;
  try {
    return JSON.parse(inner);
  } catch {
    const first = inner.indexOf('{');
    const last = inner.lastIndexOf('}');
    if (first >= 0 && last > first) return JSON.parse(inner.slice(first, last + 1));
    throw new Error('Pass 8 response is not valid JSON.');
  }
}

interface RunResult {
  readonly slug: string;
  readonly status: 'ok' | 'skipped' | 'failed';
  readonly reason?: string;
  readonly advice?: ConciergePass8Output;
  readonly tokens?: { input: number; output: number };
}

async function runOne(
  client: import('pg').Client,
  slug: string,
  prompt: string,
  args: CliArgs,
): Promise<RunResult> {
  const row = await fetchHotel(client, slug);
  if (row === null) return { slug, status: 'failed', reason: 'hotel not found' };
  const env = loadEnv();
  const provider = resolveProvider(env);
  const llm = buildLlmClient(env, provider);

  const context = buildContext(row);
  const userPrompt = `=== BRIEF JSON ===\n${JSON.stringify(context, null, 2)}\n\n=== TEXTE FINAL POST-PASS-7 ===\n# ${row.name}\n\n${row.description_fr ?? ''}`;
  const t0 = Date.now();
  const result = await llm.call({
    systemPrompt: prompt,
    userPrompt,
    temperature: 0.7,
    maxOutputTokens: 2500,
    responseFormat: provider === 'openai' ? 'json' : 'text',
  });
  const elapsed = Date.now() - t0;
  const raw = extractJsonObject(result.content);
  const parsed = ConciergePass8OutputSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    return { slug, status: 'failed', reason: `schema validation failed:\n${issues}` };
  }
  const advice = parsed.data;

  if (args.dryRun) {
    return {
      slug,
      status: 'ok',
      reason: `[dry-run] ${elapsed}ms`,
      advice,
      tokens: { input: result.usage.inputTokens, output: result.usage.outputTokens },
    };
  }

  const adviceForDb = args.noEn
    ? { fr: advice.concierge_advice.fr }
    : { fr: advice.concierge_advice.fr, en: advice.concierge_advice.en };
  await client.query(`update public.hotels set concierge_advice = $1 where slug = $2`, [
    adviceForDb,
    slug,
  ]);
  return {
    slug,
    status: 'ok',
    reason: `${elapsed}ms`,
    advice,
    tokens: { input: result.usage.inputTokens, output: result.usage.outputTokens },
  };
}

async function runWithConcurrency(
  client: import('pg').Client,
  slugs: readonly string[],
  prompt: string,
  args: CliArgs,
): Promise<readonly RunResult[]> {
  const queue = [...slugs];
  const out: RunResult[] = [];
  let active = 0;
  let started = 0;
  const total = slugs.length;
  return new Promise((resolveAll) => {
    const tick = (): void => {
      while (active < args.concurrency && queue.length > 0) {
        const slug = queue.shift();
        if (slug === undefined) break;
        active += 1;
        started += 1;
        const idx = started;
        console.log(`[${idx}/${total}] start ${slug} (active=${active})`);
        runOne(client, slug, prompt, args)
          .then((r) => {
            out.push(r);
            const tag = r.status === 'ok' ? 'OK' : r.status === 'skipped' ? 'SKIP' : 'FAIL';
            const tokens = r.tokens ? ` ${r.tokens.input}→${r.tokens.output}t` : '';
            console.log(`[${idx}/${total}] ${tag} ${slug}${tokens} — ${r.reason ?? ''}`);
            if (r.status === 'ok' && r.advice !== undefined) {
              console.log(`         FR body: ${r.advice.concierge_advice.fr.body.slice(0, 80)}...`);
            }
            if (r.status === 'failed') {
              console.warn(`[${idx}/${total}] FAIL ${slug} — ${r.reason}`);
            }
          })
          .catch((e: unknown) => {
            const msg = e instanceof Error ? e.message : String(e);
            out.push({ slug, status: 'failed', reason: msg });
            console.warn(`[${idx}/${total}] EXC ${slug} — ${msg}`);
          })
          .finally(() => {
            active -= 1;
            if (queue.length === 0 && active === 0) resolveAll(out);
            else tick();
          });
      }
      if (queue.length === 0 && active === 0) resolveAll(out);
    };
    tick();
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.slug && args.slugs.length === 0 && !args.all && !args.missing && !args.invalid) {
    console.error(
      'Usage: --slug <s> | --slugs <a,b,c> | --all | --missing | --invalid  [--concurrency N] [--dry-run] [--no-en]',
    );
    process.exit(1);
  }
  const prompt = await fs.readFile(PROMPT_PATH, 'utf-8');
  const client = await connectPg();
  try {
    const slugs = await listSlugs(client, args);
    console.log(
      `[concierge-humanizer] targets: ${slugs.length} hotel(s), concurrency=${args.concurrency}, dryRun=${args.dryRun}`,
    );
    if (slugs.length === 0) {
      console.log('Nothing to do.');
      return;
    }
    const results = await runWithConcurrency(client, slugs, prompt, args);
    const ok = results.filter((r) => r.status === 'ok').length;
    const failed = results.filter((r) => r.status === 'failed').length;
    const tokens = results.reduce(
      (acc, r) => ({
        input: acc.input + (r.tokens?.input ?? 0),
        output: acc.output + (r.tokens?.output ?? 0),
      }),
      { input: 0, output: 0 },
    );
    console.log(`\n=== Summary ===`);
    console.log(`  ok     : ${ok}`);
    console.log(`  failed : ${failed}`);
    console.log(`  total tokens in/out : ${tokens.input} / ${tokens.output}`);
    if (failed > 0) process.exit(2);
  } finally {
    await client.end();
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
