/**
 * completeness.ts — C2 (2026-06-24) shared completeness contract.
 *
 * A ranking is "complete" when the number of persisted
 * `editorial_ranking_entries` rows reaches the combinator's intended
 * `targetLength` for that seed. This single helper is the common reference for:
 *
 *   - `run-rankings-v2-bulk.ts`  — `--strict` gate that fails a seed whose
 *     freshly-generated `entries.length` is below the target.
 *   - `verify-rankings.ts`       — post-hoc DB check (entries vs target).
 *   - `report-completeness.ts`   — the catalogue-wide gaps report.
 *
 * Keeping the rule in one place avoids the historic drift where the bulk
 * runner, the pillar allow-list runners and the audit each had their own
 * notion of "enough entries". See `docs/audits/rankings-completeness-gaps-2026-06-24.md`.
 */

export interface CompletenessStatus {
  readonly slug: string;
  /** Persisted (or freshly generated) entry count. */
  readonly entries: number;
  /** Intended list length (combinator `targetLength`, or pillar allow-list size). */
  readonly target: number;
  /** `target - entries`, clamped at 0 — the number of missing entries. */
  readonly gap: number;
  /** True when `entries >= target`. */
  readonly complete: boolean;
}

/** True when a ranking has at least `target` entries. */
export function isComplete(entries: number, target: number): boolean {
  return entries >= target;
}

/** Build a `CompletenessStatus` row for a single ranking. */
export function completenessStatus(
  slug: string,
  entries: number,
  target: number,
): CompletenessStatus {
  const gap = Math.max(0, target - entries);
  return { slug, entries, target, gap, complete: entries >= target };
}

export interface CompletenessSummary {
  readonly total: number;
  readonly complete: number;
  readonly underfilled: number;
  readonly empty: number;
  readonly worstGaps: readonly CompletenessStatus[];
}

/**
 * Aggregate a set of completeness rows. `worstGaps` is sorted by descending
 * gap (largest shortfall first) and capped at `topN` (default 25).
 */
export function summarizeCompleteness(
  rows: readonly CompletenessStatus[],
  topN = 25,
): CompletenessSummary {
  let complete = 0;
  let underfilled = 0;
  let empty = 0;
  for (const r of rows) {
    if (r.complete) complete += 1;
    else underfilled += 1;
    if (r.entries === 0) empty += 1;
  }
  const worstGaps = [...rows]
    .filter((r) => r.gap > 0)
    .sort((a, b) => b.gap - a.gap || a.slug.localeCompare(b.slug))
    .slice(0, topN);
  return { total: rows.length, complete, underfilled, empty, worstGaps };
}
