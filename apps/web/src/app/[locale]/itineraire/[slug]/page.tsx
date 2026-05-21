import { notFound } from 'next/navigation';

import { isRoutingLocale } from '@/i18n/routing';

/**
 * `/itineraire/[slug]` — bespoke itinerary detail.
 *
 * Anticipated by the `itinerary-editorial-pipeline` skill. Returns
 * `notFound()` until the `itineraries` table ships and the
 * pipeline-generated rows are seeded.
 *
 * Keeping the route declared (in `routing.ts`) so:
 *   - The agent-skills `get-itinerary` action can reference a stable
 *     URL pattern (`/{locale}/itineraire/{slug}`).
 *   - Future seeded content slots in without touching the routing tree.
 *
 * @see .cursor/skills/itinerary-editorial-pipeline/SKILL.md
 */
export const dynamic = 'force-dynamic';

export default async function ItineraireDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<never> {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) notFound();
  // Until Sprint 2 PR 2 wires the page reader (the `itineraries` table
  // and its server queries are in place — migration 0045+0046 + PR #85),
  // every detail URL is a hard 404. The hub at `/itineraires` surfaces
  // the live alternatives (`/inspiration`, `/classements`, `/destination`)
  // so users arriving from a stale external link still land on something
  // useful.
  notFound();
}
