/**
 * Vague 2bis — Sentence shortener pour guides + rankings publiés.
 *
 * Contexte ADR-0011 / Phase 6 du plan concierge-voice-restructure :
 *   - Les prompts inline `generate-guide-v2.ts` et `generate-ranking-v2.ts`
 *     ont été amendés en Phase 2 pour imposer « toutes phrases ≤ 25 mots ».
 *   - Mais les 30 guides et 101 rankings actuellement publiés ont été
 *     générés AVANT cette mise à jour : audit `check-sentence-length.mjs`
 *     montre ~36 % de phrases > 25 mots côté guides, ~39 % côté rankings.
 *   - Full-regen 8-pass = 50-80 € + plusieurs heures. Trop cher pour le
 *     seul bénéfice « voix Concierge » sur du contenu déjà factuellement
 *     audité.
 *
 * Stratégie économique :
 *   1. On lit chaque guide / ranking publié.
 *   2. Pour chaque chunk de texte FR (sections.body_fr, intro_fr,
 *      outro_fr…), on isole les phrases > 25 mots.
 *   3. On envoie le chunk + la consigne « réécris chaque phrase > 25 mots
 *      en 1-3 phrases courtes ≤ 25 mots ; ne touche pas aux phrases
 *      déjà conformes, aux chiffres, aux noms propres, ni au sens » à
 *      un LLM bon marché (gpt-4o-mini).
 *   4. On valide côté script : delta wordcount < 10 %, chaque phrase
 *      ≤ 30 mots (marge tolérée), aucun chiffre n'a disparu.
 *   5. On UPDATE le row Supabase (sections / intro_fr / outro_fr) avec
 *      `revalidateTag` côté Payload qui s'en chargera au push suivant.
 *
 * Usage :
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/concierge/run-shorten-sections.ts --table guides --slug paris
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/concierge/run-shorten-sections.ts --table guides --worst 5
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/concierge/run-shorten-sections.ts --table rankings --all --concurrency 4
 *
 * Flags :
 *   --table guides|rankings   (requis)
 *   --slug <s>                cible un seul item
 *   --slugs s1,s2,s3          cible plusieurs items
 *   --worst N                 prend les N items avec le pire ratio long-sentence
 *   --all                     tous les items publiés
 *   --concurrency N           parallélisme (défaut: 2)
 *   --dry-run                 n'écrit pas en base
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';

import { buildLlmClient } from '../llm.js';
import { loadEnv, resolveProvider } from '../env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadDotenv({ path: path.resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: path.resolve(__dirname, '../../../../.env') });

const MAX_WORDS = 25;
const TOLERANCE_WORDS = 30;
const DELTA_PCT = 0.15;

type Table = 'guides' | 'rankings';

interface CliArgs {
  readonly table: Table;
  readonly slug: string | null;
  readonly slugs: readonly string[];
  readonly worst: number | null;
  readonly all: boolean;
  readonly concurrency: number;
  readonly dryRun: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let table: Table | null = null;
  let slug: string | null = null;
  let slugs: string[] = [];
  let worst: number | null = null;
  let all = false;
  let concurrency = 2;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--table') {
      const v = argv[i + 1];
      if (v === 'guides' || v === 'rankings') table = v;
      i += 1;
    } else if (a === '--slug') {
      slug = argv[i + 1] ?? null;
      i += 1;
    } else if (a === '--slugs') {
      slugs = (argv[i + 1] ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      i += 1;
    } else if (a === '--worst') {
      const n = Number(argv[i + 1] ?? '');
      if (Number.isFinite(n) && n >= 1) worst = Math.floor(n);
      i += 1;
    } else if (a === '--all') {
      all = true;
    } else if (a === '--concurrency') {
      const n = Number(argv[i + 1] ?? '');
      if (Number.isFinite(n) && n >= 1 && n <= 8) concurrency = Math.floor(n);
      i += 1;
    } else if (a === '--dry-run') {
      dryRun = true;
    }
  }
  if (table === null) {
    throw new Error('Missing --table guides|rankings');
  }
  return { table, slug, slugs, worst, all, concurrency, dryRun };
}

function splitSentences(text: string): readonly string[] {
  if (!text) return [];
  return text
    .split(/(?<=[.!?…])\s+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function wordCount(text: string): number {
  if (!text) return 0;
  return text.split(/\s+/u).filter(Boolean).length;
}

function hasLongSentences(text: string): boolean {
  for (const s of splitSentences(text)) {
    if (wordCount(s) > MAX_WORDS) return true;
  }
  return false;
}

function longSentenceCount(text: string): number {
  let n = 0;
  for (const s of splitSentences(text)) {
    if (wordCount(s) > MAX_WORDS) n++;
  }
  return n;
}

function extractNumbers(text: string): readonly string[] {
  return Array.from(text.matchAll(/\b\d[\d\s.,]*\b/gu)).map((m) => m[0].replace(/\s/g, ''));
}

/**
 * Validate a shortened chunk against its original :
 *  - Same / similar wordcount (±15 %)
 *  - Each sentence ≤ 30 words (≤ 25 strict ideally, 30 = grace margin)
 *  - All bare numbers from the original still present in the result
 */
