/**
 * Deterministic P0 DataSEO patcher for editorial_rankings (WS-C Lot 3).
 *
 * Scope (mission WS-C): editorial_rankings.{meta_desc_fr, meta_desc_en, faq}
 * on published rankings. It NEVER touches editorial_ranking_entries (curated),
 * editorial_sections, intro/outro, or regenerates any long-form prose.
 *
 * Deterministic operations only:
 *   1. faq — drop Q&A items whose question is noise (celebrity / net worth /
 *      fortune / salary / owner — via isEditoriallyRelevantPaa) OR a Phase-6
 *      live-booking/pricing angle (live price, best-rate, availability, refund,
 *      promo). Phase 6 is frozen (D1a) so those promises must not ship.
 *   2. meta_desc_fr/en — strip Phase-6 promo clauses, then trim to ≤170 chars
 *      at a sentence/word boundary when over-band. Under-band (<140) is only
 *      flagged (never fabricated). Trailing pipe/whitespace cleaned.
 *
 * Every rewritten string passes the hasLeak() gate. Dry-run by default; --apply
 * writes + per-row verifies + snapshots a rollback backup under runs/.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

import { hasLeak } from '../enrichment/scaffolding-gate.js';
import { isEditoriallyRelevantPaa } from '../hotels/faq-perplexity-gates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PILOT_ROOT = resolve(__dirname, '../..');
const REPO_ROOT = resolve(PILOT_ROOT, '../..');
const RUNS_DIR = resolve(PILOT_ROOT, 'runs');

loadDotenv({ path: resolve(REPO_ROOT, '.env.local') });
loadDotenv({ path: resolve(REPO_ROOT, '.env') });

const META_MAX = 170;
const META_MIN = 140;
/** Published rankings must keep >= 10 FAQ items (mirror of the hotels CDC floor). */
const FAQ_FLOOR = 10;

