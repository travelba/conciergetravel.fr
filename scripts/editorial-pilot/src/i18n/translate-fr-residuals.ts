/**
 * translate-fr-residuals.ts — fix English residuals in the French interface.
 *
 * Audit (May 2026, FR-residuals report) surfaced two pockets of English
 * content leaking into the FR rendering pipeline despite the data being
 * stored in `_fr`-suffixed columns:
 *
 *   1. `hotels.restaurant_info.venues[*].type_fr` — short cuisine labels
 *      ("Mediterranean", "Italian", "Modern Cuisine"…) populated by an
 *      external enrichment source (Apify scrapes, Yonder, Booking JSON-LD)
 *      where the data layering kept the EN value as the FR fallback when
 *      no native FR string was present. Closed-vocabulary problem → handled
 *      by a deterministic dictionary (no LLM needed, exact translations).
 *
 *   2. `hotels.policies.pets.notes_fr` — full English sentences copy-pasted
 *      verbatim into the FR field (same enrichment pipeline). Open-text
 *      problem with 47 unique strings → LLM-translated in the Concierge
 *      voice (ADR-0011 EDITORIAL_VOICE.md): factual, complice, ≤ 25 words
 *      per sentence, no commercial superlatives.
 *
 * Output:
 *   - Direct UPDATEs against Supabase (one statement per affected hotel).
 *   - Audit JSONL log at `out/fr-residuals-runlog-<date>.jsonl`.
 *   - Optional SQL dump at `packages/db/migrations/0041_<...>.sql` (--dump-migration).
 *
 * Usage:
 *   pnpm exec tsx src/i18n/translate-fr-residuals.ts --dry-run
 *   pnpm exec tsx src/i18n/translate-fr-residuals.ts --pets-only
 *   pnpm exec tsx src/i18n/translate-fr-residuals.ts --cuisines-only
 *   pnpm exec tsx src/i18n/translate-fr-residuals.ts --dump-migration=0041_fr_residuals_translations.sql
 *   pnpm exec tsx src/i18n/translate-fr-residuals.ts             (applies both, default)
 */

import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import OpenAI from 'openai';
import { z } from 'zod';

const RUNLOG_DIR = resolve(process.cwd(), 'out');
mkdirSync(RUNLOG_DIR, { recursive: true });
const RUNLOG = resolve(
  RUNLOG_DIR,
  `fr-residuals-runlog-${new Date().toISOString().slice(0, 10)}.jsonl`,
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
  readonly dryRun: boolean;
  readonly petsOnly: boolean;
  readonly cuisinesOnly: boolean;
  readonly dumpMigration: string | null;
  readonly model: string;
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  let dryRun = false;
  let petsOnly = false;
  let cuisinesOnly = false;
  let dumpMigration: string | null = null;
  let model = 'gpt-4o-mini';
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i] ?? '';
    if (t === '--dry-run') dryRun = true;
    else if (t === '--pets-only') petsOnly = true;
    else if (t === '--cuisines-only') cuisinesOnly = true;
    else if (t.startsWith('--dump-migration=')) dumpMigration = String(t.split('=')[1] ?? '');
    else if (t === '--dump-migration') dumpMigration = String(argv[++i] ?? '');
    else if (t.startsWith('--model=')) model = String(t.split('=')[1] ?? 'gpt-4o-mini');
  }
  return { dryRun, petsOnly, cuisinesOnly, dumpMigration, model };
}

function log(event: string, payload: Record<string, unknown>): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), event, ...payload });
  appendFileSync(RUNLOG, `${line}\n`, 'utf8');
}

// ──────────────────────────────────────────────────────────────────
// Part 1 — cuisine types dictionary
// ──────────────────────────────────────────────────────────────────
//
// Closed-vocabulary translations for `restaurant_info.venues[*].type_fr`.
// Keys are the English strings observed in the audit (May 2026, 28 distinct
// labels covering 56 hotels). Values are the canonical French equivalents
// the editorial team would write by hand. We deliberately avoid:
//   - Excess elegance ("haute cuisine française avec une twist" → no).
//   - Brand-specific tokens (Michelin, Relais & Châteaux, etc.) — those are
//     facts handled elsewhere.
//
// Any unseen English label falls through (we WARN and skip the venue).