function validateShortened(
  original: string,
  shortened: string,
): { ok: true } | { ok: false; reason: string } {
  const origWords = wordCount(original);
  const newWords = wordCount(shortened);
  if (origWords > 0) {
    const delta = Math.abs(newWords - origWords) / origWords;
    if (delta > DELTA_PCT) {
      return {
        ok: false,
        reason: `wordcount delta ${(delta * 100).toFixed(0)}% (orig ${origWords}, new ${newWords})`,
      };
    }
  }
  for (const s of splitSentences(shortened)) {
    if (wordCount(s) > TOLERANCE_WORDS) {
      return { ok: false, reason: `sentence still > ${TOLERANCE_WORDS} words: "${s.slice(0, 80)}…"` };
    }
  }
  const origNumbers = extractNumbers(original);
  const newJoined = shortened.replace(/\s/g, '');
  for (const n of origNumbers) {
    if (!newJoined.includes(n)) {
      return { ok: false, reason: `number "${n}" missing from shortened text` };
    }
  }
  return { ok: true };
}

const SHORTEN_PROMPT = `Tu es correcteur éditorial.

Ta mission : prends le texte fourni et réécris-le en respectant **strictement** ces contraintes :

1. **Aucune phrase ne doit dépasser 25 mots.** Si une phrase fait 30 mots, coupe-la en 2-3 phrases courtes.
2. **Préserve tout le contenu factuel** : chiffres exacts, noms propres, lieux, dates, citations entre guillemets, sources nommées.
3. **Préserve le sens et la nuance.** Aucune information ne doit être supprimée. Tu peux reformuler, jamais retirer.
4. **Préserve le ton et le registre.** Voix Concierge MyConciergeHotel : expert complice, jamais commercial, références culturelles légitimes.
5. **Ne touche pas aux phrases déjà ≤ 25 mots** sauf si une retouche minime améliore le flux.
6. **N'ajoute pas de contenu nouveau** : pas de paragraphe supplémentaire, pas de phrase de transition gratuite.
7. **N'ajoute pas de formules creuses** ("n'hésitez pas à", "il est à noter que", "incroyable", "magnifique").

Format de sortie : renvoie **uniquement** le texte réécrit, sans préambule, sans bloc markdown, sans guillemets englobants. Conserve les retours à la ligne d'origine.`;

interface PgClientLike {
  query<R>(sql: string, params?: readonly unknown[]): Promise<{ rows: R[] }>;
  end(): Promise<void>;
}

async function connectPg(): Promise<PgClientLike> {
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
  return client as unknown as PgClientLike;
}

interface GuideRow {
  readonly slug: string;
  readonly summary_fr: string;
  readonly sections: unknown;
}

interface RankingRow {
  readonly slug: string;
  readonly intro_fr: string;
  readonly outro_fr: string | null;
}

async function fetchGuide(client: PgClientLike, slug: string): Promise<GuideRow | null> {
  const r = await client.query<GuideRow>(
    `select slug, summary_fr, sections from public.editorial_guides where slug = $1 limit 1`,
    [slug],
  );
  return r.rows[0] ?? null;
}

async function fetchRanking(client: PgClientLike, slug: string): Promise<RankingRow | null> {
  const r = await client.query<RankingRow>(
    `select slug, intro_fr, outro_fr from public.editorial_rankings where slug = $1 limit 1`,
    [slug],
  );
  return r.rows[0] ?? null;
}

async function listSlugs(client: PgClientLike, args: CliArgs): Promise<readonly string[]> {
  if (args.slug !== null) return [args.slug];
  if (args.slugs.length > 0) return args.slugs;
  const table = args.table === 'guides' ? 'editorial_guides' : 'editorial_rankings';
  const cols =
    args.table === 'guides' ? 'slug, summary_fr, sections' : 'slug, intro_fr, outro_fr';
  const r = await client.query<Record<string, unknown>>(
    `select ${cols} from public.${table} where is_published = true order by slug`,
  );
  const ranked = r.rows.map((row) => {
    const text = collectText(args.table, row);
    return { slug: row['slug'] as string, longRatio: ratio(text) };
  });
  if (args.worst !== null) {
    return ranked
      .sort((a, b) => b.longRatio - a.longRatio)
      .slice(0, args.worst)
      .map((r) => r.slug);
  }
  if (args.all) {
    return ranked.map((r) => r.slug);
  }
  throw new Error('Pass --slug, --slugs, --worst N, or --all.');
}

