/**
 * Audit `concierge_advice` quality across the catalog :
 *  - count of hotels with FR / EN advice
 *  - histogram of body word counts (target 60-90)
 *  - flag sentences > 25 words
 *  - flag missing « Mon conseil : » / « My tip: » prefix
 *  - report tip_for distribution
 */
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envText = readFileSync(resolve(process.cwd(), '../../.env.local'), 'utf8');
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
const conn = (env.SUPABASE_DB_POOLER_URL ?? '').replace(/\?sslmode=require/, '');
const cli = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await cli.connect();

const r = await cli.query(`
  select slug, concierge_advice
  from public.hotels
  where is_published = true
  order by slug
`);

function countWords(s) {
  if (typeof s !== 'string') return 0;
  const t = s.trim();
  if (!t.length) return 0;
  return t.split(/[^\p{L}\p{N}]+/u).filter((x) => x.length > 0).length;
}

function splitSentences(s) {
  if (typeof s !== 'string') return [];
  return s
    .replace(/\.\.\./g, '.')
    .split(/(?<=[.!?])\s+/u)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

const counts = {
  total: r.rows.length,
  hasFr: 0,
  hasEn: 0,
  frWordOk: 0,
  enWordOk: 0,
  frHasTip: 0,
  enHasTip: 0,
  frLongSentence: 0,
  enLongSentence: 0,
};
const tipForDist = {};
const offenders = [];

for (const row of r.rows) {
  const adv = row.concierge_advice;
  if (!adv || typeof adv !== 'object') continue;
  if (adv.fr) {
    counts.hasFr++;
    const w = countWords(adv.fr.body);
    if (w >= 50 && w <= 110) counts.frWordOk++;
    else offenders.push(`${row.slug} FR words=${w}`);
    if (typeof adv.fr.body === 'string' && /^\s*Mon conseil\s*:/i.test(adv.fr.body)) {
      counts.frHasTip++;
    } else {
      offenders.push(`${row.slug} FR missing "Mon conseil :"`);
    }
    const long = splitSentences(adv.fr.body).filter((s) => countWords(s) > 25);
    if (long.length > 0) {
      counts.frLongSentence++;
      offenders.push(`${row.slug} FR ${long.length} sentence(s) > 25 words: "${long[0].slice(0, 100)}…"`);
    }
    if (typeof adv.fr.tip_for === 'string') {
      tipForDist[adv.fr.tip_for] = (tipForDist[adv.fr.tip_for] ?? 0) + 1;
    }
  }
  if (adv.en) {
    counts.hasEn++;
    const w = countWords(adv.en.body);
    if (w >= 50 && w <= 110) counts.enWordOk++;
    else offenders.push(`${row.slug} EN words=${w}`);
    if (typeof adv.en.body === 'string' && /^\s*My tip\s*:/i.test(adv.en.body)) {
      counts.enHasTip++;
    } else {
      offenders.push(`${row.slug} EN missing "My tip:"`);
    }
    const long = splitSentences(adv.en.body).filter((s) => countWords(s) > 25);
    if (long.length > 0) {
      counts.enLongSentence++;
      offenders.push(`${row.slug} EN ${long.length} sentence(s) > 25 words: "${long[0].slice(0, 100)}…"`);
    }
  }
}

console.log(`=== Concierge advice audit (${counts.total} published hotels) ===`);
console.log(`  FR present                 : ${counts.hasFr} / ${counts.total}`);
console.log(`  EN present                 : ${counts.hasEn} / ${counts.total}`);
console.log(`  FR body 50-110 words       : ${counts.frWordOk} / ${counts.hasFr}`);
console.log(`  EN body 50-110 words       : ${counts.enWordOk} / ${counts.hasEn}`);
console.log(`  FR starts "Mon conseil :"  : ${counts.frHasTip} / ${counts.hasFr}`);
console.log(`  EN starts "My tip:"        : ${counts.enHasTip} / ${counts.hasEn}`);
console.log(`  FR has sentence > 25 words : ${counts.frLongSentence}`);
console.log(`  EN has sentence > 25 words : ${counts.enLongSentence}`);

console.log(`\n  tip_for distribution (FR):`);
for (const [k, v] of Object.entries(tipForDist).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${k.padEnd(10)} : ${v}`);
}

if (offenders.length > 0) {
  console.log(`\n  ${offenders.length} offender(s) (showing first 30):`);
  for (const o of offenders.slice(0, 30)) console.log(`    - ${o}`);
}

await cli.end();
