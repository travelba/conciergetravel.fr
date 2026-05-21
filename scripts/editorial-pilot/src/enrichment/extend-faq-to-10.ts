/**
 * Extends FAQ entries to at least 10 questions per hotel — required by
 * the CDC §2.11 hard rule (publish blocked if < 10 Q&A).
 *
 * Reads every published hotel with `faq_content` length < 10, then asks
 * gpt-4o-mini for the missing canonical questions (parking, breakfast,
 * Wi-Fi, pets, airport distance, pool, early check-in, transfers,
 * cancellation, taxes) — skipping the ones already present.
 *
 * The LLM returns FR + EN simultaneously so the resulting items are
 * complete (no second i18n pass needed for these specific entries).
 */

import { readFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import OpenAI from 'openai';
import { z } from 'zod';

const RUNLOG_DIR = resolve(process.cwd(), 'out');
mkdirSync(RUNLOG_DIR, { recursive: true });
const RUNLOG = resolve(
  RUNLOG_DIR,
  `faq-extend-runlog-${new Date().toISOString().slice(0, 10)}.jsonl`,
);

function loadEnv(): Record<string, string> {
  const envText = readFileSync(resolve(process.cwd(), '../../.env.local'), 'utf8');
  const env: Record<string, string> = {};
  for (const raw of envText.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = (m[2] ?? '').trim();
    const q = v.match(/^"([^"]*)"/) ?? v.match(/^'([^']*)'/);
    v = q ? (q[1] ?? '') : (v.split(/\s+#/)[0]?.trim() ?? '');
    env[m[1] ?? ''] = v;
  }
  return env;
}

interface FaqItem {
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
  address: string | null;
  description_fr: string | null;
  faq_content: FaqItem[] | null;
  policies: Record<string, unknown> | null;
  number_of_rooms: number | null;
}

const FaqGenSchema = z.object({
  items: z
    .array(
      z.object({
        question_fr: z.string().min(8).max(200),
        answer_fr: z.string().min(40).max(500),
        question_en: z.string().min(8).max(200).default(''),
        answer_en: z.string().min(40).max(500).default(''),
      }),
    )
    .min(1)
    .max(15),
});

const SYSTEM_PROMPT = `Tu es éditrice expérimentée pour MyConciergeHotel.com, agence IATA de palaces.
Tu produis des FAQ factuelles en FR et EN simultanément pour les fiches d'hôtel.
Règles strictes :
- 1 question = 1 réponse claire en 50-100 mots.
- Questions canoniques privilégiées : parking, petit-déjeuner, Wi-Fi, animaux, distance aéroport/gare, piscine, check-in anticipé, transferts, annulation, taxes de séjour, équipements famille, services pour PMR.
- Si tu n'as pas l'info exacte, donne une réponse générique honnête ("Contactez la conciergerie pour confirmer les modalités du jour") plutôt que d'inventer un chiffre.
- Ne reproduis JAMAIS une question déjà présente dans la liste fournie.
- JSON STRICT : { items: [{ question_fr, answer_fr, question_en, answer_en }] }.
- Aucune balise HTML, aucun emoji.`;

function buildUserPrompt(hotel: HotelRow, missingCount: number): string {
  const existingQs = (hotel.faq_content ?? [])
    .map((q, i) => `${i + 1}. ${q.question_fr ?? q.question ?? ''}`)
    .join('\n');
  return [
    `Hôtel : ${hotel.name}`,
    `Ville : ${hotel.city ?? '?'}`,
    `Région : ${hotel.region ?? '?'}`,
    `Adresse : ${hotel.address ?? '?'}`,
    `Nombre de chambres : ${hotel.number_of_rooms ?? '?'}`,
    `Description (extrait) : ${(hotel.description_fr ?? '').slice(0, 400)}`,
    '',
    'Questions DÉJÀ présentes (à NE PAS reproduire) :',
    existingQs.length > 0 ? existingQs : '(aucune)',
    '',
    `Mission : génère ${missingCount} NOUVELLES question/réponse complémentaires (FR + EN), parmi les questions canoniques ci-dessus, en évitant les doublons exacts ou sémantiques avec la liste ci-dessus.`,
    'Retourne UNIQUEMENT le JSON.',
  ].join('\n');
}

async function listHotelsNeedingExtension(opts: {
  includeDrafts: boolean;
  slugsFilter?: string[];
}): Promise<HotelRow[]> {
  const env = loadEnv();
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const conn = (env.SUPABASE_DB_POOLER_URL ?? '').replace(/\?sslmode=require/, '');
  const cli = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await cli.connect();
  try {
    // Build the where clause. Drafts need to have long_description_sections
    // populated (i.e. they've been through the 8-pass pipeline) so we don't
    // waste tokens generating FAQ for stub rows.
    const wherePublished = opts.includeDrafts
      ? `(is_published = true or (is_published = false and long_description_sections is not null))`
      : `is_published = true`;
    const slugClause =
      opts.slugsFilter && opts.slugsFilter.length > 0 ? `and slug = ANY($1::text[])` : '';
    const sql = `
      select slug, name, city, region, address, description_fr,
             faq_content, policies, number_of_rooms
      from hotels
      where ${wherePublished}
        and coalesce(jsonb_array_length(faq_content), 0) < 10
        ${slugClause}
      order by slug`;
    const params = opts.slugsFilter && opts.slugsFilter.length > 0 ? [opts.slugsFilter] : [];
    const { rows } = await cli.query<{
      slug: string;
      name: string;
      city: string | null;
      region: string | null;
      address: string | null;
      description_fr: string | null;
      faq_content: FaqItem[] | null;
      policies: Record<string, unknown> | null;
      number_of_rooms: number | null;
    }>(sql, params);
    return rows;
  } finally {
    await cli.end();
  }
}

type FaqGenItems = z.infer<typeof FaqGenSchema>['items'];

async function extendOne(
  openai: OpenAI,
  model: string,
  hotel: HotelRow,
  targetCount = 12,
): Promise<FaqGenItems> {
  const currentCount = (hotel.faq_content ?? []).length;
  // Target the mid-range of CDC §2.11 (10-15) so drafts with 0 FAQs come
  // out at 12, not pinned to the 10 floor.
  const missing = Math.max(0, targetCount - currentCount);
  if (missing === 0) return [];

  const response = await openai.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    temperature: 0.4,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(hotel, missing) },
    ],
  });
  const raw = response.choices[0]?.message.content ?? '';
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON: ${raw.slice(0, 200)}`);
  }
  const validated = FaqGenSchema.parse(parsed);
  return validated.items;
}

async function persistFaqExtension(hotel: HotelRow, items: FaqGenItems): Promise<void> {
  const env = loadEnv();
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const conn = (env.SUPABASE_DB_POOLER_URL ?? '').replace(/\?sslmode=require/, '');
  const cli = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await cli.connect();
  try {
    const existing = hotel.faq_content ?? [];
    // Dedupe against existing questions (case-insensitive, trimmed).
    const seen = new Set<string>(
      existing
        .map((q) => (q.question_fr ?? q.question ?? '').toLowerCase().trim())
        .filter((s) => s.length > 0),
    );
    const newItems = items
      .filter((it) => !seen.has(it.question_fr.toLowerCase().trim()))
      .map((it) => ({
        question_fr: it.question_fr,
        answer_fr: it.answer_fr,
        question_en: it.question_en.length > 8 ? it.question_en : undefined,
        answer_en: it.answer_en.length > 40 ? it.answer_en : undefined,
      }));
    if (newItems.length === 0) return;
    const merged = [...existing, ...newItems];
    await cli.query(
      `update hotels set faq_content = $1::jsonb, updated_at = timezone('utc', now()) where slug = $2`,
      [JSON.stringify(merged), hotel.slug],
    );
  } finally {
    await cli.end();
  }
}

function logEntry(o: object): void {
  appendFileSync(RUNLOG, JSON.stringify({ t: new Date().toISOString(), ...o }) + '\n');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    includeDrafts: false,
    slugs: undefined as string[] | undefined,
    target: 12,
    concurrency: 1,
  };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--include-drafts') opts.includeDrafts = true;
    else if (a === '--slugs' && args[i + 1]) {
      opts.slugs = args[i + 1]!.split(',').filter(Boolean);
      i += 1;
    } else if (a?.startsWith('--target=')) {
      opts.target = parseInt(a.slice('--target='.length), 10);
    } else if (a?.startsWith('--concurrency=')) {
      opts.concurrency = parseInt(a.slice('--concurrency='.length), 10);
    }
  }
  return opts;
}

async function processOne(
  openai: OpenAI,
  h: HotelRow,
  i: number,
  total: number,
  target: number,
): Promise<{ slug: string; ok: boolean; ms: number; added?: number; error?: string }> {
  const before = (h.faq_content ?? []).length;
  const start = Date.now();
  process.stdout.write(`[${i + 1}/${total}] ${h.slug} (${before}) ... `);
  try {
    const items = await extendOne(openai, 'gpt-4o-mini', h, target);
    await persistFaqExtension(h, items);
    const ms = Date.now() - start;
    console.log(`✓ +${items.length} in ${(ms / 1000).toFixed(1)}s`);
    return { slug: h.slug, ok: true, ms, added: items.length };
  } catch (e) {
    const ms = Date.now() - start;
    const err = (e as Error).message;
    console.log(`✗ ${err}`);
    return { slug: h.slug, ok: false, ms, error: err };
  }
}

async function main(): Promise<void> {
  const env = loadEnv();
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY missing');
  // SDK defaults silently hang for ~30 min on broken sockets (10-min request
  // timeout × 3 attempts). FAQ calls finish in ≤ 30s so a 120s ceiling
  // surfaces stuck requests fast. See concierge-voice-pipeline SKILL Rule 13.
  const openai = new OpenAI({ apiKey, timeout: 120_000, maxRetries: 2 });

  const opts = parseArgs();
  const hotels = await listHotelsNeedingExtension({
    includeDrafts: opts.includeDrafts,
    ...(opts.slugs ? { slugsFilter: opts.slugs } : {}),
  });
  console.log(
    `[faq-extend] ${hotels.length} hotels with FAQ < 10 (includeDrafts=${opts.includeDrafts}, target=${opts.target}, concurrency=${opts.concurrency})`,
  );

  let ok = 0;
  let fail = 0;

  if (opts.concurrency <= 1) {
    for (let i = 0; i < hotels.length; i += 1) {
      const r = await processOne(openai, hotels[i]!, i, hotels.length, opts.target);
      if (r.ok) ok += 1;
      else fail += 1;
      logEntry(r);
    }
  } else {
    // Simple pool: dispatch `concurrency` jobs at a time.
    let cursor = 0;
    async function worker() {
      while (cursor < hotels.length) {
        const i = cursor;
        cursor += 1;
        const r = await processOne(openai, hotels[i]!, i, hotels.length, opts.target);
        if (r.ok) ok += 1;
        else fail += 1;
        logEntry(r);
      }
    }
    const workers = Array.from({ length: opts.concurrency }, () => worker());
    await Promise.all(workers);
  }

  console.log(`\n━━━ Summary: ${ok}/${hotels.length} extended, ${fail} failed`);
}

main().catch((e) => {
  console.error('[faq-extend] FATAL', e);
  process.exit(1);
});
