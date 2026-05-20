import { notFound } from 'next/navigation';

import { permanentRedirect } from '@/i18n/navigation';
import { isRoutingLocale } from '@/i18n/routing';

/**
 * `/guides` → 308 `/destination`.
 *
 * ADR-0015: the `guides` standalone index is absorbed by `/destination`
 * (catalog destination → embedded guide article). Keeping the route
 * declaration in `routing.ts` so existing inbound links continue to
 * land somewhere, but redirected to the canonical destination
 * directory.
 *
 * @see docs/adr/0015-merge-guide-destination.md
 */
export const dynamic = 'force-dynamic';

export default async function GuidesIndexRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<never> {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) notFound();
  permanentRedirect({ href: '/destination', locale: raw });
}
