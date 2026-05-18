/**
 * Push the `concierge_advice` produced by the full 8-pass pipeline
 * (output/<slug>/08-concierge-advice.json) into Supabase.
 *
 * Use after `tsx src/run-parallel.ts --slug=foo,bar` to overwrite the
 * Phase 3 humanizer output with the higher-quality Phase 4 (vague 2)
 * pipeline output for the targeted palaces.
 *
 * Usage:
 *   node push-pipeline-advice.mjs slug1 slug2 slug3
 *   node push-pipeline-advice.mjs --all  (all output/<slug>/08-concierge-advice.json files)
 */
import pg from 'pg';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

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

const args = process.argv.slice(2);
let slugs = [];
if (args.includes('--all')) {
  const outputDir = resolve(process.cwd(), 'output');
  slugs = readdirSync(outputDir).filter((d) => {
    const p = join(outputDir, d, '08-concierge-advice.json');
    return existsSync(p);
  });
} else {
  slugs = args.filter((a) => !a.startsWith('--'));
}

if (slugs.length === 0) {
  console.error('Usage: push-pipeline-advice.mjs <slug1> <slug2>... | --all');
  process.exit(1);
}

let ok = 0;
let failed = 0;
for (const slug of slugs) {
  const adviceFile = resolve(process.cwd(), 'output', slug, '08-concierge-advice.json');
  if (!existsSync(adviceFile)) {
    console.warn(`[skip] ${slug} — no 08-concierge-advice.json found`);
    failed += 1;
    continue;
  }
  const advice = JSON.parse(readFileSync(adviceFile, 'utf8'));
  if (!advice?.concierge_advice?.fr) {
    console.warn(`[skip] ${slug} — no concierge_advice.fr`);
    failed += 1;
    continue;
  }
  const payload = {
    fr: advice.concierge_advice.fr,
    en: advice.concierge_advice.en,
  };
  try {
    await cli.query(`update public.hotels set concierge_advice = $1 where slug = $2`, [
      payload,
      slug,
    ]);
    const frBody = payload.fr.body ?? '';
    const enBody = payload.en?.body ?? '';
    console.log(
      `[ok] ${slug} — FR ${frBody.split(/\s+/).length}w / EN ${enBody.split(/\s+/).length}w / tip_for=${payload.fr.tip_for}`,
    );
    ok += 1;
  } catch (e) {
    console.error(`[err] ${slug}: ${e.message}`);
    failed += 1;
  }
}
await cli.end();
console.log(`\nSummary: ${ok} ok, ${failed} failed`);
if (failed > 0) process.exit(2);
