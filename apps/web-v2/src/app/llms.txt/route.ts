import { NextResponse } from 'next/server';

import { buildLlmsTxt } from '@mch/seo';

import { DEMO_HOTELS, DEMO_RANKING } from '@/lib/demo-data';
import { siteOrigin } from '@/lib/site-origin';

export const dynamic = 'force-dynamic';

/**
 * /llms.txt — minimal v2 LLM index (Phase 7 bascule prep).
 * Expands to full catalogue once v2 read-models replace demo data.
 */
export function GET(): NextResponse {
  const origin = siteOrigin();

  const body = buildLlmsTxt({
    siteName: 'MyConciergeHotel.com (v2 preview)',
    tagline: 'La sélection du Concierge — refonte Booking-like.',
    originUrl: origin,
    about:
      'MyConciergeHotel.com v2 is the Booking-parity rebuild: search, hotel fiches with /10 ratings, member programme, and public MCP tools. Editorial catalogue shared with v1 (`public.hotels`). Live GDS booking frozen until Phase 6.',
    lastUpdatedDate: new Date().toISOString(),
    sections: [
      {
        title: 'Pages stratégiques',
        items: [
          { url: `${origin}/`, description: 'Homepage v2 — search-first entry.' },
          { url: `${origin}/en`, description: 'Homepage (EN).' },
          { url: `${origin}/recherche`, description: 'Search results (SRP).' },
          {
            url: `${origin}/programme-membre`,
            description: 'Member programme (Genius-equivalent, indexable).',
          },
          { url: `${origin}/en/member-program`, description: 'Member programme (EN).' },
        ],
      },
      {
        title: `Catalogue démo (${DEMO_HOTELS.length} hôtels — wiring v2 read-models)`,
        items: DEMO_HOTELS.flatMap((h) => [
          {
            url: `${origin}/hotel/${h.slug}`,
            description: `${h.name} (${h.city}) — ${h.editorialBadge ?? `${h.stars}★`}.`,
          },
          {
            url: `${origin}/en/hotel/${h.slug}`,
            description: `${h.name} (${h.city}) — EN surface.`,
          },
        ]),
      },
      {
        title: 'Classements',
        items: [
          {
            url: `${origin}/classement/${DEMO_RANKING.slug}`,
            description: DEMO_RANKING.title,
          },
          {
            url: `${origin}/classements`,
            description: 'Rankings hub.',
          },
        ],
      },
      {
        title: 'API LLM-actionnables (v2)',
        items: [
          {
            url: `${origin}/.well-known/agent-skills.json`,
            description: 'Declarative skills — search, get-hotel, get-ranking, request-quote.',
          },
          {
            url: `${origin}/api/mcp`,
            description:
              'Public MCP server (JSON-RPC): search_hotels, get_hotel, get_ranking, request_quote.',
          },
          {
            url: `${origin}/api/agent/search`,
            description: 'POST hotel search (catalogue; Phase 6 adds live offers).',
          },
          {
            url: `${origin}/sitemap.xml`,
            description: 'Sitemap index — hotels + rankings sub-sitemaps.',
          },
        ],
      },
    ],
  });

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
