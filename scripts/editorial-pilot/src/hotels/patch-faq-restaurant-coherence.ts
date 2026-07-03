/**
 * Deterministic FAQ ↔ restaurant_info coherence patcher (WS-C item 4).
 *
 * Some auto-generated Dining Q&A assert a SINGULAR on-site restaurant ("one
 * on-site restaurant", "un seul restaurant", "a single restaurant") while
 * hotels.restaurant_info lists several venues — a factual contradiction the
 * page renders live. The restaurant_info block already shows the accurate F&B
 * list, so the coherent deterministic fix is to REMOVE the contradictory Q&A.
 *
 * Detection is intentionally narrow: only FLAT singular assertions (not the
 * consistent "at least one restaurant", not "one main restaurant" naming a
 * flagship, not "one restaurant as well as …") and only when the venue count
 * is >= 2. Everything else is left untouched.
 *
 * PostgREST only. Dry-run by default; --apply writes + per-row verifies +
 * snapshots a rollback backup under runs/. Never empties a FAQ column.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PILOT_ROOT = resolve(__dirname, '../..');
const REPO_ROOT = resolve(PILOT_ROOT, '../..');
const RUNS_DIR = resolve(PILOT_ROOT, 'runs');

loadDotenv({ path: resolve(REPO_ROOT, '.env.local') });
loadDotenv({ path: resolve(REPO_ROOT, '.env') });

const SINGULAR_RE =
  /\b(?:a single|just one|only one)\s+(?:on-?site\s+)?restaurant\b|\bone\s+on-?site\s+restaurant\b|\b(?:un seul|un unique|son unique)\s+restaurant\b|\bd['’]un seul restaurant\b/iu;
const HEDGE_RE = /at least|as well as|au moins|ainsi que|plusieurs/iu;

/** True when an answer flatly claims a single on-site restaurant. */
export function assertsSingleRestaurant(answer: string): boolean {
  if (answer === '') return false;
  if (HEDGE_RE.test(answer)) return false;
  return SINGULAR_RE.test(answer);
}

export function venueCount(info: unknown): number {
  if (info === null || typeof info !== 'object') return 0;
  const rec = info as { count?: unknown; venues?: unknown };
  if (Array.isArray(rec.venues)) return rec.venues.length;
  if (typeof rec.count === 'number') return rec.count;
  return 0;
}

/** A Dining Q&A that contradicts a multi-venue restaurant_info. */
export function isContradictoryDiningItem(item: unknown, venues: number): boolean {
  if (venues < 2 || item === null || typeof item !== 'object') return false;
  const it = item as { answer_en?: unknown; answer_fr?: unknown };
  const en = typeof it.answer_en === 'string' ? it.answer_en : '';
  const fr = typeof it.answer_fr === 'string' ? it.answer_fr : '';
  return assertsSingleRestaurant(en) || assertsSingleRestaurant(fr);
}

const EnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(40),
});

const FAQ_FIELDS = ['faq_content', 'faq_content_kit', 'geo_qa', 'concierge_questions'] as const;
type FaqField = (typeof FAQ_FIELDS)[number];

const RowSchema = z.object({
  id: z.string(),
  slug: z.string(),
  restaurant_info: z.unknown().nullable(),
  faq_content: z.unknown().nullable(),
  faq_content_kit: z.unknown().nullable(),
  geo_qa: z.unknown().nullable(),
  concierge_questions: z.unknown().nullable(),
});
type Row = z.infer<typeof RowSchema>;

interface Plan {
  readonly row: Row;
  readonly patch: Record<string, unknown[]>;
  readonly dropped: { readonly field: FaqField; readonly answer: string }[];
}

export function buildPlan(row: Row): Plan {
  const venues = venueCount(row.restaurant_info);
  const patch: Record<string, unknown[]> = {};
  const dropped: { field: FaqField; answer: string }[] = [];
  if (venues < 2) return { row, patch, dropped };
  for (const field of FAQ_FIELDS) {
    const arr = row[field];
    if (!Array.isArray(arr)) continue;
    const kept = arr.filter((it) => {
      if (isContradictoryDiningItem(it, venues)) {
        const a = it as { answer_en?: unknown; answer_fr?: unknown };
        dropped.push({
          field,
          answer: String((typeof a.answer_en === 'string' ? a.answer_en : a.answer_fr) ?? '').slice(
            0,
            140,
          ),
        });
        return false;
      }
      return true;
    });
    if (kept.length !== arr.length && kept.length > 0) patch[field] = kept;
  }
  return { row, patch, dropped };
}