function collectText(table: Table, row: Record<string, unknown>): string {
  if (table === 'guides') {
    const parts: string[] = [];
    const summary = row['summary_fr'];
    if (typeof summary === 'string') parts.push(summary);
    const sections = row['sections'];
    if (Array.isArray(sections)) {
      for (const s of sections) {
        if (s && typeof (s as { body_fr?: unknown }).body_fr === 'string') {
          parts.push((s as { body_fr: string }).body_fr);
        }
      }
    }
    return parts.join('\n\n');
  }
  const intro = row['intro_fr'];
  const outro = row['outro_fr'];
  return [typeof intro === 'string' ? intro : '', typeof outro === 'string' ? outro : '']
    .join('\n\n')
    .trim();
}

function ratio(text: string): number {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return 0;
  return longSentenceCount(text) / sentences.length;
}

interface ShortenResult {
  readonly slug: string;
  readonly status: 'ok' | 'skipped' | 'failed' | 'partial';
  readonly chunksProcessed: number;
  readonly chunksShortened: number;
  readonly tokens: { input: number; output: number };
  readonly reason?: string;
}

async function shortenChunk(
  llm: { call: (opts: { systemPrompt: string; userPrompt: string; temperature?: number; maxOutputTokens?: number; responseFormat?: 'text' | 'json' }) => Promise<{ content: string; usage: { inputTokens: number; outputTokens: number } }> },
  text: string,
): Promise<{ ok: true; shortened: string; tokens: { input: number; output: number } } | { ok: false; reason: string }> {
  const result = await llm.call({
    systemPrompt: SHORTEN_PROMPT,
    userPrompt: text,
    temperature: 0.3,
    maxOutputTokens: Math.max(500, Math.floor(wordCount(text) * 4)),
    responseFormat: 'text',
  });
  const shortened = result.content.trim();
  if (!shortened) return { ok: false, reason: 'empty response' };
  const validation = validateShortened(text, shortened);
  if (!validation.ok) return { ok: false, reason: validation.reason };
  return {
    ok: true,
    shortened,
    tokens: { input: result.usage.inputTokens, output: result.usage.outputTokens },
  };
}

async function processGuide(
  client: PgClientLike,
  llm: Parameters<typeof shortenChunk>[0],
  slug: string,
  args: CliArgs,
): Promise<ShortenResult> {
  const row = await fetchGuide(client, slug);
  if (row === null) return base('failed', slug, 'guide not found');

  const sections = Array.isArray(row.sections) ? [...row.sections] : [];
  const updatedSections: unknown[] = [];
  let totalIn = 0;
  let totalOut = 0;
  let processed = 0;
  let shortenedCount = 0;
  let failures = 0;
  let newSummary = row.summary_fr;

  if (hasLongSentences(row.summary_fr)) {
    processed += 1;
    const out = await shortenChunk(llm, row.summary_fr);
    if (out.ok) {
      newSummary = out.shortened;
      shortenedCount += 1;
      totalIn += out.tokens.input;
      totalOut += out.tokens.output;
    } else {
      failures += 1;
    }
  }

  for (const s of sections) {
    if (s && typeof s === 'object' && 'body_fr' in s) {
      const body = (s as { body_fr: unknown }).body_fr;
      if (typeof body === 'string' && hasLongSentences(body)) {
        processed += 1;
        const out = await shortenChunk(llm, body);
        if (out.ok) {
          shortenedCount += 1;
          totalIn += out.tokens.input;
          totalOut += out.tokens.output;
          updatedSections.push({ ...(s as object), body_fr: out.shortened });
          continue;
        } else {
          failures += 1;
        }
      }
    }
    updatedSections.push(s);
  }

  if (processed === 0) return base('skipped', slug, 'no long sentences');

  if (!args.dryRun && shortenedCount > 0) {
    await client.query(
      `update public.editorial_guides set summary_fr = $1, sections = $2, updated_at = now() where slug = $3`,
      [newSummary, JSON.stringify(updatedSections), slug],
    );
  }

  return {
    slug,
    status: failures === 0 ? 'ok' : 'partial',
    chunksProcessed: processed,
    chunksShortened: shortenedCount,
    tokens: { input: totalIn, output: totalOut },
    ...(failures > 0 ? { reason: `${failures} chunk(s) failed validation` } : {}),
  };
}