// ─── Phase-6 live-booking / pricing detection ────────────────────────────────
// Frozen until Phase 6 — the mission names exactly four angles to remove:
// **prix live · dispo · refund · promo**. We scope the detector to those.
// Deliberately NOT removed (on-brand / allowed by the freeze):
//   - loyalty / "programmes de fidélité" (Le Concierge Club is a real product);
//   - "comment réserver via le Concierge" (the freeze explicitly allows the
//     editorial concierge CTA — it is not a live-GDS booking widget).
// IMPORTANT: matched against the QUESTION only (the editorial angle), never the
// answer — an answer mentioning "meilleurs tarifs en basse saison" is legitimate
// seasonality content and must NOT drop the whole Q&A.
const PHASE6_PATTERNS: readonly RegExp[] = [
  // refund / cancellation-rate angle
  /conditions?\s+d['’]annulation/iu,
  /politique\s+d['’]annulation/iu,
  /cancellation\s+polic/iu,
  /flexible\s+cancellation/iu,
  /annulation\s+(?:flexible|souple|gratuite|flexibles)/iu,
  /\bremboursable\b/iu,
  /\bremboursement\b/iu,
  /\brefund\b/iu,
  /non[-\s]?refundable/iu,
  // promo angle — a bare "promotion(s)" over-matches ordinary editorial
  // wording (e.g. "la promotion du patrimoine"), so the generic noun only
  // trips when a booking/price token co-occurs in the same question.
  /\bcode\s+promo\b/iu,
  /\bpromo\s+code\b/iu,
  /\b(?:offres?|tarifs?|codes?)\s+promotionnel(?:s|les?)?\b/iu,
  /\bpromotions?\b[^.?!]*(?:\bcodes?\b|\br[ée]ductions?\b|\br[ée]serv\w*|\btarifs?\b|\bprix\b|\brates?\b|\bprices?\b|\bdiscounts?\b|\bbook\w*|-\s?\d{1,2}\s?%)/iu,
  /(?:\bcodes?\b|\br[ée]ductions?\b|\br[ée]serv\w*|\btarifs?\b|\bprix\b|\brates?\b|\bprices?\b|\bdiscounts?\b|\bbook\w*|-\s?\d{1,2}\s?%)[^.?!]*\bpromotions?\b/iu,
  /\bdiscount\b/iu,
  /\bcoupon\b/iu,
  // live-price angle
  /meilleur(?:s)?\s+(?:prix|tarif)\s+garanti/iu,
  /best\s+(?:price|rate)\s+guarantee/iu,
  /prix\s+en\s+temps\s+r[ée]el/iu,
  /live\s+price/iu,
  // availability angle
  /real[-\s]?time\s+availab/iu,
  /disponibilit[ée]s?\s+en\s+temps\s+r[ée]el/iu,
  /\bbook now\b/iu,
];

function isPhase6(text: string): boolean {
  return PHASE6_PATTERNS.some((re) => re.test(text));
}

/**
 * A FAQ item should be dropped when its QUESTION (fr or en) is celebrity/wealth
 * noise or a Phase-6 booking/pricing angle. Answers are intentionally ignored.
 */
export function shouldDropFaq(item: {
  readonly question_fr?: string | null | undefined;
  readonly question_en?: string | null | undefined;
  readonly answer_fr?: string | null | undefined;
  readonly answer_en?: string | null | undefined;
}): { readonly drop: boolean; readonly reason: string | null } {
  const qFr = item.question_fr ?? '';
  const qEn = item.question_en ?? '';
  if (qFr !== '' && !isEditoriallyRelevantPaa(qFr)) return { drop: true, reason: 'noise_fr' };
  if (qEn !== '' && !isEditoriallyRelevantPaa(qEn)) return { drop: true, reason: 'noise_en' };
  if (isPhase6(`${qFr} ${qEn}`)) return { drop: true, reason: 'phase6' };
  return { drop: false, reason: null };
}

// ─── meta_desc deterministic revision ────────────────────────────────────────
const META_PHASE6_CLAUSES: readonly RegExp[] = [
  /\s*[·|—-]?\s*r[ée]serv(?:ez|er)[^.!?]*\bmeilleur[^.!?]*[.!?]?/giu,
  /\s*[·|—-]?\s*meilleur(?:s)? (?:prix|tarif)[^.!?]*[.!?]?/giu,
  /\s*[·|—-]?\s*best (?:price|rate)[^.!?]*[.!?]?/giu,
  /\s*[·|—-]?\s*book now[^.!?]*[.!?]?/giu,
];

function trimToBand(text: string): string {
  let out = text
    .trim()
    .replace(/\s*\|\s*$/u, '')
    .replace(/\s{2,}/gu, ' ')
    .trim();
  if (out.length <= META_MAX) return out;
  const slice = out.slice(0, META_MAX + 1);
  // Prefer the last sentence boundary that keeps us >= META_MIN.
  const sentenceEnd = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? '),
  );
  if (sentenceEnd >= META_MIN) {
    out = out.slice(0, sentenceEnd + 1).trim();
    return out;
  }
  // Else cut at the last word boundary <= META_MAX.
  const wordCut = slice.slice(0, META_MAX).lastIndexOf(' ');
  out = (wordCut > META_MIN ? out.slice(0, wordCut) : out.slice(0, META_MAX)).trim();
  out = out.replace(/[\s,;:·|—-]+$/u, '');
  return out;
}

export function reviseMetaDesc(input: string): {
  readonly value: string;
  readonly changed: boolean;
} {
  let out = input;
  for (const re of META_PHASE6_CLAUSES) out = out.replace(re, '');
  out = trimToBand(out);
  return { value: out, changed: out !== input.trim() };
}

// ─── DB ──────────────────────────────────────────────────────────────────────
const EnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(40),
});

const FaqItemSchema = z
  .object({
    question_fr: z.string().nullish(),
    question_en: z.string().nullish(),
    answer_fr: z.string().nullish(),
    answer_en: z.string().nullish(),
    section_anchor: z.string().nullish(),
  })
  .passthrough();

const RankingRowSchema = z.object({
  id: z.string(),
  slug: z.string(),
  meta_desc_fr: z.string().nullable(),
  meta_desc_en: z.string().nullable(),
  faq: z.array(FaqItemSchema).nullable(),
});
type RankingRow = z.infer<typeof RankingRowSchema>;

interface RankingPlan {
  readonly row: RankingRow;
  readonly reasons: Set<string>;
  readonly patch: Record<string, unknown>;
  readonly droppedFaq: { readonly question: string; readonly reason: string }[];
  readonly notes: string[];
}

