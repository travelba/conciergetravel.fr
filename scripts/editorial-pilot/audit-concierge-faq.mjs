/**
 * Audit `hotels.faq_content` Concierge-voice coverage and quality
 * across the published catalog. Reports:
 *   - # hotels with ≥ 1 FAQ, # with full Concierge coverage on answer_fr
 *   - per-category breakdown (before / during / after / agency)
 *   - featured-count distribution (target = 5 per hotel)
 *   - concierge_tip_fr coverage (target = 0–2 per hotel)
 *   - sentence-length offenders (> 25 mots) — total + first 80
 *   - banned-phrase offenders (light heuristic — see linter for full
 *     set) — total + first 80
 *
 * Usage:
 *   node scripts/editorial-pilot/audit-concierge-faq.mjs
 */
import pg from 'pg';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

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
const cli = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await cli.connect();

const r = await cli.query(`
  select slug, faq_content
  from public.hotels
  where is_published = true
  order by slug
`);

// Mirror `linter.ts#countWords`: split on whitespace only so that
// hyphenated proper nouns ("Centre-Val", "Saint-Tropez") and elided
// articles ("L'Auberge", "d'Or") count as a single word. This keeps
// the audit's "> 25 words" verdict consistent with the humanizer's
// gatekeeper.
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

const BANNED = [
  /\bmagnifiques?\b/giu,
  /\bincontournables?\b/giu,
  /\bjoyaux?\b/giu,
  /\bécrins?\b/giu,
  /\bniché[se]?\b/giu,
  /\bbienvenue\b/iu,
  /\bdécouvrez\b/iu,
  /\bvues?\s+imprenables?\b/giu,
  /\bvues?\s+spectaculaires?\b/giu,
  /\bexpériences?\s+uniques?\b/giu,
  /\bprestigieux?\b/giu,
];

const stats = {
  hotelsTotal: r.rows.length,
  hotelsWithFaq: 0,
  hotelsWithFullAnswerFr: 0,
  hotelsWithExactly5Featured: 0,
  faqsTotal: 0,
  faqsWithAnswerFr: 0,
  featuredTotal: 0,
  tipsTotal: 0,
  byCategory: { before: 0, during: 0, after: 0, agency: 0 },
  longSentences: 0,
  bannedHits: 0,
};
const offenders = [];

for (const row of r.rows) {
  const faqs = Array.isArray(row.faq_content) ? row.faq_content : [];
  if (faqs.length === 0) continue;
  stats.hotelsWithFaq++;
  let allHaveAnswer = true;
  let featuredCount = 0;
  let tipCount = 0;
  for (const f of faqs) {
    stats.faqsTotal++;
    const cat = (f.category && stats.byCategory[f.category] !== undefined) ? f.category : 'before';
    stats.byCategory[cat]++;
    const ans = typeof f.answer_fr === 'string' ? f.answer_fr.trim() : '';
    if (ans.length > 0) {
      stats.faqsWithAnswerFr++;
      const longs = splitSentences(ans).filter((s) => countWords(s) > 25);
      if (longs.length > 0) {
        stats.longSentences += longs.length;
        if (offenders.length < 80) {
          offenders.push(
            `${row.slug} :: "${(f.question_fr ?? f.question_en ?? '?').slice(0, 60)}" :: sentence > 25 words: "${longs[0].slice(0, 100)}…"`,
          );
        }
      }
      for (const re of BANNED) {
        const matches = ans.match(new RegExp(re.source, re.flags));
        if (matches && matches.length > 0) {
          stats.bannedHits += matches.length;
          if (offenders.length < 80) {
            offenders.push(
              `${row.slug} :: "${(f.question_fr ?? f.question_en ?? '?').slice(0, 60)}" :: banned "${matches[0]}" in "${ans.slice(0, 120)}…"`,
            );
          }
        }
      }
    } else {
      allHaveAnswer = false;
    }
    if (f.featured === true) {
      featuredCount++;
      stats.featuredTotal++;
    }
    if (typeof f.concierge_tip_fr === 'string' && f.concierge_tip_fr.trim().length > 0) {
      tipCount++;
      stats.tipsTotal++;
    }
  }
  if (allHaveAnswer) stats.hotelsWithFullAnswerFr++;
  if (featuredCount === 5) stats.hotelsWithExactly5Featured++;
  if (featuredCount !== 5) {
    if (offenders.length < 80) {
      offenders.push(`${row.slug} :: featured-count=${featuredCount} (expected 5)`);
    }
  }
  if (tipCount > 2) {
    offenders.push(`${row.slug} :: tip-count=${tipCount} (expected ≤ 2)`);
  }
}

console.log(`=== Concierge FAQ audit (${stats.hotelsTotal} published hotels) ===`);
console.log(`  Hotels with ≥ 1 FAQ         : ${stats.hotelsWithFaq}`);
console.log(
  `  Hotels with full FR answers : ${stats.hotelsWithFullAnswerFr} / ${stats.hotelsWithFaq}`,
);
console.log(
  `  Hotels with exactly 5 featured: ${stats.hotelsWithExactly5Featured} / ${stats.hotelsWithFaq}`,
);
console.log(`  FAQs total                  : ${stats.faqsTotal}`);
console.log(
  `  FAQs with answer_fr         : ${stats.faqsWithAnswerFr} / ${stats.faqsTotal} (${
    stats.faqsTotal === 0
      ? '0'
      : ((stats.faqsWithAnswerFr * 100) / stats.faqsTotal).toFixed(1)
  }%)`,
);
console.log(`  Featured total              : ${stats.featuredTotal}`);
console.log(`  Concierge tips total        : ${stats.tipsTotal}`);
console.log(`\n  Per-category coverage:`);
for (const cat of Object.keys(stats.byCategory).sort()) {
  console.log(`    ${cat.padEnd(8)} : ${stats.byCategory[cat]}`);
}
console.log(`\n  Quality flags:`);
console.log(`    sentences > 25 words       : ${stats.longSentences}`);
console.log(`    banned-phrase occurrences  : ${stats.bannedHits}`);

if (offenders.length > 0) {
  console.log(`\n  ${offenders.length} flag(s) (showing first 60):`);
  for (const o of offenders.slice(0, 60)) console.log(`    - ${o}`);
}

await cli.end();
