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

// Mask the URL for log
const hostMatch = conn.match(/@([^:/]+):/);
console.log('Connecting to:', hostMatch ? hostMatch[1] : 'unknown');

const cli = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await cli.connect();
const { rows } = await cli.query(`select
  (select count(*) from hotels) as hotels_total,
  (select count(*) from hotels where is_published = true) as hotels_published,
  (select count(*) from editorial_guides where is_published = true) as guides_published,
  (select count(*) from editorial_rankings) as rankings_total`);
console.log(rows[0]);
await cli.end();
