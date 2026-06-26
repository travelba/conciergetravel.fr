/**
 * Report builders: an aggregate summary, a machine-readable JSON dump, and
 * a self-contained HTML report. Pure functions (string in / string out) so
 * the shapes are unit-testable; `run.ts` handles the file writes.
 */

import type { Finding, Severity } from './checks.js';
import type { UrlResult } from './crawl.js';

export interface AuditSummary {
  readonly total: number;
  readonly ok: number;
  readonly warn: number;
  readonly fail: number;
  /** count of findings per check id, split by severity */
  readonly byCheck: Readonly<Record<string, { fail: number; warn: number; info: number }>>;
}

export function summarise(results: readonly UrlResult[]): AuditSummary {
  const byCheck: Record<string, { fail: number; warn: number; info: number }> = {};
  let ok = 0;
  let warn = 0;
  let fail = 0;
  for (const r of results) {
    if (r.worstSeverity === 'fail') fail += 1;
    else if (r.worstSeverity === 'warn') warn += 1;
    else ok += 1;
    for (const f of r.findings) {
      const entry = byCheck[f.check] ?? { fail: 0, warn: 0, info: 0 };
      entry[f.severity] += 1;
      byCheck[f.check] = entry;
    }
  }
  return { total: results.length, ok, warn, fail, byCheck };
}

export interface ReportPayload {
  readonly generatedAt: string;
  readonly base: string;
  readonly summary: AuditSummary;
  readonly results: readonly UrlResult[];
}

export function buildJsonReport(payload: ReportPayload): string {
  return JSON.stringify(payload, null, 2);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;');
}

function findingRow(f: Finding): string {
  return `<li class="sev-${f.severity}"><b>${escapeHtml(f.check)}</b>: ${escapeHtml(f.message)}</li>`;
}

export function buildHtmlReport(payload: ReportPayload): string {
  const { summary } = payload;
  const checkRows = Object.entries(summary.byCheck)
    .sort((a, b) => b[1].fail - a[1].fail || b[1].warn - a[1].warn)
    .map(
      ([check, c]) =>
        `<tr><td>${escapeHtml(check)}</td><td class="num fail">${c.fail}</td><td class="num warn">${c.warn}</td></tr>`,
    )
    .join('\n');

  // Show failing + warning pages first; cap the body for very large crawls.
  const problem = payload.results
    .filter((r) => r.worstSeverity !== 'ok')
    .sort((a, b) => severityRank(b.worstSeverity) - severityRank(a.worstSeverity));
  const rows = problem
    .slice(0, 2000)
    .map(
      (r) =>
        `<tr class="row-${r.worstSeverity}"><td>${r.status ?? 'ERR'}</td><td><a href="${escapeHtml(r.url)}">${escapeHtml(r.url)}</a></td><td><ul>${r.findings.map(findingRow).join('')}</ul></td></tr>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Site audit — ${escapeHtml(payload.base)}</title>
<style>
 body{font:14px/1.5 system-ui,sans-serif;margin:2rem;color:#1a1a1a}
 h1{font-size:1.4rem} table{border-collapse:collapse;width:100%;margin:1rem 0}
 td,th{border:1px solid #ddd;padding:.4rem .6rem;text-align:left;vertical-align:top}
 .num{text-align:right} .fail{color:#b00020;font-weight:700} .warn{color:#9a6700}
 .row-fail{background:#fff0f1} .row-warn{background:#fffbe6}
 .sev-fail{color:#b00020} .sev-warn{color:#9a6700} .sev-info{color:#555}
 .kpi{display:inline-block;margin-right:1.5rem;font-size:1.1rem}
 ul{margin:0;padding-left:1.1rem}
</style></head><body>
<h1>Site audit — ${escapeHtml(payload.base)}</h1>
<p>${escapeHtml(payload.generatedAt)}</p>
<p>
 <span class="kpi">Total: <b>${summary.total}</b></span>
 <span class="kpi">OK: <b>${summary.ok}</b></span>
 <span class="kpi warn">Warn: <b>${summary.warn}</b></span>
 <span class="kpi fail">Fail: <b>${summary.fail}</b></span>
</p>
<h2>Findings by check</h2>
<table><thead><tr><th>Check</th><th class="num">fail</th><th class="num">warn</th></tr></thead>
<tbody>${checkRows || '<tr><td colspan="3">Aucun problème 🎉</td></tr>'}</tbody></table>
<h2>Pages with problems (${problem.length})</h2>
<table><thead><tr><th>Status</th><th>URL</th><th>Findings</th></tr></thead>
<tbody>${rows || '<tr><td colspan="3">Aucune page en échec ou avertissement 🎉</td></tr>'}</tbody></table>
</body></html>`;
}

function severityRank(s: 'fail' | 'warn' | 'ok'): number {
  return s === 'fail' ? 2 : s === 'warn' ? 1 : 0;
}

/** One-line-per-problem text digest for terminals / CI logs. */
export function buildTextDigest(results: readonly UrlResult[]): string {
  const lines: string[] = [];
  for (const r of results) {
    if (r.worstSeverity === 'ok') continue;
    for (const f of r.findings) {
      if (f.severity === 'info') continue;
      lines.push(`[${f.severity.toUpperCase()}] ${r.url} — ${f.check}: ${f.message}`);
    }
  }
  return lines.join('\n');
}

export function countBySeverity(results: readonly UrlResult[], severity: Severity): number {
  let n = 0;
  for (const r of results) for (const f of r.findings) if (f.severity === severity) n += 1;
  return n;
}
