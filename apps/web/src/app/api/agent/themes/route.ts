import { type NextRequest } from 'next/server';

import { THEME_NAV_ENTRIES } from '@/components/layout/nav-data';
import { agentJson, gateAgentRequest } from '@/server/agent/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/themes — inspiration themes surfaced by the
 * `/inspiration` hub and the `/classements/theme/[slug]` matrice
 * sub-hubs.
 *
 * Mirror of `list-themes` skill. Sourced from `THEME_NAV_ENTRIES`
 * (single source of truth for the menu) so the agent's enumeration
 * stays in sync with what the user sees.
 *
 * The full `axes.ts` taxonomy contains more themes — the menu surfaces
 * the curated 12 chosen for UX. We expose the menu-curated subset
 * here so the agent's recommendations match what is actually
 * indexable + visible in navigation.
 */
export async function GET(req: NextRequest) {
  const gate = await gateAgentRequest(req);
  if (!gate.ok) return gate.response;

  return agentJson(
    {
      ok: true,
      count: THEME_NAV_ENTRIES.length,
      themes: THEME_NAV_ENTRIES.map((t) => ({
        slug: t.slug,
        label: { fr: t.labelFr, en: t.labelEn },
        canonicalUrl: {
          fr: `/fr/classements/theme/${t.slug}`,
          en: `/en/classements/theme/${t.slug}`,
        },
      })),
    },
    { cacheControl: 'public, max-age=3600, s-maxage=86400' },
  );
}