const CUISINE_FR_MAP: Record<string, string> = {
  // Pure cuisine labels
  Mediterranean: 'Méditerranéenne',
  'Mediterranean Cuisine': 'Cuisine méditerranéenne',
  Italian: 'Italienne',
  French: 'Française',
  'French cuisine': 'Cuisine française',
  Japanese: 'Japonaise',
  Chinese: 'Chinoise',
  Asian: 'Asiatique',
  Seafood: 'Fruits de mer',

  // Composite labels
  'Modern Cuisine': 'Cuisine moderne',
  'Classic Cuisine': 'Cuisine classique',
  'Traditional Cuisine': 'Cuisine traditionnelle',
  'Traditional cuisine': 'Cuisine traditionnelle',
  'Gastronomic Cuisine': 'Cuisine gastronomique',
  'Creative, Modern Cuisine': 'Cuisine créative et moderne',
  'Indulgent cuisine': 'Cuisine gourmande',

  // Single-word adjectives (kept short)
  Creative: 'Créative',
  Gastronomic: 'Gastronomique',
  Bistronomic: 'Bistronomique',
  Alsatian: 'Alsacienne',
  Cantonese: 'Cantonaise',
  Peruvian: 'Péruvienne',
  Burgundy: 'Bourguignonne',
  Burgundian: 'Bourguignonne',

  // Regional / fusion
  'Mediterranean and Provençal': 'Méditerranéenne et provençale',
  'Mediterranean and Corsica flavors': 'Méditerranéenne et corse',
  'Japanese and Peruvian': 'Japonaise et péruvienne',
  'Peruvian-Japanese': 'Péruvienne-japonaise',
  'Corsican and Italian': 'Corse et italienne',
  'French, Asian': 'Française et asiatique',

  // Descriptive phrases (translated as short FR labels, not sentences)
  'haute French cuisine': 'Haute cuisine française',
  'seasonal French classics': 'Classiques français de saison',
  'traditional French cuisine with a twist': 'Cuisine française traditionnelle revisitée',
  'French brasserie': 'Brasserie française',
  'French classics': 'Classiques français',
  'French gastronomic tradition': 'Tradition gastronomique française',
  'French-style grill': 'Grill à la française',
};

// ──────────────────────────────────────────────────────────────────
// Part 2 — pets notes LLM translator (Concierge voice)
// ──────────────────────────────────────────────────────────────────

const PETS_SYSTEM_PROMPT = `Tu es traducteur anglais → français spécialisé dans l'hôtellerie de luxe (palaces 5★, Relais & Châteaux) au service de la voix éditoriale "Le Concierge" (ADR-0011) de MyConciergeHotel.com.

Tu traduis UNIQUEMENT des notes de politique animaux ("pets policy notes") affichées dans le bloc "Politiques & infos pratiques" des fiches hôtels (CDC §2 bloc 9).

Règles strictes :

1. Voix Concierge — factuel, précis, complice. JAMAIS commercial. Ne dis pas "Bien sûr !", "Avec plaisir !", "Bonne nouvelle !". Pas de superlatifs interdits (incroyable, magnifique, exceptionnel, magique, sublime).

2. Brièveté absolue — chaque phrase FR ≤ 25 mots (contrainte universelle ADR-0011 §C2). Si l'anglais source fait une seule longue phrase, scinde-la en 2 phrases courtes côté FR. Préserve la totalité de l'information factuelle.

3. Fidélité totale — aucune information ajoutée ou retirée. Tout chiffre (poids, prix, nombre d'animaux), nom propre (hôtel, restaurant, chef) et marque reste EXACT et au même format. Devise et symbole inchangés (EUR, €, 35 EUR, etc.).

4. Préserver le sens hôtelier nuancé :
   - "Pets are allowed on request. Charges may be applicable." → "Animaux acceptés sur demande. Un supplément peut s'appliquer."
   - "Pet friendly" → "Animaux acceptés"
   - "Pet amenities available" → "Équipements pour animaux disponibles"
   - "Service animals are exempt from fees/restrictions" → "Les animaux d'assistance sont exemptés des frais et restrictions."
   - "dog friendly" → "Hôtel accueillant les chiens" (pas "dog-friendly")

5. Lexique tabou — NE traduis PAS "pet-friendly" littéralement comme "ami des animaux". Préfère "qui accepte les animaux" ou "où les animaux sont les bienvenus" selon le contexte.

6. Tu réponds STRICTEMENT au format JSON demandé. Aucune phrase d'introduction. Aucune note de bas de page.`;

