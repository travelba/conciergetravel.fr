import { describe, it, expect } from 'vitest';

import {
  WAVE_PLAN,
  allWaves,
  buildStepInvocation,
  stepsForWave,
  type BuildContext,
  type PipelineStep,
} from './fiche-content-waves.js';

function step(over: Partial<PipelineStep> & Pick<PipelineStep, 'slugChannel'>): PipelineStep {
  return {
    id: 'x',
    wave: 1,
    label: 'X',
    script: 'src/x.ts',
    supportsDryRun: true,
    supportsLimit: true,
    requires: [],
    ...over,
  };
}

const cohort: BuildContext = {
  slugs: ['a', 'b', 'c'],
  slugsFilePath: null,
  dryRun: false,
  limit: null,
};

describe('WAVE_PLAN integrity', () => {
  it('has unique step ids', () => {
    const ids = WAVE_PLAN.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers waves 0..4 and excludes any booking step', () => {
    expect(allWaves()).toEqual([0, 1, 2, 3, 4]);
    expect(WAVE_PLAN.some((s) => /booking|amadeus|offer/iu.test(s.id))).toBe(false);
  });

  it('stepsForWave filters correctly', () => {
    expect(stepsForWave(0).every((s) => s.wave === 0)).toBe(true);
    expect(stepsForWave(0).length).toBeGreaterThan(0);
  });
});

describe('buildStepInvocation', () => {
  it('flag-slugs emits --slugs=csv', () => {
    const inv = buildStepInvocation(step({ slugChannel: { kind: 'flag-slugs' } }), cohort);
    expect(inv.commands).toHaveLength(1);
    expect(inv.commands[0]?.args).toContain('--slugs=a,b,c');
  });

  it('flag-slugs-space emits --slugs csv as separate args', () => {
    const inv = buildStepInvocation(step({ slugChannel: { kind: 'flag-slugs-space' } }), cohort);
    expect(inv.commands[0]?.args).toEqual(['--slugs', 'a,b,c']);
  });

  it('flag-slugs-space falls back to --all without cohort', () => {
    const inv = buildStepInvocation(step({ slugChannel: { kind: 'flag-slugs-space' } }), {
      ...cohort,
      slugs: [],
    });
    expect(inv.commands[0]?.args).toEqual(['--all']);
  });

  it('flag-slugs-file falls back to inline --slugs for a small cohort', () => {
    const inv = buildStepInvocation(step({ slugChannel: { kind: 'flag-slugs-file' } }), cohort);
    expect(inv.needsSlugsFile).toBe(false);
    expect(inv.commands[0]?.args).toContain('--slugs=a,b,c');
  });

  it('flag-slugs-file hints needsSlugsFile for a large cohort without a file', () => {
    const big = Array.from({ length: 200 }, (_, i) => `h${i}`);
    const inv = buildStepInvocation(step({ slugChannel: { kind: 'flag-slugs-file' } }), {
      ...cohort,
      slugs: big,
    });
    expect(inv.needsSlugsFile).toBe(true);
  });

  it('flag-slugs-file emits the path when provided', () => {
    const inv = buildStepInvocation(step({ slugChannel: { kind: 'flag-slugs-file' } }), {
      ...cohort,
      slugsFilePath: '/tmp/cohort.txt',
    });
    expect(inv.needsSlugsFile).toBe(false);
    expect(inv.commands[0]?.args).toContain('--slugs-file=/tmp/cohort.txt');
  });

  it('env-slugs sets MCH_ONLY_SLUGS', () => {
    const inv = buildStepInvocation(step({ slugChannel: { kind: 'env-slugs' } }), cohort);
    expect(inv.commands[0]?.env['MCH_ONLY_SLUGS']).toBe('a,b,c');
  });

  it('slug-loop yields one command per slug', () => {
    const inv = buildStepInvocation(step({ slugChannel: { kind: 'slug-loop' } }), cohort);
    expect(inv.commands).toHaveLength(3);
    expect(inv.commands.map((c) => c.forSlug)).toEqual(['a', 'b', 'c']);
    expect(inv.commands[0]?.args).toContain('--slug=a');
  });

  it('slug-loop without cohort yields a single catalogue-wide command', () => {
    const inv = buildStepInvocation(step({ slugChannel: { kind: 'slug-loop' } }), {
      ...cohort,
      slugs: [],
    });
    expect(inv.commands).toHaveLength(1);
    expect(inv.commands[0]?.args.some((a) => a.startsWith('--slug='))).toBe(false);
  });

  it('propagates --dry-run and --limit only when supported', () => {
    const ctx: BuildContext = { ...cohort, dryRun: true, limit: 5 };
    const supported = buildStepInvocation(step({ slugChannel: { kind: 'flag-slugs' } }), ctx);
    expect(supported.commands[0]?.args).toContain('--dry-run');
    expect(supported.commands[0]?.args).toContain('--limit=5');

    const unsupported = buildStepInvocation(
      step({ slugChannel: { kind: 'flag-slugs' }, supportsDryRun: false, supportsLimit: false }),
      ctx,
    );
    expect(unsupported.commands[0]?.args).not.toContain('--dry-run');
    expect(unsupported.commands[0]?.args.some((a) => a.startsWith('--limit='))).toBe(false);
  });

  it('prepends extraArgs', () => {
    const inv = buildStepInvocation(
      step({ slugChannel: { kind: 'env-slugs' }, extraArgs: ['--bucket=all'] }),
      cohort,
    );
    expect(inv.commands[0]?.args).toContain('--bucket=all');
  });
});
