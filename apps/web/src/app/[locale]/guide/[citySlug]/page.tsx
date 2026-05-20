import { notFound } from 'next/navigation';

import { permanentRedirect } from '@/i18n/navigation';
import { isRoutingLocale } from '@/i18n/routing';

/**
 * `/guide/[citySlug]` → 301/308 `/destination/[citySlug]`.
 *
 * ADR-0015 fuses the guide route into the destination route to remove
 * the SEO cannibalisation between the two pages targeting the same
 * user intent ("où dormir à Paris"). The destination route now hosts:
 *   1. The hotels hub (its original responsibility), and
 *   2. The long-read editorial article inlined via the
 *      `<CityGuideArticle>` Server Component (migrated from the
 *      previous guide page render).
 *
 * The route stays declared in `routing.ts` so old external/inbound
 * links keep working — they just `permanentRedirect` to the canonical
 * destination URL.
 *
 * Tests (PR-8 step 6 — Playwright):
 *   - `e2e/destination-guide-merge.spec.ts` covers `/fr/guide/paris`
 *     → 308 → `/fr/destination/paris` and the EN variant.
 *
 * NOTE: The original guide page render (≈ 500 lines) is preserved in
 * git history (`git show HEAD~1 -- apps/web/src/app/[locale]/guide/[citySlug]/page.tsx`)
 * and slated for inlining in the destination page in the next PR
 * (ADR-0015 step 1).
 *
 * @see docs/adr/0015-merge-guide-destination.md
 */
export const dynamic = 'force-dynamic';

export default async function GuideRedirectPage({
  params,
}: {
  params: Promise<{ locale: string; citySlug: string }>;
}): Promise<never> {
  const { locale: raw, citySlug } = await params;
  if (!isRoutingLocale(raw)) notFound();
  // `permanentRedirect` from next-intl/navigation emits a 308 (Next.js
  // default). 308 = SEO-equivalent of 301 + preserves the HTTP method
  // (relevant if the user accidentally POSTs to the URL). Search
  // engines treat 308 like 301 since Q4 2017.
  permanentRedirect({
    href: {
      pathname: '/destination/[citySlug]',
      params: { citySlug },
    },
    locale: raw,
  });
}