const TranslationOutput = z.object({
  notes_fr: z.string().min(1).max(2000),
});
type TranslationOutput = z.infer<typeof TranslationOutput>;

function buildPetsUserPrompt(notesEn: string): string {
  return `Traduis cette note de politique animaux EN → FR :

"""
${notesEn}
"""

Réponds AU FORMAT JSON STRICT :
{
  "notes_fr": "<traduction française, voix Concierge, phrases ≤ 25 mots>"
}`;
}

async function translatePetsNote(client: OpenAI, model: string, notesEn: string): Promise<string> {
  const resp = await client.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    temperature: 0.2,
    messages: [
      { role: 'system', content: PETS_SYSTEM_PROMPT },
      { role: 'user', content: buildPetsUserPrompt(notesEn) },
    ],
  });
  const raw = resp.choices[0]?.message.content ?? '';
  const parsed = TranslationOutput.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(`Zod parse failed: ${parsed.error.message}\nraw=${raw}`);
  }
  return parsed.data.notes_fr;
}

// ──────────────────────────────────────────────────────────────────
// DB layer
// ──────────────────────────────────────────────────────────────────

interface CuisineRow {
  slug: string;
  restaurant_info: { venues?: Array<Record<string, unknown>> } & Record<string, unknown>;
}

interface PetsRow {
  slug: string;
  policies: Record<string, unknown>;
  notes_en: string;
}

async function openPgClient(): Promise<pg.Client> {
  const env = loadEnv();
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const conn = (env.SUPABASE_DB_POOLER_URL ?? env.SUPABASE_DB_URL ?? '').replace(
    /\?sslmode=require/,
    '',
  );
  if (!conn) throw new Error('SUPABASE_DB_POOLER_URL or SUPABASE_DB_URL missing in .env.local');
  const { Client } = pg;
  const cli = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await cli.connect();
  return cli;
}

async function fetchCuisineRows(cli: pg.Client): Promise<readonly CuisineRow[]> {
  const englishKeys = Object.keys(CUISINE_FR_MAP);
  const englishKeysJson = JSON.stringify(englishKeys);
  const { rows } = await cli.query(
    `
      select h.slug, h.restaurant_info
      from public.hotels h
      where h.is_published = true
        and jsonb_typeof(h.restaurant_info->'venues') = 'array'
        and exists (
          select 1
          from jsonb_array_elements(h.restaurant_info->'venues') as v
          where v->>'type_fr' = any($1::text[])
        )
      order by h.slug
    `,
    [englishKeys],
  );
  log('fetch:cuisine', {
    count: rows.length,
    english_keys_count: englishKeys.length,
    sample_keys: englishKeysJson.slice(0, 200),
  });
  return rows as readonly CuisineRow[];
}

async function fetchPetsRows(cli: pg.Client): Promise<readonly PetsRow[]> {
  const { rows } = await cli.query(`
    select
      h.slug,
      h.policies,
      h.policies->'pets'->>'notes_en' as notes_en
    from public.hotels h
    where h.is_published = true
      and h.policies->'pets'->>'notes_fr' is not null
      and h.policies->'pets'->>'notes_fr' = h.policies->'pets'->>'notes_en'
    order by h.slug
  `);
  log('fetch:pets', { count: rows.length });
  return rows as readonly PetsRow[];
}

// ──────────────────────────────────────────────────────────────────
// Pure transformations
// ──────────────────────────────────────────────────────────────────

interface CuisineTransform {
  readonly slug: string;
  readonly newVenues: Array<Record<string, unknown>>;
  readonly changes: Array<{ index: number; from: string; to: string }>;
}

