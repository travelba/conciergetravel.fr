/**
 * Overnight launcher — spawns N parallel pipeline processes on remaining
 * FR hotels once briefs are complete. Reads runs/queue-fr-no-brief.txt
 * and filters to those with a brief now in briefs-auto/.
 *
 * Usage:
 *   pnpm --filter @mch/editorial-pilot exec tsx overnight-launch-fr-batches.ts \
 *     --concurrency 4 --label batch2
 *
 * Each background process gets its own log file in runs/.
 */

import { readFile, readdir, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO = resolve(__dirname, '../..');
const RUNS = resolve(REPO, 'runs');

const args = process.argv.slice(2);
const concurrency = (() => {
  const i = args.indexOf('--concurrency');
  return i >= 0 ? Number(args[i + 1]) : 4;
})();
const label = (() => {
  const i = args.indexOf('--label');
  return i >= 0 ? (args[i + 1] ?? 'batch') : 'batch';
})();
const dryRun = args.includes('--dry-run');

const queueFile = (() => {
  const i = args.indexOf('--queue');
  return i >= 0 ? (args[i + 1] ?? 'queue-fr-ready.txt') : 'queue-fr-ready.txt';
})();

const queue = (await readFile(resolve(RUNS, queueFile), 'utf-8'))
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean);

const briefs = await readdir(resolve(REPO, 'scripts/editorial-pilot/briefs-auto'));
const briefSet = new Set(
  briefs.filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')),
);

// Excluded: hotels already produced earlier in the night (the 7 with hand-crafted briefs +
// any slug whose final.md exists in scripts/editorial-pilot/output/<slug>/final.md).
const outputs = await readdir(resolve(REPO, 'scripts/editorial-pilot/output')).catch(() => []);
const alreadyProduced = new Set<string>(outputs);

const ready = queue.filter((s) => briefSet.has(s) && !alreadyProduced.has(s));
const stillNoBrief = queue.filter((s) => !briefSet.has(s));

console.log(`Queue total            : ${queue.length}`);
console.log(`With briefs (ready)    : ${ready.length}`);
console.log(`Already produced       : ${alreadyProduced.size}`);
console.log(`Still missing brief    : ${stillNoBrief.length}`);
console.log('');

if (stillNoBrief.length > 0) {
  console.log('Still missing brief (first 10):');
  stillNoBrief.slice(0, 10).forEach((s) => console.log(`  - ${s}`));
  console.log('');
}

if (ready.length === 0) {
  console.log('Nothing to launch. Exit.');
  process.exit(0);
}

// Round-robin chunk into N batches.
const batches: string[][] = Array.from({ length: concurrency }, () => []);
ready.forEach((slug, i) => {
  batches[i % concurrency]!.push(slug);
});

console.log(`Splitting ${ready.length} hotels into ${concurrency} batches:`);
batches.forEach((b, i) => {
  console.log(
    `  batch ${i + 1} (${b.length}): ${b.slice(0, 3).join(', ')}${b.length > 3 ? `, …(+${b.length - 3})` : ''}`,
  );
});

if (dryRun) {
  console.log('\n[dry-run] Not spawning processes.');
  process.exit(0);
}

await mkdir(RUNS, { recursive: true });

batches.forEach((slugs, i) => {
  if (slugs.length === 0) return;
  const logPath = resolve(RUNS, `overnight-fr-${label}-${i + 1}.log`);
  const env = {
    ...process.env,
    EDITORIAL_PILOT_OPENAI_MODEL: 'gpt-5.4',
    EDITORIAL_PILOT_BRIEFS_DIR: 'briefs-auto',
  };
  // Spawn directly via tsx — bypass pnpm wrapper to avoid PowerShell quoting drama.
  const tsxBin = resolve(REPO, 'node_modules/tsx/dist/cli.mjs');
  const child = spawn('node', [tsxBin, 'src/run.ts', ...slugs], {
    cwd: resolve(REPO, 'scripts/editorial-pilot'),
    env,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.unref();
  // Pipe stdout/stderr into log
  const fs = require('node:fs');
  const stream = fs.createWriteStream(logPath, { flags: 'a' });
  stream.write(
    `\n=== ${new Date().toISOString()} — ${label} ${i + 1} (${slugs.length} hotels) ===\n`,
  );
  child.stdout?.pipe(stream);
  child.stderr?.pipe(stream);
  console.log(`  ✓ Spawned batch ${i + 1} (PID ${child.pid}, ${slugs.length} hotels) → ${logPath}`);
});

console.log('\nAll batches spawned (detached). Tail the logs to monitor progress:');
console.log(`  Get-Content runs/overnight-fr-${label}-1.log -Tail 40 -Wait`);
