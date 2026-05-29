/**
 * fiche-content-waves.ts — declarative registry + pure command builder for
 * the pilot-then-scale content-completion plan (plan_contenu_fiches_hôtels).
 *
 * Each hotel-fiche pipeline already exists as its own CLI, but they use
 * three different slug-passing conventions (PostgREST `--slugs=`, a
 * `--slugs-file=`, or the `MCH_ONLY_SLUGS` env). This module encodes the
 * canonical execution ORDER (Wave 0 → 4) and adapts a single cohort slug
 * list to each pipeline's convention, so the orchestrator
 * (`run-fiche-content-waves.ts`) can drive the whole chain pilot-first.
 *
 * Pure here, side-effecting in the runner — keeps `buildStepInvocation`
 * unit-testable without spawning child processes.
 *
 * Skill: editorial-pilot, llm-output-robustness.
 */

/** How a pipeline accepts the cohort slug restriction. */
export type SlugChannel =
  | { readonly kind: 'flag-slugs' } // --slugs=a,b,c
  | { readonly kind: 'flag-slugs-file' } // --slugs-file=path.txt
  | { readonly kind: 'flag-slugs-space' } // --slugs a,b,c   (run-humanizer-faq)
  | { readonly kind: 'env-slugs' } // MCH_ONLY_SLUGS=a,b,c
  | { readonly kind: 'slug-loop' } // one spawn per slug: --slug=<s>
  | { readonly kind: 'bucket'; readonly arg: string }; // catalogue-wide, e.g. --all / --bucket=all

export interface PipelineStep {
  readonly id: string;
  readonly wave: number;
  readonly label: string;
  /** Path relative to the editorial-pilot package root. */
  readonly script: string;
  readonly slugChannel: SlugChannel;
  readonly supportsDryRun: boolean;
  readonly supportsLimit: boolean;
  /** Always-on extra flags (e.g. `--no-llm` for a free first pass). */
  readonly extraArgs?: readonly string[];
  /** Always-on extra env (e.g. include drafts). */
  readonly extraEnv?: Readonly<Record<string, string>>;
  /** Credentials the step needs to RUN live (documentation only). */
  readonly requires: readonly string[];
  /** Short note surfaced in --plan output. */
  readonly note?: string;
}

/**
 * The canonical wave order. Wave 0 = tooling-driven enrichment that the
 * text waves depend on; Waves 1-4 follow the plan's ROI ordering. Booking
 * (Phase 6) is intentionally absent — frozen per AGENTS.md §4ter.
 */
