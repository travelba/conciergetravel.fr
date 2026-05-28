/**
 * publish-eligible-drafts.ts — flip `is_published = true` on drafts
 * that meet the Phase 1 minimum-viable publish gate.
 *
 * Phase 1 (current) gate — editorial-only, no booking, no photos:
 *
 *   Required (publish blocker):
 *     - description_fr, description_en   non-null + length >= 600 chars
 *     - meta_desc_fr, meta_desc_en       non-null + 100-180 chars
 *     - factual_summary_fr/_en           non-null + 100-200 chars
 *                                        (production envelope = 110-165)
 *     - concierge_advice                 jsonb with body_fr + body_en
 *                                        each 30+ words
 *     - faq_content                      jsonb array length >= 10
 *
 *   NOT required at Phase 1:
 *     - photos / hero_image              (Phase 4)
 *     - long_description_sections        (Phase 5 / 8-pass pipeline)
 *     - awards.verified                  (need real audit before publish)
 *     - rooms                            (Phase 4 sub-pages)
 *     - bookable inventory               (Phase 6 — Amadeus/Little)
 *
 * The script is idempotent: re-running on already-published rows is
 * a no-op. It NEVER writes anything other than `is_published`.
 *
 * CLI:
 *   --dry-run             count + log gate failures, no DB write
 *   --tier=<a,b,c>        restrict to luxury_tier slugs
 *   --slug=<single>       restrict to one hotel
 *   --limit=N             cap number of rows considered
 *
 * Skill: editorial-pilot, hotel-detail-page (CDC \u00a72 hard rules).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

interface ConciergeAdviceLocale {
  readonly title?: string;
  readonly body?: string;
  readonly tip_for?: string;
}

interface ConciergeAdvice {
  readonly fr?: ConciergeAdviceLocale;
  readonly en?: ConciergeAdviceLocale;
}

interface FaqItem {
  readonly question_fr?: string;
  readonly answer_fr?: string;
  readonly question?: string;
  readonly answer?: string;
}

interface HotelRow {
  readonly slug: string;
  readonly name: string;
  readonly luxury_tier: string | null;
  readonly description_fr: string | null;
  readonly description_en: string | null;
  readonly meta_desc_fr: string | null;
  readonly meta_desc_en: string | null;
  readonly factual_summary_fr: string | null;
  readonly factual_summary_en: string | null;
  readonly concierge_advice: ConciergeAdvice | null;
  readonly faq_content: readonly FaqItem[] | null;
  readonly is_published: boolean;
}

interface PostgrestEnv {
  readonly restBase: string;
  readonly apikey: string;
}

function loadPostgrestEnv(): PostgrestEnv {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
  if (url.length === 0 || key.length === 0) {
    throw new Error(
      '[publish] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env.local',
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

function wordCount(s: string): number {
  return s.split(/\s+/u).filter((w) => w.length > 0).length;
}

interface GateOutcome {
  readonly slug: string;
  readonly verdict: 'pass' | 'fail';
  readonly failures: readonly string[];
}

function evaluateGate(h: HotelRow): GateOutcome {
  const failures: string[] = [];

  // description_fr / _en
  const descFr = h.description_fr ?? '';
  const descEn = h.description_en ?? '';
  if (descFr.length < 600) failures.push(`description_fr too short (${descFr.length} < 600)`);
  if (descEn.length < 600) failures.push(`description_en too short (${descEn.length} < 600)`);

  // meta_desc_fr / _en
  const mdFr = h.meta_desc_fr ?? '';
  const mdEn = h.meta_desc_en ?? '';
  if (mdFr.length < 100 || mdFr.length > 180) {
    failures.push(`meta_desc_fr out of band (${mdFr.length} chars, target 100-180)`);
  }
  if (mdEn.length < 100 || mdEn.length > 180) {
    failures.push(`meta_desc_en out of band (${mdEn.length} chars, target 100-180)`);
  }

  // factual_summary_fr / _en
  const fsFr = h.factual_summary_fr ?? '';
  const fsEn = h.factual_summary_en ?? '';
  if (fsFr.length < 100 || fsFr.length > 200) {
    failures.push(`factual_summary_fr out of band (${fsFr.length} chars, target 100-200)`);
  }
  if (fsEn.length < 100 || fsEn.length > 200) {
    failures.push(`factual_summary_en out of band (${fsEn.length} chars, target 100-200)`);
  }

  // concierge_advice — actual JSONB shape is { fr: { body, title, tip_for }, en: { ... } }
  const ca = h.concierge_advice;
  if (ca === null || typeof ca !== 'object') {
    failures.push('concierge_advice missing');
  } else {
    const wFr = wordCount(ca.fr?.body ?? '');
    const wEn = wordCount(ca.en?.body ?? '');
    if (wFr < 30) failures.push(`concierge_advice.fr.body too short (${wFr} words)`);
    if (wEn < 30) failures.push(`concierge_advice.en.body too short (${wEn} words)`);
  }

  // faq_content
  const faq = h.faq_content ?? [];
  if (faq.length < 10) failures.push(`faq_content too short (${faq.length} items, need >= 10)`);

  return {
    slug: h.slug,
    verdict: failures.length === 0 ? 'pass' : 'fail',
    failures,
  };
}

interface CliArgs {
  readonly dryRun: boolean;
  readonly tiers: readonly string[];
  readonly slug: string | null;
  readonly limit: number | null;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let dryRun = false;
  let tiers: string[] = [];
  let slug: string | null = null;
  let limit: number | null = null;
  for (const a of argv) {
    if (a === '--dry-run') dryRun = true;
    else if (a.startsWith('--tier=')) {
      tiers = a
        .slice('--tier='.length)
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    } else if (a.startsWith('--slug=')) slug = a.slice('--slug='.length);
    else if (a.startsWith('--limit=')) {
      const n = Number(a.slice('--limit='.length));
      if (Number.isFinite(n) && n > 0) limit = Math.floor(n);
    }
  }
  return { dryRun, tiers, slug, limit };
}

async function fetchDraftRows(env: PostgrestEnv, args: CliArgs): Promise<HotelRow[]> {
  const cols =
    'slug,name,luxury_tier,description_fr,description_en,meta_desc_fr,meta_desc_en,factual_summary_fr,factual_summary_en,concierge_advice,faq_content,is_published';
  const params = new URLSearchParams();
  params.set('select', cols);
  params.set('is_published', 'eq.false');
  if (args.tiers.length > 0) params.set('luxury_tier', `in.(${args.tiers.join(',')})`);
  if (args.slug !== null) params.set('slug', `eq.${args.slug}`);
  params.set('order', 'slug.asc');
  if (args.limit !== null) params.set('limit', String(args.limit));

  const PAGE = 1000;
  const all: HotelRow[] = [];
  let from = 0;
  while (true) {
    const url = `${env.restBase}/hotels?${params.toString()}`;
    const r = await fetch(url, {
      headers: pgHeaders(env, { Range: `${from}-${from + PAGE - 1}`, 'Range-Unit': 'items' }),
    });
    if (!r.ok) {
      throw new Error(`PostgREST GET hotels failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
    }
    const batch = (await r.json()) as HotelRow[];
    all.push(...batch);
    if (batch.length < PAGE) break;
    if (args.limit !== null && all.length >= args.limit) break;
    from += PAGE;
  }
  return args.limit !== null ? all.slice(0, args.limit) : all;
}

async function flipPublishedTrue(env: PostgrestEnv, slugs: readonly string[]): Promise<void> {
  if (slugs.length === 0) return;
  // PostgREST max URL length is generous, but chunk anyway to be safe.
  const CHUNK = 200;
  for (let i = 0; i < slugs.length; i += CHUNK) {
    const slice = slugs.slice(i, i + CHUNK);
    const url = `${env.restBase}/hotels?slug=in.(${slice.join(',')})`;
    const r = await fetch(url, {
      method: 'PATCH',
      headers: pgHeaders(env, { Prefer: 'return=minimal' }),
      body: JSON.stringify({ is_published: true }),
    });
    if (!r.ok) {
      throw new Error(
        `PostgREST PATCH publish failed: ${r.status} ${(await r.text()).slice(0, 200)}`,
      );
    }
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const env = loadPostgrestEnv();
  console.log(
    `[publish] dryRun=${args.dryRun} tiers=${args.tiers.join(',') || 'ALL'} ` +
      `slug=${args.slug ?? 'none'} limit=${args.limit ?? '\u221e'}`,
  );

  const rows = await fetchDraftRows(env, args);
  console.log(`[publish] ${rows.length} draft(s) considered.`);

  const outcomes = rows.map(evaluateGate);
  const pass = outcomes.filter((o) => o.verdict === 'pass');
  const fail = outcomes.filter((o) => o.verdict === 'fail');

  // Aggregate failure reasons
  const reasonCounts = new Map<string, number>();
  for (const f of fail) {
    for (const r of f.failures) {
      // Strip dynamic numbers from the reason for counting.
      const key = r.replace(/\d+/g, 'N');
      reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
    }
  }
  const sortedReasons = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1]);

  console.log(`[publish] PASS=${pass.length} FAIL=${fail.length}`);
  console.log('[publish] top failure reasons:');
  for (const [reason, n] of sortedReasons.slice(0, 12)) {
    console.log(`  ${String(n).padStart(5)} \u00d7 ${reason}`);
  }

  if (!args.dryRun && pass.length > 0) {
    console.log(`[publish] flipping is_published=true on ${pass.length} hotels...`);
    await flipPublishedTrue(
      env,
      pass.map((p) => p.slug),
    );
    console.log('[publish] done.');
  } else if (args.dryRun) {
    console.log('[publish] DRY RUN \u2014 no DB writes.');
  } else {
    console.log('[publish] nothing eligible to publish.');
  }

  const RUNLOG_DIR = resolve(__dirname, '../../runs');
  mkdirSync(RUNLOG_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = resolve(RUNLOG_DIR, `publish-gate-${ts}.json`);
  writeFileSync(
    logPath,
    JSON.stringify(
      {
        finishedAt: new Date().toISOString(),
        args,
        stats: { considered: rows.length, pass: pass.length, fail: fail.length },
        topReasons: sortedReasons.slice(0, 30),
        failures: fail.map((f) => ({ slug: f.slug, failures: f.failures })),
      },
      null,
      2,
    ),
  );
  console.log(`[publish] runlog \u2192 ${logPath}`);
}

main().catch((err) => {
  console.error('[publish] FATAL', err);
  process.exit(1);
});
