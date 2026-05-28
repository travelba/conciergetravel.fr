/**
 * run-faq-canonical.ts — replace each hotel's `faq_content` with the
 * 10 CDC §2.11 canonical questions (parking, petit-déjeuner, Wi-Fi,
 * animaux, distance aéroport, piscine, check-in anticipé, transferts,
 * annulation, taxes de séjour). Questions are HARD-CODED — the LLM
 * only generates contextualised answers (50-100 mots in FR + EN).
 *
 * Why this script exists: the legacy `extend-faq-postgrest.ts` lets
 * the LLM choose questions, leading to ad-hoc FAQ sets that drift
 * from CDC §2.11. Audit on 2026-05-28 found that fewer than 5 %
 * of fiches had the canonical 10. This script ships the gold-
 * standard set on every fiche.
 *
 * The script is idempotent: rows whose FAQ already matches the
 * canonical 10 (by question_fr keys) are skipped.
 *
 * CLI:
 *   --slug=foo                 single hotel debug
 *   --slugs=a,b,c              explicit list
 *   --slugs-file=path.txt      one slug per line OR comma-separated
 *   --include-drafts           include is_published=false rows
 *   --exclude-published        skip is_published=true rows
 *   --concurrency=N            parallel LLM calls (default 4, max 8)
 *   --limit=N                  cap eligible rows
 *   --dry-run                  generate + log, do NOT persist
 *   --force                    regenerate even if already canonical
 *
 * Skill: editorial-pilot, llm-output-robustness, structured-data-schema-org.
 * Hard rule: hotel-detail-page.mdc rule 11 (≥10 FAQ Q&A obligatoires).
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import OpenAI from 'openai';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

/* ───────────────────────────────────────────────────────────────────────
 * Canonical FAQ — 10 questions (CDC §2.11 hard rule)
 * ─────────────────────────────────────────────────────────────────────── */

interface CanonicalQuestion {
  readonly key: string;
  readonly question_fr: string;
  readonly question_en: string;
  readonly hint: string;
}

const CANONICAL_QUESTIONS: readonly CanonicalQuestion[] = [
  {
    key: 'parking',
    question_fr: "L'hôtel dispose-t-il d'un parking ?",
    question_en: 'Does the hotel have parking facilities?',
    hint: 'Parking sur place ou voiturier; payant ou inclus; place limitée; recommander de réserver via la conciergerie.',
  },
  {
    key: 'breakfast',
    question_fr: 'Quel type de petit-déjeuner est proposé ?',
    question_en: 'What kind of breakfast is served?',
    hint: 'Type (continental, buffet, à la carte), inclus ou en supplément, horaires, room service possible.',
  },
  {
    key: 'wifi',
    question_fr: "Le Wi-Fi est-il disponible dans l'hôtel ?",
    question_en: 'Is Wi-Fi available throughout the hotel?',
    hint: 'Wi-Fi haut débit gratuit; chambres + parties communes; réseau dédié si pertinent.',
  },
  {
    key: 'pets',
    question_fr: 'Les animaux sont-ils acceptés à {{name}} ?',
    question_en: 'Are pets allowed at {{name}}?',
    hint: 'Politique animale: oui/non, taille limite, supplément, services dédiés. Sinon orienter vers la conciergerie.',
  },
  {
    key: 'airport',
    question_fr: "Quelle est la distance entre l'hôtel et l'aéroport ?",
    question_en: 'How far is the hotel from the airport?',
    hint: 'Aéroport principal le plus proche; distance + temps de trajet en voiture; mention transferts.',
  },
  {
    key: 'pool',
    question_fr: "L'hôtel dispose-t-il d'une piscine ?",
    question_en: 'Does the hotel have a pool?',
    hint: 'Piscine intérieure/extérieure, chauffée, saisonnière, accès spa. Si pas de piscine, le dire honnêtement.',
  },
  {
    key: 'early_checkin',
    question_fr: 'Puis-je effectuer un check-in anticipé ?',
    question_en: 'Is early check-in available?',
    hint: 'Soumis à disponibilité, conciergerie à contacter en amont, horaires habituels.',
  },
  {
    key: 'transfers',
    question_fr: "Des transferts vers l'aéroport sont-ils proposés ?",
    question_en: 'Are airport transfers offered?',
    hint: 'Transfert privé en supplément, voiture avec chauffeur, services VIP, conciergerie qui organise.',
  },
  {
    key: 'cancellation',
    question_fr: "Quelle est la politique d'annulation de l'hôtel ?",
    question_en: "What is the hotel's cancellation policy?",
    hint: 'Variable selon tarif/saison, 24-72h gratuit en général, contacter la conciergerie pour les modalités.',
  },
  {
    key: 'taxes',
    question_fr: 'Y a-t-il des taxes de séjour à payer ?',
    question_en: 'Are there any tourist taxes to pay?',
    hint: 'Taxe de séjour locale, perçue sur place, montant variable par nuit/personne.',
  },
];