export const WAVE_PLAN: readonly PipelineStep[] = [
  // ── Wave 0 — enrichment tooling ────────────────────────────────────────
  {
    id: 'geo-context',
    wave: 0,
    label: 'Transports (POI-derived) + highlights (LLM)',
    script: 'src/enrichment/enrich-hotel-geo-context.ts',
    slugChannel: { kind: 'flag-slugs' },
    supportsDryRun: true,
    supportsLimit: true,
    requires: ['OPENAI_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
  },
  {
    id: 'amenities',
    wave: 0,
    label: 'Amenities ≥ 80 attributs (taxonomy + LLM classifier)',
    script: 'src/enrichment/enrich-hotel-amenities.ts',
    slugChannel: { kind: 'flag-slugs' },
    supportsDryRun: true,
    supportsLimit: true,
    requires: ['OPENAI_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
  },
  {
    id: 'policies',
    wave: 0,
    label: 'Policies réelles (Tavily + LLM, remplace _synthetic)',
    script: 'src/enrichment/enrich-hotel-policies.ts',
    slugChannel: { kind: 'flag-slugs-file' },
    supportsDryRun: true,
    supportsLimit: true,
    requires: ['TAVILY_API_KEY', 'OPENAI_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
  },
  // ── Wave 1 — texte P0 ──────────────────────────────────────────────────
  {
    id: 'faq-canonical',
    wave: 1,
    label: 'FAQ canonique (10 questions CDC, 50-100 mots FR/EN)',
    script: 'src/hotels/run-faq-canonical.ts',
    slugChannel: { kind: 'flag-slugs-file' },
    supportsDryRun: true,
    supportsLimit: true,
    requires: ['OPENAI_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
  },
  {
    id: 'faq-featured-tips',
    wave: 1,
    label: 'FAQ featured + concierge_tip (humanizer)',
    script: 'src/concierge/run-humanizer-faq.ts',
    slugChannel: { kind: 'flag-slugs-space' },
    supportsDryRun: true,
    supportsLimit: false,
    requires: ['OPENAI_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
  },
  {
    id: 'longform',
    wave: 1,
    label: 'Long-form ≥ 3 sections 600-1000 mots',
    script: 'src/hotels/run-hotel-description-extend.ts',
    slugChannel: { kind: 'flag-slugs' },
    supportsDryRun: true,
    supportsLimit: true,
    requires: ['OPENAI_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
  },
  {
    id: 'meta-desc',
    wave: 1,
    label: 'Meta descriptions FR/EN bande 140-170',
    script: 'src/hotels/run-hotel-meta-desc.ts',
    slugChannel: { kind: 'flag-slugs' },
    supportsDryRun: true,
    supportsLimit: true,
    requires: ['OPENAI_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
  },
  {
    id: 'factual-summary',
    wave: 1,
    label: 'Factual summary (110-165 chars)',
    script: 'src/hotels/run-hotel-factual-summary.ts',
    slugChannel: { kind: 'flag-slugs' },
    supportsDryRun: true,
    supportsLimit: true,
    requires: ['OPENAI_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
  },
  {
    id: 'concierge-advice',
    wave: 1,
    label: 'Concierge advice (50-110 mots, hors bande)',
    script: 'src/hotels/run-hotel-concierge-advice.ts',
    slugChannel: { kind: 'slug-loop' },
    supportsDryRun: true,
    supportsLimit: true,
    requires: ['OPENAI_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
    note: 'single-slug CLI — orchestrator loops one spawn per cohort slug',
  },
  // ── Wave 2 — GEO / maillage / EEAT ─────────────────────────────────────
  {
    id: 'pois',
    wave: 2,
    label: 'POI ≥ 3 (sync-hotel-pois)',
    script: 'src/pois/sync-hotel-pois.ts',
    slugChannel: { kind: 'env-slugs' },
    supportsDryRun: true,
    supportsLimit: true,
    extraArgs: ['--bucket=all'],
    requires: ['OPENAI_API_KEY', 'GOOGLE_PLACES_API_KEY', 'DATABASE_URL'],
  },
  {
    id: 'geocode',
    wave: 2,
    label: 'Géocodage GPS manquants',
    script: 'src/geocode/sync-hotel-geocoding.ts',
    slugChannel: { kind: 'env-slugs' },
    supportsDryRun: true,
    supportsLimit: true,
    requires: ['GOOGLE_PLACES_API_KEY', 'DATABASE_URL'],
  },
  {
    id: 'wikidata',
    wave: 2,
    label: 'Wikidata IDs / official_url',
    script: 'src/enrichment/enrich-wikidata-ids.ts',
    slugChannel: { kind: 'env-slugs' },
    supportsDryRun: false,
    supportsLimit: false,
    requires: ['DATABASE_URL'],
    note: 'no dry-run; SPARQL is read-only, the write is idempotent',
  },
  {
    id: 'signature',
    wave: 2,
    label: 'signature_experiences',
    script: 'src/enrichment/enrich-signature-experiences.ts',
    slugChannel: { kind: 'slug-loop' },
    supportsDryRun: false,
    supportsLimit: false,
    requires: ['OPENAI_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
    note: 'single-slug CLI (or --all); orchestrator loops per cohort slug',
  },
  // ── Wave 3 — photos ────────────────────────────────────────────────────
  {
    id: 'photos-sync',
    wave: 3,
    label: 'photos:sync (Google Places hero + galerie)',
    script: 'src/photos/sync-hotel-photos.ts',
    slugChannel: { kind: 'slug-loop' },
    supportsDryRun: true,
    supportsLimit: true,
    requires: ['GOOGLE_PLACES_API_KEY', 'CLOUDINARY_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
  },
  {
    id: 'photos-categorize',
    wave: 3,
    label: 'Catégorisation Vision (10 catégories, alt + caption)',
    script: 'src/photos/categorize-with-vision.ts',
    slugChannel: { kind: 'flag-slugs' },
    supportsDryRun: true,
    supportsLimit: true,
    requires: ['OPENAI_API_KEY', 'CLOUDINARY_CLOUD_NAME', 'SUPABASE_SERVICE_ROLE_KEY'],
  },
  // ── Wave 4 — chambres & amenities scale ────────────────────────────────
  {
    id: 'amenities-scale',
    wave: 4,
    label: 'Amenities ≥ 80 (généralisation catalogue)',
    script: 'src/enrichment/enrich-hotel-amenities.ts',
    slugChannel: { kind: 'bucket', arg: '' },
    supportsDryRun: true,
    supportsLimit: true,
    requires: ['OPENAI_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
    note: 'catalogue-wide (no cohort restriction) — relies on eligibility filter',
  },
];

export interface BuildContext {
  /** Cohort slugs (empty = catalogue-wide via eligibility). */
  readonly slugs: readonly string[];
  /** Absolute path to a slugs file (one per line) for `flag-slugs-file`. */
  readonly slugsFilePath: string | null;
  readonly dryRun: boolean;
  readonly limit: number | null;
}

export interface StepInvocation {
  readonly stepId: string;
  /** One arg vector per spawn (slug-loop yields N, others yield 1). */
  readonly commands: ReadonlyArray<{
    readonly args: readonly string[];
    readonly env: Readonly<Record<string, string>>;
    /** Human label for the loop element (e.g. the slug). */
    readonly forSlug?: string;
  }>;
  /** True when the step needs a slugs file but none was provided. */
  readonly needsSlugsFile: boolean;
}

function csv(slugs: readonly string[]): string {
  return slugs.join(',');
}

/**
 * Build the concrete tsx invocation(s) for a step under a context.
 * Returns the arg vectors (excluding the leading `tsx <script>`), so the
 * runner just prepends the executable. Pure — no spawning, no fs.
 */
export function buildStepInvocation(step: PipelineStep, ctx: BuildContext): StepInvocation {
  const common: string[] = [];
  if (step.extraArgs) common.push(...step.extraArgs);
  if (step.supportsDryRun && ctx.dryRun) common.push('--dry-run');
  if (step.supportsLimit && ctx.limit !== null) common.push(`--limit=${ctx.limit}`);

  const env: Record<string, string> = { ...(step.extraEnv ?? {}) };
  const hasCohort = ctx.slugs.length > 0;
  let needsSlugsFile = false;

  const single = (extra: readonly string[]): StepInvocation['commands'] => [
    { args: [...common, ...extra], env },
  ];

  switch (step.slugChannel.kind) {
    case 'flag-slugs':
      return {
        stepId: step.id,
        commands: single(hasCohort ? [`--slugs=${csv(ctx.slugs)}`] : []),
        needsSlugsFile: false,
      };
    case 'flag-slugs-space':
      return {
        stepId: step.id,
        commands: single(hasCohort ? ['--slugs', csv(ctx.slugs)] : ['--all']),
        needsSlugsFile: false,
      };
    case 'flag-slugs-file': {
      // Prefer a slugs file (avoids PostgREST URL limits on large cohorts);
      // fall back to inline `--slugs=` which these CLIs also accept.
      let extra: readonly string[] = [];
      if (hasCohort) {
        if (ctx.slugsFilePath !== null) extra = [`--slugs-file=${ctx.slugsFilePath}`];
        else {
          extra = [`--slugs=${csv(ctx.slugs)}`];
          // Soft hint only when the cohort is large enough to risk URL limits.
          if (ctx.slugs.length > 150) needsSlugsFile = true;
        }
      }
      return { stepId: step.id, commands: single(extra), needsSlugsFile };
    }
    case 'env-slugs': {
      const envWithSlugs = hasCohort ? { ...env, MCH_ONLY_SLUGS: csv(ctx.slugs) } : env;
      return {
        stepId: step.id,
        commands: [{ args: [...common], env: envWithSlugs }],
        needsSlugsFile: false,
      };
    }
    case 'slug-loop': {
      if (!hasCohort) {
        // Fall back to catalogue-wide with --limit (relies on eligibility).
        return { stepId: step.id, commands: single([]), needsSlugsFile: false };
      }
      return {
        stepId: step.id,
        commands: ctx.slugs.map((s) => ({ args: [...common, `--slug=${s}`], env, forSlug: s })),
        needsSlugsFile: false,
      };
    }
    case 'bucket': {
      const bucketArg = step.slugChannel.arg.length > 0 ? [step.slugChannel.arg] : [];
      return { stepId: step.id, commands: single(bucketArg), needsSlugsFile: false };
    }
    default: {
      const _exhaustive: never = step.slugChannel;
      throw new Error(`unhandled slug channel: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

export function stepsForWave(wave: number): readonly PipelineStep[] {
  return WAVE_PLAN.filter((s) => s.wave === wave);
}

export function allWaves(): readonly number[] {
  return [...new Set(WAVE_PLAN.map((s) => s.wave))].sort((a, b) => a - b);
}
