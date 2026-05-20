/**
 * translate-guides-en.ts — bulk FR → EN translator for every published
 * editorial_guide that still has missing EN fields.
 *
 * Mirrors the architecture of `translate-hotels-en.ts`:
 *   - One LLM call per guide (atomic, consistent voice across all fields).
 *   - Send the entire guide FR payload + the indices that need translation;
 *     receive a Zod-validated JSON payload back.
 *   - Only persist EN fields that come back "meaningful" (non-empty,
 *     min length per field type) — never overwrite an existing EN field
 *     with an empty/garbage LLM output.
 *
 * Why one call per guide and not per field?
 *   - A guide is a coherent editorial piece; same brand voice across
 *     summary / sections / callouts / glossary / FAQ.
 *   - Cheaper than 30+ small calls.
 *   - One transaction → atomic UPDATE; partial failures don't leave the
 *     guide half-translated.
 *
 * SEO goal: lift the 50 published guides from ~70 % to 100 % EN coverage,
 * doubling the indexable surface on the English search market.
 *
 * Usage:
 *   pnpm exec tsx src/i18n/translate-guides-en.ts                 (all needing EN)
 *   pnpm exec tsx src/i18n/translate-guides-en.ts --slug=aix-en-provence
 *   pnpm exec tsx src/i18n/translate-guides-en.ts --slug=paris --slug=lyon
 *   pnpm exec tsx src/i18n/translate-guides-en.ts --limit=5 --dry-run
 *   pnpm exec tsx src/i18n/translate-guides-en.ts --concurrency=2
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
  `i18n-guides-en-runlog-${new Date().toISOString().slice(0, 10)}.jsonl`,
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
    v = q ? (q[1] ?? '') : (v.split(/\s+#/)[0]?.trim() ?? '');
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
    else if (t === '--slugs') {
      const v = argv[++i] ?? '';
      for (const s of v
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)) {
        explicitSlugs.push(s);
      }
    } else if (t.startsWith('--slugs=')) {
      const v = t.split('=')[1] ?? '';
      for (const s of v
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)) {
        explicitSlugs.push(s);
      }
    } else if (t.startsWith('--model=')) model = String(t.split('=')[1]);
    else if (t.startsWith('--concurrency=')) {
      const n = Number(t.split('=')[1]);
      if (Number.isFinite(n) && n >= 1 && n <= 8) concurrency = n;
    }
  }
  return { limit, dryRun, explicitSlugs, skipExisting, model, concurrency };
}

// ─── shape interfaces (mirror the JSONB payload) ─────────────────

interface SectionItem {
  readonly key?: string;
  readonly type?: string;
  readonly title_fr?: string;
  readonly title_en?: string;
  readonly body_fr?: string;
  readonly body_en?: string;
}

interface CalloutItem {
  readonly kind?: string;
  readonly title_fr?: string;
  readonly title_en?: string;
  readonly body_fr?: string;
  readonly body_en?: string;
}

interface GlossaryItem {
  readonly term_fr?: string;
  readonly term_en?: string;
  readonly definition_fr?: string;
  readonly definition_en?: string;
}

interface FaqItem {
  readonly category?: string;
  readonly question_fr?: string;
  readonly question_en?: string;
  readonly answer_fr?: string;
  readonly answer_en?: string;
}

interface GuideRow {
  readonly slug: string;
  readonly name_fr: string;
  readonly name_en: string | null;
  readonly summary_fr: string;
  readonly summary_en: string | null;
  readonly meta_title_fr: string | null;
  readonly meta_title_en: string | null;
  readonly meta_desc_fr: string | null;
  readonly meta_desc_en: string | null;
  readonly sections: SectionItem[] | null;
  readonly editorial_callouts: CalloutItem[] | null;
  readonly glossary: GlossaryItem[] | null;
  readonly faq: FaqItem[] | null;
}

// ─── DB ────────────────────────────────────────────────────────────
async function listGuides(slugFilter: readonly string[]): Promise<readonly GuideRow[]> {
  const env = loadEnv();
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
  const conn = (env['SUPABASE_DB_POOLER_URL'] ?? env['SUPABASE_DB_URL'] ?? '').replace(
    /[?&]sslmode=[^&]*/giu,
    '',
  );
  const { Client } = pg;
  const cli = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await cli.connect();
  try {
    const where =
      slugFilter.length > 0
        ? `where is_published = true and slug = any($1::text[])`
        : `where is_published = true`;
    const params = slugFilter.length > 0 ? [slugFilter as readonly string[]] : [];
    const { rows } = await cli.query<GuideRow>(
      `select slug, name_fr, name_en, summary_fr, summary_en,
              meta_title_fr, meta_title_en, meta_desc_fr, meta_desc_en,
              sections, editorial_callouts, glossary, faq
       from public.editorial_guides
       ${where}
       order by slug`,
      params,
    );
    return rows;
  } finally {
    await cli.end();
  }
}

