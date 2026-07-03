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
 * flagship, not "one restaurant as well as …") and only when the RESTAURANT
 * venue count is >= 2 — bars/lounges/terraces in `venues[]` never count, and
 * an untyped ambiguous venue is not counted (least-destructive default).
 * Everything else is left untouched.
 *
 * PostgREST only. Dry-run by default; --apply writes + per-row verifies
 * (verify failures exit non-zero) + snapshots the full pre-patch column
 * values under runs/ as a genuine rollback backup. Never empties a FAQ
 * column, never takes faq_content below the CDC floor of 10 items.
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

const RESTAURANT_TYPE_RE = /restaurant/iu;
// Conservative name heuristic, used ONLY when a venue carries no type field.
const RESTAURANT_NAME_RE = /\brestaurant\b|\bristorante\b|\btrattoria\b|\bbrasserie\b/iu;

/**
 * Count venues that are actually RESTAURANTS — not bars, lounges or terraces.
 * `restaurant_info.venues[]` lists every F&B outlet, so using its raw length
 * would falsely flag a hotel with 1 restaurant + 2 bars whose "single
 * restaurant" FAQ is CORRECT. A venue counts when its `type_en`/`type_fr`/
 * `type` matches "restaurant", or — when it has no type at all — when its
 * name conservatively says so. Untyped, unnamed-as-restaurant venues (e.g. a
 * cooking school) are NOT counted: the least-destructive default is to
 * under-count and leave the row unflagged.
 */
export function restaurantVenueCount(info: unknown): number {
  if (info === null || typeof info !== 'object') return 0;
  const rec = info as { venues?: unknown };
  if (!Array.isArray(rec.venues)) return 0; // no venue detail → ambiguous → never flag
  let count = 0;
  for (const venue of rec.venues) {
    if (venue === null || typeof venue !== 'object') continue;
    const v = venue as { type_en?: unknown; type_fr?: unknown; type?: unknown; name?: unknown };
    const types = [v.type_en, v.type_fr, v.type].filter((t): t is string => typeof t === 'string');
    if (types.length > 0) {
      if (types.some((t) => RESTAURANT_TYPE_RE.test(t))) count += 1;
      continue; // typed as Bar/Lounge/… → definitively not a restaurant
    }
    if (typeof v.name === 'string' && RESTAURANT_NAME_RE.test(v.name)) count += 1;
  }
  return count;
}

/** A Dining Q&A that contradicts a multi-RESTAURANT restaurant_info. */
export function isContradictoryDiningItem(item: unknown, restaurants: number): boolean {
  if (restaurants < 2 || item === null || typeof item !== 'object') return false;
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

/** CDC §2 hard rule — published fiches must keep >= 10 faq_content items. */
const FAQ_CONTENT_FLOOR = 10;

interface Plan {
  readonly row: Row;
  readonly patch: Record<string, unknown[]>;
  readonly dropped: { readonly field: FaqField; readonly answer: string }[];
  /** Fields where a drop was detected but blocked by a safety floor. */
  readonly skipped: { readonly field: FaqField; readonly reason: string }[];
}

export function buildPlan(row: Row): Plan {
  const venues = restaurantVenueCount(row.restaurant_info);
  const patch: Record<string, unknown[]> = {};
  const dropped: { field: FaqField; answer: string }[] = [];
  const skipped: { field: FaqField; reason: string }[] = [];
  if (venues < 2) return { row, patch, dropped, skipped };
  for (const field of FAQ_FIELDS) {
    const arr = row[field];
    if (!Array.isArray(arr)) continue;
    const fieldDropped: { field: FaqField; answer: string }[] = [];
    const kept = arr.filter((it) => {
      if (isContradictoryDiningItem(it, venues)) {
        const a = it as { answer_en?: unknown; answer_fr?: unknown };
        fieldDropped.push({
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
    if (kept.length === arr.length) continue;
    if (kept.length === 0) {
      skipped.push({ field, reason: 'would_empty_field' });
      continue;
    }
    if (field === 'faq_content' && kept.length < FAQ_CONTENT_FLOOR) {
      skipped.push({ field, reason: `would_break_cdc_floor_${kept.length}<${FAQ_CONTENT_FLOOR}` });
      continue;
    }
    patch[field] = kept;
    dropped.push(...fieldDropped);
  }
  return { row, patch, dropped, skipped };
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
  const allPlans = rows.map(buildPlan);
  const planned = allPlans.filter((p) => Object.keys(p.patch).length > 0);
  const floorSkipped = allPlans.filter(
    (p) => Object.keys(p.patch).length === 0 && p.skipped.length > 0,
  );

  console.log(
    `[patch-faq-restaurant-coherence] candidates=${rows.length} planned=${planned.length} floorSkipped=${floorSkipped.length} apply=${apply}`,
  );
  for (const p of planned) {
    console.log(`  · ${p.row.slug} (restaurants=${restaurantVenueCount(p.row.restaurant_info)})`);
    for (const d of p.dropped) console.log(`      ✂ [${d.field}] ${d.answer}`);
    for (const s of p.skipped) console.log(`      ! skipped [${s.field}] ${s.reason}`);
  }
  for (const p of floorSkipped) {
    console.log(
      `  ! ${p.row.slug} — contradiction found but blocked: ${p.skipped
        .map((s) => `${s.field}:${s.reason}`)
        .join(', ')}`,
    );
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
        planned: planned.map((p) => ({
          id: p.row.id,
          slug: p.row.slug,
          dropped: p.dropped,
          skipped: p.skipped,
          // Full pre-patch value of every column this plan rewrites, so the
          // run file is a genuine rollback backup (PATCH hotels?id=eq.<id>
          // with `before` restores the row verbatim).
          before: Object.fromEntries(Object.keys(p.patch).map((f) => [f, p.row[f as FaqField]])),
          after: p.patch,
        })),
        floorSkipped: floorSkipped.map((p) => ({
          id: p.row.id,
          slug: p.row.slug,
          skipped: p.skipped,
        })),
      },
      null,
      2,
    ),
    'utf8',
  );

  if (!apply) return;
  let applied = 0;
  let verified = 0;
  const verifyFailures: string[] = [];
  for (const plan of planned) {
    await patchRow(url, env.SUPABASE_SERVICE_ROLE_KEY, plan);
    if (await verifyRow(url, env.SUPABASE_SERVICE_ROLE_KEY, plan)) {
      applied += 1;
      verified += 1;
    } else {
      verifyFailures.push(plan.row.slug);
      console.error(`  VERIFY FAILED ${plan.row.slug}`);
    }
  }
  console.log(
    `[patch-faq-restaurant-coherence] applied=${applied} verified=${verified} verifyFailed=${verifyFailures.length}`,
  );
  if (verifyFailures.length > 0) {
    console.error(
      `[patch-faq-restaurant-coherence] post-PATCH verification failed for: ${verifyFailures.join(', ')}`,
    );
    process.exitCode = 1;
  }
}

const isEntryPoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) {
  main().catch((err: unknown) => {
    console.error('[patch-faq-restaurant-coherence] FATAL', err);
    process.exit(1);
  });
}