async function processRanking(
  client: PgClientLike,
  llm: Parameters<typeof shortenChunk>[0],
  slug: string,
  args: CliArgs,
): Promise<ShortenResult> {
  const row = await fetchRanking(client, slug);
  if (row === null) return base('failed', slug, 'ranking not found');

  let totalIn = 0;
  let totalOut = 0;
  let processed = 0;
  let shortenedCount = 0;
  let failures = 0;
  let newIntro = row.intro_fr;
  let newOutro = row.outro_fr;

  if (hasLongSentences(row.intro_fr)) {
    processed += 1;
    const out = await shortenChunk(llm, row.intro_fr);
    if (out.ok) {
      newIntro = out.shortened;
      shortenedCount += 1;
      totalIn += out.tokens.input;
      totalOut += out.tokens.output;
    } else {
      failures += 1;
    }
  }
  if (typeof row.outro_fr === 'string' && hasLongSentences(row.outro_fr)) {
    processed += 1;
    const out = await shortenChunk(llm, row.outro_fr);
    if (out.ok) {
      newOutro = out.shortened;
      shortenedCount += 1;
      totalIn += out.tokens.input;
      totalOut += out.tokens.output;
    } else {
      failures += 1;
    }
  }

  if (processed === 0) return base('skipped', slug, 'no long sentences');

  if (!args.dryRun && shortenedCount > 0) {
    await client.query(
      `update public.editorial_rankings set intro_fr = $1, outro_fr = $2, updated_at = now() where slug = $3`,
      [newIntro, newOutro, slug],
    );
  }

  return {
    slug,
    status: failures === 0 ? 'ok' : 'partial',
    chunksProcessed: processed,
    chunksShortened: shortenedCount,
    tokens: { input: totalIn, output: totalOut },
    ...(failures > 0 ? { reason: `${failures} chunk(s) failed validation` } : {}),
  };
}

function base(status: ShortenResult['status'], slug: string, reason?: string): ShortenResult {
  return {
    slug,
    status,
    chunksProcessed: 0,
    chunksShortened: 0,
    tokens: { input: 0, output: 0 },
    ...(reason !== undefined ? { reason } : {}),
  };
}

async function runWithConcurrency<T>(
  items: readonly string[],
  concurrency: number,
  worker: (slug: string) => Promise<T>,
): Promise<readonly T[]> {
  const results: T[] = [];
  let cursor = 0;
  async function pull(): Promise<void> {
    while (cursor < items.length) {
      const idx = cursor++;
      const slug = items[idx];
      if (slug === undefined) return;
      const r = await worker(slug);
      results.push(r);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => pull()));
  return results;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const client = await connectPg();
  const env = loadEnv();
  const provider = resolveProvider(env);
  const llm = buildLlmClient(env, provider);

  const slugs = await listSlugs(client, args);
  if (slugs.length === 0) {
    console.log('No items to process.');
    await client.end();
    return;
  }
  console.log(
    `Shortening ${slugs.length} ${args.table} (concurrency ${args.concurrency}, model ${llm.model}, dryRun=${args.dryRun})`,
  );

  const t0 = Date.now();
  const results = await runWithConcurrency(slugs, args.concurrency, async (slug) => {
    try {
      const r =
        args.table === 'guides'
          ? await processGuide(client, llm, slug, args)
          : await processRanking(client, llm, slug, args);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
      const tok = `${r.tokens.input}+${r.tokens.output}t`;
      console.log(
        `  [${r.status.toUpperCase()}] ${slug} — ${r.chunksShortened}/${r.chunksProcessed} chunks ${tok} (${elapsed}s elapsed)${r.reason ? ` — ${r.reason}` : ''}`,
      );
      return r;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.log(`  [FAILED] ${slug} — ${reason}`);
      return base('failed', slug, reason);
    }
  });

  const totalIn = results.reduce((s, r) => s + r.tokens.input, 0);
  const totalOut = results.reduce((s, r) => s + r.tokens.output, 0);
  const ok = results.filter((r) => r.status === 'ok').length;
  const partial = results.filter((r) => r.status === 'partial').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  const elapsedMin = ((Date.now() - t0) / 60_000).toFixed(1);
  console.log('---');
  console.log(
    `Done in ${elapsedMin}min — ok=${ok}, partial=${partial}, skipped=${skipped}, failed=${failed}`,
  );
  console.log(`Tokens: ${totalIn} input + ${totalOut} output`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
