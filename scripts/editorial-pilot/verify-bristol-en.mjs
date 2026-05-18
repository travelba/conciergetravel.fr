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
const { rows } = await cli.query(`
  select slug, description_en, meta_title_en, meta_desc_en,
         (faq_content -> 0 ->> 'question_en') as faq0_q_en,
         (faq_content -> 0 ->> 'answer_en') as faq0_a_en,
         (long_description_sections -> 0 ->> 'title_en') as sec0_title_en,
         left(long_description_sections -> 0 ->> 'body_en', 200) as sec0_body_en,
         (signature_experiences -> 0 ->> 'summary_en') as sig0_en,
         (awards -> 0 ->> 'name_en') as award0_en
  from hotels where slug = 'le-bristol-paris'`);
console.log(JSON.stringify(rows[0], null, 2));
await cli.end();