function transformCuisineRow(row: CuisineRow): CuisineTransform | null {
  const venues = Array.isArray(row.restaurant_info.venues) ? row.restaurant_info.venues : [];
  const changes: Array<{ index: number; from: string; to: string }> = [];
  const newVenues = venues.map((v, idx) => {
    const typeFr = typeof v['type_fr'] === 'string' ? (v['type_fr'] as string) : '';
    const replacement = CUISINE_FR_MAP[typeFr];
    if (replacement !== undefined && replacement !== typeFr) {
      changes.push({ index: idx, from: typeFr, to: replacement });
      return { ...v, type_fr: replacement };
    }
    return v;
  });
  if (changes.length === 0) return null;
  return { slug: row.slug, newVenues, changes };
}

// ──────────────────────────────────────────────────────────────────
// Apply / dump
// ──────────────────────────────────────────────────────────────────

function sqlQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function buildCuisineUpdate(t: CuisineTransform): string {
  const jsonbVenues = JSON.stringify(t.newVenues);
  return `update public.hotels
set restaurant_info = jsonb_set(restaurant_info, '{venues}', ${sqlQuote(jsonbVenues)}::jsonb)
where slug = ${sqlQuote(t.slug)};`;
}

function buildPetsUpdate(slug: string, notesFr: string): string {
  const jsonValue = JSON.stringify(notesFr);
  return `update public.hotels
set policies = jsonb_set(policies, '{pets,notes_fr}', ${sqlQuote(jsonValue)}::jsonb)
where slug = ${sqlQuote(slug)};`;
}

async function applyUpdate(
  cli: pg.Client,
  slug: string,
  jsonPath: readonly string[],
  jsonValue: unknown,
): Promise<void> {
  const root = jsonPath[0] === 'restaurant_info' ? 'restaurant_info' : 'policies';
  const subPath = jsonPath.slice(1);
  await cli.query(
    `
      update public.hotels
      set ${root} = jsonb_set(${root}, $1::text[], $2::jsonb)
      where slug = $3
    `,
    [`{${subPath.join(',')}}`, JSON.stringify(jsonValue), slug],
  );
}

// ──────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────

interface PendingUpdate {
  readonly kind: 'cuisine' | 'pets';
  readonly slug: string;
  readonly summary: string;
  readonly sql: string;
  apply: (cli: pg.Client) => Promise<void>;
}

