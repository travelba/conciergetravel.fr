/**
 * Orchestrator — kit rollout wave for 5 display_only pilot fiches (2026-06-10).
 *
 * Runs per slug (sequential promote to avoid PostgREST rate spikes):
 *   1. enrich:concierge-handoff (venues tips)
 *   2. enrich-poi-handoff
 *   3. enrich-spa-dossier
 *   4. enrich:amenities
 *   5. promote:{slug}-golden
 *   6. reviews:sync
 *   7. {slug}:photos:gallery (if npm script exists)
 *   8. audit:hotel-fiches-cdc
 *
 * Usage:
 *   pnpm --filter @mch/editorial-pilot kit:wave5:dry
 *   pnpm --filter @mch/editorial-pilot kit:wave5
 *   pnpm --filter @mch/editorial-pilot kit:wave5 -- --slug=cheval-blanc-paris
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WAVE_SLUGS = [
  'cheval-blanc-paris',
  'le-bristol-paris',
  'les-airelles-courchevel',
  'les-pres-deugenie',
  'shangri-la-paris',
] as const;

const PROMOTE_SCRIPT: Readonly<Record<string, string>> = {
  'cheval-blanc-paris': 'promote-cheval-blanc-paris-golden.ts',
  'le-bristol-paris': 'promote-le-bristol-paris-golden.ts',
  'les-airelles-courchevel': 'promote-les-airelles-courchevel-golden.ts',
  'les-pres-deugenie': 'promote-les-pres-deugenie-golden.ts',
  'shangri-la-paris': 'promote-shangri-la-paris-golden.ts',
};

const GALLERY_SCRIPT: Readonly<Record<string, string>> = {
  'cheval-blanc-paris': 'resource-cheval-blanc-paris-gallery-batch.ts',
  'le-bristol-paris': 'resource-le-bristol-paris-gallery-batch.ts',
  'les-airelles-courchevel': 'resource-les-airelles-courchevel-gallery-batch.ts',
  'les-pres-deugenie': 'resource-les-pres-deugenie-gallery-batch.ts',
  'shangri-la-paris': 'resource-shangri-la-paris-gallery-batch.ts',
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PILOT_ROOT = path.resolve(__dirname, '..');

function parseArgs(argv: readonly string[]): {
  readonly slugs: readonly string[];
  readonly dryRun: boolean;
  readonly skipPhotos: boolean;
  readonly skipEnrich: boolean;
} {
  const map = new Map<string, string | true>();
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq === -1) map.set(arg.slice(2), true);
    else map.set(arg.slice(2, eq), arg.slice(eq + 1));
  }
  const slugRaw = map.get('slug');
  const slugs =
    typeof slugRaw === 'string' && slugRaw.length > 0
      ? slugRaw.split(',').map((s) => s.trim())
      : [...WAVE_SLUGS];
  return {
    slugs,
    dryRun: map.has('dry-run'),
    skipPhotos: map.has('skip-photos'),
    skipEnrich: map.has('skip-enrich'),
  };
}

function runStep(label: string, cmd: string, args: readonly string[]): boolean {
  console.log(`\n[kit:wave5] ▶ ${label}`);
  const res = spawnSync(cmd, args, {
    cwd: PILOT_ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });
  if (res.status !== 0) {
    console.error(`[kit:wave5] ✗ ${label} failed (exit ${String(res.status)})`);
    return false;
  }
  console.log(`[kit:wave5] ✓ ${label}`);
  return true;
}

function tsx(relPath: string, extraArgs: readonly string[] = []): boolean {
  const abs = path.resolve(__dirname, relPath);
  return runStep(relPath, 'npx', ['tsx', abs, ...extraArgs]);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log(`[kit:wave5] slugs=${args.slugs.join(',')} dryRun=${args.dryRun}`);

  let failures = 0;

  for (const slug of args.slugs) {
    console.log(`\n${'='.repeat(60)}\n[kit:wave5] HOTEL: ${slug}\n${'='.repeat(60)}`);

    if (!args.skipEnrich) {
      const enrichSlugs = `--slugs=${slug}`;
      if (
        !tsx('../enrichment/enrich-concierge-handoff.ts', [
          enrichSlugs,
          ...(args.dryRun ? ['--dry-run'] : []),
        ])
      ) {
        failures += 1;
      }
      if (
        !tsx('../enrichment/enrich-poi-handoff.ts', [
          enrichSlugs,
          ...(args.dryRun ? ['--dry-run'] : []),
        ])
      ) {
        failures += 1;
      }
      if (
        !tsx('../enrichment/enrich-spa-dossier.ts', [
          enrichSlugs,
          ...(args.dryRun ? ['--dry-run'] : []),
        ])
      ) {
        failures += 1;
      }
      if (
        !runStep('enrich:amenities', 'pnpm', [
          '--filter',
          '@mch/editorial-pilot',
          'enrich:amenities',
          '--',
          `--slug=${slug}`,
          ...(args.dryRun ? ['--dry-run'] : []),
        ])
      ) {
        failures += 1;
      }
    }

    const promoteScript = PROMOTE_SCRIPT[slug];
    if (promoteScript !== undefined) {
      const promoteArgs = args.dryRun ? ['--dry-run'] : [];
      if (!tsx(`./${promoteScript}`, promoteArgs)) failures += 1;
    } else {
      console.warn(`[kit:wave5] ⚠ no promote script for ${slug} — skip`);
      failures += 1;
    }

    if (!args.dryRun) {
      if (
        !runStep('reviews:sync', 'pnpm', [
          '--filter',
          '@mch/editorial-pilot',
          'reviews:sync',
          '--',
          `--slug=${slug}`,
        ])
      ) {
        failures += 1;
      }
    }

    if (!args.skipPhotos && !args.dryRun) {
      const galleryScript = GALLERY_SCRIPT[slug];
      if (galleryScript !== undefined) {
        const galleryArgs = args.dryRun ? ['--dry-run'] : [];
        if (!tsx(`../photos/${galleryScript}`, galleryArgs)) failures += 1;
      }
    }

    const auditArgs = [`--slug=${slug}`];
    if (!tsx('./audit-hotel-fiche-cdc.ts', auditArgs)) failures += 1;
  }

  console.log(`\n[kit:wave5] done — ${failures} step failure(s)`);
  if (failures > 0) process.exit(1);
}

main().catch((err: unknown) => {
  console.error('[kit:wave5] fatal:', err);
  process.exit(1);
});
