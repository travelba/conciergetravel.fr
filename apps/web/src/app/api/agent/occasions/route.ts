import { type NextRequest } from 'next/server';

import { OCCASION_NAV_ENTRIES } from '@/components/layout/nav-data';
import { agentJson, gateAgentRequest } from '@/server/agent/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/occasions — travel occasions surfaced by the
 * `/inspiration` hub and the `/classements/occasion/[slug]` sub-hubs.
 *
 * Mirror of `list-occasions` skill. Sourced from `OCCASION_NAV_ENTRIES`
 * (the 9 occasions exposed in the menu). High-intent surface — these
 * are the AEO-premium queries (lune de miel, mariage, séminaire…)
 * where an LLM citing a dedicated page outperforms a generic ranking.
 */
export async function GET(req: NextRequest) {
  const gate = await gateAgentRequest(req);
  if (!gate.ok) return gate.response;

  return agentJson(
    {
      ok: true,
      count: OCCASION_NAV_ENTRIES.length,
      occasions: OCCASION_NAV_ENTRIES.map((o) => ({
        slug: o.slug,
        label: { fr: o.labelFr, en: o.labelEn },
        canonicalUrl: {
          fr: `/fr/classements/occasion/${o.slug}`,
          en: `/en/classements/occasion/${o.slug}`,
        },
      })),
    },
    { cacheControl: 'public, max-age=3600, s-maxage=86400' },
  );
}