function isEmpty(v: string | null | undefined): boolean {
  return v === null || v === undefined || v.trim().length === 0;
}

function needsTranslation(g: GuideRow): boolean {
  if (!isEmpty(g.name_fr) && isEmpty(g.name_en)) return true;
  if (!isEmpty(g.summary_fr) && isEmpty(g.summary_en)) return true;
  if (!isEmpty(g.meta_title_fr) && isEmpty(g.meta_title_en)) return true;
  if (!isEmpty(g.meta_desc_fr) && isEmpty(g.meta_desc_en)) return true;
  for (const s of g.sections ?? []) {
    if (!isEmpty(s.title_fr) && isEmpty(s.title_en)) return true;
    if (!isEmpty(s.body_fr) && isEmpty(s.body_en)) return true;
  }
  for (const c of g.editorial_callouts ?? []) {
    if (!isEmpty(c.title_fr) && isEmpty(c.title_en)) return true;
    if (!isEmpty(c.body_fr) && isEmpty(c.body_en)) return true;
  }
  for (const gl of g.glossary ?? []) {
    if (!isEmpty(gl.term_fr) && isEmpty(gl.term_en)) return true;
    if (!isEmpty(gl.definition_fr) && isEmpty(gl.definition_en)) return true;
  }
  for (const f of g.faq ?? []) {
    if (!isEmpty(f.question_fr) && isEmpty(f.question_en)) return true;
    if (!isEmpty(f.answer_fr) && isEmpty(f.answer_en)) return true;
  }
  return false;
}

// ─── LLM ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es traducteur français → anglais, spécialisé dans les guides éditoriaux haut-de-gamme (destinations de luxe, palaces 5★, art de vivre) au service de la marque MyConciergeHotel.com et de sa voix "Le Concierge" (ADR-0011). Voici tes règles strictes :

