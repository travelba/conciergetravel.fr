/**
 * run-fiche-content-waves.ts — pilot-then-scale orchestrator for the
 * hotel-fiche content-completion plan.
 *
 * Drives the existing per-pipeline CLIs in the canonical Wave 0→4 order
 * (see fiche-content-waves.ts), adapting one cohort slug list to each
 * pipeline's flag convention. Designed to run the pilot cohort first,
 * then scale by tier.
 *
 * Usage:
 *   pnpm fiches:waves --plan                      # print the full plan
 *   pnpm fiches:waves --wave=1 --plan             # plan for one wave
 *   pnpm fiches:waves --wave=1 --cohort=runs/pilot-cohort.txt --dry-run
 *   pnpm fiches:waves --wave=1 --cohort=... --limit=5   # live pilot
 *   pnpm fiches:waves --wave=1 --slugs=a,b,c --dry-run
 *   pnpm fiches:waves --wave=0 --from-step=policies --plan
 *
 * Safety: defaults to `--plan` (prints, runs nothing) unless an execution
 * intent is given. `--dry-run` propagates to every step that supports it.
 *
 * Skill: editorial-pilot, user-acceptance-loop.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, isAbsolute } from 'node:path';

import {
  WAVE_PLAN,
  allWaves,
  buildStepInvocation,
  stepsForWave,
  type BuildContext,
  type PipelineStep,
} from './fiche-content-waves.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PILOT_ROOT = resolve(__dirname, '../..');

interface Args {
  readonly wave: number | null;
  readonly fromStep: string | null;
  readonly onlyStep: string | null;
  readonly cohortFile: string | null;
  readonly slugs: readonly string[];
  readonly dryRun: boolean;
  readonly limit: number | null;
  readonly plan: boolean;
  readonly execute: boolean;
}

function parseArgs(argv: readonly string[]): Args {
  const map = new Map<string, string | true>();
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq === -1) map.set(arg.slice(2), true);
    else map.set(arg.slice(2, eq), arg.slice(eq + 1));
  }
  const waveRaw = map.get('wave');
  const limitRaw = map.get('limit');
  const slugsRaw = map.get('slugs');
  const cohortRaw = map.get('cohort');
  const fromStepRaw = map.get('from-step');
  const onlyStepRaw = map.get('step');
  const execute = map.has('execute') || map.has('run');
  return {
    wave: typeof waveRaw === 'string' ? Number(waveRaw) : null,
    fromStep: typeof fromStepRaw === 'string' ? fromStepRaw : null,
    onlyStep: typeof onlyStepRaw === 'string' ? onlyStepRaw : null,
    cohortFile: typeof cohortRaw === 'string' ? cohortRaw : null,
    slugs:
      typeof slugsRaw === 'string'
        ? slugsRaw
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
        : [],
    dryRun: map.has('dry-run'),
    limit:
      typeof limitRaw === 'string' && Number.isFinite(Number(limitRaw)) ? Number(limitRaw) : null,
    // Plan-by-default: only execute when explicitly asked.
    plan: map.has('plan') || (!execute && true),
    execute,
  };
}

async function readCohortFile(path: string): Promise<readonly string[]> {
  const content = await readFile(path, 'utf-8');
  return content
    .split(/[\r\n,]+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('#'));
}

function selectSteps(args: Args): readonly PipelineStep[] {
  let steps = args.wave !== null ? stepsForWave(args.wave) : WAVE_PLAN;
  if (args.onlyStep !== null) {
    steps = steps.filter((s) => s.id === args.onlyStep);
  } else if (args.fromStep !== null) {
    const idx = steps.findIndex((s) => s.id === args.fromStep);
    if (idx >= 0) steps = steps.slice(idx);
  }
  return steps;
}

function fmtCmd(args: readonly string[], env: Readonly<Record<string, string>>): string {
  const envPrefix = Object.entries(env)
    .map(([k, v]) => `${k}=${v.length > 40 ? `${v.slice(0, 37)}…` : v}`)
    .join(' ');
  const cmd = `tsx ${args.join(' ')}`;
  return envPrefix.length > 0 ? `${envPrefix} ${cmd}` : cmd;
}

function runOne(
  scriptAbs: string,
  args: readonly string[],
  extraEnv: Readonly<Record<string, string>>,
): Promise<number> {
  return new Promise((resolveRun) => {
    const child = spawn('npx', ['tsx', scriptAbs, ...args], {
      cwd: PILOT_ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: { ...process.env, ...extraEnv },
    });
    child.on('exit', (code) => resolveRun(code ?? 1));
    child.on('error', () => resolveRun(1));
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  let slugs = args.slugs;
  let cohortFilePath: string | null = null;
  if (args.cohortFile !== null) {
    cohortFilePath = isAbsolute(args.cohortFile)
      ? args.cohortFile
      : resolve(PILOT_ROOT, args.cohortFile);
    if (!existsSync(cohortFilePath)) {
      throw new Error(`[waves] cohort file not found: ${cohortFilePath}`);
    }
    const fileSlugs = await readCohortFile(cohortFilePath);
    slugs = slugs.length > 0 ? [...new Set([...slugs, ...fileSlugs])] : fileSlugs;
  }

  const ctx: BuildContext = {
    slugs,
    slugsFilePath: cohortFilePath,
    dryRun: args.dryRun,
    limit: args.limit,
  };

  const steps = selectSteps(args);
  if (steps.length === 0) {
    console.log('[waves] no steps match the selection.');
    return;
  }

  const mode = args.execute ? (args.dryRun ? 'EXECUTE (dry-run)' : 'EXECUTE (LIVE)') : 'PLAN';
  console.log(
    `[waves] mode=${mode} waves=${args.wave ?? allWaves().join(',')} cohort=${slugs.length} slugs limit=${args.limit ?? '∞'}`,
  );
  console.log('');

  let lastWave = -1;
  for (const step of steps) {
    if (step.wave !== lastWave) {
      console.log(`\n=== Wave ${step.wave} ===`);
      lastWave = step.wave;
    }
    const inv = buildStepInvocation(step, ctx);
    console.log(`\n• [${step.id}] ${step.label}`);
    if (step.note) console.log(`  note: ${step.note}`);
    console.log(`  requires: ${step.requires.join(', ')}`);
    if (inv.needsSlugsFile) {
      console.log(
        '  ⚠ needs --cohort=<file> to restrict to the cohort; will run catalogue-wide otherwise.',
      );
    }
    const loopNote =
      inv.commands.length > 1 ? ` (${inv.commands.length} spawns, one per slug)` : '';
    for (const c of inv.commands.slice(0, args.execute ? inv.commands.length : 3)) {
      console.log(
        `  $ ${fmtCmd([step.script, ...c.args], c.env)}${c.forSlug ? `   # ${c.forSlug}` : ''}`,
      );
    }
    if (!args.execute && inv.commands.length > 3) {
      console.log(`  … +${inv.commands.length - 3} more${loopNote}`);
    }

    if (!args.execute) continue;

    const scriptAbs = resolve(PILOT_ROOT, step.script);
    for (const c of inv.commands) {
      const code = await runOne(scriptAbs, c.args, c.env);
      if (code !== 0) {
        console.error(
          `[waves] step ${step.id}${c.forSlug ? ` (${c.forSlug})` : ''} exited ${code} — stopping.`,
        );
        process.exitCode = code;
        return;
      }
    }
  }

  console.log('\n[waves] done.');
  if (!args.execute) {
    console.log('[waves] this was a PLAN. Re-run with --execute (and --dry-run for a safe pass).');
  }
}

main().catch((err) => {
  console.error('[waves] FATAL', err);
  process.exit(1);
});
