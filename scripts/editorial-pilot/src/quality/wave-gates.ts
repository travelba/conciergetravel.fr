/**
 * wave-gates.ts — Gate 1 (code/content) evaluator at the wave level.
 *
 * Part of the 4-gate quality contract of the master plan
 * (docs/runbooks/PROJET-MASTER-PLAN.md §6). This module is the single
 * source of truth for the *content* half of Gate 1, evaluated per hotel
 * over a wave (a list of slugs). It composes the existing fiche gates
 * (`evaluateHotelFiche`) and adds the two checks the master plan requires
 * but that were not yet wired into any audit CLI:
 *
 *   - `gate1.geo_qa_present`  — DoD GEO: the data-driven answer-engine
 *     block (`hotels.geo_qa`, migration 0072) must be a non-empty array.
 *   - `gate1.no_leak`         — ADR-0029 invariant: no scaffolding /
 *     brief / pipeline meta-commentary leaked into rendered prose
 *     (shared `LEAK_MARKERS`).
 *   - `gate1.agent_consumable` (warn) — concierge/agent DoD (audit §4): the
 *     post-stay recommendation surfaces (Concierge's Tip + nearby POIs) are
 *     populated so a WhatsApp/LLM concierge has grounding data to serve. The
 *     endpoint-exposure half is owned by INFRA GEO.
 *
 * The typecheck / lint / unit / build half of Gate 1 is enforced by the
 * existing toolchain (`turbo run typecheck`, `pnpm lint`, `pnpm test:unit`,
 * `pnpm build`) and is orchestrated at the wave level by `audit-wave.ts`.
 *
 * Skill: editorial-pilot, llm-output-robustness Rule 14 (audit mirrors
 * production envelopes), photo-pipeline (Gate eligibility).
 *
 * Gotcha — `gate1.publish` semantics (validated 2026-06-17): the delegated
 * `evaluateHotelFiche` publish gate is the STRICT T0 bar (requires
 * `faq_content_kit`, `concierge_questions`, in-band meta/factual, etc.). It
 * is intentionally stricter than the Phase-1 publish criteria actually used
 * to flip `is_published` (`publish-eligible-drafts.ts`). Consequently most
 * of the live catalogue — and even the golden kit pilots — fail it today,
 * because golden fiches render via local overrides in
 * `get-hotel-by-slug.ts` that are NOT present in the raw DB row the audit
 * reads. Cross-checked against the canonical `audit:hotel-fiches` (same
 * result). So a near-0% wave pass rate measures distance-to-target (Gordes
 * DoD), not a tool bug. The dominant *hygiene* signal independent of the
 * target bar is `gate1.no_leak` (ADR-0029).
 */

import { hasLeak } from '../enrichment/scaffolding-gate.js';
import {
  evaluateHotelFiche,
  T3_COMPLETE_THRESHOLD,
  type ConciergeAdvicePayload,
  type HotelAuditRow,
  type LongDescriptionSection,
} from '../hotels/hotel-fiche-gates.js';

/** A hotel row plus the `geo_qa` column (not part of the base audit row). */
export interface WaveHotelRow extends HotelAuditRow {
  /** Migration 0072 — nullable jsonb array of answer-engine blocks. */
  readonly geo_qa?: unknown;
}

export type WaveGateId =
  | 'gate1.publish'
  | 'gate1.indexable'
  | 'gate1.t3_complete'
  | 'gate1.geo_qa_present'
  | 'gate1.no_leak'
  | 'gate1.agent_consumable';

export type WaveGateSeverity = 'blocker' | 'warn';

export interface WaveGateCheck {
  readonly id: WaveGateId;
  readonly passed: boolean;
  readonly severity: WaveGateSeverity;
  readonly detail: string;
}

export interface WaveGateResult {
  readonly slug: string;
  readonly name: string;
  readonly is_published: boolean;
  /** True when every `blocker` check passed. */
  readonly passed: boolean;
  readonly score_t3: number;
  readonly checks: readonly WaveGateCheck[];
  /** Fields where a scaffolding leak was detected (empty when clean). */
  readonly leakFields: readonly string[];
}

export interface WaveGateOptions {
  /**
   * When false, `gate1.geo_qa_present` is emitted as a `warn` instead of a
   * `blocker`. Lets a wave run before the geo_qa backfill without painting
   * the whole catalogue red. Defaults to true (DoD-strict).
   */
  readonly strictGeoQa?: boolean;
}

/** True when `geo_qa` is a non-empty array (lenient shape check). */
export function geoQaPresent(row: WaveHotelRow): boolean {
  return Array.isArray(row.geo_qa) && row.geo_qa.length > 0;
}

/** True when a jsonb value is a non-empty array. */
function nonEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