1. Style : Anglais britannique haut-de-gamme, registre du Financial Times Travel ou Condé Nast Traveller. Pas de calque syntaxique du français. La voix Concierge française (complice, confiante, secrets opérationnels) doit transparaître en anglais — légèrement plus formelle qu'en FR, mais jamais désincarnée.
2. ⛔ Contrainte universelle (ADR-0011) : aucune phrase EN ne doit dépasser 25 mots. Si la phrase FR source en faisait 35, scinde la traduction EN en 2 phrases. Bénéfice : lisibilité Flesch en anglais et meilleur chunking AEO côté Google AI Overviews.
3. Fidélité : Aucune information ajoutée ou retirée. Tout chiffre, nom propre, marque, étoile, date, distance reste exact.
4. Noms propres : NE TRADUIS PAS les noms de palaces, chefs, designers, marques, restaurants. ("Le Bristol Paris" → "Le Bristol Paris", pas "The Bristol".) Mais traduis les titres descriptifs ("le palace parisien" → "the Parisian palace").
5. Cuisine : termes français techniques (e.g. *bouillabaisse*, *foie gras*, *garçon*, *aïoli*) restent en français, en italiques implicites (les italiques sont gérées hors-traduction).
6. Géo : Villes traduites quand l'usage anglais l'impose ("Bordeaux" → "Bordeaux"; "Lyon" → "Lyon"; "Paris" → "Paris"; "Nice" → "Nice"; "Reims" → "Reims"). Régions : "Bourgogne" → "Burgundy", "Bretagne" → "Brittany", "Côte d'Azur" → "French Riviera", "Provence" → "Provence", "Vallée de la Loire" → "Loire Valley", "Alsace" → "Alsace".
7. Termes labels/distinctions : "palace (distinction Atout France)" → "Palace (Atout France distinction)", "Relais & Châteaux" reste tel quel, "trois étoiles Michelin" → "three Michelin stars", "Meilleur Ouvrier de France" reste FR ("Meilleur Ouvrier de France"), "patrimoine UNESCO" → "UNESCO heritage".
8. Banni : "discover", "explore", "indulge", "unveil", "embark on a journey", "perfect for", "unforgettable", "magical" — ces formules creuses cassent la voix Concierge. Préfère le fait nu : "Sit at the chef's table" plutôt que "Indulge in the chef's table experience".
9. Aucun mot inventé. Aucune Q&A inventée. Réponds STRICTEMENT au format JSON demandé.`;

// Lenient — accept any string (or missing). Downstream merge logic
// refuses to overwrite a populated FR field with empty EN, so this
// schema only needs to validate the shape.
const TranslatedSectionSchema = z.object({
  title_en: z.string().max(180).default(''),
  body_en: z.string().max(8000).default(''),
});
const TranslatedCalloutSchema = z.object({
  title_en: z.string().max(120).default(''),
  body_en: z.string().max(800).default(''),
});
const TranslatedGlossarySchema = z.object({
  term_en: z.string().max(120).default(''),
  definition_en: z.string().max(800).default(''),
});
const TranslatedFaqSchema = z.object({
  question_en: z.string().max(300).default(''),
  answer_en: z.string().max(2000).default(''),
});

const TranslationOutputSchema = z.object({
  name_en: z.string().max(120).optional(),
  summary_en: z.string().max(800).optional(),
  meta_title_en: z.string().max(90).optional(),
  meta_desc_en: z.string().max(220).optional(),
  sections_en: z.array(TranslatedSectionSchema).default([]),
  callouts_en: z.array(TranslatedCalloutSchema).default([]),
  glossary_en: z.array(TranslatedGlossarySchema).default([]),
  faq_en: z.array(TranslatedFaqSchema).default([]),
});
type TranslationOutput = z.infer<typeof TranslationOutputSchema>;

function buildUserPrompt(g: GuideRow): string {
  const sectionsFr = (g.sections ?? []).map((s, i) => ({
    index: i,
    title_fr: s.title_fr ?? '',
    body_fr: s.body_fr ?? '',
  }));
  const calloutsFr = (g.editorial_callouts ?? []).map((c, i) => ({
    index: i,
    title_fr: c.title_fr ?? '',
    body_fr: c.body_fr ?? '',
  }));
  const glossaryFr = (g.glossary ?? []).map((gl, i) => ({
    index: i,
    term_fr: gl.term_fr ?? '',
    definition_fr: gl.definition_fr ?? '',
  }));
  const faqFr = (g.faq ?? []).map((f, i) => ({
    index: i,
    question_fr: f.question_fr ?? '',
    answer_fr: f.answer_fr ?? '',
  }));

  return `Guide éditorial — destination : ${g.name_fr} (slug = ${g.slug})

À traduire :

name_fr (titre principal du guide, ≤ 80 chars) :
${g.name_fr}

summary_fr (chapeau du guide, ~400 chars) :
${g.summary_fr}

meta_title_fr (SEO, ≤ 70 chars) :
${g.meta_title_fr ?? '(vide — ne rends pas meta_title_en)'}

meta_desc_fr (SEO, ≤ 160 chars) :
${g.meta_desc_fr ?? '(vide — ne rends pas meta_desc_en)'}

Sections long-form (${sectionsFr.length} entrées, garde l'ordre EXACT — réponse = array sections_en[index]) :
${JSON.stringify(sectionsFr, null, 2)}

Editorial callouts (${calloutsFr.length} entrées, garde l'ordre EXACT — réponse = array callouts_en[index]) :
${JSON.stringify(calloutsFr, null, 2)}

Glossary (${glossaryFr.length} entrées, garde l'ordre EXACT — réponse = array glossary_en[index]) :
${JSON.stringify(glossaryFr, null, 2)}

FAQ (${faqFr.length} entrées, garde l'ordre EXACT — réponse = array faq_en[index]) :
${JSON.stringify(faqFr, null, 2)}

Réponds AU FORMAT JSON :
{
  "name_en":       "...",
  "summary_en":    "...",
  "meta_title_en": "...",
  "meta_desc_en":  "...",
  "sections_en":   [ { "title_en": "...", "body_en": "..." } ],
  "callouts_en":   [ { "title_en": "...", "body_en": "..." } ],
  "glossary_en":   [ { "term_en": "...", "definition_en": "..." } ],
  "faq_en":        [ { "question_en": "...", "answer_en": "..." } ]
}

Règles d'écho :
- Si tu n'as pas le FR pour un champ scalaire (meta_title, meta_desc), OMETS-LE complètement (n'invente rien).
- Pour les arrays : MÊME LONGUEUR que l'entrée FR, MÊME ORDRE, indices implicites. Si une entrée FR est vide, retourne une entrée EN vide à la même position.`;
}

async function translateOne(
  client: OpenAI,
  model: string,
  g: GuideRow,
): Promise<TranslationOutput> {
  const prompt = buildUserPrompt(g);
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
    const issues = safe.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`schema validation failed:\n${issues}`);
  }
  return safe.data;
}

