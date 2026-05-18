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
    v = q ? (q[1] ?? '') : v.split(/\s+#/)[0]?.trim() ?? '';
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
    .max(10),
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

async function listHotelsNeedingExtension(): Promise<HotelRow[]> {
  const env = loadEnv();
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const conn = (env.SUPABASE_DB_POOLER_URL ?? '').replace(/\?sslmode=require/, '');
  const cli = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await cli.connect();
  try {
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
    }>(`
      select slug, name, city, region, address, description_fr,
             faq_content, policies, number_of_rooms
      from hotels
      where is_published = true
        and coalesce(jsonb_array_length(faq_content), 0) < 10
      order by slug`);
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
): Promise<FaqGenItems> {
  const currentCount = (hotel.faq_content ?? []).length;
  const missing = Math.max(0, 10 - currentCount + 1); // overshoot by 1
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

async function main(): Promise<void> {
  const env = loadEnv();
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY missing');
  const openai = new OpenAI({ apiKey });

  const hotels = await listHotelsNeedingExtension();
  console.log(`[faq-extend] ${hotels.length} hotels with FAQ < 10`);

  let ok = 0;
  let fail = 0;
  for (let i = 0; i < hotels.length; i++) {
    const h = hotels[i]!;
    const before = (h.faq_content ?? []).length;
    const start = Date.now();
    process.stdout.write(`[${i + 1}/${hotels.length}] ${h.slug} (${before}) ... `);
    try {
      const items = await extendOne(openai, 'gpt-4o-mini', h);
      await persistFaqExtension(h, items);
      const ms = Date.now() - start;
      console.log(`✓ +${items.length} in ${(ms / 1000).toFixed(1)}s`);
      ok += 1;
      logEntry({ slug: h.slug, ok: true, ms, added: items.length });
    } catch (e) {
      const ms = Date.now() - start;
      const err = (e as Error).message;
      console.log(`✗ ${err}`);
      fail += 1;
      logEntry({ slug: h.slug, ok: false, ms, error: err });
    }
  }
  console.log(`\n━━━ Summary: ${ok}/${hotels.length} extended, ${fail} failed`);
}

main().catch((e) => {
  console.error('[faq-extend] FATAL', e);
  process.exit(1);
});