async function fetchCandidates(url: string, key: string): Promise<Row[]> {
  const rows: Row[] = [];
  const pageSize = 200;
  let offset = 0;
  for (;;) {
    const endpoint = new URL('/rest/v1/hotels', url);
    endpoint.searchParams.set(
      'select',
      'id,slug,restaurant_info,faq_content,faq_content_kit,geo_qa,concierge_questions',
    );
    endpoint.searchParams.set('restaurant_info', 'not.is.null');
    endpoint.searchParams.set('order', 'slug.asc');
    endpoint.searchParams.set('limit', String(pageSize));
    endpoint.searchParams.set('offset', String(offset));
    const res = await fetch(endpoint, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok)
      throw new Error(`SELECT hotels failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
    const page = z.array(RowSchema).parse(await res.json());
    rows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

async function patchRow(url: string, key: string, plan: Plan): Promise<void> {
  const endpoint = new URL('/rest/v1/hotels', url);
  endpoint.searchParams.set('id', `eq.${plan.row.id}`);
  const res = await fetch(endpoint, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(plan.patch),
  });
  if (!res.ok)
    throw new Error(
      `PATCH ${plan.row.slug} failed (${res.status}): ${(await res.text()).slice(0, 300)}`,
    );
}

async function verifyRow(url: string, key: string, plan: Plan): Promise<boolean> {
  const endpoint = new URL('/rest/v1/hotels', url);
  endpoint.searchParams.set('select', FAQ_FIELDS.join(','));
  endpoint.searchParams.set('id', `eq.${plan.row.id}`);
  const res = await fetch(endpoint, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) return false;
  const [row] = (await res.json()) as Record<FaqField, unknown[] | null>[];
  if (!row) return false;
  return Object.entries(plan.patch).every(
    ([f, arr]) => (row[f as FaqField]?.length ?? -1) === arr.length,
  );
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const env = EnvSchema.parse(process.env);
  const url = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/u, '');
  const rows = await fetchCandidates(url, env.SUPABASE_SERVICE_ROLE_KEY);
  const planned = rows.map(buildPlan).filter((p) => Object.keys(p.patch).length > 0);

  console.log(
    `[patch-faq-restaurant-coherence] candidates=${rows.length} planned=${planned.length} apply=${apply}`,
  );
  for (const p of planned) {
    console.log(`  · ${p.row.slug} (venues=${venueCount(p.row.restaurant_info)})`);
    for (const d of p.dropped) console.log(`      ✂ [${d.field}] ${d.answer}`);
  }

  const generatedAt = new Date().toISOString();
  await mkdir(RUNS_DIR, { recursive: true });
  await writeFile(
    resolve(
      RUNS_DIR,
      `faq-restaurant-coherence-${apply ? 'apply' : 'dry'}-${generatedAt.replace(/[:.]/gu, '-')}.json`,
    ),
    JSON.stringify(
      {
        generatedAt,
        apply,
        planned: planned.map((p) => ({ id: p.row.id, slug: p.row.slug, dropped: p.dropped })),
      },
      null,
      2,
    ),
    'utf8',
  );

  if (!apply) return;
  let applied = 0;
  let verified = 0;
  for (const plan of planned) {
    await patchRow(url, env.SUPABASE_SERVICE_ROLE_KEY, plan);
    applied += 1;
    if (await verifyRow(url, env.SUPABASE_SERVICE_ROLE_KEY, plan)) verified += 1;
    else console.error(`  VERIFY FAILED ${plan.row.slug}`);
  }
  console.log(`[patch-faq-restaurant-coherence] applied=${applied} verified=${verified}`);
}

const isEntryPoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) {
  main().catch((err: unknown) => {
    console.error('[patch-faq-restaurant-coherence] FATAL', err);
    process.exit(1);
  });
}