// ─── persistence ──────────────────────────────────────────────────

// Only overwrite when EN is non-trivially populated. Empty/very short
// LLM output keeps the FR-only field untouched.
const isMeaningful = (s: string | undefined, min: number): boolean =>
  s !== undefined && s.trim().length >= min;

function mergeEnIntoSections(
  sections: SectionItem[],
  en: { title_en: string; body_en: string }[],
): SectionItem[] {
  return sections.map((s, i) => {
    const t = en[i];
    if (!t) return s;
    return {
      ...s,
      ...(isMeaningful(t.title_en, 3) && isEmpty(s.title_en) ? { title_en: t.title_en } : {}),
      ...(isMeaningful(t.body_en, 50) && isEmpty(s.body_en) ? { body_en: t.body_en } : {}),
    };
  });
}

function mergeEnIntoCallouts(
  callouts: CalloutItem[],
  en: { title_en: string; body_en: string }[],
): CalloutItem[] {
  return callouts.map((c, i) => {
    const t = en[i];
    if (!t) return c;
    return {
      ...c,
      ...(isMeaningful(t.title_en, 3) && isEmpty(c.title_en) ? { title_en: t.title_en } : {}),
      ...(isMeaningful(t.body_en, 20) && isEmpty(c.body_en) ? { body_en: t.body_en } : {}),
    };
  });
}

function mergeEnIntoGlossary(
  glossary: GlossaryItem[],
  en: { term_en: string; definition_en: string }[],
): GlossaryItem[] {
  return glossary.map((gl, i) => {
    const t = en[i];
    if (!t) return gl;
    return {
      ...gl,
      ...(isMeaningful(t.term_en, 2) && isEmpty(gl.term_en) ? { term_en: t.term_en } : {}),
      ...(isMeaningful(t.definition_en, 20) && isEmpty(gl.definition_en)
        ? { definition_en: t.definition_en }
        : {}),
    };
  });
}

function mergeEnIntoFaq(
  faq: FaqItem[],
  en: { question_en: string; answer_en: string }[],
): FaqItem[] {
  return faq.map((f, i) => {
    const t = en[i];
    if (!t) return f;
    return {
      ...f,
      ...(isMeaningful(t.question_en, 3) && isEmpty(f.question_en)
        ? { question_en: t.question_en }
        : {}),
      ...(isMeaningful(t.answer_en, 20) && isEmpty(f.answer_en) ? { answer_en: t.answer_en } : {}),
    };
  });
}

async function persistTranslation(g: GuideRow, t: TranslationOutput): Promise<void> {
  const env = loadEnv();
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
  const conn = (env['SUPABASE_DB_POOLER_URL'] ?? env['SUPABASE_DB_URL'] ?? '').replace(
    /[?&]sslmode=[^&]*/giu,
    '',
  );
  const { Client } = pg;
  const cli = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await cli.connect();
  try {
    const sectionsMerged =
      g.sections !== null
        ? mergeEnIntoSections(g.sections, t.sections_en as { title_en: string; body_en: string }[])
        : null;
    const calloutsMerged =
      g.editorial_callouts !== null
        ? mergeEnIntoCallouts(
            g.editorial_callouts,
            t.callouts_en as { title_en: string; body_en: string }[],
          )
        : null;
    const glossaryMerged =
      g.glossary !== null
        ? mergeEnIntoGlossary(
            g.glossary,
            t.glossary_en as { term_en: string; definition_en: string }[],
          )
        : null;
    const faqMerged =
      g.faq !== null
        ? mergeEnIntoFaq(g.faq, t.faq_en as { question_en: string; answer_en: string }[])
        : null;

    const newName = isMeaningful(t.name_en, 2) && isEmpty(g.name_en) ? t.name_en : g.name_en;
    const newSummary =
      isMeaningful(t.summary_en, 30) && isEmpty(g.summary_en) ? t.summary_en : g.summary_en;
    const newMetaTitle =
      isMeaningful(t.meta_title_en, 10) && isEmpty(g.meta_title_en)
        ? t.meta_title_en
        : g.meta_title_en;
    const newMetaDesc =
      isMeaningful(t.meta_desc_en, 20) && isEmpty(g.meta_desc_en) ? t.meta_desc_en : g.meta_desc_en;

    await cli.query(
      `update public.editorial_guides set
         name_en       = $1,
         summary_en    = $2,
         meta_title_en = $3,
         meta_desc_en  = $4,
         sections      = coalesce($5::jsonb, sections),
         editorial_callouts = coalesce($6::jsonb, editorial_callouts),
         glossary      = coalesce($7::jsonb, glossary),
         faq           = coalesce($8::jsonb, faq),
         updated_at    = now()
       where slug = $9`,
      [
        newName,
        newSummary,
        newMetaTitle,
        newMetaDesc,
        sectionsMerged ? JSON.stringify(sectionsMerged) : null,
        calloutsMerged ? JSON.stringify(calloutsMerged) : null,
        glossaryMerged ? JSON.stringify(glossaryMerged) : null,
        faqMerged ? JSON.stringify(faqMerged) : null,
        g.slug,
      ],
    );
  } finally {
    await cli.end();
  }
}