export function buildRankingPlan(row: RankingRow): RankingPlan {
  const reasons = new Set<string>();
  const patch: Record<string, unknown> = {};
  const droppedFaq: { question: string; reason: string }[] = [];
  const notes: string[] = [];

  if (row.faq && row.faq.length > 0) {
    const kept = row.faq.filter((item) => {
      const { drop, reason } = shouldDropFaq(item);
      if (drop) {
        droppedFaq.push({
          question: item.question_fr ?? item.question_en ?? '?',
          reason: reason ?? '?',
        });
        return false;
      }
      return true;
    });
    if (kept.length !== row.faq.length && kept.length > 0) {
      if (kept.length < FAQ_FLOOR) {
        // Hard floor — a drop must never leave a published ranking under 10
        // FAQ items. The row is skipped (reported as floorSkipped) and goes
        // to the manual backlog: backfill FAQ first, then re-run.
        notes.push(`faq_floor_skipped_${kept.length}<${FAQ_FLOOR}`);
      } else {
        patch.faq = kept;
        reasons.add('drop_noisy_or_phase6_faq');
      }
    } else if (kept.length === 0 && row.faq.length > 0) {
      notes.push('faq_all_dropped_kept_as_is'); // never empty the column
    }
  }

  for (const field of ['meta_desc_fr', 'meta_desc_en'] as const) {
    const value = row[field];
    if (value === null || value.trim() === '') continue;
    const { value: revised, changed } = reviseMetaDesc(value);
    if (changed && !hasLeak(revised) && revised.length >= META_MIN) {
      patch[field] = revised;
      reasons.add(`revise_${field}`);
    } else if (changed) {
      // A Phase-6 clause WAS detected but the deterministic revision can't
      // ship (falls under-band or trips the leak gate) — the promo text is
      // still live. Surface it loudly instead of silently skipping.
      notes.push(`${field}_meta_needs_manual_${revised.length}`);
    } else if (value.length < META_MIN) {
      notes.push(`${field}_short_${value.length}`);
    } else if (value.length > META_MAX) {
      notes.push(`${field}_overband_unresolved_${value.length}`);
    }
  }

  return { row, reasons, patch, droppedFaq, notes };
}

