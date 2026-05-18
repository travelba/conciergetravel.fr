/**
 * Cross-block Concierge completeness audit for `public.hotels`.
 *
 * For every published hotel, computes a 4-axis score:
 *   - Advice  : `concierge_advice.fr.body` present and in the 50-110
 *               word envelope (ADR-0011 §C2).
 *   - POI     : every `points_of_interest[].description_fr` is in
 *               Concierge voice (≤ 25 words/sentence, no banned phrase).
 *   - Events  : every `upcoming_events[].description_fr` present + in
 *               Concierge voice.
 *   - FAQ     : every `faq_content[].answer_fr` present, in Concierge
 *               voice, AND the hotel has exactly 5 `featured: true`.
 *
 * Each axis returns a 0-100 % score per hotel (ratio of items passing
 * the rule over total items in that block). The hotel's global score
 * is the unweighted mean of the 4 axes. The script exits non-zero if
 * any published hotel scores < 95 %.
 *
 * Word counter intentionally matches `linter.ts#countWords` so the
 * audit verdict is in lockstep with the humanizer gatekeepers.
 *
 * Usage:
 *   node scripts/editorial-pilot/audit-concierge-fiche.mjs
 *   node scripts/editorial-pilot/audit-concierge-fiche.mjs --json
 *   node scripts/editorial-pilot/audit-concierge-fiche.mjs --threshold 0.9
 */
import pg from 'pg';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const wantJson = args.includes('--json');
const thresholdIdx = args.indexOf('--threshold');
const threshold = thresholdIdx >= 0 ? Number(args[thresholdIdx + 1]) : 0.95;
if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
  console.error('audit: --threshold must be a number in (0, 1]');
  process.exit(2);
}

const envPath = [
  resolve(process.cwd(), '.env.local'),
  resolve(process.cwd(), '../../.env.local'),
  resolve(import.meta.dirname, '../../.env.local'),
].find((p) => existsSync(p));
if (!envPath) {
  console.error('audit: no .env.local found (looked in cwd, ../../, script dir)');
  process.exit(1);
}
const envText = readFileSync(envPath, 'utf8');
const env = {};
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
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const conn = (env.SUPABASE_DB_POOLER_URL ?? env.DATABASE_URL ?? '').replace(
  /\?sslmode=require/,
  '',
);
if (!conn) {
  console.error('audit: SUPABASE_DB_POOLER_URL / DATABASE_URL missing');
  process.exit(1);
}
const cli = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await cli.connect();

const r = await cli.query(`
  select slug, concierge_advice, points_of_interest, upcoming_events, faq_content
  from public.hotels
  where is_published = true
  order by slug
`);

// ---------------------------------------------------------------------------
// Word + sentence helpers — kept byte-identical with the linter.
// ---------------------------------------------------------------------------
function countWords(s) {
  if (typeof s !== 'string') return 0;
  return s.split(/\s+/).filter((w) => w.length > 0 && /[\p{L}\p{N}]/u.test(w)).length;
}