// ─── runner ────────────────────────────────────────────────────────

interface RunResult {
  readonly slug: string;
  readonly status: 'ok' | 'skipped' | 'failed';
  readonly elapsedMs: number;
  readonly reason?: string;
  readonly tokensIn?: number;
  readonly tokensOut?: number;
}

async function runWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<RunResult>,
): Promise<readonly RunResult[]> {
  const results: RunResult[] = [];
  let cursor = 0;
  async function pull(): Promise<void> {
    while (cursor < items.length) {
      const idx = cursor++;
      const item = items[idx];
      if (item === undefined) return;
      results.push(await worker(item));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => pull()));
  return results;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const env = loadEnv();
  const apiKey = env['OPENAI_API_KEY'];
  if (apiKey === undefined || apiKey.trim() === '') {
    throw new Error('OPENAI_API_KEY missing in .env.local');
  }
  const openai = new OpenAI({ apiKey });

  console.log(
    `[translate-guides-en] model=${args.model} concurrency=${args.concurrency} dryRun=${args.dryRun} skipExisting=${args.skipExisting}`,
  );

  const allGuides = await listGuides(args.explicitSlugs);
  let candidates = allGuides;
  if (args.skipExisting) {
    candidates = allGuides.filter(needsTranslation);
  }
  candidates = candidates.slice(0, args.limit);

  console.log(
    `[translate-guides-en] ${allGuides.length} published guide(s), ${candidates.length} need translation`,
  );
  if (candidates.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  const t0 = Date.now();
  const results = await runWithConcurrency(candidates, args.concurrency, async (g) => {
    const start = Date.now();
    try {
      console.log(`  → ${g.slug} translating…`);
      const t = await translateOne(openai, args.model, g);
      if (!args.dryRun) {
        await persistTranslation(g, t);
      }
      const elapsed = Date.now() - start;
      const line = {
        ts: new Date().toISOString(),
        slug: g.slug,
        status: 'ok',
        elapsedMs: elapsed,
        dryRun: args.dryRun,
      };
      appendFileSync(RUNLOG, `${JSON.stringify(line)}\n`);
      console.log(`  ✓ ${g.slug} done in ${(elapsed / 1000).toFixed(1)}s`);
      return { slug: g.slug, status: 'ok', elapsedMs: elapsed } as RunResult;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      const elapsed = Date.now() - start;
      const line = {
        ts: new Date().toISOString(),
        slug: g.slug,
        status: 'failed',
        elapsedMs: elapsed,
        reason,
      };
      appendFileSync(RUNLOG, `${JSON.stringify(line)}\n`);
      console.log(`  ✗ ${g.slug} FAILED in ${(elapsed / 1000).toFixed(1)}s — ${reason}`);
      return { slug: g.slug, status: 'failed', elapsedMs: elapsed, reason } as RunResult;
    }
  });

  const ok = results.filter((r) => r.status === 'ok').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  const elapsedMin = ((Date.now() - t0) / 60_000).toFixed(1);
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Done in ${elapsedMin}min — ok=${ok}, failed=${failed}, dryRun=${args.dryRun}`);
  console.log(`Runlog: ${RUNLOG}`);
}

main().catch((err: unknown) => {
  console.error('[translate-guides-en] FATAL:', err);
  process.exit(1);
});
