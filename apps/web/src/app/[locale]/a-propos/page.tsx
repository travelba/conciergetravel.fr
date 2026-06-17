import { notFound } from 'next/navigation';

import { permanentRedirect } from '@/i18n/navigation';
import { isRoutingLocale } from '@/i18n/routing';

/**
 * `/a-propos` (`/en/about`) → 308 `/le-concierge`.
 *
 * The route is declared in `routing.ts` and targeted by the legacy
 * EN redirect map (`/en/a-propos` → `/en/about`) + the breadcrumb
 * (`a-propos` → `/le-concierge`), but never had a page — so it 404'd.
 * The institutional "about" content lives on the `/le-concierge`
 * EEAT hub; redirect there so the declared route resolves instead of
 * dead-ending.
 */
export const dynamic = 'force-dynamic';

export default async function AProposRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<never> {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) notFound();
  permanentRedirect({ href: '/le-concierge', locale: raw });
}
