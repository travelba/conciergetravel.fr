/**
 * classify-unknowns.ts — for every Yonder hotel without `hint_stars`,
 * run ONE Tavily basic search + ONE LLM extraction to determine the star
 * rating + the Atout-France Palace label. Writes
 *   yonder/unknowns-classified.json  (idempotent — skips hotels already classified)
 *
 * Cost : ~ 145 Tavily credits + ~$0.15 in OpenAI (gpt-4o-mini).
 * Duration : ~ 15-20 min for 145 hotels.
 *
 * Usage:
 *   pnpm yonder:classify
 *   pnpm yonder:classify -- --limit=20      # for a smaller smoke run
 *   pnpm yonder:classify -- --slug=hotel-X  # single-hotel reclassification
 *
 * After running, re-run `pnpm yonder:scaffold` to insert any newly identified
 * 5★ / Palace hotels into Supabase.
 */

import { z } from 'zod';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tavilySearch } from '../enrichment/tavily-client.js';
import { llmExtract } from '../enrichment/llm-extract.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PILOT_ROOT = resolve(__dirname, '../..');
const YONDER_DIR = resolve(PILOT_ROOT, 'yonder');
const OUT_FILE = resolve(YONDER_DIR, 'unknowns-classified.json');
const LOG_FILE = resolve(YONDER_DIR, `classify-unknowns-${Date.now()}.log`);

if (!existsSync(YONDER_DIR)) mkdirSync(YONDER_DIR, { recursive: true });

// ─── Schemas ──────────────────────────────────────────────────────────────

const ClassificationSchema = z.object({
  stars: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).nullable(),
  is_palace: z.boolean().nullable(),
  is_5_star_or_palace: z.boolean(),
  is_in_france: z.boolean().nullable(),
  rationale: z.string().min(1).max(400),
});

type Classification = z.infer<typeof ClassificationSchema>;

interface YonderHotel {
  key: string;
  name: string;
  sources: string[];
  hint_city: string | null;
  hint_region: string | null;
  hint_country: string | null;
  hint_stars: number | null;
  is_palace: boolean | null;
}