async function fetchPublishedRankings(url: string, key: string): Promise<RankingRow[]> {
  const rows: RankingRow[] = [];
  const pageSize = 500;
  let offset = 0;
  for (;;) {
    const endpoint = new URL('/rest/v1/editorial_rankings', url);
    endpoint.searchParams.set('select', 'id,slug,meta_desc_fr,meta_desc_en,faq');
    endpoint.searchParams.set('is_published', 'eq.true');
    endpoint.searchParams.set('order', 'slug.asc');
    endpoint.searchParams.set('limit', String(pageSize));
    endpoint.searchParams.set('offset', String(offset));
    const res = await fetch(endpoint, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok)
      throw new Error(
        `SELECT rankings failed (${res.status}): ${(await res.text()).slice(0, 300)}`,
      );
    const page = z.array(RankingRowSchema).parse(await res.json());
    rows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

async function patchRow(url: string, key: string, plan: RankingPlan): Promise<void> {
  const endpoint = new URL('/rest/v1/editorial_rankings', url);
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

async function verifyRow(url: string, key: string, plan: RankingPlan): Promise<boolean> {
  const endpoint = new URL('/rest/v1/editorial_rankings', url);
  endpoint.searchParams.set('select', 'meta_desc_fr,meta_desc_en,faq');
  endpoint.searchParams.set('id', `eq.${plan.row.id}`);
  const res = await fetch(endpoint, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) return false;
  const [row] = (await res.json()) as {
    meta_desc_fr: string | null;
    meta_desc_en: string | null;
    faq: unknown[] | null;
  }[];
  if (!row) return false;
  if (typeof plan.patch.meta_desc_fr === 'string' && row.meta_desc_fr !== plan.patch.meta_desc_fr)
    return false;
  if (typeof plan.patch.meta_desc_en === 'string' && row.meta_desc_en !== plan.patch.meta_desc_en)
    return false;
  if (Array.isArray(plan.patch.faq) && (row.faq?.length ?? -1) !== plan.patch.faq.length)
    return false;
  return true;
}

interface Args {
  readonly apply: boolean;
  readonly limit: number | null;
  readonly slugs: readonly string[];
  readonly prefixes: readonly string[];
}
function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const limitArg = argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number.parseInt(limitArg.split('=')[1] ?? '', 10) : null;
  const slugsRaw = argv.find((a) => a.startsWith('--slugs='))?.slice('--slugs='.length);
  const prefixRaw = argv.find((a) => a.startsWith('--prefix='))?.slice('--prefix='.length);
  return {
    apply: argv.includes('--apply'),
    limit: limit !== null && Number.isFinite(limit) ? limit : null,
    slugs: slugsRaw
      ? slugsRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
    prefixes: prefixRaw
      ? prefixRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
  };
}

async function main(): Promise<void> {
  const args = parseArgs();
  const env = EnvSchema.parse(process.env);
  const url = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/u, '');
  let rows = await fetchPublishedRankings(url, env.SUPABASE_SERVICE_ROLE_KEY);
  if (args.slugs.length > 0) rows = rows.filter((r) => args.slugs.includes(r.slug));
  if (args.prefixes.length > 0)
    rows = rows.filter((r) => args.prefixes.some((p) => r.slug.startsWith(p)));

  const allPlans = rows.map(buildRankingPlan);
  let planned = allPlans.filter((p) => Object.keys(p.patch).length > 0);
  if (args.limit !== null) planned = planned.slice(0, args.limit);
  const noteworthy = allPlans.filter(
    (p) => Object.keys(p.patch).length === 0 && p.notes.length > 0,
  );

  const counts = {
    faq: 0,
    meta_desc_fr: 0,
    meta_desc_en: 0,
    droppedFaqItems: 0,
    metaNeedsManual: 0,
    faqFloorSkipped: 0,
  };
  for (const p of planned) {
    if ('faq' in p.patch) counts.faq += 1;
    if ('meta_desc_fr' in p.patch) counts.meta_desc_fr += 1;
    if ('meta_desc_en' in p.patch) counts.meta_desc_en += 1;
    counts.droppedFaqItems += p.droppedFaq.length;
  }
  counts.metaNeedsManual = allPlans.filter((p) =>
    p.notes.some((n) => n.includes('meta_needs_manual')),
  ).length;
  counts.faqFloorSkipped = allPlans.filter((p) =>
    p.notes.some((n) => n.startsWith('faq_floor_skipped')),
  ).length;

  console.log(
    `[patch-dataseo-p0-rankings] published=${rows.length} planned=${planned.length} apply=${args.apply}`,
  );
  console.log(`  ${JSON.stringify(counts)}`);
  for (const p of planned.slice(0, 20)) {
    console.log(`  · ${p.row.slug} — ${[...p.reasons].join(', ')}`);
    for (const d of p.droppedFaq) console.log(`      ✂ [${d.reason}] ${d.question.slice(0, 90)}`);
    if (typeof p.patch.meta_desc_fr === 'string')
      console.log(`      meta_fr → ${(p.patch.meta_desc_fr as string).length}c`);
    if (typeof p.patch.meta_desc_en === 'string')
      console.log(`      meta_en → ${(p.patch.meta_desc_en as string).length}c`);
  }
  if (noteworthy.length > 0) {
    console.log(
      `\n  ${noteworthy.length} ranking(s) with unresolved notes (no deterministic fix):`,
    );
    for (const p of noteworthy.slice(0, 20))
      console.log(`    ! ${p.row.slug} — ${p.notes.join(', ')}`);
  }
  const needsManual = allPlans.filter((p) => p.notes.some((n) => n.includes('meta_needs_manual')));
  if (needsManual.length > 0) {
    console.log(
      `\n  ⚠ ${needsManual.length} ranking(s) META_NEEDS_MANUAL — Phase-6 clause detected but the deterministic strip is unshippable (promo text still live):`,
    );
    for (const p of needsManual)
      console.log(
        `    ⚠ ${p.row.slug} — ${p.notes.filter((n) => n.includes('meta_needs_manual')).join(', ')}`,
      );
  }

  const generatedAt = new Date().toISOString();
  await mkdir(RUNS_DIR, { recursive: true });
  const stamp = generatedAt.replace(/[:.]/gu, '-');
  await writeFile(
    resolve(RUNS_DIR, `dataseo-p0-rankings-${args.apply ? 'apply' : 'dry'}-${stamp}.json`),
    JSON.stringify(
      {
        generatedAt,
        apply: args.apply,
        counts,
        planned: planned.map((p) => ({
          id: p.row.id,
          slug: p.row.slug,
          reasons: [...p.reasons],
          droppedFaq: p.droppedFaq,
          before: {
            meta_desc_fr: p.row.meta_desc_fr,
            meta_desc_en: p.row.meta_desc_en,
            faqLen: p.row.faq?.length ?? 0,
            // Full pre-patch faq (only when this plan rewrites it) so the run
            // file is a genuine rollback backup at sweep scale.
            ...(Array.isArray(p.patch.faq) ? { faq: p.row.faq } : {}),
          },
          after: {
            meta_desc_fr: p.patch.meta_desc_fr ?? p.row.meta_desc_fr,
            meta_desc_en: p.patch.meta_desc_en ?? p.row.meta_desc_en,
            faqLen: Array.isArray(p.patch.faq) ? p.patch.faq.length : (p.row.faq?.length ?? 0),
          },
        })),
        notes: allPlans
          .filter((p) => p.notes.length > 0)
          .map((p) => ({ slug: p.row.slug, notes: p.notes })),
      },
      null,
      2,
    ),
    'utf8',
  );

  if (!args.apply) return;

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
    `[patch-dataseo-p0-rankings] applied=${applied} verified=${verified} verifyFailed=${verifyFailures.length}`,
  );
  if (verifyFailures.length > 0) {
    console.error(
      `[patch-dataseo-p0-rankings] post-PATCH verification failed for: ${verifyFailures.join(', ')}`,
    );
    process.exitCode = 1;
  }
}

const isEntryPoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) {
  main().catch((err: unknown) => {
    console.error('[patch-dataseo-p0-rankings] FATAL', err);
    process.exit(1);
  });
}
