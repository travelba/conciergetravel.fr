import { describe, expect, it } from 'vitest';

import type { UrlResult } from './crawl.js';
import { buildHtmlReport, buildTextDigest, countBySeverity, summarise } from './report.js';

const RESULTS: readonly UrlResult[] = [
  { url: 'https://h/a', status: 200, elapsedMs: 10, findings: [], worstSeverity: 'ok' },
  {
    url: 'https://h/b',
    status: 200,
    elapsedMs: 12,
    findings: [{ check: 'h1', severity: 'warn', message: '2 h1' }],
    worstSeverity: 'warn',
  },
  {
    url: 'https://h/c',
    status: 404,
    elapsedMs: 8,
    findings: [{ check: 'http-status', severity: 'fail', message: 'HTTP 404' }],
    worstSeverity: 'fail',
  },
];

describe('summarise', () => {
  it('counts pages by worst severity and findings by check', () => {
    const s = summarise(RESULTS);
    expect(s.total).toBe(3);
    expect(s.ok).toBe(1);
    expect(s.warn).toBe(1);
    expect(s.fail).toBe(1);
    expect(s.byCheck['http-status']).toEqual({ fail: 1, warn: 0, info: 0 });
    expect(s.byCheck['h1']).toEqual({ fail: 0, warn: 1, info: 0 });
  });
});

describe('countBySeverity', () => {
  it('counts findings across pages', () => {
    expect(countBySeverity(RESULTS, 'fail')).toBe(1);
    expect(countBySeverity(RESULTS, 'warn')).toBe(1);
    expect(countBySeverity(RESULTS, 'info')).toBe(0);
  });
});

describe('buildTextDigest', () => {
  it('lists only problem findings, one per line', () => {
    const digest = buildTextDigest(RESULTS);
    expect(digest).toContain('[FAIL] https://h/c — http-status');
    expect(digest).toContain('[WARN] https://h/b — h1');
    expect(digest).not.toContain('https://h/a');
  });
});

describe('buildHtmlReport', () => {
  it('renders a self-contained HTML report with the KPIs', () => {
    const html = buildHtmlReport({
      generatedAt: '2026-06-26T00:00:00.000Z',
      base: 'https://h',
      summary: summarise(RESULTS),
      results: RESULTS,
    });
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Fail: <b>1</b>');
    expect(html).toContain('https://h/c');
    // escapes nothing dangerous but keeps url
    expect(html).toContain('http-status');
  });
});