function splitSentences(s) {
  if (typeof s !== 'string') return [];
  return s
    .replace(/\.\.\./g, '.')
    .split(/(?<=[.!?…])\s+/u)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

// Subset of `linter.ts` BANNED terms we treat as blockers for the
// cross-block audit. We focus on the high-frequency patterns the
// humanizers explicitly target — full lint runs are reserved for the
// per-block audits.
const BANNED_BLOCKERS = [
  /\bniché[se]?\s+(?:au\s+cœur|entre)\b/iu,
  /^(\s*)découvrez\b/imu,
  /^(\s*)bienvenue\s+dans\b/imu,
  /^(\s*)plongez\s+dans\b/imu,
  /\bvues?\s+imprenables?\b/giu,
  /\bvues?\s+spectaculaires?\b/giu,
  /\bexpériences?\s+inoubliables?\b/giu,
  /\bcocons?\b/giu,
  /\bjoyaux?\b/giu,
  /\bécrins?\b/giu,
  /\bart\s+de\s+(?:recevoir|vivre)\b/giu,
];

function violatesBanned(text) {
  if (typeof text !== 'string' || text.length === 0) return false;
  return BANNED_BLOCKERS.some((re) => new RegExp(re.source, re.flags).test(text));
}

function violatesSentenceLength(text, max = 25) {
  if (typeof text !== 'string' || text.length === 0) return false;
  return splitSentences(text).some((s) => countWords(s) > max);
}

function passesConciergeText(text) {
  if (typeof text !== 'string') return false;
  const t = text.trim();
  if (t.length === 0) return false;
  if (violatesSentenceLength(t)) return false;
  if (violatesBanned(t)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Per-axis scoring.
// ---------------------------------------------------------------------------
function scoreAdvice(advice) {
  // Envelope 50-110 mots on `advice.fr.body`.
  if (!advice || typeof advice !== 'object') return { score: 0, total: 1, pass: 0, note: 'missing' };
  const body = advice?.fr?.body;
  if (typeof body !== 'string') return { score: 0, total: 1, pass: 0, note: 'no fr.body' };
  const wc = countWords(body);
  if (wc < 50 || wc > 110) return { score: 0, total: 1, pass: 0, note: `wc=${wc} out of 50-110` };
  if (violatesSentenceLength(body) || violatesBanned(body))
    return { score: 0, total: 1, pass: 0, note: 'voice violation' };
  return { score: 1, total: 1, pass: 1, note: 'ok' };
}

function scorePoi(pois) {
  // No POIs is a data-availability gap (DATAtourisme + Google Places
  // didn't return anything within radius), not a Concierge voice
  // failure — treat as n/a so the global score isn't penalised.
  if (!Array.isArray(pois) || pois.length === 0)
    return { score: 1, total: 0, pass: 0, note: 'no POIs (n/a)' };
  let pass = 0;
  for (const p of pois) {
    if (passesConciergeText(p?.description_fr)) pass += 1;
  }
  return { score: pass / pois.length, total: pois.length, pass, note: '' };
}

function scoreEvents(events) {
  if (!Array.isArray(events) || events.length === 0)
    return { score: 1, total: 0, pass: 0, note: 'no events (n/a)' };
  let pass = 0;
  for (const e of events) {
    if (passesConciergeText(e?.description_fr)) pass += 1;
  }
  return { score: pass / events.length, total: events.length, pass, note: '' };
}

function scoreFaq(faqs) {
  if (!Array.isArray(faqs) || faqs.length === 0)
    return { score: 0, total: 0, pass: 0, note: 'no FAQs' };
  let pass = 0;
  let featured = 0;
  for (const f of faqs) {
    if (passesConciergeText(f?.answer_fr)) pass += 1;
    if (f?.featured === true) featured += 1;
  }
  const answerScore = pass / faqs.length;
  // Featured count must be exactly 5 (ADR-0011 C1). Apply as a hard
  // gate: any deviation drops the score to 0.5 × answerScore.
  const featuredOk = featured === 5;
  return {
    score: featuredOk ? answerScore : answerScore * 0.5,
    total: faqs.length,
    pass,
    note: featuredOk ? `featured=${featured}` : `featured=${featured} (expected 5)`,
  };
}

// ---------------------------------------------------------------------------
// Roll up per hotel.
// ---------------------------------------------------------------------------
const perHotel = [];
const aggregate = {
  totalHotels: r.rows.length,
  axes: { advice: 0, poi: 0, events: 0, faq: 0 },
  axisTotals: { advice: 0, poi: 0, events: 0, faq: 0 },
  failed: 0,
};
for (const row of r.rows) {
  const a = scoreAdvice(row.concierge_advice);
  const p = scorePoi(row.points_of_interest);
  const e = scoreEvents(row.upcoming_events);
  const f = scoreFaq(row.faq_content);
  const global = (a.score + p.score + e.score + f.score) / 4;
  aggregate.axes.advice += a.score;
  aggregate.axes.poi += p.score;
  aggregate.axes.events += e.score;
  aggregate.axes.faq += f.score;
  aggregate.axisTotals.advice += 1;
  aggregate.axisTotals.poi += 1;
  aggregate.axisTotals.events += 1;
  aggregate.axisTotals.faq += 1;
  if (global < threshold) aggregate.failed += 1;
  perHotel.push({
    slug: row.slug,
    global,
    axes: { advice: a, poi: p, events: e, faq: f },
  });
}

const meanAxis = {
  advice: aggregate.axes.advice / Math.max(1, aggregate.axisTotals.advice),
  poi: aggregate.axes.poi / Math.max(1, aggregate.axisTotals.poi),
  events: aggregate.axes.events / Math.max(1, aggregate.axisTotals.events),
  faq: aggregate.axes.faq / Math.max(1, aggregate.axisTotals.faq),
};

if (wantJson) {
  console.log(JSON.stringify({ threshold, aggregate: { ...aggregate, meanAxis }, perHotel }, null, 2));
} else {
  console.log(`=== Concierge fiche cross-block audit ===`);
  console.log(`  Threshold       : ${(threshold * 100).toFixed(0)} %`);
  console.log(`  Hotels audited  : ${aggregate.totalHotels}`);
  console.log(`  Mean Advice score : ${(meanAxis.advice * 100).toFixed(1)} %`);
  console.log(`  Mean POI score    : ${(meanAxis.poi * 100).toFixed(1)} %`);
  console.log(`  Mean Events score : ${(meanAxis.events * 100).toFixed(1)} %`);
  console.log(`  Mean FAQ score    : ${(meanAxis.faq * 100).toFixed(1)} %`);
  console.log(`  Failing hotels    : ${aggregate.failed} / ${aggregate.totalHotels}`);
  const worst = [...perHotel].sort((a, b) => a.global - b.global).slice(0, 15);
  if (worst[0] && worst[0].global < 1) {
    console.log(`\n  Worst 15 hotels:`);
    for (const h of worst) {
      const a = `advice=${(h.axes.advice.score * 100).toFixed(0)}%`;
      const p = `poi=${(h.axes.poi.score * 100).toFixed(0)}%${h.axes.poi.note ? ` (${h.axes.poi.note})` : ''}`;
      const e = `events=${(h.axes.events.score * 100).toFixed(0)}%`;
      const f = `faq=${(h.axes.faq.score * 100).toFixed(0)}%${h.axes.faq.note ? ` (${h.axes.faq.note})` : ''}`;
      console.log(
        `    ${h.slug.padEnd(42)} global=${(h.global * 100).toFixed(0)}%  ${a} | ${p} | ${e} | ${f}`,
      );
    }
  }
}

await cli.end();
if (aggregate.failed > 0) process.exit(1);
