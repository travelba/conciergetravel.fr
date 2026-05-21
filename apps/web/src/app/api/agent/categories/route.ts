import { type NextRequest } from 'next/server';

import { EDITORIAL_CATEGORIES } from '@/server/hotels/editorial-categories';
import { agentJson, gateAgentRequest } from '@/server/agent/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/categories — editorial categories surfaced on
 * `/categorie/[slug]` (5 Palace + 7 non-Palace per ADR-0016).
 *
 * Mirror of `list-categories` skill. Static enumeration: the result
 * is derived from `EDITORIAL_CATEGORIES` and doesn't hit the DB.
 * Designed for an LLM to introspect the editorial taxonomy before
 * deep-linking the user to a `/categorie/<slug>` page.
 *
 * Skill: api-integration, geo-llm-optimization §agent-skills.json.
 */
export async function GET(req: NextRequest) {
  const gate = await gateAgentRequest(req);
  if (!gate.ok) return gate.response;

  return agentJson(
    {
      ok: true,
      count: EDITORIAL_CATEGORIES.length,
      categories: EDITORIAL_CATEGORIES.map((c) => ({
        slug: c.slug,
        label: { fr: c.labelFr, en: c.labelEn },
        canonicalUrl: {
          fr: `/fr/categorie/${c.slug}`,
          en: `/en/categorie/${c.slug}`,
        },
      })),
    },
    { cacheControl: 'public, max-age=3600, s-maxage=86400' },
  );
}