async function main(): Promise<void> {
  const args = parseArgs();
  log('start', { args });

  const cli = await openPgClient();
  let openai: OpenAI | null = null;
  if (!args.cuisinesOnly) {
    const env = loadEnv();
    if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY missing in .env.local');
    openai = new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 60_000, maxRetries: 2 });
  }

  const pending: PendingUpdate[] = [];

  // ── Step A: cuisines ────────────────────────────────────────────
  if (!args.petsOnly) {
    const cuisineRows = await fetchCuisineRows(cli);
    let unmatchedSamples: Array<{ slug: string; type_fr: string }> = [];
    for (const row of cuisineRows) {
      const t = transformCuisineRow(row);
      if (!t) continue;
      // Detect unmatched English labels we didn't cover in the dict
      for (const v of row.restaurant_info.venues ?? []) {
        const typeFr = typeof v['type_fr'] === 'string' ? (v['type_fr'] as string) : '';
        if (
          typeFr &&
          CUISINE_FR_MAP[typeFr] === undefined &&
          /^[A-Z][a-zA-Z\s,&'-]{1,80}$/.test(typeFr)
        ) {
          unmatchedSamples.push({ slug: row.slug, type_fr: typeFr });
        }
      }
      const slug = row.slug;
      const newVenues = t.newVenues;
      pending.push({
        kind: 'cuisine',
        slug,
        summary: `${t.changes.length} venue(s) — ${t.changes.map((c) => `"${c.from}"→"${c.to}"`).join(', ')}`,
        sql: buildCuisineUpdate(t),
        apply: async (c) => applyUpdate(c, slug, ['restaurant_info', 'venues'], newVenues),
      });
      log('plan:cuisine', { slug: row.slug, changes: t.changes });
    }
    if (unmatchedSamples.length > 0) {
      const unique = Array.from(new Set(unmatchedSamples.map((u) => u.type_fr))).slice(0, 20);
      console.warn(
        `[warn] ${unmatchedSamples.length} unmatched type_fr fields (kept as-is). Unique sample: ${JSON.stringify(unique)}`,
      );
      log('warn:unmatched_cuisine', { count: unmatchedSamples.length, unique });
    }
  }

  // ── Step B: pets ────────────────────────────────────────────────
  if (!args.cuisinesOnly && openai) {
    const petsRows = await fetchPetsRows(cli);
    // Dedupe — same English string → translate once
    const uniqueNotes = Array.from(new Set(petsRows.map((r) => r.notes_en)));
    console.log(
      `[pets] ${petsRows.length} rows → ${uniqueNotes.length} unique strings to translate`,
    );
    const cache = new Map<string, string>();
    let n = 0;
    for (const noteEn of uniqueNotes) {
      n++;
      try {
        const noteFr = await translatePetsNote(openai, args.model, noteEn);
        cache.set(noteEn, noteFr);
        console.log(
          `[pets ${n}/${uniqueNotes.length}] ✓ "${noteEn.slice(0, 50)}…" → "${noteFr.slice(0, 60)}…"`,
        );
        log('llm:pets:ok', { en: noteEn, fr: noteFr });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[pets ${n}/${uniqueNotes.length}] ✗ "${noteEn.slice(0, 50)}…": ${msg}`);
        log('llm:pets:fail', { en: noteEn, error: msg });
      }
    }
    for (const row of petsRows) {
      const noteFr = cache.get(row.notes_en);
      if (!noteFr) continue;
      const slug = row.slug;
      const translation = noteFr;
      pending.push({
        kind: 'pets',
        slug,
        summary: `"${row.notes_en.slice(0, 60)}…" → "${noteFr.slice(0, 60)}…"`,
        sql: buildPetsUpdate(slug, noteFr),
        apply: async (c) => applyUpdate(c, slug, ['policies', 'pets', 'notes_fr'], translation),
      });
      log('plan:pets', { slug: row.slug, notes_en: row.notes_en, notes_fr: noteFr });
    }
  }

  console.log(
    `\n[plan] ${pending.length} hotel update(s) ready (cuisine: ${pending.filter((p) => p.kind === 'cuisine').length}, pets: ${pending.filter((p) => p.kind === 'pets').length}).`,
  );

  // ── Dump migration ──────────────────────────────────────────────
  if (args.dumpMigration) {
    const target = resolve(process.cwd(), '../../packages/db/migrations', args.dumpMigration);
    const header = `-- ${args.dumpMigration} — auto-generated by translate-fr-residuals.ts
-- Restores the French canonical form of two pockets of English content
-- that leaked into _fr-suffixed columns:
--   (a) ${pending.filter((p) => p.kind === 'cuisine').length} hotels — restaurant_info.venues[*].type_fr (dictionary)
--   (b) ${pending.filter((p) => p.kind === 'pets').length} hotels — policies.pets.notes_fr (LLM, Concierge voice)
-- Source audit: out/fr-residuals-runlog-${new Date().toISOString().slice(0, 10)}.jsonl
-- Forward-only. Idempotent: re-running on already-translated rows is a no-op.

`;
    const body = pending
      .map((p) => `-- [${p.kind}] ${p.slug} — ${p.summary}\n${p.sql}`)
      .join('\n\n');
    const footer = `\n\ninsert into public._cct_sql_migrations (filename)\nvalues ('${args.dumpMigration}')\n  on conflict do nothing;\n`;
    writeFileSync(target, header + body + footer, 'utf8');
    console.log(`[dump] wrote ${target} (${pending.length} statements)`);
  }

  // ── Apply ───────────────────────────────────────────────────────
  if (!args.dryRun) {
    console.log(`[apply] applying ${pending.length} update(s)…`);
    for (const p of pending) {
      try {
        await p.apply(cli);
        log('apply:ok', { kind: p.kind, slug: p.slug });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[apply] ✗ ${p.kind} ${p.slug}: ${msg}`);
        log('apply:fail', { kind: p.kind, slug: p.slug, error: msg });
      }
    }
    console.log(`[apply] done.`);
  } else {
    console.log(
      `[dry-run] no UPDATEs applied. Use --dump-migration to emit SQL or rerun without --dry-run to apply.`,
    );
  }

  await cli.end();
}

main().catch((e) => {
  console.error(e);
  log('fatal', { error: e instanceof Error ? e.message : String(e) });
  process.exit(1);
});