interface ClassifiedHotel extends YonderHotel {
  classified_at: string;
  classification: Classification | null;
  search_top_titles: string[];
  error: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function log(msg: string): void {
  const stamped = `[${new Date().toISOString()}] ${msg}`;
  console.log(stamped);
  try {
    writeFileSync(LOG_FILE, stamped + '\n', { flag: 'a' });
  } catch {
    /* ignore */
  }
}

function parseLimit(): number | null {
  const a = process.argv.find((x) => x.startsWith('--limit='));
  if (!a) return null;
  const n = Number(a.slice('--limit='.length));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseSlug(): string | null {
  const a = process.argv.find((x) => x.startsWith('--slug='));
  return a ? a.slice('--slug='.length) : null;
}

function loadExisting(): Map<string, ClassifiedHotel> {
  if (!existsSync(OUT_FILE)) return new Map();
  try {
    const arr = JSON.parse(readFileSync(OUT_FILE, 'utf8')) as ClassifiedHotel[];
    return new Map(arr.map((h) => [h.key, h]));
  } catch (e) {
    log(`[warn] could not parse ${OUT_FILE} (${(e as Error).message}); starting fresh`);
    return new Map();
  }
}

function persist(map: Map<string, ClassifiedHotel>): void {
  const arr = Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  writeFileSync(OUT_FILE, JSON.stringify(arr, null, 2));
}

function getUnknowns(): YonderHotel[] {
  const missingFile = resolve(YONDER_DIR, 'diff-missing.json');
  const raw = JSON.parse(readFileSync(missingFile, 'utf8')) as YonderHotel[];
  return raw.filter((h) => h.hint_stars === null && h.is_palace !== true);
}

async function classifyOne(h: YonderHotel): Promise<ClassifiedHotel> {
  const cityHint = h.hint_city ? ` ${h.hint_city}` : '';
  const query = `${h.name}${cityHint} hôtel étoiles luxe France classement`;
  try {
    const search = await tavilySearch({
      query: query.slice(0, 380),
      searchDepth: 'basic',
      maxResults: 5,
      country: 'france',
      includeRawContent: false,
    });

    const evidence = search.results
      .slice(0, 5)
      .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content}`.slice(0, 1200))
      .join('\n\n---\n\n');

    if (evidence.length < 80) {
      return {
        ...h,
        classified_at: new Date().toISOString(),
        classification: null,
        search_top_titles: search.results.map((r) => r.title),
        error: 'no search results',
      };
    }

    const extraction = await llmExtract<typeof ClassificationSchema>({
      content: evidence,
      context: `Determine whether the hotel "${h.name}" is a 5★ hotel or an Atout France Palace`,
      schemaDescription: `{
        "stars": <1|2|3|4|5|null — only if explicitly stated by an authoritative source (Atout France, hotel official page, Michelin Guide, Relais & Châteaux). Booking.com/Tripadvisor star-ratings are unreliable, ignore them.>,
        "is_palace": <true if the hotel explicitly carries the Atout France "Palace" distinction (a short, official list — ~32 properties in France in 2026). false otherwise. null when unsure.>,
        "is_5_star_or_palace": <true if either stars === 5 OR is_palace === true>,
        "is_in_france": <true if the hotel is located in France. null when ambiguous.>,
        "rationale": <"<100 words: cite which source led to the classification">
      }`,
      schema: ClassificationSchema,
      model: 'gpt-4o-mini-2024-07-18',
    });

    if (!extraction) {
      return {
        ...h,
        classified_at: new Date().toISOString(),
        classification: null,
        search_top_titles: search.results.map((r) => r.title),
        error: 'llm-extract returned null',
      };
    }

    return {
      ...h,
      classified_at: new Date().toISOString(),
      classification: extraction.data,
      search_top_titles: search.results.map((r) => r.title),
      error: null,
    };
  } catch (e) {
    return {
      ...h,
      classified_at: new Date().toISOString(),
      classification: null,
      search_top_titles: [],
      error: (e as Error).message.slice(0, 300),
    };
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log(`[start] classify-unknowns — out=${OUT_FILE}`);
  const unknowns = getUnknowns();
  const cached = loadExisting();
  const slugFilter = parseSlug();
  const limit = parseLimit();

  const todo = unknowns
    .filter((h) => (slugFilter ? h.key === slugFilter : true))
    .filter((h) => !cached.has(h.key) || cached.get(h.key)?.error !== null);
  const work = limit ? todo.slice(0, limit) : todo;

  log(
    `[plan] unknowns=${unknowns.length} cached=${cached.size} todo=${todo.length} this-run=${work.length}`,
  );

  if (work.length === 0) {
    log('[done] nothing to classify');
    return;
  }

  let i = 0;
  let palaces = 0;
  let fives = 0;
  let nonFr = 0;
  for (const h of work) {
    i++;
    log(`[${i}/${work.length}] ${h.name}${h.hint_city ? ` (${h.hint_city})` : ''}`);
    const classified = await classifyOne(h);
    cached.set(h.key, classified);
    if (classified.classification) {
      const c = classified.classification;
      if (c.is_palace === true) palaces++;
      if (c.stars === 5) fives++;
      if (c.is_in_france === false) nonFr++;
      log(
        `       → stars=${c.stars} palace=${c.is_palace} fr=${c.is_in_france} 5★/Palace=${c.is_5_star_or_palace}`,
      );
    } else {
      log(`       → unable to classify (${classified.error ?? '?'})`);
    }
    // persist every 5 iterations to survive crashes
    if (i % 5 === 0) persist(cached);
    // gentle pacing to be polite to APIs
    await new Promise((r) => setTimeout(r, 250));
  }
  persist(cached);
  log(`[done] processed=${i} 5★=${fives} palace=${palaces} non-fr=${nonFr}`);
}

main().catch((e) => {
  log(`[fatal] ${(e as Error).message}`);
  process.exit(1);
});
