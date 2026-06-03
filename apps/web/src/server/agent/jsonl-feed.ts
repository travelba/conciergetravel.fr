import 'server-only';

import { env } from '@/lib/env';

/**
 * Shared helpers for the `/.well-known/*.jsonl` machine-readable feeds
 * (hotels, rankings, guides, itineraries) consumed by LLM agents and AI
 * search engines. JSONL (a.k.a. NDJSON) is streamable, diffable and
 * greppable — the right shape for catalogue-scale corpora.
 *
 * Skill: geo-llm-optimization §Machine-readable surfaces.
 */

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

/** Canonical site origin without a trailing slash. */
export function feedOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
}

/**
 * Wrap pre-serialised NDJSON lines in a `Response` with the canonical
 * feed headers (NDJSON MIME, CDN cache, permissive CORS, row count).
 * Mirrors the `hotels.jsonl` contract so every feed behaves identically.
 */
export function jsonlResponse(lines: readonly string[]): Response {
  const body = lines.length > 0 ? `${lines.join('\n')}\n` : '';
  return new Response(body, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
      'Access-Control-Allow-Origin': '*',
      'X-Catalog-Count': String(lines.length),
    },
  });
}
