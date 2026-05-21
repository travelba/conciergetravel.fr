import { NextResponse } from 'next/server';

import { env } from '@/lib/env';

export const dynamic = 'force-static';
export const revalidate = 86400;

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

/**
 * robots.txt — generated dynamically so the SEO team can override allow/disallow
 * via Payload `RobotsConfig` global. Skill: seo-technical, geo-llm-optimization.
 *
 * `force-static` here means the route is prerendered. Reading `request.url`
 * at build time bakes the build-host (typically `http://localhost:3000`)
 * into the deployed Sitemap reference. We read the canonical site URL
 * from validated env to keep production output correct.
 */
export function GET() {
  const origin = (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');

  // LLM crawler tokens use the official robots.txt user-agent strings as of 2026:
  //   - `Google-Extended`     — Google's AI training opt-out (no hyphen "bot")
  //   - `GPTBot`              — OpenAI training crawler
  //   - `OAI-SearchBot`       — OpenAI's ChatGPT Search index
  //   - `ChatGPT-User`        — when ChatGPT browses live for a user query
  //   - `PerplexityBot`       — Perplexity search index
  //   - `Perplexity-User`     — Perplexity live browse
  //   - `ClaudeBot`           — Anthropic crawler (training + retrieval, Q4 2025+)
  //   - `anthropic-ai`        — legacy Anthropic crawler (kept for back-compat)
  //   - `Applebot-Extended`   — Apple AI training opt-out
  //   - `MistralAI-User`      — Le Chat live browse (Mistral, Q4 2025 European LLM relevant for FR market)
  //   - `Meta-ExternalAgent`  — Meta AI live browse (Llama-powered assistants)
  //   - `Meta-ExternalFetcher`— Meta AI on-demand fetch for user queries
  //   - `Bytespider`          — ByteDance / Doubao crawler (allowed by design — Doubao is the #1 LLM by usage in Asia)
  //   - `Diffbot`             — Diffbot Knowledge Graph (cited by Bing AI and Bard for entity grounding)
  // Explicitly listing each agent prevents accidental drift from the
  // shared `User-agent: *` rule (which already says Allow: /, but a
  // per-agent stanza is the contract LLM operators look for).
  const lines: string[] = [
    '# MyConciergeHotel.com — robots.txt',
    '# Authorize Google + OpenAI + Perplexity + Anthropic + Apple + Mistral + Meta + ByteDance + Diffbot LLM crawlers (cf. CDC §6.5)',
    '',
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /admin/',
    'Disallow: /fr/reservation/',
    'Disallow: /en/reservation/',
    'Disallow: /fr/compte/',
    'Disallow: /en/compte/',
    'Disallow: /fr/auth/',
    'Disallow: /en/auth/',
    'Disallow: /monitoring',
    '',
    'User-agent: Google-Extended',
    'Allow: /',
    '',
    'User-agent: GPTBot',
    'Allow: /',
    '',
    'User-agent: OAI-SearchBot',
    'Allow: /',
    '',
    'User-agent: ChatGPT-User',
    'Allow: /',
    '',
    'User-agent: PerplexityBot',
    'Allow: /',
    '',
    'User-agent: Perplexity-User',
    'Allow: /',
    '',
    'User-agent: ClaudeBot',
    'Allow: /',
    '',
    'User-agent: anthropic-ai',
    'Allow: /',
    '',
    'User-agent: Applebot-Extended',
    'Allow: /',
    '',
    'User-agent: MistralAI-User',
    'Allow: /',
    '',
    'User-agent: Meta-ExternalAgent',
    'Allow: /',
    '',
    'User-agent: Meta-ExternalFetcher',
    'Allow: /',
    '',
    'User-agent: Bytespider',
    'Allow: /',
    '',
    'User-agent: Diffbot',
    'Allow: /',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ];

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
