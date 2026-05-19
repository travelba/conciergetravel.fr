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

const cols = await c.query(`select column_name, data_type from information_schema.columns where table_schema='public' and table_name='hotels' order by ordinal_position`);
console.log('Columns in public.hotels:');
for (const r of cols.rows) console.log(`  ${r.column_name.padEnd(30)} ${r.data_type}`);

console.log('\nSample row (bvlgari-hotel-paris):');
const r = await c.query(`select * from public.hotels where slug = 'bvlgari-hotel-paris' limit 1`);
for (const [k, v] of Object.entries(r.rows[0] ?? {})) {
  let display = v;
  if (v && typeof v === 'object') display = JSON.stringify(v).slice(0, 80);
  if (typeof v === 'string' && v.length > 80) display = v.slice(0, 80) + '…';
  console.log(`  ${k.padEnd(30)} ${display}`);
}

await c.end();
