import { headers } from 'next/headers';

import { isRoutingLocale, type Locale } from '@/i18n/routing';

export interface BarePathnameContext {
  readonly bare: string;
  readonly locale: Locale;
}

/** Strip `/<locale>` prefix from the proxy pathname header. */
export async function readBarePathname(): Promise<BarePathnameContext> {
  const headersList = await headers();
  const rawPath = headersList.get('x-pathname') ?? '/';
  const localeRaw = headersList.get('x-locale') ?? 'fr';
  const locale = isRoutingLocale(localeRaw) ? localeRaw : 'fr';

  const localePrefix = `/${locale}`;
  const bare =
    rawPath === localePrefix
      ? '/'
      : rawPath.startsWith(`${localePrefix}/`)
        ? rawPath.slice(localePrefix.length)
        : rawPath;

  return { bare, locale };
}

/** Stitch heritage skin applies to hotel fiches and room sub-pages. */
export function isHotelHeritageRoute(bare: string): boolean {
  return bare === '/hotel' || bare.startsWith('/hotel/');
}
