/**
 * translate-hotels-en.ts — bulk FR → EN translator for every hotel
 * fiche in `public.hotels` that has rich FR content but empty / weak
 * EN equivalents. One LLM call per hotel (gpt-4o-mini, JSON mode),
 * Zod-validated, persisted as JSON-LD-ready UPDATE.
 *
 * Why one call per hotel?
 *   - Same context (hotel identity, register) → consistent style.
 *   - Cheaper than per-field calls.
 *   - Atomic update — partial failures don't leave EN/FR mismatched.
 *
 * SEO goal: double the indexable surface from ~106 FR pages to
 * ~212 FR+EN pages. English content is critical for international
 * luxury-travel queries (Booking, Forbes, Conde Nast).
 *
 * Usage:
 *   pnpm exec tsx src/i18n/translate-hotels-en.ts             (all needing EN)
 *   pnpm exec tsx src/i18n/translate-hotels-en.ts --slug=le-bristol-paris
 *   pnpm exec tsx src/i18n/translate-hotels-en.ts --limit=5 --dry-run
 *   pnpm exec tsx src/i18n/translate-hotels-en.ts --no-skip   (re-translate)
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
  `i18n-en-runlog-${new Date().toISOString().slice(0, 10)}.jsonl`,
);

// ─── env loader (Rule 7 — windows-dev-environment) ────────────────
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

interface CliArgs {
  readonly limit: number;
  readonly dryRun: boolean;
  readonly explicitSlugs: readonly string[];
  readonly skipExisting: boolean;
  readonly model: string;
  readonly concurrency: number;
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  let limit = Infinity;
  let dryRun = false;
  let skipExisting = true;
  let model = 'gpt-4o-mini';
  let concurrency = 1;
  const explicitSlugs: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i] ?? '';
    if (t === '--dry-run') dryRun = true;
    else if (t === '--no-skip') skipExisting = false;
    else if (t.startsWith('--limit=')) limit = Number(t.split('=')[1]);
    else if (t === '--limit') limit = Number(argv[++i]);
    else if (t.startsWith('--slug=')) explicitSlugs.push(t.split('=')[1] ?? '');
    else if (t === '--slug') explicitSlugs.push(argv[++i] ?? '');
    else if (t.startsWith('--model=')) model = String(t.split('=')[1]);
    else if (t.startsWith('--concurrency=')) {
      const n = Number(t.split('=')[1]);
      if (Number.isFinite(n) && n >= 1 && n <= 8) concurrency = n;
    }
  }
  return { limit, dryRun, explicitSlugs, skipExisting, model, concurrency };
}

interface FaqItem {
  question_fr?: string;
  question?: string;
  answer_fr?: string;
  answer?: string;
  question_en?: string;
  answer_en?: string;
}

interface SectionItem {
  key?: string;
  title_fr?: string;
  title_en?: string;
  body_fr?: string;
  body_en?: string;
}

interface SignatureItem {
  name?: string;
  summary_fr?: string;
  summary_en?: string;
}

interface AwardItem {
  name_fr?: string;
  name_en?: string;
  source?: string;
  url?: string;
}

interface HotelRow {
  slug: string;
  name: string;
  city: string;
  description_fr: string | null;
  description_en: string | null;
  meta_title_fr: string | null;
  meta_title_en: string | null;
  meta_desc_fr: string | null;
  meta_desc_en: string | null;
  faq_content: FaqItem[] | null;
  long_description_sections: SectionItem[] | null;
  signature_experiences: SignatureItem[] | null;
  awards: AwardItem[] | null;
}

// ─── DB ────────────────────────────────────────────────────────────
async function listHotelsNeedingEn(): Promise<readonly HotelRow[]> {
  const env = loadEnv();
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const conn = (env.SUPABASE_DB_POOLER_URL ?? env.SUPABASE_DB_URL ?? '').replace(
    /\?sslmode=require/,
    '',
  );
  const { Client } = pg;
  const cli = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await cli.connect();
  const { rows } = await cli.query(`
    select slug, name, city,
           description_fr, description_en, meta_title_fr, meta_title_en,
           meta_desc_fr, meta_desc_en,
           faq_content, long_description_sections, signature_experiences, awards
    from hotels
    where is_published = true
      and (
        coalesce(length(description_fr), 0) > 50
        or jsonb_array_length(coalesce(faq_content, '[]'::jsonb)) > 0
        or jsonb_array_length(coalesce(long_description_sections, '[]'::jsonb)) > 0
      )
    order by is_palace desc, name asc
  `);
  await cli.end();
  return rows as readonly HotelRow[];
}

function needsTranslation(h: HotelRow): boolean {
  // Description: has FR but EN empty/very short
  if ((h.description_fr ?? '').length > 50 && (h.description_en ?? '').length < 50) return true;

  // FAQ: any FR question without EN equivalent
  const faqMissingEn = (h.faq_content ?? []).some(
    (f) => (f.question_fr ?? f.question ?? '').length > 0 && !(f.question_en ?? '').length,
  );
  if (faqMissingEn) return true;

  // Sections: any section_fr without EN
  const secMissingEn = (h.long_description_sections ?? []).some(
    (s) => (s.body_fr ?? '').length > 100 && !(s.body_en ?? '').length,
  );
  if (secMissingEn) return true;

  // Signatures: any summary_fr without EN
  const sigMissingEn = (h.signature_experiences ?? []).some(
    (s) => (s.summary_fr ?? '').length > 20 && !(s.summary_en ?? '').length,
  );
  if (sigMissingEn) return true;

  return false;
}

// ─── LLM ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es traducteur français → anglais, spécialisé dans l'hôtellerie de luxe (palaces 5★, Relais & Châteaux), au service de la voix de marque "Le Concierge" (ADR-0011) de MyConciergeHotel.com. Voici tes règles strictes :

1. Style : Anglais britannique haut-de-gamme, registre du Financial Times Travel ou Condé Nast. Pas de calque syntaxique du français. La voix Concierge française (complice, confiante, secrets opérationnels) doit transparaître en anglais — légèrement plus formelle qu'en FR, mais jamais désincarnée. "Mon conseil" → "My tip", "à retenir" → "what to remember".
2. ⛔ Contrainte universelle (ADR-0011 §C2) : aucune phrase EN ne doit dépasser 25 mots. Si la phrase FR source en faisait 35, scinde la traduction EN en 2 phrases. Bénéfice : meilleure lisibilité Flesch en anglais et meilleur chunking AEO côté Google AI Overviews.
3. Fidélité : Aucune information ajoutée ou retirée. Tout chiffre, nom propre, marque, étoile reste exact.
4. Noms propres : NE TRADUIS PAS les noms de palaces, chefs, designers, marques. ("Le Bristol Paris" → "Le Bristol Paris", pas "The Bristol".) Mais traduis les titres descriptifs ("le palace parisien" → "the Parisian palace").
5. Cuisine : termes français techniques en italiques (e.g. *bouillabaisse*, *foie gras*, *garçon*) restent en français.
6. Géo : Villes traduites quand l'usage anglais l'impose ("Bordeaux" → "Bordeaux"; "Lyon" → "Lyon"; "Paris" → "Paris"; "Nice" → "Nice"; "Reims" → "Reims, Champagne"). Régions : "Bourgogne" → "Burgundy", "Bretagne" → "Brittany", "Côte d'Azur" → "French Riviera", "Provence" → "Provence".
7. Aucun mot inventé. Aucune Q&A inventée. Réponds STRICTEMENT au format JSON demandé.`;

// Lenient — accept any string (or missing). We re-validate downstream
// when merging into the existing FR row: empty/short EN won't overwrite
// a populated FR field.
const TranslatedFaqSchema = z.object({
  question_en: z.string().max(300).default(''),
  answer_en: z.string().max(2000).default(''),
});
const TranslatedSectionSchema = z.object({
  title_en: z.string().max(180).default(''),
  body_en: z.string().max(8000).default(''),
});
const TranslatedSignatureSchema = z.object({
  summary_en: z.string().max(400).default(''),
});
const TranslatedAwardSchema = z.object({
  name_en: z.string().max(120).default(''),
});
const TranslationOutputSchema = z.object({
  description_en: z.string().max(1200).optional(),
  meta_title_en: z.string().max(90).optional(),
  meta_desc_en: z.string().max(220).optional(),
  faq_en: z.array(TranslatedFaqSchema).default([]),
  sections_en: z.array(TranslatedSectionSchema).default([]),
  signatures_en: z.array(TranslatedSignatureSchema).default([]),
  awards_en: z.array(TranslatedAwardSchema).default([]),
});
type TranslationOutput = z.infer<typeof TranslationOutputSchema>;

function buildUserPrompt(h: HotelRow): string {
  const faqFr = (h.faq_content ?? []).map((f, i) => ({
    index: i,
    question_fr: f.question_fr ?? f.question ?? '',
    answer_fr: f.answer_fr ?? f.answer ?? '',
  }));
  const sectionsFr = (h.long_description_sections ?? []).map((s, i) => ({
    index: i,
    title_fr: s.title_fr ?? '',
    body_fr: s.body_fr ?? '',
  }));
  const signaturesFr = (h.signature_experiences ?? []).map((s, i) => ({
    index: i,
    name: s.name ?? '',
    summary_fr: s.summary_fr ?? '',
  }));
  const awardsFr = (h.awards ?? []).map((a, i) => ({
    index: i,
    name_fr: a.name_fr ?? '',
  }));

  return `Hôtel : ${h.name} (${h.city})

À traduire :

description_fr (court résumé éditorial, ~150 chars) :
${h.description_fr ?? '(vide — ne rends pas description_en)'}

meta_title_fr (SEO, ≤ 70 chars) :
${h.meta_title_fr ?? '(vide)'}

meta_desc_fr (SEO, ≤ 160 chars) :
${h.meta_desc_fr ?? '(vide)'}

FAQ (${faqFr.length} entrées, garde l'ordre EXACT — réponse = array faq_en[index]) :
${JSON.stringify(faqFr, null, 2)}

Sections long-form (${sectionsFr.length} entrées, garde l'ordre EXACT — réponse = array sections_en[index]) :
${JSON.stringify(sectionsFr, null, 2)}

Signature experiences (${signaturesFr.length} entrées, garde l'ordre EXACT — réponse = array signatures_en[index]) :
${JSON.stringify(signaturesFr, null, 2)}

Awards (${awardsFr.length} entrées, garde l'ordre EXACT — réponse = array awards_en[index]) :
${JSON.stringify(awardsFr, null, 2)}

Réponds AU FORMAT JSON :
{
  "description_en": "...",
  "meta_title_en": "...",
  "meta_desc_en": "...",
  "faq_en":         [ { "question_en": "...", "answer_en": "..." } ],
  "sections_en":    [ { "title_en": "...", "body_en": "..." } ],
  "signatures_en":  [ { "summary_en": "..." } ],
  "awards_en":      [ { "name_en": "..." } ]
}

Règles d'écho :
- Si tu n'as pas le FR pour un champ, OMETS-LE complètement (n'invente rien).
- Pour les arrays : MÊME LONGUEUR que l'entrée FR, MÊME ORDRE, indices implicites.`;
}

async function translateOne(client: OpenAI, model: string, h: HotelRow): Promise<TranslationOutput> {
  const prompt = buildUserPrompt(h);
  const resp = await client.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    temperature: 0.3,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
  });
  const raw = resp.choices[0]?.message?.content ?? '{}';
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`JSON.parse failed: ${(e as Error).message}`);
  }
  const safe = TranslationOutputSchema.safeParse(parsed);
  if (!safe.success) {
    const issues = safe.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`schema validation failed:\n${issues}`);
  }
  return safe.data;
}

// ─── persistence ──────────────────────────────────────────────────

// Only overwrite when EN is non-trivially populated. Empty/very short
// LLM output keeps the FR-only field untouched.
const isMeaningful = (s: string, min: number): boolean => s.trim().length >= min;

function mergeEnIntoFaq(faq: FaqItem[], en: { question_en: string; answer_en: string }[]): FaqItem[] {
  return faq.map((f, i) => {
    const t = en[i];
    if (!t) return f;
    return {
      ...f,
      ...(isMeaningful(t.question_en, 3) ? { question_en: t.question_en } : {}),
      ...(isMeaningful(t.answer_en, 10) ? { answer_en: t.answer_en } : {}),
    };
  });
}

function mergeEnIntoSections(
  sections: SectionItem[],
  en: { title_en: string; body_en: string }[],
): SectionItem[] {
  return sections.map((s, i) => {
    const t = en[i];
    if (!t) return s;
    return {
      ...s,
      ...(isMeaningful(t.title_en, 3) ? { title_en: t.title_en } : {}),
      ...(isMeaningful(t.body_en, 50) ? { body_en: t.body_en } : {}),
    };
  });
}

function mergeEnIntoSignatures(
  sigs: SignatureItem[],
  en: { summary_en: string }[],
): SignatureItem[] {
  return sigs.map((s, i) => {
    const t = en[i];
    if (!t || !isMeaningful(t.summary_en, 10)) return s;
    return { ...s, summary_en: t.summary_en };
  });
}

function mergeEnIntoAwards(awards: AwardItem[], en: { name_en: string }[]): AwardItem[] {
  return awards.map((a, i) => {
    const t = en[i];
    if (!t || !isMeaningful(t.name_en, 2)) return a;
    return { ...a, name_en: t.name_en };
  });
}

async function persistTranslation(h: HotelRow, t: TranslationOutput): Promise<void> {
  const env = loadEnv();
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const conn = (env.SUPABASE_DB_POOLER_URL ?? env.SUPABASE_DB_URL ?? '').replace(
    /\?sslmode=require/,
    '',
  );
  const { Client } = pg;
  const cli = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await cli.connect();
  try {
    const faqMerged = h.faq_content
      ? mergeEnIntoFaq(h.faq_content, t.faq_en as { question_en: string; answer_en: string }[])
      : null;
    const sectionsMerged = h.long_description_sections
      ? mergeEnIntoSections(
          h.long_description_sections,
          t.sections_en as { title_en: string; body_en: string }[],
        )
      : null;
    const signaturesMerged = h.signature_experiences
      ? mergeEnIntoSignatures(
          h.signature_experiences,
          t.signatures_en as { summary_en: string }[],
        )
      : null;
    const awardsMerged = h.awards
      ? mergeEnIntoAwards(h.awards, t.awards_en as { name_en: string }[])
      : null;

    await cli.query(
      `update hotels set
         description_en              = coalesce($2, description_en),
         meta_title_en               = coalesce($3, meta_title_en),
         meta_desc_en                = coalesce($4, meta_desc_en),
         faq_content                 = coalesce($5::jsonb, faq_content),
         long_description_sections   = coalesce($6::jsonb, long_description_sections),
         signature_experiences       = coalesce($7::jsonb, signature_experiences),
         awards                      = coalesce($8::jsonb, awards),
         updated_at                  = now()
       where slug = $1`,
      [
        h.slug,
        t.description_en ?? null,
        t.meta_title_en ?? null,
        t.meta_desc_en ?? null,
        faqMerged ? JSON.stringify(faqMerged) : null,
        sectionsMerged ? JSON.stringify(sectionsMerged) : null,
        signaturesMerged ? JSON.stringify(signaturesMerged) : null,
        awardsMerged ? JSON.stringify(awardsMerged) : null,
      ],
    );
  } finally {
    await cli.end();
  }
}

function logEntry(entry: Record<string, unknown>): void {
  appendFileSync(RUNLOG, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n');
}

// ─── main ──────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs();
  const env = loadEnv();
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY missing');
  const openai = new OpenAI({ apiKey });

  const all = await listHotelsNeedingEn();
  console.log(`[i18n-en] ${all.length} hotels with FR content`);

  let queue: readonly HotelRow[] = all;
  if (args.explicitSlugs.length > 0) {
    queue = all.filter((h) => args.explicitSlugs.includes(h.slug));
  }
  if (args.skipExisting) {
    queue = queue.filter(needsTranslation);
    console.log(`[i18n-en] ${queue.length} hotels need EN translation`);
  }
  if (queue.length > args.limit) queue = queue.slice(0, args.limit);

  if (args.dryRun) {
    console.log('\n[dry-run] would translate:');
    for (const h of queue) {
      console.log(`  - ${h.slug} (${h.name})`);
    }
    return;
  }

  console.log(`\n[i18n-en] runlog: ${RUNLOG}`);
  console.log(`[i18n-en] model: ${args.model}`);
  console.log(`[i18n-en] concurrency: ${args.concurrency}\n`);

  let ok = 0;
  let fail = 0;
  let nextIdx = 0;
  const total = queue.length;

  const worker = async (): Promise<void> => {
    while (true) {
      const idx = nextIdx++;
      if (idx >= total) return;
      const h = queue[idx];
      if (!h) continue;
      const start = Date.now();
      console.log(`[${idx + 1}/${total}] START ${h.slug} — ${h.name}`);
      try {
        const t = await translateOne(openai, args.model, h);
        await persistTranslation(h, t);
        const ms = Date.now() - start;
        console.log(
          `[${idx + 1}/${total}] ✓ ${h.slug} in ${(ms / 1000).toFixed(1)}s — desc=${(t.description_en ?? '').length}, faq=${t.faq_en.length}, sec=${t.sections_en.length}, sig=${t.signatures_en.length}, aw=${t.awards_en.length}`,
        );
        ok += 1;
        logEntry({
          slug: h.slug,
          ok: true,
          ms,
          counts: {
            desc: (t.description_en ?? '').length,
            faq: t.faq_en.length,
            sections: t.sections_en.length,
            sigs: t.signatures_en.length,
            awards: t.awards_en.length,
          },
        });
      } catch (e) {
        const ms = Date.now() - start;
        const err = (e as Error).message;
        console.error(`[${idx + 1}/${total}] ✗ ${h.slug} in ${(ms / 1000).toFixed(1)}s — ${err}`);
        fail += 1;
        logEntry({ slug: h.slug, ok: false, ms, error: err });
      }
    }
  };

  const workers = Array.from({ length: args.concurrency }, () => worker());
  await Promise.all(workers);

  console.log(`\n━━━ i18n-en summary ━━━`);
  console.log(`  ${ok}/${queue.length} translated, ${fail} failed`);
}

main().catch((e) => {
  console.error('[translate-hotels-en] FATAL', e);
  process.exit(1);
});