/** True when a jsonb value is a non-null object (on-site block present). */
function presentObject(value: unknown): boolean {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** True when the concierge tip carries a non-empty fr or en body. */
function conciergeTipPresent(row: WaveHotelRow): boolean {
  const advice = row.concierge_advice;
  if (advice === null) return false;
  return Boolean(advice.fr?.body?.trim()) || Boolean(advice.en?.body?.trim());
}

/**
 * The *content* half of the concierge/agent-consumable DoD (audit
 * §4 — docs/runbooks/audit-contenu-vers-produit-2026-06.md). A hotel is
 * consumable only when the post-stay recommendation surfaces a concierge
 * (WhatsApp) or an LLM would serve are actually populated in the row:
 *
 *   - the Concierge's Tip (`concierge_advice`), AND
 *   - at least one nearby point of interest (`points_of_interest`).
 *
 * On-site dining (`restaurant_info`) and signature experiences
 * (`signature_experiences`) are *bonus* signals surfaced in the detail
 * string but not required — not every property has a restaurant, and
 * requiring them would false-fail genuine no-dining hotels.
 *
 * The *endpoint-exposure* half (these fields actually returned by
 * `/api/agent/hotel/[slug]`) is enforced by INFRA GEO, not here — this
 * gate only proves the data exists to expose.
 */
export function agentConsumablePresent(row: WaveHotelRow): boolean {
  return conciergeTipPresent(row) && nonEmptyArray(row.points_of_interest);
}

/** Human-readable inventory of the consumable surfaces present on a row. */
export function agentConsumableDetail(row: WaveHotelRow): string {
  const present: string[] = [];
  if (conciergeTipPresent(row)) present.push('tip');
  if (nonEmptyArray(row.points_of_interest)) present.push('poi');
  if (presentObject(row.restaurant_info)) present.push('dining');
  if (nonEmptyArray(row.signature_experiences)) present.push('experiences');
  return present.length > 0
    ? `consumable surfaces: ${present.join(', ')}`
    : 'no consumable surface';
}

function pushIfLeak(fields: string[], field: string, value: string | null | undefined): void {
  if (hasLeak(value)) fields.push(field);
}

/** Collect the rendered-prose fields that carry a scaffolding leak. */
export function collectLeakFields(row: WaveHotelRow): string[] {
  const fields: string[] = [];
  pushIfLeak(fields, 'description_fr', row.description_fr);
  pushIfLeak(fields, 'description_en', row.description_en);
  pushIfLeak(fields, 'factual_summary_fr', row.factual_summary_fr);
  pushIfLeak(fields, 'factual_summary_en', row.factual_summary_en);
  pushIfLeak(fields, 'meta_desc_fr', row.meta_desc_fr);
  pushIfLeak(fields, 'meta_desc_en', row.meta_desc_en);

  const advice: ConciergeAdvicePayload | null = row.concierge_advice;
  if (advice !== null) {
    pushIfLeak(fields, 'concierge_advice.fr.body', advice.fr?.body);
    pushIfLeak(fields, 'concierge_advice.en.body', advice.en?.body);
  }

  const sections: readonly LongDescriptionSection[] = row.long_description_sections ?? [];
  sections.forEach((section, idx) => {
    pushIfLeak(fields, `long_description_sections[${idx}].body_fr`, section.body_fr);
    pushIfLeak(fields, `long_description_sections[${idx}].body_en`, section.body_en);
  });

  return fields;
}

/**
 * Evaluate the wave-level Gate 1 content checks for a single hotel.
 * `passed` reflects blockers only; warns are advisory.
 */
export function evaluateWaveGates(
  row: WaveHotelRow,
  options: WaveGateOptions = {},
): WaveGateResult {
  const strictGeoQa = options.strictGeoQa ?? true;
  const fiche = evaluateHotelFiche(row);

  const geoOk = geoQaPresent(row);
  const leakFields = collectLeakFields(row);

  const checks: WaveGateCheck[] = [
    {
      id: 'gate1.publish',
      passed: fiche.publish_gate_pass,
      severity: 'blocker',
      detail: fiche.publish_gate_pass
        ? 'publish gate ok'
        : `publish gate failed: ${fiche.gaps
            .filter((g) => g.severity === 'blocker')
            .slice(0, 6)
            .map((g) => g.field)
            .join(', ')}`,
    },
    {
      id: 'gate1.indexable',
      passed: fiche.indexable,
      severity: 'blocker',
      detail: fiche.indexable ? 'indexable' : 'not indexable (thin content / no hero)',
    },
    {
      id: 'gate1.t3_complete',
      passed: fiche.score_t3 >= T3_COMPLETE_THRESHOLD,
      severity: 'warn',
      detail: `T3 editorial score ${fiche.score_t3} / ${T3_COMPLETE_THRESHOLD}`,
    },
    {
      id: 'gate1.geo_qa_present',
      passed: geoOk,
      severity: strictGeoQa ? 'blocker' : 'warn',
      detail: geoOk ? 'geo_qa block present' : 'geo_qa block missing/empty (migration 0072)',
    },
    {
      id: 'gate1.no_leak',
      passed: leakFields.length === 0,
      severity: 'blocker',
      detail:
        leakFields.length === 0
          ? 'no scaffolding leak'
          : `scaffolding leak in: ${leakFields.join(', ')}`,
    },
    {
      id: 'gate1.agent_consumable',
      passed: agentConsumablePresent(row),
      severity: 'warn',
      detail: agentConsumableDetail(row),
    },
  ];

  const passed = checks.every((c) => c.severity !== 'blocker' || c.passed);

  return {
    slug: row.slug,
    name: row.name,
    is_published: row.is_published,
    passed,
    score_t3: fiche.score_t3,
    checks,
    leakFields,
  };
}

export interface WaveAggregate {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  /** Share of rows passing all blockers, 0..1. */
  readonly passRate: number;
  /** Count of rows failing each blocker check id. */
  readonly failByCheck: Record<string, number>;
}

/** Roll up per-hotel results into wave-level KPIs (incl. fail-by-check). */
export function aggregateWave(results: readonly WaveGateResult[]): WaveAggregate {
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failByCheck: Record<string, number> = {};
  for (const r of results) {
    for (const c of r.checks) {
      if (c.severity === 'blocker' && !c.passed) {
        failByCheck[c.id] = (failByCheck[c.id] ?? 0) + 1;
      }
    }
  }
  return {
    total,
    passed,
    failed: total - passed,
    passRate: total === 0 ? 1 : passed / total,
    failByCheck,
  };
}