/* ───────────────────────────────────────────────────────────────────────
 * Types
 * ─────────────────────────────────────────────────────────────────────── */

interface FaqItemDb {
  question_fr?: string;
  question?: string;
  answer_fr?: string;
  answer?: string;
  question_en?: string;
  answer_en?: string;
}

interface HotelRow {
  slug: string;
  name: string;
  city: string | null;
  region: string | null;
  country_code: string | null;
  address: string | null;
  description_fr: string | null;
  description_en: string | null;
  faq_content: FaqItemDb[] | null;
  policies: Record<string, unknown> | null;
  number_of_rooms: number | null;
  stars: number | null;
  luxury_tier: string | null;
  is_published: boolean;
}

const AnswerSchema = z.object({
  answer_fr: z.string().min(40).max(700),
  answer_en: z.string().min(40).max(700),
});

const AnswersSchema = z.object({
  answers: z.array(AnswerSchema).length(CANONICAL_QUESTIONS.length),
});

type GeneratedAnswers = z.infer<typeof AnswersSchema>['answers'];

/* ───────────────────────────────────────────────────────────────────────
 * LLM prompt — answers only, questions are fixed
 * ─────────────────────────────────────────────────────────────────────── */

const SYSTEM_PROMPT = [
  "Tu es éditrice expérimentée pour MyConciergeHotel.com, agence IATA d'hôtels d'exception.",
  "Tu produis des RÉPONSES factuelles à 10 questions canoniques, pour la fiche FAQ d'un hôtel.",
  '',
  'CONTRAINTES STRICTES :',
  '- Tu ne modifies PAS les questions. Elles sont fixes — tu ne fais que répondre.',
  '- 1 réponse FR + 1 réponse EN par question, 50-100 mots chacune.',
  "- Si tu n'as pas l'info exacte, donne une réponse honnête (\"Contactez la conciergerie pour confirmer\") plutôt que d'inventer.",
  '- Ton expert, sobre, factuel — voix concierge complice. Pas de superlatifs creux (« incroyable », « magnifique », « exceptionnel », « sublime »).',
  '- Aucune balise HTML, aucun emoji, aucun lien.',
  "- Sortie JSON STRICTE : { answers: [{ answer_fr, answer_en }, …] } avec exactement 10 entrées dans l'ordre des questions données.",
].join('\n');

function buildUserPrompt(hotel: HotelRow): string {
  const lines: string[] = [];
  lines.push(`Hôtel : ${hotel.name}`);
  lines.push(`Ville : ${hotel.city ?? '?'}`);
  lines.push(`Région : ${hotel.region ?? '?'}`);
  lines.push(`Pays : ${hotel.country_code ?? '?'}`);
  if (hotel.address !== null) lines.push(`Adresse : ${hotel.address}`);
  if (hotel.stars !== null) lines.push(`Étoiles : ${hotel.stars}`);
  if (hotel.luxury_tier !== null) lines.push(`Tier : ${hotel.luxury_tier}`);
  if (hotel.number_of_rooms !== null) lines.push(`Chambres : ${hotel.number_of_rooms}`);
  if (hotel.description_fr !== null) {
    lines.push(`Description FR (extrait) : ${hotel.description_fr.slice(0, 400)}`);
  }
  if (hotel.description_en !== null) {
    lines.push(`Description EN (extrait) : ${hotel.description_en.slice(0, 400)}`);
  }
  if (hotel.policies !== null) {
    lines.push(`Policies (jsonb) : ${JSON.stringify(hotel.policies).slice(0, 400)}`);
  }
  lines.push('');
  lines.push("QUESTIONS CANONIQUES (dans l'ordre, ne pas modifier) :");
  CANONICAL_QUESTIONS.forEach((q, i) => {
    const qFr = q.question_fr.replaceAll('{{name}}', hotel.name);
    const qEn = q.question_en.replaceAll('{{name}}', hotel.name);
    lines.push(`${i + 1}. [FR] ${qFr}`);
    lines.push(`   [EN] ${qEn}`);
    lines.push(`   [hint] ${q.hint}`);
  });
  lines.push('');
  lines.push(
    `Génère exactement ${CANONICAL_QUESTIONS.length} couples (answer_fr, answer_en), un par question, dans l'ordre exact ci-dessus. JSON strict : { answers: [...] }.`,
  );
  return lines.join('\n');
}

