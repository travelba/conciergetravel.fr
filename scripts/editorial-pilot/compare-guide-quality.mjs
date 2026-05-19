/**
 * Compare quality of 10 new drafts vs 30 already-published guides.
 * Decision: are the drafts publishable at the existing bar?
 */
import { config as loadDotenv } from 'dotenv';
import { Client } from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadDotenv({ path: path.resolve(__dirname, '../../.env.local') });

const conn = (process.env['SUPABASE_DB_POOLER_URL'] ?? process.env['SUPABASE_DB_URL'] ?? '').replace(/[?&]sslmode=[^&]*/gi, '');
const c = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await c.connect();

const BANNED = ['incroyable', 'magnifique', 'exceptionnel', 'magique', 'sublime', 'extraordinaire', 'fantastique', 'féerique', 'merveilleux', 'unique en son genre'];

function countWords(s) {
  if (typeof s !== 'string') return 0;
  return s.trim().split(/[^\p{L}\p{N}]+/u).filter((x) => x.length > 0).length;
}
function splitSentences(s) {
  return (s || '').replace(/\.\.\./g, '.').split(/(?<=[.!?])\s+/u).map((x) => x.trim()).filter(Boolean);
}
function bannedCount(s) {
  const lower = (s || '').toLowerCase();
  let n = 0;
  for (const t of BANNED) {
    const re = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*\\b`, 'gi');
    const m = lower.match(re);
    if (m) n += m.length;
  }
  return n;
}

const r = await c.query(`select slug, is_published, sections from public.editorial_guides order by slug`);
const stats = { pub: [], draft: [] };
for (const row of r.rows) {
  const sections = Array.isArray(row.sections) ? row.sections : [];
  let wordsFr = 0, over25 = 0, banned = 0;
  for (const s of sections) {
    const body = s?.body_fr ?? '';
    wordsFr += countWords(body);
    for (const sentence of splitSentences(body)) {
      if (countWords(sentence) > 25) over25++;
    }
    banned += bannedCount(body);
  }
  const entry = { slug: row.slug, fr_words: wordsFr, over25, banned, sections: sections.length };
  if (row.is_published) stats.pub.push(entry); else stats.draft.push(entry);
}

function summarise(rows, label) {
  const n = rows.length;
  if (n === 0) {
    console.log(`${label}: no rows`);
    return;
  }
  const avg = (k) => Math.round(rows.reduce((a, b) => a + b[k], 0) / n);
  const min = (k) => Math.min(...rows.map((r) => r[k]));
  const max = (k) => Math.max(...rows.map((r) => r[k]));
  console.log(`\n${label} (n=${n}):`);
  console.log(`  FR words   avg=${avg('fr_words')}  min=${min('fr_words')}  max=${max('fr_words')}`);
  console.log(`  >25 words  avg=${avg('over25')}    min=${min('over25')}    max=${max('over25')}`);
  console.log(`  banned     avg=${avg('banned')}    min=${min('banned')}    max=${max('banned')}`);
}
summarise(stats.pub, 'PUBLISHED guides');
summarise(stats.draft, 'DRAFT guides (10 new)');

const blocking = stats.draft.filter((d) => {
  const pubAvgOver25 = stats.pub.reduce((a, b) => a + b.over25, 0) / stats.pub.length;
  const pubMaxBanned = Math.max(...stats.pub.map((r) => r.banned));
  return d.over25 > pubAvgOver25 * 2 || d.banned > pubMaxBanned + 2;
});
console.log(`\nDrafts that significantly exceed the published bar: ${blocking.length}`);
for (const d of blocking) console.log(`  - ${d.slug}: over25=${d.over25}, banned=${d.banned}`);

await c.end();