/* ───────────────────────────────────────────────────────────────────────
 * PostgREST helpers
 * ─────────────────────────────────────────────────────────────────────── */

interface PostgrestEnv {
  readonly restBase: string;
  readonly apikey: string;
}

function loadPostgrestEnv(): PostgrestEnv {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
  if (url.length === 0 || key.length === 0) {
    throw new Error(
      '[faq-canonical] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env.local',
    );
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

async function fetchEligibleHotels(
  env: PostgrestEnv,
  opts: {
    includeDrafts: boolean;
    includePublished: boolean;
    slugs?: readonly string[];
    limit?: number;
  },
): Promise<HotelRow[]> {
  const cols =
    'slug,name,city,region,country_code,address,description_fr,description_en,faq_content,policies,number_of_rooms,stars,luxury_tier,is_published';
  const all: HotelRow[] = [];
  const PAGE = 1000;

  // PostgREST `in.(...)` URLs can blow past server limits past ~200 slugs.
  // Chunk the slug list when it's set; otherwise paginate the full table.
  if (opts.slugs && opts.slugs.length > 0) {
    const CHUNK = 150;
    for (let i = 0; i < opts.slugs.length; i += CHUNK) {
      const slice = opts.slugs.slice(i, i + CHUNK);
      const params = new URLSearchParams();
      params.set('select', cols);
      if (opts.includeDrafts && opts.includePublished) {
        // both
      } else if (opts.includeDrafts) params.set('is_published', 'eq.false');
      else if (opts.includePublished) params.set('is_published', 'eq.true');
      params.set('slug', `in.(${slice.join(',')})`);
      params.set('order', 'slug.asc');
      const url = `${env.restBase}/hotels?${params.toString()}`;
      const r = await fetch(url, { headers: pgHeaders(env) });
      if (!r.ok) {
        throw new Error(
          `PostgREST GET hotels failed: ${r.status} ${(await r.text()).slice(0, 200)}`,
        );
      }
      const batch = (await r.json()) as HotelRow[];
      all.push(...batch);
      if (opts.limit !== undefined && all.length >= opts.limit) break;
    }
  } else {
    const params = new URLSearchParams();
    params.set('select', cols);
    if (opts.includeDrafts && opts.includePublished) {
      // both
    } else if (opts.includeDrafts) params.set('is_published', 'eq.false');
    else if (opts.includePublished) params.set('is_published', 'eq.true');
    params.set('order', 'slug.asc');
    if (opts.limit !== undefined) params.set('limit', String(opts.limit));
    let from = 0;
    while (true) {
      const url = `${env.restBase}/hotels?${params.toString()}`;
      const r = await fetch(url, {
        headers: pgHeaders(env, { Range: `${from}-${from + PAGE - 1}`, 'Range-Unit': 'items' }),
      });
      if (!r.ok) {
        throw new Error(
          `PostgREST GET hotels failed: ${r.status} ${(await r.text()).slice(0, 200)}`,
        );
      }
      const batch = (await r.json()) as HotelRow[];
      all.push(...batch);
      if (batch.length < PAGE) break;
      if (opts.limit !== undefined && all.length >= opts.limit) break;
      from += PAGE;
    }
  }

  return opts.limit !== undefined ? all.slice(0, opts.limit) : all;
}

/* ───────────────────────────────────────────────────────────────────────
 * Canonicality check (idempotency)
 * ─────────────────────────────────────────────────────────────────────── */

function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isAlreadyCanonical(hotel: HotelRow): boolean {
  const items = hotel.faq_content ?? [];
  if (items.length !== CANONICAL_QUESTIONS.length) return false;
  // Strict — every canonical question (after {{name}} substitution) must
  // appear verbatim (case + accent normalised) in the existing FAQ.
  const haystack = new Set(items.map((it) => normalise(it.question_fr ?? it.question ?? '')));
  for (const q of CANONICAL_QUESTIONS) {
    const expected = normalise(q.question_fr.replaceAll('{{name}}', hotel.name));
    if (!haystack.has(expected)) return false;
  }
  return true;
}

/* ───────────────────────────────────────────────────────────────────────
 * LLM call
 * ─────────────────────────────────────────────────────────────────────── */

async function generateAnswers(openai: OpenAI, hotel: HotelRow): Promise<GeneratedAnswers> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini-2024-07-18',
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 3500,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(hotel) },
    ],
  });
  const raw = response.choices[0]?.message.content ?? '';
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON: ${raw.slice(0, 200)}`);
  }
  const validated = AnswersSchema.parse(parsed);
  return validated.answers;
}

function buildCanonicalFaq(hotel: HotelRow, answers: GeneratedAnswers): FaqItemDb[] {
  return CANONICAL_QUESTIONS.map((q, i) => ({
    question_fr: q.question_fr.replaceAll('{{name}}', hotel.name),
    question_en: q.question_en.replaceAll('{{name}}', hotel.name),
    answer_fr: answers[i]!.answer_fr,
    answer_en: answers[i]!.answer_en,
  }));
}

async function persistFaq(env: PostgrestEnv, slug: string, faq: FaqItemDb[]): Promise<void> {
  const url = `${env.restBase}/hotels?slug=eq.${encodeURIComponent(slug)}`;
  const r = await fetch(url, {
    method: 'PATCH',
    headers: pgHeaders(env, { Prefer: 'return=minimal' }),
    body: JSON.stringify({ faq_content: faq }),
  });
  if (!r.ok) {
    throw new Error(
      `PostgREST PATCH ${slug} failed: ${r.status} ${(await r.text()).slice(0, 200)}`,
    );
  }
}

/* ───────────────────────────────────────────────────────────────────────
 * CLI
 * ─────────────────────────────────────────────────────────────────────── */

interface CliArgs {
  readonly slug: string | null;
  readonly slugs: readonly string[];
  readonly slugsFile: string | null;
  readonly includeDrafts: boolean;
  readonly includePublished: boolean;
  readonly concurrency: number;
  readonly limit: number | null;
  readonly dryRun: boolean;
  readonly force: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let slug: string | null = null;
  let slugs: string[] = [];
  let slugsFile: string | null = null;
  let includeDrafts = false;
  let includePublished = true;
  let concurrency = 4;
  let limit: number | null = null;
  let dryRun = false;
  let force = false;
  for (const a of argv) {
    if (a === '--include-drafts') includeDrafts = true;
    else if (a === '--exclude-published') includePublished = false;
    else if (a === '--dry-run') dryRun = true;
    else if (a === '--force') force = true;
    else if (a.startsWith('--slug=')) slug = a.slice('--slug='.length);
    else if (a.startsWith('--slugs-file=')) slugsFile = a.slice('--slugs-file='.length);
    else if (a.startsWith('--slugs=')) {
      slugs = a
        .slice('--slugs='.length)
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    } else if (a.startsWith('--concurrency=')) {
      const n = Number(a.slice('--concurrency='.length));
      if (Number.isFinite(n) && n > 0) concurrency = Math.min(8, Math.max(1, Math.floor(n)));
    } else if (a.startsWith('--limit=')) {
      const n = Number(a.slice('--limit='.length));
      if (Number.isFinite(n) && n > 0) limit = Math.floor(n);
    }
  }
  return {
    slug,
    slugs,
    slugsFile,
    includeDrafts,
    includePublished,
    concurrency,
    limit,
    dryRun,
    force,
  };
}

function loadSlugsFromFile(path: string): string[] {
  const raw = readFileSync(path, 'utf8');
  // Accept newline-separated or comma-separated (or both).
  return raw
    .split(/[\n,]/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

interface RunEntry {
  readonly slug: string;
  readonly status: 'success' | 'error' | 'noop';
  readonly error?: string;
  readonly elapsedMs: number;
  readonly tokens?: { in: number; out: number };
}

async function runWithConcurrency<T, R>(
  items: ReadonlyArray<T>,
  concurrency: number,
  fn: (t: T, i: number) => Promise<R>,
  onProgress?: (done: number, total: number, last: R) => void,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  let done = 0;
  const total = items.length;
  await Promise.all(
    Array.from({ length: Math.max(1, concurrency) }).map(async () => {
      while (true) {
        const i = next++;
        if (i >= total) return;
        const r = await fn(items[i] as T, i);
        results[i] = r;
        done += 1;
        if (onProgress) onProgress(done, total, r);
      }
    }),
  );
  return results;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const env = loadPostgrestEnv();
  const apiKey = process.env['OPENAI_API_KEY'] ?? '';
  if (apiKey.length === 0) throw new Error('[faq-canonical] OPENAI_API_KEY missing');
  const openai = new OpenAI({ apiKey });

  const explicitSlugs: string[] = [];
  if (args.slug !== null) explicitSlugs.push(args.slug);
  for (const s of args.slugs) explicitSlugs.push(s);
  if (args.slugsFile !== null) {
    explicitSlugs.push(...loadSlugsFromFile(args.slugsFile));
  }

  console.log(
    `[faq-canonical] include_drafts=${args.includeDrafts} include_published=${args.includePublished} ` +
      `slugs=${explicitSlugs.length} concurrency=${args.concurrency} limit=${args.limit ?? '∞'} ` +
      `dry_run=${args.dryRun} force=${args.force}`,
  );

  const fetchOpts: {
    includeDrafts: boolean;
    includePublished: boolean;
    slugs?: readonly string[];
    limit?: number;
  } = {
    includeDrafts: args.includeDrafts,
    includePublished: args.includePublished,
  };
  if (explicitSlugs.length > 0) fetchOpts.slugs = explicitSlugs;
  if (args.limit !== null) fetchOpts.limit = args.limit;

  const all = await fetchEligibleHotels(env, fetchOpts);
  console.log(`[faq-canonical] fetched ${all.length} hotel(s) from DB.`);

  // Filter out rows already canonical (unless --force).
  const eligible = args.force ? all : all.filter((h) => !isAlreadyCanonical(h));
  const skipped = all.length - eligible.length;
  console.log(
    `[faq-canonical] ${eligible.length} eligible (${skipped} already canonical, skipped).`,
  );
  if (eligible.length === 0) {
    console.log('[faq-canonical] nothing to do.');
    return;
  }

  let totalIn = 0;
  let totalOut = 0;
  const t0 = Date.now();

  const entries = await runWithConcurrency<HotelRow, RunEntry>(
    eligible,
    args.concurrency,
    async (hotel, i) => {
      const tStart = Date.now();
      try {
        const answers = await generateAnswers(openai, hotel);
        const faq = buildCanonicalFaq(hotel, answers);
        if (!args.dryRun) {
          await persistFaq(env, hotel.slug, faq);
        }
        const elapsedMs = Date.now() - tStart;
        const a0 = answers[0]!;
        return {
          slug: hotel.slug,
          status: 'success' as const,
          elapsedMs,
          tokens: { in: 0, out: 0 },
        };
      } catch (err) {
        const elapsedMs = Date.now() - tStart;
        return {
          slug: hotel.slug,
          status: 'error' as const,
          error: err instanceof Error ? err.message : String(err),
          elapsedMs,
        };
      }
    },
    (done, total, last) => {
      const tag = last.status === 'success' ? '✓' : last.status === 'noop' ? '·' : '✗';
      const note = last.status === 'error' ? ` ${last.error?.slice(0, 80) ?? ''}` : '';
      console.log(
        `[${String(done).padStart(4)}/${total}] ${tag} ${last.slug} (${last.elapsedMs}ms)${note}`,
      );
    },
  );

  const success = entries.filter((e) => e.status === 'success').length;
  const errors = entries.filter((e) => e.status === 'error');
  const elapsedSec = ((Date.now() - t0) / 1000).toFixed(1);

  console.log('---');
  console.log(`[faq-canonical] DONE in ${elapsedSec}s`);
  console.log(
    `[faq-canonical] success=${success} fail=${errors.length} skipped_canonical=${skipped}`,
  );
  if (errors.length > 0) {
    console.log('[faq-canonical] first 10 failures:');
    for (const e of errors.slice(0, 10)) {
      console.log(`  ${e.slug}: ${e.error?.slice(0, 120)}`);
    }
  }

  // Run log
  const RUNLOG_DIR = resolve(__dirname, '../../runs');
  mkdirSync(RUNLOG_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = resolve(RUNLOG_DIR, `faq-canonical-${ts}.json`);
  writeFileSync(
    logPath,
    JSON.stringify(
      {
        finishedAt: new Date().toISOString(),
        args,
        stats: {
          fetched: all.length,
          eligible: eligible.length,
          skipped,
          success,
          fail: errors.length,
        },
        entries,
      },
      null,
      2,
    ),
  );
  console.log(`[faq-canonical] runlog → ${logPath}`);

  if (errors.length > 0 && success === 0) process.exit(1);
}

main().catch((err) => {
  console.error('[faq-canonical] FATAL', err);
  process.exit(1);
});
